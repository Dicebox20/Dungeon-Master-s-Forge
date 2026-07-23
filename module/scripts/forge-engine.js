/*
 * Dungeon Master's Forge Module Engine
 * Foundry VTT v14 / DND5e v5.3.3
 *
 * Expects Foundry globals: game, ui, Folder, Item, Actor, CONFIG, CONST, foundry, Roll, ChatMessage, canvas.
 */

import { MODULE_ID, readForgeFlags } from "./package-identity.js";
import { armorBonusValue, inferArmorProfile, isImplementCategory, normalizeItemDocumentType, normalizeMagicalBonus, normalizeWeight, safeItemIcon } from "./equipment-normalization.js";
import { resolveActorByName, resolveDocumentFromMatch } from "./content-resolver.js";
import { sanitizeForgeSpec } from "./forge-spec-integrity.js";
import { normalizeAutomationContract } from "./automation-contract.js";

const CHOOSER_ACTIVITY_LISTS = Object.freeze(["attackActivities", "saveActivities", "utilityActivities", "activities"]);

function itemHasExplicitActivityChoices(spec = {}) {
  return CHOOSER_ACTIVITY_LISTS.some(listName => Array.isArray(spec?.[listName]) && spec[listName].length > 0)
    || Boolean(spec?.toggleLight)
    || Array.isArray(spec?.summonProfiles) && spec.summonProfiles.length > 0
    || Boolean(spec?.summonActivity);
}

function midiQolEnabled(config = {}) {
  return config?.enabled === true;
}

function activityNeedsTargetConfirmation(target = {}) {
  const affects = target?.affects ?? {};
  const template = target?.template ?? {};
  return Boolean(
    target?.prompt === true
    || template.type
    || template.size != null
    || (affects.type && affects.type !== "self")
  );
}

function applyMidiQolActivityDefaults(activity = {}, { enabled = false, target = {}, useCost = 0, forceTargetConfirmation = false, suppressTargetConfirmation = false } = {}) {
  if (!enabled) return activity;
  const midiProperties = {
    confirmTargets: !suppressTargetConfirmation && (forceTargetConfirmation || activityNeedsTargetConfirmation(target)) ? "always" : "default"
  };
  // Prevent automatic workflows from spending a limited item use before the GM
  // has selected the intended targets or summon profile.
  if (useCost) midiProperties.forceConsumeDialog = "always";
  return foundry.utils.mergeObject(foundry.utils.deepClone(activity), { midiProperties }, { inplace: false });
}

function normalizeActorAuraActivitySpec(activitySpec = {}) {
  const text = [activitySpec.activityName, activitySpec.name, activitySpec.description, activitySpec.chatFlavor]
    .filter(Boolean)
    .join(" ");
  if (!/\baura\b/i.test(text)) return activitySpec;
  const target = activitySpec.target && typeof activitySpec.target === "object" ? activitySpec.target : {};
  const affects = target.affects && typeof target.affects === "object" ? target.affects : {};
  return {
    ...activitySpec,
    range: { ...(activitySpec.range && typeof activitySpec.range === "object" ? activitySpec.range : {}), value: null, units: "self" },
    target: {
      ...target,
      affects: { ...affects, count: "1", type: "self", special: "Wielder's actor token" },
      prompt: false
    }
  };
}

function isFriendlySummon(spec = {}, activitySpec = {}) {
  if (typeof activitySpec.friendlySummon === "boolean") return activitySpec.friendlySummon;
  if (typeof spec.friendlySummon === "boolean") return spec.friendlySummon;
  const text = [
    activitySpec.activityName,
    activitySpec.chatFlavor,
    spec.description,
    spec.name
  ].filter(Boolean).join(" ");
  return /\b(?:friendly|allied|ally|companion|pal|obeys(?:\s+the\s+wielder)?)\b/i.test(text);
}

function suppressMidiTargetConfirmationForUtility(activitySpec = {}) {
  if (activitySpec.midiTargetConfirmation === false) return true;
  const target = activitySpec.target ?? {};
  const template = target.template ?? {};
  return /\bmisty\s+step\b/i.test(String(activitySpec.activityName ?? ""))
    && target.affects?.type === "space"
    && !template.type;
}

function forceExplicitChoiceOnAttack(activity = {}, { midiQol = false } = {}) {
  const patch = {
    otherActivityId: "none",
    otherActivityUuid: ""
  };
  if (midiQol) patch.midiProperties = { triggeredActivityId: "none" };
  return foundry.utils.mergeObject(foundry.utils.deepClone(activity), patch, { inplace: false });
}

function forceSummonUseConfirmation(activity = {}, { midiQol = false, profileCount = 0, useCost = 0 } = {}) {
  // Keep the native summon dialog ahead of Midi-QOL's automatic resource consumption.
  if (!midiQolEnabled({ enabled: midiQol }) || !activity?.midiProperties || !useCost) return activity;
  return foundry.utils.mergeObject(foundry.utils.deepClone(activity), {
    midiProperties: { forceConsumeDialog: "always" }
  }, { inplace: false });
}

function multiActivityStaffActivityLists(spec = {}) {
  const lists = {
    attack: Array.isArray(spec.attackActivities) ? [...spec.attackActivities] : [],
    save: Array.isArray(spec.saveActivities) ? [...spec.saveActivities] : [],
    utility: Array.isArray(spec.utilityActivities) ? [...spec.utilityActivities] : []
  };
  for (const activity of spec.activities ?? []) {
    if (activity?.type === "attack" || activity?.attack) lists.attack.push(activity);
    else if (activity?.type === "utility" || (!activity?.save && !activity?.damageOnSave && !activity?.damageParts?.length)) lists.utility.push(activity);
    else lists.save.push(activity);
  }
  return lists;
}

function stripEmbeddedDocumentIds(entries) {
  return (entries ?? []).map(entry => {
    const copy = foundry.utils.deepClone(entry);
    delete copy._id;
    delete copy.id;
    return copy;
  });
}

function normalizeSrdActorLookupName(name = "") {
  return String(name)
    .trim()
    .replace(/^(?:one|a|an|the)\s+/i, "")
    .replace(/^(?:friendly|loyal|tame)\s+/i, "")
    .trim();
}

async function resolveSrdSummonActor(actorSpec = {}) {
  const requestedName = String(actorSpec.srdActorName ?? "").trim();
  if (!requestedName) return null;
  const lookupNames = [requestedName];
  const normalizedName = normalizeSrdActorLookupName(requestedName);
  if (normalizedName && normalizedName !== requestedName) lookupNames.push(normalizedName);
  for (const lookupName of lookupNames) {
    const resolution = await resolveActorByName(lookupName);
    const resolved = resolution.status === "compatible"
      ? await resolveDocumentFromMatch(resolution.match)
      : null;
    if (resolved) return resolved;
  }
  if (actorSpec.requireSrdActor) {
    throw new Error(`Free Forge can only summon exact DND5e SRD actors. No SRD actor named "${requestedName}" was found; use a supported SRD creature or author a custom summon manually.`);
  }
  return null;
}

function clonedSrdSummonActorData(sourceActor, actorSpec, folder, forgeFlags = {}) {
  const data = foundry.utils.deepClone(sourceActor.toObject());
  delete data._id;
  delete data.id;
  data.items = stripEmbeddedDocumentIds(data.items);
  data.effects = stripEmbeddedDocumentIds(data.effects);

  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const friendly = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
  const actorName = actorSpec.name || sourceActor.name;
  const actorImage = actorSpec.img || data.img;
  data.name = actorName;
  data.folder = folder.id;
  data.ownership = { default: owner };
  data.img = actorImage;
  data.prototypeToken = foundry.utils.mergeObject(data.prototypeToken ?? {}, {
    name: actorSpec.tokenName ?? actorName,
    actorLink: false,
    disposition: friendly,
    texture: { src: actorSpec.tokenImg ?? actorImage }
  }, { inplace: false });
  data.flags = foundry.utils.mergeObject(data.flags ?? {}, {
    [MODULE_ID]: {
      ...forgeFlags,
      sourceActorUuid: sourceActor.uuid ?? "",
      sourceActorName: sourceActor.name ?? "",
      engine: forgeFlags.engine ?? "unknown",
      createdAt: new Date().toISOString()
    }
  }, { inplace: false });
  return data;
}

async function runDungeonMastersForge(FORGE, ITEMS, { validateOnly = false, authorizeGeneratedAutomation = false } = {}) {
  const midiQolAutomation = FORGE.midiQolAutomation === true;
  // Item Macro is its own capability. Recipes that also need Midi-QOL declare
  // that combination in the negotiated automation route.
  const itemMacroAutomation = FORGE.itemMacroAutomation === true;

  function makeIdentifier(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "dm_forge-item";
  }

  function assertActivityId(id) {
    if (!/^[A-Za-z0-9]{16}$/.test(id)) {
      throw new Error(`Invalid DND5e activity id "${id}". Activity ids must be exactly 16 alphanumeric characters.`);
    }
    return id;
  }

  function assertDocumentId(id) {
    if (!/^[A-Za-z0-9]{16}$/.test(id)) {
      throw new Error(`Invalid embedded document id "${id}". Use exactly 16 alphanumeric characters.`);
    }
    return id;
  }

  function generatedDocumentId(seed = "ForgeEffect") {
    const provided = String(seed ?? "").replace(/[^A-Za-z0-9]/g, "");
    if (/^[A-Za-z0-9]{16}$/.test(provided)) return provided;
    if (foundry?.utils?.randomID) return assertDocumentId(foundry.utils.randomID(16));
    return assertDocumentId((provided || "ForgeEffect").padEnd(16, "0").slice(0, 16));
  }

  function damageData({ number = 1, denomination = 6, bonus = "", types = [], scaling: inputScaling = {} } = {}) {
    return {
      number,
      denomination,
      bonus,
      types,
      custom: { enabled: false, formula: "" },
      scaling: {
        mode: inputScaling.mode ?? "",
        number: inputScaling.number ?? 1,
        formula: inputScaling.formula ?? ""
      }
    };
  }

  function emptyDamageData() {
    return damageData({ number: null, denomination: null, bonus: "", types: [] });
  }

  function htmlDescription(title, body) {
    return `<h2>${title}</h2><p>${body}</p>`;
  }

  function modeValue(mode) {
    if (typeof mode === "number") return mode;
    return CONST.ACTIVE_EFFECT_MODES[mode] ?? CONST.ACTIVE_EFFECT_MODES.ADD;
  }

  function effectChangeData(change) {
    if (!change?.key) return null;
    if (change.value && typeof change.value === "object") return null;
    const value = String(change.value);
    const saveBonusPath = /^system\.bonuses\.abilities\.save(?:\.|$)/.test(change.key);
    if (saveBonusPath && /^(?:dis)?advantage$/i.test(value.trim())) return null;
    return {
      key: change.key,
      mode: modeValue(change.mode),
      value,
      priority: change.priority ?? 20
    };
  }

  async function ensureFolder(name, type, color) {
    const existing = Array.from(game.folders ?? []).find(folder =>
      folder.type === type && folder.name === name
    );
    if (existing) return existing;

    return Folder.create({
      name,
      type,
      sorting: "a",
      color
    });
  }

  async function deleteExistingWorldItem(name) {
    if (!FORGE.replaceExistingWorldDocuments) return;
    const matches = Array.from(game.items ?? []).filter(item => item.name === name);
    for (const item of matches) await item.delete();
  }

  async function deleteExistingWorldActor(name) {
    if (!FORGE.replaceExistingWorldDocuments) return;
    const matches = Array.from(game.actors ?? []).filter(actor => actor.name === name);
    for (const actor of matches) await actor.delete();
  }

  function basePhysicalSystem(spec) {
    return {
      description: {
        value: htmlDescription(spec.name, spec.description ?? "A generated item."),
        chat: ""
      },
      identifier: makeIdentifier(spec.name),
      source: { custom: "" },
      identified: true,
      unidentified: { name: "", description: "" },
      container: null,
      quantity: spec.quantity ?? 1,
      weight: { value: normalizeWeight(spec.weight), units: spec.weightUnits ?? "lb" },
      price: { value: spec.price ?? 0, denomination: spec.priceDenomination ?? "gp" },
      rarity: spec.rarity ?? "common",
      attunement: spec.attunement ?? "",
      attuned: false,
      equipped: false,
      properties: spec.properties ?? ["mgc"]
    };
  }

  function usesData(uses = {}) {
    return {
      spent: uses.spent ?? 0,
      max: String(uses.max ?? ""),
      recovery: uses.recovery ?? [],
      autoDestroy: Boolean(uses.autoDestroy ?? false)
    };
  }

  function activityConsumption(chargeCost = 1, scaling = {}) {
    const allowScaling = scaling?.allowed === true;
    return {
      scaling: {
        allowed: allowScaling,
        max: allowScaling ? String(scaling.max ?? "@item.uses.value") : ""
      },
      spellSlot: false,
      targets: [
        {
          type: "itemUses",
          target: "",
          value: String(chargeCost),
          scaling: allowScaling ? {
            mode: scaling.mode ?? "amount",
            formula: String(scaling.formula ?? "")
          } : {}
        }
      ]
    };
  }

  function useCostForActivity(chargeCost, uses = {}) {
    const explicit = Number(chargeCost);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const available = Number(uses?.max);
    return Number.isFinite(available) && available > 0 ? 1 : 0;
  }

  function durationData(duration = {}) {
    return {
      value: duration.value ?? null,
      units: duration.units ?? "inst",
      concentration: Boolean(duration.concentration ?? false),
      override: false
    };
  }

  function compactText(value) {
    return String(value ?? "").trim();
  }

  function rangeData(range = {}) {
    const explicitValue = range.value != null;
    const explicitUnits = compactText(range.units) && compactText(range.units).toLowerCase() !== "self";
    const explicitSpecial = Boolean(compactText(range.special));
    const hasExplicitRange = explicitValue || explicitUnits || explicitSpecial;
    return {
      value: range.value ?? null,
      units: range.units ?? "self",
      special: range.special ?? "",
      override: Boolean(hasExplicitRange || range.override === true)
    };
  }

  function targetData(target = {}) {
    const template = target?.template ?? {};
    const affects = target?.affects ?? {};
    const hasTemplate = Boolean(
      compactText(template.type)
      || template.size != null
      || template.width != null
      || template.height != null
    );
    const hasAffects = Boolean(
      compactText(affects.count)
      || compactText(affects.type)
      || compactText(affects.special)
      || affects.choice === true
    );
    return {
      template: {
        count: template.count ?? (template.type ? "1" : ""),
        contiguous: Boolean(template.contiguous ?? false),
        stationary: Boolean(template.stationary ?? false),
        type: template.type ?? "",
        size: template.size ?? "",
        width: template.width ?? "",
        height: template.height ?? "",
        units: template.units ?? "ft"
      },
      affects: {
        count: affects.count ?? "",
        type: affects.type ?? "",
        choice: Boolean(affects.choice ?? false),
        special: affects.special ?? ""
      },
      override: Boolean(hasTemplate || hasAffects || target?.override === true),
      prompt: Boolean(target?.prompt ?? false)
    };
  }

  function findAttackActivity(item, preferredName = "") {
    const attacks = Array.from(item.system.activities ?? []).filter(activity => activity.type === "attack");
    const preferred = compactText(preferredName).toLowerCase();
    return attacks.find(activity => compactText(activity.name).toLowerCase() === preferred)
      ?? attacks.find(activity => /^attack with\b/i.test(compactText(activity.name)))
      ?? attacks[0];
  }

  function removeRedundantBaseAttacks(created, primaryAttackId, updateData) {
    for (const activity of Array.from(created.system.activities ?? [])) {
      if (activity.type !== "attack" || activity.id === primaryAttackId) continue;
      updateData[`-=system.activities.${activity.id}`] = null;
    }
  }

  function baseAttackTarget(spec) {
    if (spec.attackTarget) return spec.attackTarget;
    if (!spec.conditionOnHit) return null;
    return {
      affects: { count: "1", type: "creature", special: "One creature" },
      prompt: false,
      override: true
    };
  }

  function suppressBaseAttackTargetConfirmation(spec) {
    return Boolean(spec.conditionOnHit && !spec.attackTarget);
  }

  async function createWorldItem(spec, data, folder) {
    await deleteExistingWorldItem(spec.name);
    const forgeFlags = readForgeFlags(data.flags);
    const itemData = {
      ...data,
      type: normalizeItemDocumentType(data.type, "equipment"),
      img: safeItemIcon(data.img)
    };
    return Item.create({
      ...itemData,
      folder: folder.id,
      flags: foundry.utils.mergeObject(itemData.flags ?? {}, {
        [MODULE_ID]: {
          ...forgeFlags,
          kind: spec.kind,
          engine: FORGE.engineVersion ?? "unknown",
          ...(spec.unresolvedMechanics?.length ? {
            unresolvedMechanics: foundry.utils.deepClone(spec.unresolvedMechanics)
          } : {}),
          ...(spec.automation ? { automation: foundry.utils.deepClone(spec.automation) } : {}),
          createdAt: new Date().toISOString()
        }
      }, { inplace: false })
    });
  }

  async function createWeaponExtraDamage(spec, folder) {
    const item = await createWorldItem(spec, {
      name: spec.name,
      type: "weapon",
      img: spec.img,
      system: foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: {
          value: spec.weaponType ?? "simpleM",
          baseItem: spec.baseItem ?? ""
        },
        damage: {
          base: damageData(spec.damage?.base ?? { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] }),
          versatile: damageData(spec.damage?.versatile ?? { number: null, denomination: null, bonus: "", types: [] })
        },
        magicalBonus: normalizeMagicalBonus(spec.magicalBonus),
        proficient: spec.proficient ?? null,
        range: {
          value: spec.range?.value ?? null,
          long: spec.range?.long ?? null,
          reach: spec.range?.reach ?? 5,
          units: spec.range?.units ?? "ft"
        },
        mastery: spec.mastery ?? "",
        ammunition: { type: "" },
        armor: { value: 0 },
        cover: null,
        crew: { max: null, value: [] },
        hp: null,
        speed: null
      }, { inplace: false }),
      effects: [],
      flags: activityMacroFlags((spec.utilityActivities ?? [])
        .filter(activity => activity.macroCommand)
        .map(activity => activity.activityId))
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const attack = findAttackActivity(created, spec.attackName ?? `Attack with ${spec.name}`);
    const updateData = {};
    if (!attack) {
      ui.notifications.warn(`${spec.name} was created, but no attack activity was found to patch.`);
    } else {
      const attackData = attack.toObject ? attack.toObject() : foundry.utils.deepClone(attack);
      foundry.utils.mergeObject(attackData, {
        name: spec.attackName ?? `Attack with ${spec.name}`,
        damage: {
          includeBase: true,
          critical: { bonus: "" },
          parts: (spec.extraDamageParts ?? []).map(damageData)
        },
        ...(baseAttackTarget(spec) ? { target: targetData(baseAttackTarget(spec)) } : {}),
        ...(suppressBaseAttackTargetConfirmation(spec) ? { midiProperties: { confirmTargets: "never" } } : {})
      }, { inplace: true });
      updateData[`system.activities.${attack.id}`] = itemHasExplicitActivityChoices(spec)
        ? forceExplicitChoiceOnAttack(attackData, { midiQol: midiQolAutomation })
        : attackData;
      removeRedundantBaseAttacks(created, attack.id, updateData);
    }

    for (const activitySpec of spec.attackActivities ?? []) {
      const activity = makeAttackActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    for (const activitySpec of spec.utilityActivities ?? []) {
      const activity = makeUtilityActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    for (const activitySpec of spec.saveActivities ?? []) {
      const activity = makeSaveActivity(created, {
        ...activitySpec,
        name: spec.name,
        img: activitySpec.activityImg ?? spec.img,
        requireAttunement: spec.attunement === "required"
      });
      updateData[`system.activities.${activity._id}`] = activity;
    }

    if (Object.keys(updateData).length) await created.update(updateData);
    return game.items.get(created.id) ?? created;
  }

  async function createPassiveEffectEquipment(spec, folder) {
    return createWorldItem(spec, {
      name: spec.name,
      type: "equipment",
      img: spec.img,
      system: foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: {
          value: spec.equipmentType ?? "wondrous",
          baseItem: spec.baseItem ?? ""
        },
        armor: {
          value: spec.armorValue ?? 0,
          magicalBonus: normalizeMagicalBonus(spec.magicalBonus),
          dex: null
        },
        proficient: null,
        strength: null,
        cover: null,
        crew: { max: null, value: [] },
        hp: null,
        speed: null
      }, { inplace: false }),
      effects: (spec.effects ?? [])
        .filter(effect => effect && typeof effect === "object")
        .map((effect, index) => ({
          _id: generatedDocumentId(effect.effectId ?? `${spec.name}Passive${index + 1}`),
          name: String(effect.name ?? spec.name).trim() || spec.name,
          img: effect.img ?? spec.img,
          transfer: true,
          disabled: false,
          duration: {},
          changes: (effect.changes ?? []).map(effectChangeData).filter(Boolean),
          flags: foundry.utils.mergeObject(effect.flags ?? {}, { dae: { transfer: true } }, { inplace: false })
        }))
    }, folder);
  }

  async function createWondrousPassive(spec, folder) {
    return createPassiveEffectEquipment({
      equipmentType: "wondrous",
      ...spec,
      effects: spec.effects ?? []
    }, folder);
  }

  async function createShieldArmorBonus(spec, folder) {
    const profile = inferArmorProfile(spec);
    return createPassiveEffectEquipment({
      ...spec,
      equipmentType: profile.equipmentType,
      baseItem: profile.baseItem,
      armorValue: profile.armorValue,
      armorDex: profile.armorDex,
      magicalBonus: armorBonusValue(spec, profile),
      weight: spec.weight ?? profile.weight,
      strength: spec.strength ?? profile.strength ?? null
    }, folder);
  }

  function makeSaveActivity(item, spec) {
    const SaveActivity = CONFIG.DND5E.activityTypes.save.documentClass;
    const activity = new SaveActivity({}, { parent: item }).toObject();
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(spec.activityId),
      type: "save",
      name: spec.activityName ?? `Use ${spec.name}`,
      img: spec.activityImg ?? spec.img,
      sort: spec.sort ?? 70000,
      activation: {
        type: spec.activationType ?? "action",
        value: null,
        condition: spec.activationCondition ?? "",
        override: false
      },
      consumption: activityConsumption(spec.chargeCost ?? 1, spec.chargeScaling),
      description: { chatFlavor: spec.chatFlavor ?? "" },
      duration: durationData(spec.duration),
      effects: [],
      range: rangeData(spec.range),
      target: targetData(spec.target),
      uses: { spent: 0, max: "", recovery: [] },
      damage: {
        onSave: spec.damageOnSave ?? "half",
        parts: (spec.damageParts ?? []).map(damageData)
      },
      save: {
        ability: [spec.save?.ability ?? "dex"],
        dc: {
          calculation: "",
          formula: String(spec.save?.dc ?? "")
        }
      },
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: Boolean(spec.requireAttunement ?? false),
        requireIdentification: false,
        requireMagic: true
      }
    }, { inplace: false });
    return applyMidiQolActivityDefaults(activityData, {
      enabled: midiQolAutomation,
      target: spec.target,
      useCost: spec.chargeCost ?? 1
    });
  }

  async function createChargedSaveDamage(spec, folder) {
    const itemType = normalizeItemDocumentType(spec.itemType, isImplementCategory(spec.itemType) ? "equipment" : "consumable");
    const equipmentType = spec.equipmentType ?? (isImplementCategory(spec.itemType) ? spec.itemType : "wondrous");
    const equipmentBaseItem = spec.baseItem ?? (isImplementCategory(spec.itemType) ? spec.itemType : "");
    const base = itemType === "equipment"
      ? foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: { value: equipmentType, baseItem: equipmentBaseItem },
        uses: usesData(spec.uses),
        armor: {
          value: spec.armorValue ?? 0,
          magicalBonus: normalizeMagicalBonus(spec.magicalBonus),
          dex: spec.armorDex ?? null
        },
        proficient: null,
        strength: spec.strength ?? null,
        activities: {}
      }, { inplace: false })
      : foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: { value: spec.consumableType ?? "potion", subtype: "" },
        uses: usesData(spec.uses),
        damage: { base: emptyDamageData(), replace: false },
        magicalBonus: "",
        activities: {}
      }, { inplace: false });

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: itemType,
      img: spec.img,
      system: base,
      effects: []
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const activity = makeSaveActivity(created, spec);
    await created.update({ [`system.activities.${activity._id}`]: activity });
    return game.items.get(created.id) ?? created;
  }

  async function createChargedHealing(spec, folder) {
    const item = await createWorldItem(spec, {
      name: spec.name,
      type: "consumable",
      img: spec.img,
      system: foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: { value: spec.consumableType ?? "potion", subtype: "" },
        uses: usesData(spec.uses),
        damage: { base: emptyDamageData(), replace: false },
        magicalBonus: "",
        activities: {}
      }, { inplace: false }),
      effects: []
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const HealActivity = CONFIG.DND5E.activityTypes.heal.documentClass;
    const activity = new HealActivity({}, { parent: created }).toObject();
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(spec.activityId),
      type: "heal",
      name: spec.activityName ?? `Use ${spec.name}`,
      img: spec.activityImg ?? spec.img,
      activation: { type: spec.activationType ?? "action", value: null, condition: "", override: false },
      consumption: activityConsumption(spec.chargeCost ?? 1, spec.chargeScaling),
      description: { chatFlavor: spec.chatFlavor ?? "" },
      duration: durationData(spec.duration),
      effects: [],
      range: rangeData(spec.range ?? { units: "self" }),
      target: targetData(spec.target ?? { affects: { count: "1", type: "self" }, prompt: false }),
      uses: { spent: 0, max: "", recovery: [] },
      healing: damageData(spec.healing ?? { number: 1, denomination: 4, bonus: "", types: ["healing"] }),
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: false,
        requireIdentification: false,
        requireMagic: false
      }
    }, { inplace: false });
    await created.update({ [`system.activities.${activityData._id}`]: activityData });
    return game.items.get(created.id) ?? created;
  }

  async function createMultiActivityStaff(spec, folder, actorFolder) {
    const actorsByProfileId = new Map();
    const createdActors = [];
    for (const profile of allSummonProfiles(spec)) {
      const actor = await createSummonProfileActor(spec, actorFolder, profile);
      actorsByProfileId.set(profile.profileId, actor);
      createdActors.push(actor);
    }

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: suiteItemType(spec),
      img: spec.img,
      system: suiteUsesWeaponBase(spec)
        ? weaponSystem({ properties: ["mgc", "ver"], ...spec })
        : foundry.utils.mergeObject(basePhysicalSystem({
          properties: ["mgc", "foc"],
          equipmentType: "wondrous",
          baseItem: "staff",
          ...spec
        }), {
          type: { value: spec.equipmentType ?? "wondrous", baseItem: spec.baseItem ?? "staff" },
          uses: usesData(spec.uses),
          armor: { value: 0, magicalBonus: "", dex: null },
          proficient: null,
          strength: null,
          activities: {},
          cover: null,
          crew: { max: null, value: [] },
          hp: null,
          speed: null
        }, { inplace: false }),
      effects: [],
      flags: actorsByProfileId.size ? {
        [MODULE_ID]: {
          summonActorUuids: Object.fromEntries(Array.from(actorsByProfileId.entries()).map(([id, actor]) => [id, actor.uuid]))
        }
      } : {}
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const updateData = {};
    patchWeaponBaseAttack(created, spec, updateData);
    const activityLists = multiActivityStaffActivityLists(spec);
    for (const activitySpec of activityLists.attack) {
      const activity = makeAttackActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    for (const activitySpec of activityLists.utility) {
      const activity = summonProfilesFromActivity(activitySpec).length
        ? summonActivityDocument(created, spec, activitySpec, actorsByProfileId)
        : makeSuiteUtilityActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    for (const activitySpec of activityLists.save) {
      const activity = makeSaveActivity(created, {
        ...activitySpec,
        name: spec.name,
        img: activitySpec.img ?? spec.img,
        requireAttunement: spec.attunement === "required"
      });
      updateData[`system.activities.${activity._id}`] = activity;
    }
    if ((spec.summonProfiles ?? []).length) {
      const activity = summonActivityDocument(created, spec, spec.summonActivity ?? spec, actorsByProfileId);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    await created.update(updateData);
    const resolved = game.items.get(created.id) ?? created;
    return createdActors.length ? { item: resolved, actors: createdActors } : resolved;
  }

  function enchantChange(change) {
    let value = change.value;
    if (change.key === "system.damage.parts") {
      const damage = value?.damage ?? value;
      if (damage && typeof damage === "object") {
        value = JSON.stringify(damageData(damage));
      } else if (typeof damage === "string") {
        const match = damage.match(/(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?\s+([a-z]+)/i);
        if (match) {
          const [, number, denomination, sign = "", bonus = "", type] = match;
          value = JSON.stringify(damageData({
            number: Number(number),
            denomination: Number(denomination),
            bonus: bonus ? `${sign}${bonus}` : "",
            types: [type.toLowerCase()]
          }));
        }
      }
    }
    return {
      key: change.key,
      type: "add",
      value: String(value),
      phase: change.phase ?? "initial",
      priority: change.priority ?? 20
    };
  }

  async function createNativeEnchant(spec, folder, actorFolder) {
    const actorsByProfileId = new Map();
    const createdActors = [];
    for (const profile of allSummonProfiles(spec)) {
      const actor = await createSummonProfileActor(spec, actorFolder, profile);
      actorsByProfileId.set(profile.profileId, actor);
      createdActors.push(actor);
    }

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: spec.itemType ?? "consumable",
      img: spec.img,
      system: foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: spec.itemType === "equipment"
          ? { value: spec.equipmentType ?? "wondrous", baseItem: spec.baseItem ?? "" }
          : { value: spec.consumableType ?? "potion", subtype: "" },
        uses: usesData(spec.uses),
        damage: { base: emptyDamageData(), replace: false },
        magicalBonus: "",
        activities: {}
      }, { inplace: false }),
      effects: [
        {
          _id: spec.effectId,
          name: spec.effectName ?? spec.name,
          type: "enchantment",
          img: spec.effectImg ?? spec.img,
          transfer: false,
          disabled: false,
          duration: spec.duration?.seconds ? { seconds: spec.duration.seconds } : {},
          system: { changes: (spec.enchantChanges ?? []).map(enchantChange) },
          flags: { [MODULE_ID]: { effect: "native-enchantment" } }
        }
      ],
      flags: actorsByProfileId.size ? {
        [MODULE_ID]: {
          summonActorUuids: Object.fromEntries(Array.from(actorsByProfileId.entries()).map(([id, actor]) => [id, actor.uuid]))
        }
      } : {}
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const EnchantActivity = CONFIG.DND5E.activityTypes.enchant.documentClass;
    const activity = new EnchantActivity({}, { parent: created }).toObject();
    const useCost = useCostForActivity(spec.chargeCost, spec.uses);
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(spec.activityId),
      type: "enchant",
      name: spec.activityName ?? `Apply ${spec.name}`,
      img: spec.activityImg ?? spec.img,
      activation: { type: spec.activationType ?? "action", value: null, condition: "", override: false },
      consumption: useCost ? activityConsumption(useCost, spec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: spec.chatFlavor ?? "" },
      duration: durationData(spec.duration),
      effects: [
        {
          _id: spec.effectId,
          level: { min: null, max: null },
          riders: { activity: [], effect: [], item: [] }
        }
      ],
      enchant: { self: Boolean(spec.enchantSelf ?? false) },
      range: rangeData(spec.range),
      restrictions: {
        allowMagical: Boolean(spec.restrictions?.allowMagical ?? false),
        categories: spec.restrictions?.categories ?? [],
        properties: spec.restrictions?.properties ?? [],
        type: spec.restrictions?.type ?? ""
      },
      target: targetData(spec.target),
      uses: { spent: 0, max: "", recovery: [] },
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: false,
        requireIdentification: false,
        requireMagic: false
      }
    }, { inplace: false });
    const updateData = { [`system.activities.${activityData._id}`]: activityData };
    if ((spec.summonProfiles ?? []).length) {
      const summon = summonActivityDocument(created, spec, spec.summonActivity ?? spec, actorsByProfileId);
      updateData[`system.activities.${summon._id}`] = summon;
    }
    await created.update(updateData);
    const resolved = game.items.get(created.id) ?? created;
    return createdActors.length ? { item: resolved, actors: createdActors } : resolved;
  }

  async function createSummonActor(spec, folder) {
    const actorSpec = spec.summonActor;
    if (!actorSpec?.name) throw new Error(`${spec.name} is missing summonActor.name`);
    await deleteExistingWorldActor(actorSpec.name);

    const sourceActor = await resolveSrdSummonActor(actorSpec);
    if (sourceActor) {
      const actor = await Actor.create(clonedSrdSummonActorData(sourceActor, actorSpec, folder, {
        template: "srd-summon-actor",
        engine: FORGE.engineVersion ?? "unknown"
      }));
      return game.actors.get(actor.id) ?? actor;
    }

    const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const friendly = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
    const actor = await Actor.create({
      name: actorSpec.name,
      type: "npc",
      img: actorSpec.img,
      folder: folder.id,
      ownership: { default: owner },
      prototypeToken: {
        name: actorSpec.tokenName ?? actorSpec.name,
        actorLink: false,
        disposition: friendly,
        texture: { src: actorSpec.tokenImg ?? actorSpec.img },
        width: 1,
        height: 1
      },
      system: {
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(ability => [
          ability, { value: actorSpec.abilities?.[ability] ?? 10 }
        ])),
        attributes: {
          ac: { flat: actorSpec.ac ?? 10, calc: "flat" },
          hp: {
            value: actorSpec.hp?.value ?? 1,
            max: actorSpec.hp?.max ?? 1,
            temp: 0,
            tempmax: 0,
            formula: actorSpec.hp?.formula ?? ""
          },
          movement: {
            walk: actorSpec.movement?.walk ?? 30,
            units: actorSpec.movement?.units ?? "ft"
          },
          senses: {
            ranges: {
              darkvision: actorSpec.darkvision ?? 0,
              blindsight: 0,
              tremorsense: 0,
              truesight: 0
            },
            units: "ft",
            special: actorSpec.senses ?? ""
          }
        },
        details: {
          type: { value: actorSpec.type ?? "beast", subtype: "", swarm: "", custom: "" },
          alignment: actorSpec.alignment ?? "Unaligned",
          cr: actorSpec.cr ?? 0
        },
        source: { custom: "" },
        traits: { size: actorSpec.size ?? "med" }
      },
      flags: {
        [MODULE_ID]: {
          template: "summon-actor",
          engine: FORGE.engineVersion ?? "unknown",
          createdAt: new Date().toISOString()
        }
      }
    });

    const created = game.actors.get(actor.id) ?? actor;
    const embeddedItems = (actorSpec.items ?? []).map(item => ({
      name: item.name,
      type: "weapon",
      img: item.img,
      system: {
        description: { value: item.description ?? "", chat: "" },
        identifier: makeIdentifier(item.name),
        source: { custom: "" },
        identified: true,
        type: { value: "natural", baseItem: "" },
        damage: {
          base: damageData(item.damage ?? { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] }),
          versatile: emptyDamageData()
        },
        magicalBonus: "",
        proficient: 1,
        properties: [],
        range: { value: null, long: null, reach: item.reach ?? 5, units: "ft" },
        mastery: "",
        ammunition: { type: "" },
        armor: { value: 0 },
        equipped: true
      }
    }));
    if (embeddedItems.length) await created.createEmbeddedDocuments("Item", embeddedItems);
    return game.actors.get(created.id) ?? created;
  }

  async function createNativeSummon(spec, itemFolder, actorFolder) {
    const summonActor = await createSummonActor(spec, actorFolder);
    const item = await createWorldItem(spec, {
      name: spec.name,
      type: "equipment",
      img: spec.img,
      system: foundry.utils.mergeObject(basePhysicalSystem(spec), {
        type: { value: spec.equipmentType ?? "wondrous", baseItem: spec.baseItem ?? "" },
        uses: usesData(spec.uses),
        armor: {
          value: spec.armorValue ?? 0,
          magicalBonus: normalizeMagicalBonus(spec.magicalBonus),
          dex: spec.armorDex ?? null
        },
        proficient: null,
        strength: spec.strength ?? null,
        activities: {},
        cover: null,
        crew: { max: null, value: [] },
        hp: null,
        speed: null
      }, { inplace: false }),
      effects: [],
      flags: {
        [MODULE_ID]: {
          summonActorUuid: summonActor.uuid
        }
      }
    }, itemFolder);

    const created = game.items.get(item.id) ?? item;
    const SummonActivity = CONFIG.DND5E.activityTypes.summon.documentClass;
    const activity = new SummonActivity({}, { parent: created }).toObject();
    const useCost = useCostForActivity(spec.chargeCost, spec.uses);
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(spec.activityId),
      type: "summon",
      name: spec.activityName ?? `Summon ${spec.profileName ?? summonActor.name}`,
      img: spec.activityImg ?? spec.summonActor?.img ?? summonActor.img ?? spec.img,
      activation: { type: spec.activationType ?? "action", value: null, condition: "", override: false },
      consumption: useCost ? activityConsumption(useCost, spec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: spec.chatFlavor ?? "" },
      duration: durationData(spec.duration),
      effects: [],
      range: rangeData(spec.range),
      target: targetData(spec.target ?? {
        affects: { count: "1", type: "space", special: "An unoccupied space within range" }
      }),
      uses: { spent: 0, max: "", recovery: [] },
      bonuses: { ac: "", hd: "", hp: "", attackDamage: "", saveDamage: "", healing: "" },
      creatureSizes: [summonActor.system?.traits?.size ?? spec.summonActor?.size ?? "med"],
      creatureTypes: [summonActor.system?.details?.type?.value ?? spec.summonActor?.type ?? "beast"],
      match: {
        ability: "",
        attacks: false,
        disposition: Boolean(spec.matchDisposition ?? false),
        proficiency: Boolean(spec.matchProficiency ?? false),
        saves: false
      },
      profiles: [
        {
          _id: assertActivityId(spec.profileId),
          count: String(spec.count ?? "1"),
          cr: "",
          level: { min: null, max: null },
          name: spec.profileName ?? summonActor.name,
          types: [summonActor.system?.details?.type?.value ?? spec.summonActor?.type ?? "beast"],
          uuid: summonActor.uuid
        }
      ],
      summon: { mode: "specific", prompt: true },
      tempHP: "",
      ...(midiQolAutomation && isFriendlySummon(spec) ? { friendlySummon: true } : {}),
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: true
      }
    }, { inplace: false });
    await created.update({ [`system.activities.${activityData._id}`]: activityData });
    return { item: game.items.get(created.id) ?? created, actor: summonActor };
  }

  function activityConsumptionNone() {
    return {
      scaling: { allowed: false, max: "" },
      spellSlot: false,
      targets: []
    };
  }

  function activityMacroFlags(activityIds = []) {
    if (!itemMacroAutomation || !midiQolAutomation) return {};
    const entries = Array.from(new Set(activityIds.filter(Boolean))).map(activityId =>
      `[postActiveEffects]ActivityMacro-${assertActivityId(activityId)}`
    );
    return entries.length ? { "midi-qol": { onUseMacroName: entries.join(",") } } : {};
  }

  function guardedUtilityMacroCommand(activitySpec) {
    const activityId = assertActivityId(activitySpec.activityId);
    return `
const dmfExpectedActivityId = ${JSON.stringify(activityId)};
const dmfMacroScope = typeof scope !== "undefined" ? scope : {};
const dmfWorkflow = typeof workflow !== "undefined" ? workflow : dmfMacroScope.workflow ?? null;
const dmfRolledActivityId = dmfMacroScope.rolledActivity?.id ?? dmfWorkflow?.activity?.id ?? null;
if (dmfRolledActivityId !== dmfExpectedActivityId) return;

${activitySpec.macroCommand}
`.trim();
  }

  function weaponSystem(spec) {
    const baseWeapons = {
      dagger: { weaponType: "simpleM", damage: { base: { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] } }, range: { value: 20, long: 60, reach: 5, units: "ft" } },
      rapier: { weaponType: "martialM", damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } }, range: { value: null, long: null, reach: 5, units: "ft" } },
      glaive: { weaponType: "martialM", damage: { base: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } }, range: { value: null, long: null, reach: 10, units: "ft" } },
      trident: { weaponType: "martialM", damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] }, versatile: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } }, range: { value: 20, long: 60, reach: 5, units: "ft" } },
      "hand crossbow": { weaponType: "martialR", damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] } }, range: { value: 30, long: 120, reach: 5, units: "ft" } },
      longbow: { weaponType: "martialR", damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } }, range: { value: 150, long: 600, reach: 5, units: "ft" } },
      quarterstaff: { weaponType: "simpleM", damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] }, versatile: { number: 1, denomination: 8, bonus: "@mod", types: ["bludgeoning"] } }, range: { value: null, long: null, reach: 5, units: "ft" } }
    };
    const baseProfile = baseWeapons[String(spec.baseItem ?? "").toLowerCase()] ?? null;
    const normalizedBase = spec.damage?.base ?? baseProfile?.damage?.base ?? { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] };
    const normalizedVersatile = spec.damage?.versatile
      ?? baseProfile?.damage?.versatile
      ?? { number: null, denomination: null, bonus: "", types: [] };
    const baseTypes = Array.isArray(normalizedBase?.types) && normalizedBase.types.length
      ? normalizedBase.types
      : (baseProfile?.damage?.base?.types ?? ["piercing"]);
    const versatileTypes = Array.isArray(normalizedVersatile?.types) && normalizedVersatile.types.length
      ? normalizedVersatile.types
      : (baseProfile?.damage?.versatile?.types ?? []);
    const system = foundry.utils.mergeObject(basePhysicalSystem(spec), {
      type: {
        value: spec.weaponType ?? baseProfile?.weaponType ?? "simpleM",
        baseItem: spec.baseItem ?? ""
      },
      damage: {
        base: damageData({ ...normalizedBase, types: baseTypes }),
        versatile: damageData({ ...normalizedVersatile, types: versatileTypes })
      },
      magicalBonus: normalizeMagicalBonus(spec.magicalBonus),
      proficient: spec.proficient ?? null,
      range: {
        value: spec.range?.value ?? baseProfile?.range?.value ?? null,
        long: spec.range?.long ?? baseProfile?.range?.long ?? null,
        reach: spec.range?.reach ?? baseProfile?.range?.reach ?? 5,
        units: spec.range?.units ?? "ft"
      },
      mastery: spec.mastery ?? "",
      ammunition: { type: "" },
      armor: { value: 0 },
      cover: null,
      crew: { max: null, value: [] },
      hp: null,
      speed: null
    }, { inplace: false });

    if (spec.uses) system.uses = usesData(spec.uses);
    return system;
  }

  function equipmentSystem(spec) {
    const armorLike = spec.kind === "shieldArmorBonus"
      || Number(spec.armorValue ?? 0) > 0
      || /\b(?:shield|armor|plate|mail|breastplate|half plate|scale mail|hide|studded|leather|padded)\b/i.test([spec.name, spec.description, spec.baseItem, spec.equipmentType].filter(Boolean).join(" "));
    const armorProfile = armorLike ? inferArmorProfile(spec) : null;
    return foundry.utils.mergeObject(basePhysicalSystem(spec), {
      type: {
        value: armorProfile?.equipmentType ?? spec.equipmentType ?? "wondrous",
        baseItem: armorProfile?.baseItem ?? spec.baseItem ?? ""
      },
      uses: usesData(spec.uses),
      armor: {
        value: armorProfile?.armorValue ?? spec.armorValue ?? 0,
        magicalBonus: armorLike ? armorBonusValue(spec, armorProfile) : normalizeMagicalBonus(spec.magicalBonus),
        dex: armorProfile?.armorDex ?? spec.armorDex ?? null
      },
      proficient: null,
      strength: armorProfile?.strength ?? spec.strength ?? null,
      activities: {},
      cover: null,
      crew: { max: null, value: [] },
      hp: null,
      speed: null
    }, { inplace: false });
  }

  function consumableSystem(spec) {
    return foundry.utils.mergeObject(basePhysicalSystem(spec), {
      type: { value: spec.consumableType ?? "trinket", subtype: "" },
      uses: usesData(spec.uses),
      damage: { base: emptyDamageData(), replace: false },
      magicalBonus: "",
      activities: {}
    }, { inplace: false });
  }

  function suiteUsesWeaponBase(spec) {
    return Boolean(spec?.weaponType && spec?.baseItem);
  }

  function suiteShouldUseConsumableBase(spec) {
    if (spec?.itemType === "consumable" || compactText(spec?.consumableType)) return true;
    const text = compactText([
      spec?.name,
      spec?.description,
      spec?.baseItem,
      spec?.itemType,
      spec?.equipmentType
    ].filter(Boolean).join(" "));
    return Boolean(spec?.uses?.autoDestroy) && /\b(?:consumable|grenade|bomb|flask|vial|alchemist(?:'s)? fire|acid flask|holy water)\b/i.test(text);
  }

  function suiteItemType(spec) {
    if (suiteShouldUseConsumableBase(spec)) return "consumable";
    return suiteUsesWeaponBase(spec) ? "weapon" : "equipment";
  }

  function suiteItemSystem(spec) {
    if (suiteItemType(spec) === "consumable") return consumableSystem(spec);
    return suiteUsesWeaponBase(spec) ? weaponSystem(spec) : equipmentSystem(spec);
  }

  function transferEffectFromSpec(spec, effect) {
    return {
      _id: generatedDocumentId(effect.effectId ?? `${spec.name}Fx`),
      name: String(effect.name ?? spec.name).trim() || spec.name,
      img: effect.img ?? spec.img,
      transfer: effect.transfer ?? true,
      disabled: false,
      duration: effect.duration ?? {},
      changes: (effect.changes ?? []).map(effectChangeData).filter(Boolean),
      flags: foundry.utils.mergeObject(effect.flags ?? {}, { dae: { transfer: effect.transfer ?? true } }, { inplace: false })
    };
  }

  function passiveEffectDocuments(spec) {
    const seen = new Set();
    return [...(spec.effects ?? []), ...(spec.passiveEffects ?? [])]
      .filter(effect => effect && typeof effect === "object")
      .filter(effect => {
        const key = String(effect.effectId ?? effect.id ?? "")
          || `${String(effect.name ?? "")}|${JSON.stringify(effect.changes ?? [])}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(effect => transferEffectFromSpec(spec, effect));
  }

  function suiteEffectDocuments(spec) {
    const effects = passiveEffectDocuments(spec);
    for (const activitySpec of spec.utilityActivities ?? []) {
      if (!Array.isArray(activitySpec?.enchantChanges) || !activitySpec.enchantChanges.length || !activitySpec.effectId) continue;
      effects.push({
        _id: assertDocumentId(activitySpec.effectId),
        name: String(activitySpec.effectName ?? activitySpec.activityName ?? spec.name).trim() || spec.name,
        type: "enchantment",
        img: activitySpec.effectImg ?? activitySpec.activityImg ?? spec.img,
        transfer: false,
        disabled: false,
        duration: activitySpec.duration?.seconds ? { seconds: activitySpec.duration.seconds } : {},
        system: { changes: activitySpec.enchantChanges.map(enchantChange) },
        flags: { [MODULE_ID]: { effect: "suite-enchantment" } }
      });
    }
    return effects;
  }

  function makeUtilityActivity(item, spec, activitySpec) {
    const UtilityActivity = CONFIG.DND5E.activityTypes.utility.documentClass;
    const activity = new UtilityActivity({}, { parent: item }).toObject();
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(activitySpec.activityId),
      type: "utility",
      name: activitySpec.activityName ?? `Use ${spec.name}`,
      img: activitySpec.activityImg ?? spec.img,
      sort: activitySpec.sort ?? 100000,
      activation: {
        type: activitySpec.activationType ?? "action",
        value: null,
        condition: activitySpec.activationCondition ?? "",
        override: false
      },
      consumption: activitySpec.chargeCost ? activityConsumption(activitySpec.chargeCost, activitySpec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: activitySpec.chatFlavor ?? "" },
      duration: durationData(activitySpec.duration),
      effects: [],
      range: rangeData(activitySpec.range),
      target: targetData(activitySpec.target),
      uses: { spent: 0, max: "", recovery: [] },
      roll: { prompt: false, visible: false, name: "", formula: "" },
      ...(activitySpec.macroCommand ? {
        macroData: {
          name: activitySpec.macroName ?? activitySpec.activityName ?? `Use ${spec.name}`,
          command: guardedUtilityMacroCommand(activitySpec)
        }
      } : {}),
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: activitySpec.requireMagic ?? true
      }
    }, { inplace: false });
    return applyMidiQolActivityDefaults(activityData, {
      enabled: midiQolAutomation,
      target: activitySpec.target,
      useCost: activitySpec.chargeCost ?? 0,
      suppressTargetConfirmation: suppressMidiTargetConfirmationForUtility(activitySpec)
    });
  }

  function makeHealingActivity(item, spec, activitySpec) {
    const HealActivity = CONFIG.DND5E.activityTypes.heal.documentClass;
    const activity = new HealActivity({}, { parent: item }).toObject();
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(activitySpec.activityId),
      type: "heal",
      name: activitySpec.activityName ?? `Use ${spec.name}`,
      img: activitySpec.activityImg ?? spec.img,
      sort: activitySpec.sort ?? 90000,
      activation: {
        type: activitySpec.activationType ?? "action",
        value: null,
        condition: activitySpec.activationCondition ?? "",
        override: false
      },
      consumption: activitySpec.chargeCost ? activityConsumption(activitySpec.chargeCost, activitySpec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: activitySpec.chatFlavor ?? "" },
      duration: durationData(activitySpec.duration),
      effects: [],
      range: rangeData(activitySpec.range),
      target: targetData(activitySpec.target),
      uses: { spent: 0, max: "", recovery: [] },
      healing: damageData(activitySpec.healing ?? { number: 1, denomination: 4, bonus: "", types: ["healing"] }),
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: activitySpec.requireMagic ?? true
      }
    }, { inplace: false });
    return applyMidiQolActivityDefaults(activityData, {
      enabled: midiQolAutomation,
      target: activitySpec.target,
      useCost: activitySpec.chargeCost ?? 0
    });
  }

  function makeEnchantActivity(item, spec, activitySpec) {
    const EnchantActivity = CONFIG.DND5E.activityTypes.enchant.documentClass;
    const activity = new EnchantActivity({}, { parent: item }).toObject();
    const activityData = foundry.utils.mergeObject(activity, {
      _id: assertActivityId(activitySpec.activityId),
      type: "enchant",
      name: activitySpec.activityName ?? `Apply ${spec.name}`,
      img: activitySpec.activityImg ?? spec.img,
      activation: { type: activitySpec.activationType ?? "action", value: null, condition: "", override: false },
      consumption: activitySpec.chargeCost ? activityConsumption(activitySpec.chargeCost, activitySpec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: activitySpec.chatFlavor ?? "" },
      duration: durationData(activitySpec.duration),
      effects: activitySpec.effectId ? [{
        _id: assertDocumentId(activitySpec.effectId),
        level: { min: null, max: null },
        riders: { activity: [], effect: [], item: [] }
      }] : [],
      enchant: { self: Boolean(activitySpec.enchantSelf ?? false) },
      range: rangeData(activitySpec.range),
      restrictions: {
        allowMagical: Boolean(activitySpec.restrictions?.allowMagical ?? false),
        categories: activitySpec.restrictions?.categories ?? [],
        properties: activitySpec.restrictions?.properties ?? [],
        type: activitySpec.restrictions?.type ?? ""
      },
      target: targetData(activitySpec.target),
      uses: { spent: 0, max: "", recovery: [] },
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: activitySpec.requireMagic ?? true
      }
    }, { inplace: false });
    return applyMidiQolActivityDefaults(activityData, {
      enabled: midiQolAutomation,
      target: activitySpec.target,
      useCost: activitySpec.chargeCost ?? 0
    });
  }

  function makeSuiteUtilityActivity(item, spec, activitySpec) {
    const normalizedActivitySpec = normalizeActorAuraActivitySpec(activitySpec);
    if (normalizedActivitySpec?.healing) return makeHealingActivity(item, spec, normalizedActivitySpec);
    if (Array.isArray(normalizedActivitySpec?.enchantChanges) && normalizedActivitySpec.enchantChanges.length) {
      return makeEnchantActivity(item, spec, normalizedActivitySpec);
    }
    return makeUtilityActivity(item, spec, normalizedActivitySpec);
  }

  function makeAttackActivity(item, spec, activitySpec) {
    const AttackActivity = CONFIG.DND5E.activityTypes.attack.documentClass;
    const activity = new AttackActivity({}, { parent: item }).toObject();
    const activityData = applyMidiQolActivityDefaults(foundry.utils.mergeObject(activity, {
      _id: assertActivityId(activitySpec.activityId),
      type: "attack",
      name: activitySpec.activityName ?? `Attack with ${spec.name}`,
      img: activitySpec.activityImg ?? spec.img,
      sort: activitySpec.sort ?? 50000,
      activation: {
        type: activitySpec.activationType ?? "action",
        value: null,
        condition: activitySpec.activationCondition ?? "",
        override: false
      },
      consumption: activitySpec.chargeCost ? activityConsumption(activitySpec.chargeCost, activitySpec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: activitySpec.chatFlavor ?? "" },
      duration: durationData(activitySpec.duration),
      effects: [],
      range: rangeData(activitySpec.range),
      target: targetData(activitySpec.target),
      uses: { spent: 0, max: "", recovery: [] },
      attack: {
        ability: activitySpec.ability ?? "spellcasting",
        bonus: activitySpec.attackBonus ?? "",
        critical: { threshold: activitySpec.criticalThreshold ?? 20 },
        flat: Boolean(activitySpec.flatAttack ?? false),
        type: {
          value: activitySpec.attackType ?? "ranged",
          classification: activitySpec.attackClassification ?? "spell"
        }
      },
      damage: {
        critical: { bonus: activitySpec.criticalBonus ?? "" },
        includeBase: Boolean(activitySpec.includeBaseDamage ?? false),
        parts: (activitySpec.damageParts ?? []).map(damageData)
      },
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: activitySpec.requireMagic ?? true
      }
    }, { inplace: false }), {
      enabled: midiQolAutomation,
      target: activitySpec.target,
      useCost: activitySpec.chargeCost ?? 0,
      forceTargetConfirmation: true
    });
    return itemHasExplicitActivityChoices({
      attackActivities: [activitySpec],
      saveActivities: spec.saveActivities,
      utilityActivities: spec.utilityActivities,
      activities: spec.activities,
      toggleLight: spec.toggleLight,
      summonProfiles: spec.summonProfiles,
      summonActivity: spec.summonActivity
    })
      ? forceExplicitChoiceOnAttack(activityData, { midiQol: midiQolAutomation })
      : activityData;
  }

  function patchWeaponBaseAttack(created, spec, updateData) {
    if (!suiteUsesWeaponBase(spec)) return;
    const attack = findAttackActivity(created, spec.attackName ?? `Attack with ${spec.name}`);
    if (!attack) {
      ui.notifications.warn(`${spec.name} was created, but no weapon attack activity was found to patch.`);
      return;
    }
    const attackData = buildWeaponBaseAttackData(attack, spec);
    updateData[`system.activities.${attack.id}`] = itemHasExplicitActivityChoices(spec)
      ? forceExplicitChoiceOnAttack(attackData, { midiQol: midiQolAutomation })
      : attackData;
    removeRedundantBaseAttacks(created, attack.id, updateData);

    Object.assign(updateData, conditionOnHitHookUpdate(created, spec, attack.id));
  }

  function buildWeaponBaseAttackData(attack, spec) {
    const attackData = attack.toObject ? attack.toObject() : foundry.utils.deepClone(attack);
    const baseTarget = baseAttackTarget(spec);
    foundry.utils.mergeObject(attackData, {
      name: spec.attackName ?? `Attack with ${spec.name}`,
      damage: {
        includeBase: true,
        critical: { bonus: "" },
        parts: (spec.extraDamageParts ?? []).map(damageData)
      },
      target: targetData(baseTarget),
      ...(spec.conditionOnHit ? {
        macroData: {
          name: spec.conditionOnHit.macroName ?? "Condition On Hit",
          command: conditionMacroCommand(spec)
        }
      } : {})
    }, { inplace: true });
    const patched = applyMidiQolActivityDefaults(attackData, {
      enabled: midiQolAutomation,
      target: baseTarget ?? {},
      suppressTargetConfirmation: suppressBaseAttackTargetConfirmation(spec)
    });
    if (suppressBaseAttackTargetConfirmation(spec)) {
      patched.midiProperties = { ...(patched.midiProperties ?? {}), confirmTargets: "never" };
    }
    return patched;
  }

  function conditionOnHitHookUpdate(created, spec, activityId) {
    if (!spec.conditionOnHit || !itemMacroAutomation || !midiQolAutomation) return {};
    const existingHook = typeof created.getFlag === "function"
      ? created.getFlag("midi-qol", "onUseMacroName")
      : "";
    const hooks = String(existingHook ?? "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
    const conditionHook = `[postActiveEffects]ActivityMacro-${activityId}`;
    if (!hooks.includes(conditionHook)) hooks.push(conditionHook);
    return { "flags.midi-qol.onUseMacroName": hooks.join(",") };
  }

  async function createCasterUtilityEquipment(spec, folder, actorFolder) {
    const createdActors = [];
    const actorsByProfileId = new Map();
    for (const profile of allSummonProfiles(spec)) {
      const actor = await createSummonProfileActor(spec, actorFolder, profile);
      createdActors.push(actor);
      actorsByProfileId.set(profile.profileId, actor);
    }

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: suiteItemType(spec),
      img: spec.img,
      system: suiteItemSystem(spec),
      effects: suiteEffectDocuments(spec),
      flags: activityMacroFlags((spec.utilityActivities ?? [])
        .filter(activity => activity.macroCommand)
        .map(activity => activity.activityId))
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const updateData = {};
    patchWeaponBaseAttack(created, spec, updateData);
    for (const activitySpec of spec.attackActivities ?? []) {
      const activity = makeAttackActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    for (const activitySpec of spec.utilityActivities ?? []) {
      const activity = summonProfilesFromActivity(activitySpec).length
        ? summonActivityDocument(created, spec, activitySpec, actorsByProfileId)
        : makeSuiteUtilityActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }
    for (const activitySpec of spec.saveActivities ?? []) {
      const activity = makeSaveActivity(created, {
        ...activitySpec,
        name: spec.name,
        img: activitySpec.activityImg ?? spec.img,
        requireAttunement: spec.attunement === "required"
      });
      updateData[`system.activities.${activity._id}`] = activity;
    }
    if ((spec.summonProfiles ?? []).length) {
      const activityData = summonActivityDocument(created, spec, spec.summonActivity ?? spec, actorsByProfileId);
      updateData[`system.activities.${activityData._id}`] = activityData;
    }
    if (Object.keys(updateData).length) await created.update(updateData);
    const refreshed = game.items.get(created.id) ?? created;
    return createdActors.length ? { item: refreshed, actors: createdActors } : refreshed;
  }

  async function createSummonProfileActor(parentSpec, folder, profile) {
    const actorSpec = profile.actor;
    if (!actorSpec?.name) throw new Error(`${parentSpec.name} summon profile ${profile.profileName ?? profile.profileId} is missing actor.name`);
    await deleteExistingWorldActor(actorSpec.name);

    const sourceActor = await resolveSrdSummonActor(actorSpec);
    if (sourceActor) {
      const actor = await Actor.create(clonedSrdSummonActorData(sourceActor, actorSpec, folder, {
        template: "srd-summon-actor",
        profileId: profile.profileId,
        profileName: profile.profileName ?? "",
        engine: FORGE.engineVersion ?? "unknown"
      }));
      return game.actors.get(actor.id) ?? actor;
    }

    const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const friendly = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
    const abilities = actorSpec.abilities ?? {};
    const movement = actorSpec.movement ?? {};
    const isFiend = actorSpec.type === "fiend";
    const actor = await Actor.create({
      name: actorSpec.name,
      type: "npc",
      img: actorSpec.img,
      folder: folder.id,
      ownership: { default: owner },
      prototypeToken: {
        name: actorSpec.tokenName ?? actorSpec.name,
        actorLink: false,
        disposition: friendly,
        texture: { src: actorSpec.tokenImg ?? actorSpec.img },
        width: actorSpec.tokenWidth ?? 1,
        height: actorSpec.tokenHeight ?? 1
      },
      system: {
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(ability => [
          ability, { value: abilities[ability] ?? 10 }
        ])),
        attributes: {
          ac: { flat: actorSpec.ac ?? 10, calc: "flat" },
          hp: {
            value: actorSpec.hp?.value ?? 1,
            max: actorSpec.hp?.max ?? 1,
            temp: 0,
            tempmax: 0,
            formula: actorSpec.hp?.formula ?? ""
          },
          movement: {
            walk: movement.walk ?? 0,
            climb: movement.climb ?? 0,
            fly: movement.fly ?? 0,
            swim: movement.swim ?? 0,
            burrow: movement.burrow ?? 0,
            units: movement.units ?? "ft"
          },
          senses: {
            ranges: {
              darkvision: actorSpec.darkvision ?? 0,
              blindsight: actorSpec.blindsight ?? 0,
              tremorsense: actorSpec.tremorsense ?? 0,
              truesight: actorSpec.truesight ?? 0
            },
            units: "ft",
            special: actorSpec.senses ?? ""
          }
        },
        details: {
          type: { value: actorSpec.type ?? "beast", subtype: actorSpec.subtype ?? "", swarm: "", custom: "" },
          alignment: actorSpec.alignment ?? "Neutral",
          cr: actorSpec.cr ?? 0
        },
        source: { custom: "" },
        traits: {
          size: actorSpec.size ?? "med",
          dr: actorSpec.traits?.dr ?? { value: isFiend ? ["fire"] : [], bypasses: [], custom: "" },
          di: actorSpec.traits?.di ?? { value: isFiend ? ["poison"] : [], bypasses: [], custom: "" },
          ci: actorSpec.traits?.ci ?? { value: isFiend ? ["poisoned"] : [], custom: "" },
          languages: actorSpec.traits?.languages ?? { value: [], custom: actorSpec.languages ?? (isFiend ? "Abyssal, Infernal; telepathy 60 ft." : "") }
        }
      },
      flags: {
        [MODULE_ID]: {
          template: "multi-profile-summon-actor",
          profileId: profile.profileId,
          profileName: profile.profileName ?? "",
          engine: FORGE.engineVersion ?? "unknown",
          createdAt: new Date().toISOString()
        }
      }
    });

    const created = game.actors.get(actor.id) ?? actor;
    const embeddedItems = (actorSpec.items ?? []).map(item => ({
      name: item.name,
      type: "weapon",
      img: item.img,
      system: {
        description: { value: item.description ?? "", chat: "" },
        identifier: makeIdentifier(item.name),
        source: { custom: "" },
        identified: true,
        type: { value: "natural", baseItem: "" },
        damage: {
          base: damageData(item.damage ?? { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] }),
          versatile: emptyDamageData()
        },
        magicalBonus: "",
        proficient: 1,
        properties: item.properties ?? [],
        range: {
          value: item.range?.value ?? null,
          long: item.range?.long ?? null,
          reach: item.range ? null : (item.reach ?? 5),
          units: item.range?.units ?? "ft"
        },
        mastery: "",
        ammunition: { type: "" },
        armor: { value: 0 },
        equipped: true
      }
    }));
    if (embeddedItems.length) await created.createEmbeddedDocuments("Item", embeddedItems);
    return game.actors.get(created.id) ?? created;
  }

  function summonProfilesFromActivity(activitySpec) {
    return Array.isArray(activitySpec?.summonProfiles)
      ? activitySpec.summonProfiles.filter(profile => profile && typeof profile === "object")
      : [];
  }

  function allSummonProfiles(spec) {
    const profiles = [];
    const seen = new Set();
    for (const profile of spec.summonProfiles ?? []) {
      if (!profile?.profileId || seen.has(profile.profileId)) continue;
      seen.add(profile.profileId);
      profiles.push(profile);
    }
    for (const activitySpec of spec.utilityActivities ?? []) {
      for (const profile of summonProfilesFromActivity(activitySpec)) {
        if (!profile?.profileId || seen.has(profile.profileId)) continue;
        seen.add(profile.profileId);
        profiles.push(profile);
      }
    }
    return profiles;
  }

  function summonActivityDocument(item, spec, activitySpec, actorsByProfileId) {
    const SummonActivity = CONFIG.DND5E.activityTypes.summon.documentClass;
    const baseActivity = new SummonActivity({}, { parent: item }).toObject();
    const useCost = useCostForActivity(activitySpec.chargeCost, spec.uses);
    const activityId = activitySpec.activityId
      ?? generatedDocumentId(`${spec.name} ${activitySpec.activityName ?? "Summon"}`);
    const summonProfiles = summonProfilesFromActivity(activitySpec).length
      ? summonProfilesFromActivity(activitySpec)
      : (spec.summonProfiles ?? []);
    const profiles = summonProfiles.map(profile => {
      const actor = actorsByProfileId.get(profile.profileId);
      const actorType = actor?.system?.details?.type?.value ?? profile.actor?.type ?? "beast";
      return {
        _id: assertActivityId(profile.profileId),
        count: String(profile.count ?? "1"),
        cr: "",
        level: { min: null, max: null },
        name: profile.profileName ?? profile.actor?.name ?? "Summon",
        types: [actorType],
        uuid: actor?.uuid ?? ""
      };
    });
    const creatureSizes = Array.from(new Set(summonProfiles.map(profile => actorsByProfileId.get(profile.profileId)?.system?.traits?.size ?? profile.actor?.size ?? "med")));
    const creatureTypes = Array.from(new Set(summonProfiles.map(profile => actorsByProfileId.get(profile.profileId)?.system?.details?.type?.value ?? profile.actor?.type ?? "beast")));
    const activity = applyMidiQolActivityDefaults(foundry.utils.mergeObject(baseActivity, {
      _id: assertActivityId(activityId),
      type: "summon",
      name: activitySpec.activityName ?? `Summon ${spec.name}`,
      img: activitySpec.activityImg ?? spec.img,
      activation: { type: activitySpec.activationType ?? "action", value: null, condition: activitySpec.activationCondition ?? "", override: false },
      consumption: useCost ? activityConsumption(useCost, activitySpec.chargeScaling) : activityConsumptionNone(),
      description: { chatFlavor: activitySpec.chatFlavor ?? "" },
      duration: durationData(activitySpec.duration),
      effects: [],
      range: rangeData(activitySpec.range),
      target: targetData(activitySpec.target ?? {
        affects: { count: "1", type: "space", special: "An unoccupied space within range" },
        prompt: true
      }),
      uses: { spent: 0, max: "", recovery: [] },
      bonuses: { ac: "", hd: "", hp: "", attackDamage: "", saveDamage: "", healing: "" },
      creatureSizes,
      creatureTypes,
      match: {
        ability: "",
        attacks: false,
        disposition: Boolean(spec.matchDisposition ?? false),
        proficiency: Boolean(spec.matchProficiency ?? false),
        saves: false
      },
      profiles,
      summon: { mode: "specific", prompt: profiles.length > 1 },
      tempHP: "",
      ...(midiQolAutomation && isFriendlySummon(spec, activitySpec) ? { friendlySummon: true } : {}),
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: true
      }
    }, { inplace: false }), {
      enabled: midiQolAutomation,
      target: activitySpec.target ?? { prompt: true },
      useCost
    });
    return forceSummonUseConfirmation(activity, { midiQol: midiQolAutomation, profileCount: profiles.length, useCost });
  }

  async function createNativeMultiProfileSummon(spec, itemFolder, actorFolder) {
    const actorsByProfileId = new Map();
    const createdActors = [];
    for (const profile of allSummonProfiles(spec)) {
      const actor = await createSummonProfileActor(spec, actorFolder, profile);
      actorsByProfileId.set(profile.profileId, actor);
      createdActors.push(actor);
    }

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: "equipment",
      img: spec.img,
      system: equipmentSystem(spec),
      effects: [],
      flags: {
        [MODULE_ID]: {
          summonActorUuids: Object.fromEntries(Array.from(actorsByProfileId.entries()).map(([id, actor]) => [id, actor.uuid]))
        }
      }
    }, itemFolder);

    const created = game.items.get(item.id) ?? item;
    const activityData = summonActivityDocument(created, spec, spec, actorsByProfileId);
    await created.update({ [`system.activities.${activityData._id}`]: activityData });
    return { item: game.items.get(created.id) ?? created, actors: createdActors };
  }

  async function createLegendaryEquipmentSuite(spec, itemFolder, actorFolder) {
    const actorsByProfileId = new Map();
    const createdActors = [];
    for (const profile of allSummonProfiles(spec)) {
      const actor = await createSummonProfileActor(spec, actorFolder, profile);
      actorsByProfileId.set(profile.profileId, actor);
      createdActors.push(actor);
    }

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: suiteItemType(spec),
      img: spec.img,
      system: suiteItemSystem(spec),
      effects: suiteEffectDocuments(spec),
      flags: foundry.utils.mergeObject(
        actorsByProfileId.size ? {
          [MODULE_ID]: {
            summonActorUuids: Object.fromEntries(Array.from(actorsByProfileId.entries()).map(([id, actor]) => [id, actor.uuid]))
          }
        } : {},
        activityMacroFlags((spec.utilityActivities ?? [])
          .filter(activity => activity.macroCommand)
          .map(activity => activity.activityId)),
        { inplace: false }
      )
    }, itemFolder);

    const created = game.items.get(item.id) ?? item;
    const updateData = {};
    patchWeaponBaseAttack(created, spec, updateData);

    for (const activitySpec of spec.attackActivities ?? []) {
      const activity = makeAttackActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }

    for (const activitySpec of spec.utilityActivities ?? []) {
      const activity = summonProfilesFromActivity(activitySpec).length
        ? summonActivityDocument(created, spec, activitySpec, actorsByProfileId)
        : makeSuiteUtilityActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }

    for (const activitySpec of spec.saveActivities ?? []) {
      const activity = makeSaveActivity(created, {
        ...activitySpec,
        name: spec.name,
        img: activitySpec.activityImg ?? spec.img,
        requireAttunement: spec.attunement === "required"
      });
      updateData[`system.activities.${activity._id}`] = activity;
    }

    if ((spec.summonProfiles ?? []).length) {
      const activityData = summonActivityDocument(created, spec, spec.summonActivity ?? spec, actorsByProfileId);
      updateData[`system.activities.${activityData._id}`] = activityData;
    }

    if (Object.keys(updateData).length) await created.update(updateData);
    return { item: game.items.get(created.id) ?? created, actors: createdActors };
  }

  function toggleLightMacroCommand(itemName, toggle) {
    const flagKey = toggle.flagKey ?? `${makeIdentifier(itemName)}Light`;
    const warning = toggle.selectedTokenWarning ?? `Use ${itemName} from an actor with an active token.`;
    const onChat = toggle.onChat ?? `${itemName} begins shedding light.`;
    const offChat = toggle.offChat ?? `${itemName}'s light fades.`;
    const color = toggle.color ?? "#ff7a18";
    const alpha = toggle.alpha ?? 0.35;
    const animation = toggle.animation ?? {};

    return `
const FLAG_SCOPE = "world";
const FLAG_KEY = ${JSON.stringify(flagKey)};
const ITEM_NAME = ${JSON.stringify(itemName)};
const WARNING = ${JSON.stringify(warning)};
const ON_CHAT = ${JSON.stringify(onChat)};
const OFF_CHAT = ${JSON.stringify(offChat)};

const sourceActor =
  (typeof actor !== "undefined" && actor) ||
  (typeof item !== "undefined" && (item?.actor ?? item?.parent)) ||
  (typeof workflow !== "undefined" && workflow?.actor) ||
  null;
const sourceToken =
  (typeof token !== "undefined" && token) ||
  (typeof workflow !== "undefined" && workflow?.token) ||
  sourceActor?.getActiveTokens?.(true)?.[0] ||
  sourceActor?.getActiveTokens?.()?.[0] ||
  null;

if (!sourceToken) {
  ui.notifications.warn(WARNING);
  return;
}

const tokenDocument = sourceToken.document;
const previousLight = await tokenDocument.getFlag(FLAG_SCOPE, FLAG_KEY);
const currentLight = tokenDocument.light ?? {};

const isProbablyOn =
  (currentLight.bright === ${Number(toggle.bright ?? 20)}) &&
  (currentLight.dim === ${Number(toggle.dim ?? 40)}) &&
  (currentLight.color === ${JSON.stringify(color)});

if (previousLight) {
  await tokenDocument.update({
    "light.dim": previousLight.dim ?? 0,
    "light.bright": previousLight.bright ?? 0,
    "light.color": previousLight.color ?? null,
    "light.alpha": previousLight.alpha ?? 0.5,
    "light.animation.type": previousLight.animationType ?? null,
    "light.animation.speed": previousLight.animationSpeed ?? 5,
    "light.animation.intensity": previousLight.animationIntensity ?? 5
  });

  await tokenDocument.unsetFlag(FLAG_SCOPE, FLAG_KEY);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: sourceToken }),
    content: "<p><strong>" + ITEM_NAME + ":</strong> " + OFF_CHAT + "</p>"
  });

  ui.notifications.info(ITEM_NAME + " light toggled off.");
  return;
}

if (isProbablyOn) {
  await tokenDocument.update({
    "light.dim": 0,
    "light.bright": 0,
    "light.color": null,
    "light.alpha": 0.5,
    "light.animation.type": null,
    "light.animation.speed": 5,
    "light.animation.intensity": 5
  });

  await tokenDocument.unsetFlag(FLAG_SCOPE, FLAG_KEY);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: sourceToken }),
    content: "<p><strong>" + ITEM_NAME + ":</strong> " + OFF_CHAT + "</p>"
  });

  ui.notifications.info(ITEM_NAME + " light toggled off.");
  return;
}

await tokenDocument.setFlag(FLAG_SCOPE, FLAG_KEY, {
  dim: currentLight.dim ?? 0,
  bright: currentLight.bright ?? 0,
  color: currentLight.color ?? null,
  alpha: currentLight.alpha ?? 0.5,
  animationType: currentLight.animation?.type ?? null,
  animationSpeed: currentLight.animation?.speed ?? 5,
  animationIntensity: currentLight.animation?.intensity ?? 5
});

await tokenDocument.update({
  "light.dim": ${Number(toggle.dim ?? 40)},
  "light.bright": ${Number(toggle.bright ?? 20)},
  "light.color": ${JSON.stringify(color)},
  "light.alpha": ${Number(alpha)},
  "light.animation.type": ${JSON.stringify(animation.type ?? "torch")},
  "light.animation.speed": ${Number(animation.speed ?? 3)},
  "light.animation.intensity": ${Number(animation.intensity ?? 4)}
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ token: sourceToken }),
  content: "<p><strong>" + ITEM_NAME + ":</strong> " + ON_CHAT + "</p>"
});

ui.notifications.info(ITEM_NAME + " light toggled on.");
`.trim();
  }

  function lightTriggerEffect(toggle) {
    const macroAutomation = itemMacroAutomation && midiQolAutomation && FORGE.daeAutomation === true;
    return {
      _id: assertDocumentId(toggle.effectId),
      name: toggle.effectName ?? "Light Toggle",
      img: toggle.effectImg ?? "icons/magic/fire/flame-burning-campfire-orange.webp",
      transfer: false,
      disabled: false,
      duration: {},
      type: "base",
      system: {
        changes: macroAutomation ? [
          {
            key: "flags.midi-qol.onUseMacroName",
            type: "custom",
            value: "ActivityMacro,postActiveEffects",
            phase: "final",
            priority: null
          }
        ] : []
      },
      flags: {
        ...(macroAutomation ? { dae: {
          enableCondition: "",
          disableCondition: "",
          stackable: "noneName",
          expiryMode: "default",
          durationExpression: "",
          macroRepeat: "none",
          disableIncapacitated: false,
          selfTarget: false,
          selfTargetAlways: false,
          dontApply: false,
          specialDuration: []
        } } : {}),
        core: { overlay: false }
      }
    };
  }

  function makeToggleLightActivity(item, spec, toggle) {
    const UtilityActivity = CONFIG.DND5E.activityTypes.utility.documentClass;
    const activity = new UtilityActivity({}, { parent: item }).toObject();
    return foundry.utils.mergeObject(activity, {
      _id: assertActivityId(toggle.activityId),
      type: "utility",
      name: toggle.activityName ?? "Toggle Light",
      img: toggle.activityImg ?? "icons/magic/fire/flame-burning-campfire-orange.webp",
      sort: toggle.sort ?? 100000,
      activation: { type: toggle.activationType ?? "bonus", value: null, condition: "", override: false },
      consumption: activityConsumptionNone(),
      description: { chatFlavor: toggle.chatFlavor ?? toggle.onChat ?? "" },
      duration: durationData(toggle.duration ?? { value: "10", units: "minute" }),
      effects: [{ _id: assertDocumentId(toggle.effectId), level: {} }],
      range: rangeData(toggle.range ?? { units: "self" }),
      target: targetData(toggle.target ?? { affects: { count: "1", type: "self" }, prompt: false }),
      uses: { spent: 0, max: "", recovery: [] },
      roll: { prompt: false, visible: false, name: "", formula: "" },
      macroData: {
        name: toggle.macroName ?? toggle.activityName ?? "Toggle Light",
        command: toggleLightMacroCommand(spec.name, toggle)
      },
      visibility: {
        identifier: "",
        level: { min: null, max: null },
        requireAttunement: spec.attunement === "required",
        requireIdentification: false,
        requireMagic: true
      }
    }, { inplace: false });
  }

  async function createArtifactWeaponHybrid(spec, folder, actorFolder) {
    const effects = passiveEffectDocuments(spec);
    if (spec.toggleLight) effects.push(lightTriggerEffect(spec.toggleLight));
    const actorsByProfileId = new Map();
    const createdActors = [];
    for (const profile of allSummonProfiles(spec)) {
      const actor = await createSummonProfileActor(spec, actorFolder, profile);
      actorsByProfileId.set(profile.profileId, actor);
      createdActors.push(actor);
    }

    const item = await createWorldItem(spec, {
      name: spec.name,
      type: "weapon",
      img: spec.img,
      system: weaponSystem(spec),
      effects,
      flags: foundry.utils.mergeObject(
        actorsByProfileId.size ? {
          [MODULE_ID]: {
            summonActorUuids: Object.fromEntries(Array.from(actorsByProfileId.entries()).map(([id, actor]) => [id, actor.uuid]))
          }
        } : {},
        activityMacroFlags([
          spec.toggleLight?.activityId,
          ...(spec.utilityActivities ?? [])
            .filter(activity => activity.macroCommand)
            .map(activity => activity.activityId)
        ]),
        { inplace: false }
      )
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const attack = findAttackActivity(created, spec.attackName ?? `Attack with ${spec.name}`);
    const updateData = {};

    if (attack) {
      const attackData = buildWeaponBaseAttackData(attack, spec);
      updateData[`system.activities.${attack.id}`] = itemHasExplicitActivityChoices(spec)
        ? forceExplicitChoiceOnAttack(attackData, { midiQol: midiQolAutomation })
        : attackData;
      Object.assign(updateData, conditionOnHitHookUpdate(created, spec, attack.id));
    } else {
      ui.notifications.warn(`${spec.name} was created, but no weapon attack activity was found to patch.`);
    }

    if (spec.toggleLight) {
      const activity = makeToggleLightActivity(created, spec, spec.toggleLight);
      updateData[`system.activities.${activity._id}`] = activity;
    }

    for (const activitySpec of spec.attackActivities ?? []) {
      const activity = makeAttackActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }

    for (const activitySpec of spec.utilityActivities ?? []) {
      const activity = summonProfilesFromActivity(activitySpec).length
        ? summonActivityDocument(created, spec, activitySpec, actorsByProfileId)
        : makeSuiteUtilityActivity(created, spec, activitySpec);
      updateData[`system.activities.${activity._id}`] = activity;
    }

    for (const activitySpec of spec.saveActivities ?? []) {
      const activity = makeSaveActivity(created, {
        ...activitySpec,
        name: spec.name,
        img: activitySpec.activityImg ?? spec.img,
        requireAttunement: spec.attunement === "required"
      });
      updateData[`system.activities.${activity._id}`] = activity;
    }

    if ((spec.summonProfiles ?? []).length) {
      const activityData = summonActivityDocument(created, spec, spec.summonActivity ?? spec, actorsByProfileId);
      updateData[`system.activities.${activityData._id}`] = activityData;
    }

    await created.update(updateData);
    if (createdActors.length) return { item: game.items.get(created.id) ?? created, actors: createdActors };
    return game.items.get(created.id) ?? created;
  }

  function conditionMacroCommand(spec) {
    const rider = spec.conditionOnHit;
    const ability = rider.save?.ability ?? "con";
    const dc = Number(rider.save?.dc ?? 10);
    const condition = rider.condition ?? "poisoned";
    const effectName = rider.effectName ?? `${spec.name} - ${condition}`;
    const durationSeconds = Number(rider.durationSeconds ?? 30);
    const targetCreatureType = String(rider.targetCreatureType ?? "").trim().toLowerCase();
    const effectImg = rider.img ?? "icons/svg/aura.svg";

    return `
const SAVE_ABILITY = ${JSON.stringify(ability)};
const SAVE_DC = ${dc};
const DURATION_SECONDS = ${durationSeconds};
const CONDITION = ${JSON.stringify(condition)};
const TARGET_CREATURE_TYPE = ${JSON.stringify(targetCreatureType)};
const EFFECT_NAME = ${JSON.stringify(effectName)};
const EFFECT_IMG = ${JSON.stringify(effectImg)};
const SOURCE_LABEL = ${JSON.stringify(FORGE.sourceLabel)};

const macroWorkflow = typeof workflow !== "undefined" ? workflow : null;
const macroItem = typeof item !== "undefined" ? item : null;
const macroActor = typeof actor !== "undefined" ? actor : macroItem?.parent ?? null;
const macroToken = typeof token !== "undefined" ? token : null;

const hitTargets = Array.from(macroWorkflow?.hitTargets ?? []);
const workflowTargets = Array.from(macroWorkflow?.targets ?? []);
const userTargets = Array.from(game.user.targets ?? []);
const targets = hitTargets.length ? hitTargets : (workflowTargets.length ? workflowTargets : userTargets);

if (!targets.length) {
  ui.notifications.warn((macroItem?.name ?? "Weapon") + " found no hit or targeted enemy for the condition save.");
  return;
}

let matchingTargets = 0;

async function rollSave(targetActor, targetToken) {
  const abilityData = targetActor.system?.abilities?.[SAVE_ABILITY] ?? {};
  const rawSaveBonus = abilityData.save ?? abilityData.mod ?? 0;
  const saveBonus = Number.isFinite(Number(rawSaveBonus)) ? Number(rawSaveBonus) : 0;
  const roll = await new Roll("1d20 + @save", { save: saveBonus }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: targetActor, token: targetToken?.document ?? targetToken }),
    flavor: "<strong>" + (macroItem?.name ?? "Weapon") + ":</strong> DC " + SAVE_DC + " " + SAVE_ABILITY.toUpperCase() + " saving throw."
  });
  return roll.total;
}

async function applyCondition(targetActor, targetToken) {
  const existing = Array.from(targetActor.effects ?? []).filter(effect =>
    effect.name === EFFECT_NAME || effect.statuses?.has?.(CONDITION)
  );
  for (const effect of existing) {
    if (effect.name === EFFECT_NAME) await effect.delete();
  }

  const activeCombat = game.combat?.started ? game.combat : null;
  const effectDuration = activeCombat
    ? {
      rounds: Math.max(1, Math.ceil(DURATION_SECONDS / 6)),
      startRound: activeCombat.round,
      startTurn: activeCombat.turn
    }
    : {
      seconds: DURATION_SECONDS,
      startTime: game.time.worldTime
    };

  await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name: EFFECT_NAME,
    img: EFFECT_IMG,
    origin: macroItem?.uuid ?? "",
    transfer: false,
    disabled: false,
    duration: effectDuration,
    statuses: [CONDITION],
    changes: [],
    description: CONDITION + " from " + (macroItem?.name ?? "weapon") + ".",
    flags: {
      core: { statusId: CONDITION },
      ${JSON.stringify(MODULE_ID)}: {
        source: SOURCE_LABEL,
        tokenUuid: targetToken?.document?.uuid ?? targetToken?.uuid ?? ""
      }
    }
  }]);
}

for (const target of targets) {
  const targetToken = target.document ? target : canvas.tokens.get(target.id);
  const targetActor = target.actor ?? targetToken?.actor;
  if (!targetActor) continue;
  const targetType = String(targetActor.system?.details?.type?.value ?? targetActor.system?.details?.type ?? "").toLowerCase();
  if (TARGET_CREATURE_TYPE && targetType !== TARGET_CREATURE_TYPE) continue;
  matchingTargets += 1;

  const total = await rollSave(targetActor, targetToken);
  if (total < SAVE_DC) {
    await applyCondition(targetActor, targetToken);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: macroActor, token: macroToken }),
      content: "<p><strong>" + (macroItem?.name ?? "Weapon") + ":</strong> " + targetActor.name + " fails the save (" + total + ") and gains " + CONDITION + " for " + DURATION_SECONDS + " seconds.</p>"
    });
    ui.notifications.info(targetActor.name + " gains " + CONDITION + ".");
  } else {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: macroActor, token: macroToken }),
      content: "<p><strong>" + (macroItem?.name ?? "Weapon") + ":</strong> " + targetActor.name + " succeeds on the save (" + total + ").</p>"
    });
  }
}

if (TARGET_CREATURE_TYPE && matchingTargets === 0) {
  ui.notifications.info((macroItem?.name ?? "Weapon") + " found no matching " + TARGET_CREATURE_TYPE + " hit target.");
}
`.trim();
  }

  function generatedAutomationCode(specs) {
    const entries = [];
    for (const spec of specs ?? []) {
      if (spec.conditionOnHit) {
        entries.push({
          itemName: spec.name,
          activityName: spec.attackName ?? `Attack with ${spec.name}`,
          source: "Condition on hit",
          command: conditionMacroCommand(spec)
        });
      }
      if (spec.toggleLight) {
        entries.push({
          itemName: spec.name,
          activityName: spec.toggleLight.activityName ?? "Toggle Light",
          source: "Light toggle",
          command: toggleLightMacroCommand(spec.name, spec.toggleLight)
        });
      }
      for (const activity of spec.utilityActivities ?? []) {
        if (!activity?.macroCommand) continue;
        entries.push({
          itemName: spec.name,
          activityName: activity.activityName ?? `Use ${spec.name}`,
          source: "Utility activity",
          command: guardedUtilityMacroCommand(activity)
        });
      }
    }
    return entries;
  }

  async function createWeaponConditionOnHit(spec, folder) {
    const item = await createWorldItem(spec, {
      name: spec.name,
      type: "weapon",
      img: spec.img,
      system: weaponSystem(spec),
      effects: []
    }, folder);

    const created = game.items.get(item.id) ?? item;
    const attack = findAttackActivity(created, spec.attackName ?? `Attack with ${spec.name}`);
    if (!attack) {
      ui.notifications.warn(`${spec.name} was created, but no weapon attack activity was found to patch.`);
      return created;
    }

    const midiAttackData = buildWeaponBaseAttackData(attack, spec);
    await created.update({
      [`system.activities.${attack.id}`]: midiAttackData,
      ...(() => {
        const redundant = {};
        removeRedundantBaseAttacks(created, attack.id, redundant);
        return redundant;
      })(),
      ...conditionOnHitHookUpdate(created, spec, attack.id)
    });

    return game.items.get(created.id) ?? created;
  }

  const FACTORIES = {
    weaponExtraDamage: createWeaponExtraDamage,
    passiveEffectEquipment: createPassiveEffectEquipment,
    chargedSaveDamage: createChargedSaveDamage,
    chargedHealing: createChargedHealing,
    multiActivityStaff: createMultiActivityStaff,
    nativeEnchant: createNativeEnchant,
    nativeSummon: createNativeSummon,
    nativeMultiProfileSummon: createNativeMultiProfileSummon,
    shieldArmorBonus: createShieldArmorBonus,
    wondrousPassive: createWondrousPassive,
    artifactWeaponHybrid: createArtifactWeaponHybrid,
    weaponConditionOnHit: createWeaponConditionOnHit,
    casterUtilityEquipment: createCasterUtilityEquipment,
    equipmentPowerSuite: createLegendaryEquipmentSuite,
    legendaryEquipmentSuite: createLegendaryEquipmentSuite
  };

  function validateSpecs(specs) {
    if (!Array.isArray(specs) || !specs.length) {
      throw new Error("Provide at least one item spec in an array.");
    }

    const names = new Set();
    for (const spec of specs) {
      if (!spec.name) throw new Error("Every item spec requires a name.");
      if (!spec.kind) throw new Error(`${spec.name} is missing kind.`);
      if (!FACTORIES[spec.kind]) throw new Error(`${spec.name} has unsupported kind "${spec.kind}".`);
      if (names.has(spec.name)) throw new Error(`Duplicate item name in specs: ${spec.name}`);
      names.add(spec.name);

      for (const key of ["activityId", "profileId"]) {
        if (spec[key]) assertActivityId(spec[key]);
      }
      for (const activity of spec.activities ?? []) {
        if (activity.activityId) assertActivityId(activity.activityId);
      }
      for (const activity of spec.attackActivities ?? []) {
        if (activity.activityId) assertActivityId(activity.activityId);
      }
      for (const activity of spec.saveActivities ?? []) {
        if (activity.activityId) assertActivityId(activity.activityId);
      }
      for (const activity of spec.utilityActivities ?? []) {
        if (activity.activityId) assertActivityId(activity.activityId);
        for (const profile of activity.summonProfiles ?? []) {
          if (profile.profileId) assertActivityId(profile.profileId);
        }
      }
      for (const effect of spec.effects ?? []) {
        if (effect.effectId) assertDocumentId(effect.effectId);
      }
      for (const effect of spec.passiveEffects ?? []) {
        if (effect.effectId) assertDocumentId(effect.effectId);
      }
      for (const profile of spec.summonProfiles ?? []) {
        if (profile.profileId) assertActivityId(profile.profileId);
      }
      if (spec.summonActivity?.activityId) assertActivityId(spec.summonActivity.activityId);
      if (spec.toggleLight) {
        assertActivityId(spec.toggleLight.activityId);
        assertDocumentId(spec.toggleLight.effectId);
      }
      if (spec.unresolvedMechanics != null && !Array.isArray(spec.unresolvedMechanics)) {
        throw new Error(`${spec.name} unresolvedMechanics must be an array.`);
      }
      for (const mechanic of spec.unresolvedMechanics ?? []) {
        if (!mechanic.id) throw new Error(`${spec.name} has an unresolved mechanic without an id.`);
        assertDocumentId(mechanic.id);
        for (const key of ["category", "label", "requestedText", "reason", "handling"]) {
          if (typeof mechanic[key] !== "string" || !mechanic[key].trim()) {
            throw new Error(`${spec.name} unresolved mechanic ${mechanic.id} is missing ${key}.`);
          }
        }
        if (typeof mechanic.resolved !== "boolean") {
          throw new Error(`${spec.name} unresolved mechanic ${mechanic.id} must set resolved to true or false.`);
        }
      }
      if (spec.kind === "weaponConditionOnHit" && !spec.conditionOnHit) {
        throw new Error(`${spec.name} uses weaponConditionOnHit but is missing conditionOnHit.`);
      }
      if (spec.kind === "nativeMultiProfileSummon") {
        if (!spec.summonProfiles?.length) throw new Error(`${spec.name} uses nativeMultiProfileSummon but has no summonProfiles.`);
        for (const profile of spec.summonProfiles) {
          if (!profile.actor?.name) throw new Error(`${spec.name} summon profile ${profile.profileName ?? profile.profileId} is missing actor.name.`);
        }
      }
      const hasEmbeddedSummonActivities = (spec.utilityActivities ?? []).some(activity => activity.summonProfiles?.length);
      if (["casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite"].includes(spec.kind) && spec.summonProfiles?.length && !spec.summonActivity?.activityId && !hasEmbeddedSummonActivities) {
        throw new Error(`${spec.name} has summonProfiles but is missing summonActivity.activityId.`);
      }
    }
  }

  function summarizeDocument(doc) {
    if (!doc) return null;
    if (doc.documentName === "Actor") {
      return {
        name: doc.name,
        uuid: doc.uuid,
        type: doc.type,
        folder: doc.folder?.name ?? "",
        ownershipDefault: doc.ownership?.default,
        tokenDisposition: doc.prototypeToken?.disposition,
        items: Array.from(doc.items ?? []).map(item => item.name)
      };
    }

    const activities = Array.from(doc.system.activities ?? []).map(activity => ({
      id: activity.id,
      validId: /^[A-Za-z0-9]{16}$/.test(activity.id),
      name: activity.name,
      type: activity.type,
      consumption: activity.consumption?.targets?.map(target => target.toObject?.() ?? target) ?? [],
      profiles: Array.from(activity.profiles ?? []).map(profile => ({
        id: profile._id,
        name: profile.name,
        uuid: profile.uuid
      }))
    }));

    return {
      name: doc.name,
      uuid: doc.uuid,
      type: doc.type,
      itemType: doc.system.type?.value,
      folder: doc.folder?.name ?? "",
      rarity: doc.system.rarity ?? "",
      attunement: doc.system.attunement ?? "",
      usesMax: doc.system.uses?.max ?? "",
      unresolvedMechanicCount: readForgeFlags(doc.flags).unresolvedMechanics?.length ?? 0,
      effects: Array.from(doc.effects ?? []).map(effect => ({
        name: effect.name,
        type: effect.type,
        transfer: effect.transfer,
        changes: effect.changes?.map(change => `${change.key} ${change.value}`) ?? []
      })),
      activities
    };
  }

  const preparedItems = ITEMS.map(spec => {
    const sanitized = sanitizeForgeSpec(spec).spec;
    const automation = normalizeAutomationContract(sanitized.automation);
    return automation ? { ...sanitized, automation } : sanitized;
  });
  validateSpecs(preparedItems);
  const automationCodePreview = generatedAutomationCode(preparedItems);

  if (validateOnly) {
    return {
      valid: true,
      itemCount: preparedItems.length,
      names: preparedItems.map(spec => spec.name),
      kinds: preparedItems.map(spec => spec.kind),
      unresolvedCounts: preparedItems.map(spec => spec.unresolvedMechanics?.length ?? 0),
      unresolvedMechanicCount: preparedItems.reduce((total, spec) => total + (spec.unresolvedMechanics?.length ?? 0), 0),
      automationCodePreview
    };
  }

  if (automationCodePreview.length && authorizeGeneratedAutomation !== true) {
    throw new Error("This item includes generated automation code. Review the code preview and explicitly authorize it before creation.");
  }

  const itemFolder = await ensureFolder(FORGE.itemFolderName, "Item", "#f07a38");
  const actorFolder = await ensureFolder(FORGE.actorFolderName, "Actor", "#9ec7ff");
  const createdItems = [];
  const createdActors = [];

  for (const spec of preparedItems) {
    const factory = FACTORIES[spec.kind];
    const result = ["nativeSummon", "nativeMultiProfileSummon", "nativeEnchant", "casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite", "artifactWeaponHybrid", "multiActivityStaff"].includes(spec.kind)
      ? await factory(spec, itemFolder, actorFolder)
      : await factory(spec, itemFolder);

    if (result?.item) createdItems.push(result.item);
    else createdItems.push(result);
    if (result?.actor) createdActors.push(result.actor);
    if (result?.actors?.length) createdActors.push(...result.actors);
  }

  const itemSummary = createdItems.map(item => summarizeDocument(game.items.get(item.id) ?? item));
  const actorSummary = createdActors.map(actor => summarizeDocument(game.actors.get(actor.id) ?? actor));

  console.log("Dungeon Master's Forge created items:", createdItems);
  console.table(itemSummary);
  if (actorSummary.length) {
    console.log("Dungeon Master's Forge created summon actors:", createdActors);
    console.table(actorSummary);
  }

  ui.notifications.info(`Dungeon Master's Forge created ${createdItems.length} item(s)${createdActors.length ? ` and ${createdActors.length} summon actor(s)` : ""}.`);

  return {
    items: createdItems,
    actors: createdActors,
    itemSummary,
    actorSummary
  };
}

export { activityNeedsTargetConfirmation, applyMidiQolActivityDefaults, clonedSrdSummonActorData, forceExplicitChoiceOnAttack, forceSummonUseConfirmation, isFriendlySummon, itemHasExplicitActivityChoices, multiActivityStaffActivityLists, normalizeActorAuraActivitySpec, normalizeSrdActorLookupName, runDungeonMastersForge, suppressMidiTargetConfirmationForUtility };
