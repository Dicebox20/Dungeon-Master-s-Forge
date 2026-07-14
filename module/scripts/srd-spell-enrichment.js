import { normalizeMagicalBonus } from "./equipment-normalization.js";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const DEFAULT_SAVE_DC = 13;

function stableId(label) {
  const base = String(label).replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "Forge";
  let hash = 2166136261;
  for (const character of String(label)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36).padStart(5, "0").slice(-5);
  return `${base}${suffix}`.padEnd(16, "0").slice(0, 16);
}

function activityList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return Array.from(value);
  } catch {
    return [];
  }
}

function plainActivity(activity) {
  if (!activity) return null;
  return typeof activity.toObject === "function" ? activity.toObject() : clone(activity);
}

function normalizeAbility(value) {
  const ability = Array.isArray(value) ? value[0] : value;
  return compactText(ability).toLowerCase();
}

function normalizeSave(value = {}, fallback = {}) {
  const ability = normalizeAbility(value.ability ?? fallback.ability);
  const formula = value?.dc?.formula ?? value?.dc ?? fallback?.dc;
  const dc = Number(formula);
  return {
    ...(ability ? { ability } : {}),
    ...(Number.isFinite(dc) && dc > 0 ? { dc } : {})
  };
}

function ensureSaveDc(save = {}) {
  const next = clone(save) ?? {};
  const dc = Number(next?.dc?.formula ?? next?.dc);
  if (!Number.isFinite(dc) || dc <= 0) next.dc = DEFAULT_SAVE_DC;
  return next;
}

function requestedSaveDc(request) {
  const text = compactText(request);
  const value = text.match(/\b(?:spell\s+)?save\s+dc\s*(?:of|:)?\s*(\d+)\b/i)?.[1]
    ?? text.match(/\bdc\s*(\d+)\b/i)?.[1];
  const dc = Number(value);
  return Number.isFinite(dc) && dc > 0 ? dc : null;
}

function specNeedsDefaultMagicalBonus(spec = {}) {
  const current = normalizeMagicalBonus(spec.magicalBonus);
  if (current && current !== "0") return false;
  const weaponLike = Boolean(
    spec.weaponType
    || spec.damage?.base
    || ["weaponExtraDamage", "weaponConditionOnHit", "artifactWeaponHybrid", "multiActivityStaff"].includes(spec.kind)
  );
  const armorLike = spec.kind === "shieldArmorBonus"
    || (Number(spec.armorValue ?? 0) > 0 && /\b(?:shield|armor|plate|mail|leather)\b/i.test(compactText(spec.description)));
  return weaponLike || armorLike;
}

function activityMechanicalScore(activity = {}) {
  let score = 0;
  if (compactText(activity?.target?.template?.type) && activity?.target?.template?.size != null) score += 3;
  if (compactText(activity?.range?.units) || activity?.range?.value != null) score += 2;
  if (compactText(activity?.save?.ability)) score += 2;
  if (Number(activity?.save?.dc) > 0 || Number(activity?.save?.dc?.formula) > 0) score += 2;
  if (Array.isArray(activity?.damageParts) && activity.damageParts.length) score += 2;
  if (/^cast\s+/i.test(compactText(activity?.activityName))) score += 1;
  if (!/\(\d+\s*charge/i.test(compactText(activity?.activityName))) score += 1;
  return score;
}

function normalizeTarget(target = {}) {
  const next = clone(target) ?? {};
  if (!next.affects) next.affects = {};
  if (next.prompt == null) next.prompt = Boolean(next.template?.type || next.affects?.type || next.affects?.special);
  return next;
}

function hasTemplateShape(target = {}) {
  return Boolean(compactText(target?.template?.type) && compactText(target?.template?.size));
}

function hasMeaningfulRange(range = {}) {
  const units = compactText(range?.units).toLowerCase();
  const special = compactText(range?.special);
  if (range?.value != null) return true;
  if (special) return true;
  if (!units) return false;
  return units !== "self";
}

function hasMeaningfulDuration(duration = {}) {
  return Boolean(duration?.value != null && compactText(duration?.units));
}

function mergeTargetWithFallback(target = {}, fallback = {}) {
  const next = normalizeTarget(target);
  const fallbackTarget = normalizeTarget(fallback);

  if (!hasTemplateShape(next) && hasTemplateShape(fallbackTarget)) {
    next.template = clone(fallbackTarget.template);
  }
  if (!compactText(next?.affects?.type) && compactText(fallbackTarget?.affects?.type)) {
    next.affects = clone(fallbackTarget.affects);
  } else if (!compactText(next?.affects?.special) && compactText(fallbackTarget?.affects?.special)) {
    next.affects = {
      ...next.affects,
      special: fallbackTarget.affects.special
    };
  }
  if (next.prompt == null && fallbackTarget.prompt != null) next.prompt = fallbackTarget.prompt;
  return next;
}

function mergeSaveWithFallback(save = {}, fallback = {}) {
  const primary = normalizeSave(save);
  const backup = normalizeSave(fallback);
  return {
    ...(backup.ability && !primary.ability ? { ability: backup.ability } : {}),
    ...primary,
    ...(backup.dc && !primary.dc ? { dc: backup.dc } : {})
  };
}

function supportsScalingFromDamageParts(damageParts = []) {
  return damageParts.some(part => part?.scaling?.mode);
}

function supportsScalingFromHealing(healing = {}) {
  return Boolean(healing?.scaling?.mode);
}

async function spellDocumentMetadata(spellName, options = {}) {
  const resolveSpell = options.resolveSpell;
  const resolveSpellDocument = options.resolveSpellDocument;
  const fallbackProfile = localSpellProfileByName(spellName);
  const fallbackMetadata = () => fallbackProfile ? {
    name: fallbackProfile.name,
    type: compactText(fallbackProfile.type),
    level: Number(fallbackProfile.level ?? 0),
    range: clone(fallbackProfile.range ?? {}),
    target: clone(fallbackProfile.target ?? {}),
    save: clone(fallbackProfile.save ?? {}),
    damageOnSave: compactText(fallbackProfile.damageOnSave),
    damageParts: clone(fallbackProfile.damageParts ?? []),
    healing: clone(fallbackProfile.healing ?? {}),
    duration: clone(fallbackProfile.duration ?? {}),
    img: compactText(fallbackProfile.img),
    attackType: compactText(fallbackProfile.attackType),
    attackClassification: compactText(fallbackProfile.attackClassification),
    supportsScaling: supportsScalingFromDamageParts(fallbackProfile.damageParts ?? []) || supportsScalingFromHealing(fallbackProfile.healing ?? {})
  } : null;

  if (typeof resolveSpell !== "function" || typeof resolveSpellDocument !== "function") return fallbackMetadata();

  const resolution = await resolveSpell(spellName);
  if (resolution?.status !== "compatible") return fallbackMetadata();
  const document = await resolveSpellDocument(resolution);
  if (!document) return fallbackMetadata();

  const activity = activityList(document.system?.activities).find(candidate => {
    const type = compactText(candidate?.type).toLowerCase();
    return ["save", "attack", "heal", "utility"].includes(type);
  });
  const raw = plainActivity(activity);
  if (!raw) return null;

  const damageParts = clone(raw.damage?.parts ?? raw.damageParts ?? []);
  const fallbackDamageParts = clone(fallbackProfile?.damageParts ?? []);
  const mergedDamageParts = damageParts.length ? damageParts : fallbackDamageParts;
  const rawRange = clone(raw.range ?? {});
  const mergedRange = hasMeaningfulRange(rawRange) ? rawRange : clone(fallbackProfile?.range ?? {});
  const rawTarget = normalizeTarget(raw.target ?? {});
  const mergedTarget = mergeTargetWithFallback(rawTarget, fallbackProfile?.target ?? {});
  const mergedSave = mergeSaveWithFallback(raw.save ?? {}, fallbackProfile?.save ?? {});
  const rawDuration = clone(raw.duration ?? {});
  const mergedDuration = hasMeaningfulDuration(rawDuration) ? rawDuration : clone(fallbackProfile?.duration ?? {});
  const damageOnSave = compactText(raw.damage?.onSave ?? raw.damageOnSave ?? "")
    || compactText(fallbackProfile?.damageOnSave ?? "");
  const healing = clone(raw.healing ?? fallbackProfile?.healing ?? {});
  return {
    name: String(document.name ?? spellName).trim() || spellName,
    type: compactText(raw.type).toLowerCase() || "save",
    level: Number(document.system?.level ?? resolution.match?.spellLevel ?? 0),
    range: mergedRange,
    target: mergedTarget,
    save: mergedSave,
    damageOnSave,
    damageParts: mergedDamageParts,
    healing,
    duration: mergedDuration,
    img: String(document.img ?? resolution.match?.img ?? "").trim(),
    attackType: compactText(raw.attack?.type?.value ?? fallbackProfile?.attackType),
    attackClassification: compactText(raw.attack?.type?.classification ?? fallbackProfile?.attackClassification),
    supportsScaling: supportsScalingFromDamageParts(mergedDamageParts) || supportsScalingFromHealing(healing)
  };
}

const SPELL_LIBRARY = Object.freeze([
  Object.freeze({
    name: "Ray of Sickness",
    type: "attack",
    level: 1,
    tags: Object.freeze(["poison"]),
    range: { value: 60, units: "ft" },
    target: {
      affects: { count: "1", type: "creature", special: "One creature within range" },
      prompt: true
    },
    attackType: "ranged",
    attackClassification: "spell",
    damageParts: Object.freeze([{
      number: 2,
      denomination: 8,
      bonus: "",
      types: Object.freeze(["poison"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }])
  }),
  Object.freeze({
    name: "Ice Knife",
    type: "attack",
    level: 1,
    tags: Object.freeze(["cold", "piercing"]),
    range: { value: 60, units: "ft" },
    target: {
      affects: { count: "1", type: "creature", special: "One creature within range" },
      prompt: true
    },
    attackType: "ranged",
    attackClassification: "spell",
    damageParts: Object.freeze([
      {
        number: 1,
        denomination: 10,
        bonus: "",
        types: Object.freeze(["piercing"]),
        scaling: Object.freeze({ mode: "", number: 1, formula: "" })
      },
      {
        number: 2,
        denomination: 6,
        bonus: "",
        types: Object.freeze(["cold"]),
        scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
      }
    ])
  }),
  Object.freeze({
    name: "Command",
    level: 1,
    tags: Object.freeze([]),
    save: { ability: "wis" },
    damageParts: Object.freeze([]),
    range: { value: 60, units: "ft" },
    target: {
      affects: { count: "1", type: "creature", special: "One creature within range" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Thunderwave",
    level: 1,
    tags: Object.freeze(["thunder"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{
      number: 2,
      denomination: 8,
      bonus: "",
      types: Object.freeze(["thunder"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cube", size: 15, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 15-foot cube" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Shatter",
    level: 2,
    tags: Object.freeze(["thunder"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{
      number: 3,
      denomination: 8,
      bonus: "",
      types: Object.freeze(["thunder"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { value: 60, units: "ft" },
    target: {
      template: { count: "1", type: "sphere", size: 10, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 10-foot-radius sphere" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Tidal Wave",
    level: 3,
    tags: Object.freeze(["bludgeoning"]),
    save: { ability: "dex" },
    damageOnSave: "half",
    damageParts: Object.freeze([{
      number: 4,
      denomination: 8,
      bonus: "",
      types: Object.freeze(["bludgeoning"]),
      scaling: Object.freeze({ mode: "", number: 1, formula: "" })
    }]),
    range: { value: 120, units: "ft" },
    target: {
      template: { count: "1", type: "line", size: 30, width: 10, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 30-foot-long, 10-foot-wide area" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Burning Hands",
    level: 1,
    tags: Object.freeze(["fire"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([{
      number: 3,
      denomination: 6,
      bonus: "",
      types: Object.freeze(["fire"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cone", size: 15, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 15-foot cone" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Fireball",
    level: 3,
    tags: Object.freeze(["fire"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([{
      number: 8,
      denomination: 6,
      bonus: "",
      types: Object.freeze(["fire"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { value: 150, units: "ft" },
    target: {
      template: { count: "1", type: "sphere", size: 20, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius sphere" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Lightning Bolt",
    level: 3,
    tags: Object.freeze(["lightning"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([{
      number: 8,
      denomination: 6,
      bonus: "",
      types: Object.freeze(["lightning"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "line", size: 100, width: 5, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 100-foot line" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Ice Storm",
    level: 4,
    tags: Object.freeze(["cold", "bludgeoning"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([
      { number: 2, denomination: 8, bonus: "", types: Object.freeze(["bludgeoning"]), scaling: Object.freeze({ mode: "whole", number: 1, formula: "" }) },
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["cold"]) }
    ]),
    range: { value: 300, units: "ft" },
    target: {
      template: { count: "1", type: "cylinder", size: 20, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius, 40-foot-high cylinder" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Cone of Cold",
    level: 5,
    tags: Object.freeze(["cold"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{
      number: 8,
      denomination: 8,
      bonus: "",
      types: Object.freeze(["cold"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cone", size: 60, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 60-foot cone" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Flame Strike",
    level: 5,
    tags: Object.freeze(["fire", "radiant"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["fire"]), scaling: Object.freeze({ mode: "whole", number: 1, formula: "" }) },
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["radiant"]), scaling: Object.freeze({ mode: "whole", number: 1, formula: "" }) }
    ]),
    range: { value: 60, units: "ft" },
    target: {
      template: { count: "1", type: "cylinder", size: 10, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 10-foot-radius, 40-foot-high cylinder" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Clairvoyance",
    level: 3,
    tags: Object.freeze([]),
    range: { value: 1, units: "mi" },
    duration: { value: 10, units: "minute", concentration: true },
    target: {
      affects: { count: "1", type: "space", special: "A location within range" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Fog Cloud",
    level: 1,
    tags: Object.freeze([]),
    range: { value: 120, units: "ft" },
    duration: { value: 1, units: "hour", concentration: true },
    target: {
      template: { count: "1", type: "sphere", size: 20, units: "ft" },
      affects: { type: "space", special: "A 20-foot-radius sphere of fog" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Detect Thoughts",
    level: 2,
    tags: Object.freeze([]),
    range: { units: "self" },
    duration: { value: 1, units: "minute", concentration: true },
    target: {
      affects: { count: "1", type: "self", special: "Self" },
      prompt: false
    }
  }),
  Object.freeze({
    name: "Sleet Storm",
    level: 3,
    tags: Object.freeze(["cold"]),
    range: { value: 150, units: "ft" },
    duration: { value: 1, units: "minute", concentration: true },
    target: {
      template: { count: "1", type: "cylinder", size: 40, height: 20, units: "ft" },
      affects: { type: "space", special: "A 40-foot-radius, 20-foot-high cylinder of sleet and freezing rain" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Misty Step",
    level: 2,
    tags: Object.freeze([]),
    range: { value: 30, units: "ft" },
    duration: { units: "inst", concentration: false },
    target: {
      affects: { count: "1", type: "space", special: "An unoccupied space you can see within range" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Invisibility",
    level: 2,
    tags: Object.freeze([]),
    range: { units: "touch" },
    duration: { value: 1, units: "hour", concentration: true },
    target: {
      affects: { count: "1", type: "creature", special: "A creature you touch" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Cure Wounds",
    level: 1,
    tags: Object.freeze(["healing"]),
    range: { units: "touch" },
    duration: { units: "inst", concentration: false },
    target: {
      affects: { count: "1", type: "creature", special: "A creature you touch" },
      prompt: true
    },
    healing: Object.freeze({
      number: 1,
      denomination: 8,
      bonus: "@mod",
      types: Object.freeze(["healing"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    })
  }),
  Object.freeze({
    name: "Moonbeam",
    level: 2,
    tags: Object.freeze(["radiant"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{
      number: 2,
      denomination: 10,
      bonus: "",
      types: Object.freeze(["radiant"]),
      scaling: Object.freeze({ mode: "whole", number: 1, formula: "" })
    }]),
    range: { value: 120, units: "ft" },
    duration: { value: 1, units: "minute", concentration: true },
    target: {
      template: { count: "1", type: "cylinder", size: 5, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the moonbeam's area" },
      prompt: true
    }
  })
]);

function localSpellProfileByName(name) {
  const normalized = compactText(name).toLowerCase();
  return SPELL_LIBRARY.find(profile => profile.name.toLowerCase() === normalized) ?? null;
}

const ACTIVITY_CAPABLE_KINDS = new Set([
  "weaponExtraDamage",
  "artifactWeaponHybrid",
  "casterUtilityEquipment",
  "equipmentPowerSuite",
  "legendaryEquipmentSuite",
  "multiActivityStaff"
]);

function requestedSpellChoiceCount(request) {
  const text = compactText(request);
  const direct = text.match(/\b(\d+)\s+spells?\s+of\s+(?:your|their|the wielder'?s?)\s+choice\b/i)?.[1];
  if (direct) return Number(direct);
  const choose = text.match(/\bchoose\s+(\d+)\s+spells?\b/i)?.[1];
  if (choose) return Number(choose);
  return 0;
}

function parseChargeMax(request) {
  const match = compactText(request).match(/\b(\d+)\s+charges?\b/i)?.[1];
  return match ? String(Number(match)) : "";
}

function inferDamageTags(request, spec = {}) {
  const tags = new Set();
  const source = `${compactText(request)} ${compactText(spec.description)}`.toLowerCase();
  for (const tag of ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "slashing", "thunder"]) {
    if (source.includes(tag)) tags.add(tag);
  }
  for (const part of spec.extraDamageParts ?? []) {
    for (const type of part?.types ?? []) tags.add(String(type).toLowerCase());
  }
  for (const part of spec.damageParts ?? []) {
    for (const type of part?.types ?? []) tags.add(String(type).toLowerCase());
  }
  for (const activity of [...(spec.saveActivities ?? []), ...(spec.activities ?? [])]) {
    for (const part of activity?.damageParts ?? []) {
      for (const type of part?.types ?? []) tags.add(String(type).toLowerCase());
    }
  }
  return tags;
}

function rankedSpellProfiles(tags) {
  const preferred = [];
  const add = name => {
    const profile = SPELL_LIBRARY.find(entry => entry.name === name);
    if (profile && !preferred.includes(profile)) preferred.push(profile);
  };

  if (tags.has("thunder")) {
    add("Thunderwave");
    add("Shatter");
  }
  if (tags.has("fire")) {
    add("Fireball");
    add("Burning Hands");
    add("Flame Strike");
  }
  if (tags.has("lightning")) add("Lightning Bolt");
  if (tags.has("cold")) {
    add("Ice Storm");
    add("Cone of Cold");
  }

  for (const profile of SPELL_LIBRARY) {
    if (!preferred.includes(profile)) preferred.push(profile);
  }
  return preferred;
}

function hasExplicitSpellActivities(spec) {
  const namedActivities = [
    ...(spec.activities ?? []),
    ...(spec.saveActivities ?? []),
    ...(spec.utilityActivities ?? []),
    ...(spec.attackActivities ?? [])
  ];
  return namedActivities.some(activity => /^cast\s+/i.test(compactText(activity.activityName)));
}

function isSpellChoiceMechanic(mechanic) {
  const text = [
    compactText(mechanic?.label),
    compactText(mechanic?.requestedText),
    compactText(mechanic?.reason),
    compactText(mechanic?.handling)
  ].join(" ").toLowerCase();
  return /\bspell/.test(text) && (/\bchoice\b/.test(text) || /\bcharges?\b/.test(text));
}

function buildSaveActivity(itemName, spellProfile, metadata = null, request = "") {
  const source = metadata ?? spellProfile;
  const explicitCost = explicitSpellChargeCost(request, spellProfile.name);
  const usesCharges = /\bcharges?\b/i.test(compactText(request));
  return {
    activityId: stableId(`${itemName} ${spellProfile.name}`),
    activityName: `Cast ${spellProfile.name}`,
    activationType: "action",
    chargeCost: explicitCost ?? (usesCharges ? source.level : 1),
    chargeScaling: supportsScalingFromDamageParts(source.damageParts)
      ? { allowed: true, max: "@item.uses.value", mode: "amount", formula: "" }
      : undefined,
    chatFlavor: `Cast ${spellProfile.name} using this item's charges.`,
    range: {
      ...clone(source.range ?? spellProfile.range),
      override: true
    },
    target: {
      ...normalizeTarget(source.target ?? spellProfile.target),
      override: true,
      prompt: true
    },
    save: clone(source.save ?? spellProfile.save),
    duration: clone(source.duration),
    damageOnSave: source.damageOnSave || spellProfile.damageOnSave || "half",
    damageParts: clone(source.damageParts ?? spellProfile.damageParts),
    ...(source.img ? { activityImg: source.img } : {})
  };
}

function activitySpellName(activityName) {
  const normalized = compactText(activityName);
  const castMatch = normalized.match(/^Cast\s+(.+)$/i);
  const candidate = compactText(castMatch?.[1] ?? normalized)
    .replace(/\s*\(\d+\s*charge(?:s)?\)\s*$/i, "")
    .replace(/\s+\d+\/\d+\s*$/i, "");
  const exact = SPELL_LIBRARY.find(profile => profile.name.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact.name;
  const embedded = SPELL_LIBRARY.find(profile => new RegExp(`\\b${profile.name.replace(/\s+/g, "\\s+")}\\b`, "i").test(candidate));
  return embedded?.name ?? candidate;
}

function spellProfileForActivity(activityName) {
  const spellName = activitySpellName(activityName).toLowerCase();
  return SPELL_LIBRARY.find(profile => profile.name.toLowerCase() === spellName) ?? null;
}

function explicitSpellChargeCost(request, spellName) {
  const escaped = compactText(spellName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const direct = compactText(request).match(new RegExp(`(?:costs?|spend|expend(?:s)?|uses?)\\s*(\\d+)\\s*charges?[^.]{0,120}${escaped}\\b`, "i"))?.[1];
  if (direct) return Number(direct);
  const trailing = compactText(request).match(new RegExp(`${escaped}[^.]{0,80}(?:costs?|for|using|use)\\s*(\\d+)\\s*charges?`, "i"))?.[1];
  if (trailing) return Number(trailing);
  return null;
}

function usesSharedCharges(spec, request) {
  if (/\bcharges?\b/i.test(compactText(request))) return true;
  const max = Number(spec?.uses?.max ?? 0);
  return Number.isFinite(max) && max > 1 && /\bcast\b/i.test(compactText(request));
}

function normalizedSpellUseCost(activity, spellProfile, request) {
  const explicitCost = explicitSpellChargeCost(request, spellProfile.name);
  if (explicitCost != null) return explicitCost;

  // A daily/rest-limited item use is not a spell-level charge pool. Do not retain
  // a model-supplied spell level as its consumption cost unless charges were requested.
  if (!/\bcharges?\b/i.test(compactText(request))) return 1;

  const existingCost = Number(activity?.chargeCost);
  return Number.isFinite(existingCost) && existingCost > 0 ? existingCost : 1;
}

async function spellMetadataForActivity(activityName, options = {}) {
  const aliasedProfile = spellProfileForActivityOrAlias(activityName, options.request);
  const resolvedName = aliasedProfile?.name ?? activitySpellName(activityName);
  const documentMetadata = await spellDocumentMetadata(resolvedName, options);
  if (documentMetadata) {
    return {
      name: documentMetadata.name,
      level: documentMetadata.level,
      profile: documentMetadata,
      supportsScaling: Boolean(documentMetadata.supportsScaling)
    };
  }
  const profile = aliasedProfile ?? spellProfileForActivity(activityName);
  if (profile) {
    return {
      name: profile.name,
      level: profile.level,
      profile,
      supportsScaling: Boolean(profile.damageParts?.some?.(part => part?.scaling?.mode) || profile.healing?.scaling?.mode)
    };
  }
  const resolveSpell = options.resolveSpell;
  if (typeof resolveSpell !== "function") return null;
  const resolution = await resolveSpell(resolvedName);
  if (resolution?.status !== "compatible") return null;
  const level = Number(resolution.match?.spellLevel ?? 0);
  if (!Number.isFinite(level) || level < 1) return null;
  return {
    name: resolvedName,
    level,
    profile: null,
    supportsScaling: false
  };
}

function repeatedSpellCount(request, spellName) {
  const normalizedRequest = compactText(request).toLowerCase();
  const normalizedSpellName = compactText(spellName).toLowerCase();
  const escaped = normalizedSpellName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const pluralized = escaped.replace(/(\w+)$/, "$1s?");
  const wordCounts = { once: 1, one: 1, twice: 2, two: 2, thrice: 3, three: 3, four: 4 };

  const directWord = normalizedRequest.match(new RegExp(`\\b(once|twice|thrice|one|two|three|four|\\d+)\\s+${pluralized}\\b`, "i"))?.[1];
  if (directWord) return Number(wordCounts[directWord] ?? directWord);

  const castTimes = normalizedRequest.match(new RegExp(`\\bcast\\s+${escaped}\\s+(once|twice|thrice|\\d+)\\s+times?\\b`, "i"))?.[1];
  if (castTimes) return Number(wordCounts[castTimes] ?? castTimes);

  const atOnce = normalizedRequest.match(new RegExp(`\\b(\\d+)\\s+${pluralized}\\b(?=[^.]{0,40}\\b(?:at once|all at once|simultaneously|consecutively)\\b)`, "i"))?.[1];
  if (atOnce) return Number(atOnce);

  return 1;
}

function sameDamageType(left = {}, right = {}) {
  const leftTypes = Array.isArray(left.types) ? left.types : [];
  const rightTypes = Array.isArray(right.types) ? right.types : [];
  return leftTypes.length === rightTypes.length && leftTypes.every((type, index) => type === rightTypes[index]);
}

function activityLooksLikeScaledDuplicate(activity, spellProfile, repeatedCount) {
  if (repeatedCount <= 1) return false;
  if (!Array.isArray(activity?.damageParts) || activity.damageParts.length !== spellProfile.damageParts.length) return false;
  return activity.damageParts.every((part, index) => {
    const profilePart = spellProfile.damageParts[index];
    return Number(part?.denomination) === Number(profilePart?.denomination)
      && sameDamageType(part, profilePart)
      && Number(part?.number) === Number(profilePart?.number) * repeatedCount;
  });
}

function normalizedSpellActivity(activity, spellProfile, repeatedCount = 1, suffix = "", metadata = null, request = "") {
  const source = metadata ?? spellProfile;
  const next = clone(activity);
  next.activityName = suffix ? `Cast ${spellProfile.name} ${suffix}` : `Cast ${spellProfile.name}`;
  next.chargeCost = normalizedSpellUseCost(activity, spellProfile, request);
  next.range = {
    ...clone(source.range ?? spellProfile.range),
    override: true
  };
  next.target = {
    ...normalizeTarget(source.target ?? spellProfile.target),
    override: true,
    prompt: true
  };
  const explicitDc = requestedSaveDc(request);
  next.save = {
    ...clone(source.save ?? spellProfile.save),
    ...(explicitDc != null ? { dc: explicitDc } : { dc: DEFAULT_SAVE_DC })
  };
  if (!next.save?.ability) next.save = clone(source.save ?? spellProfile.save);
  next.save = ensureSaveDc(next.save);
  next.duration = clone(source.duration ?? next.duration);
  if (source.img) next.activityImg = source.img;
  if (!Array.isArray(next.damageParts) || activityLooksLikeScaledDuplicate(activity, spellProfile, repeatedCount)) {
    next.damageParts = clone(source.damageParts ?? spellProfile.damageParts);
  }
  next.damageOnSave = source.damageOnSave || spellProfile.damageOnSave || next.damageOnSave;
  return next;
}

function normalizedUtilitySpellActivity(activity, spellProfile, metadata = null, request = "") {
  const source = metadata ?? spellProfile;
  const next = clone(activity);
  next.activityName = spellActivityDisplayName(activity, spellProfile.name);
  next.chargeCost = normalizedSpellUseCost(activity, spellProfile, request);
  next.range = {
    ...clone(source.range ?? spellProfile.range),
    override: true
  };
  next.target = {
    ...normalizeTarget(source.target ?? spellProfile.target),
    override: true,
    prompt: true
  };
  if (source.duration) next.duration = clone(source.duration);
  if (source.img) next.activityImg = source.img;
  if (source.healing && Object.keys(source.healing).length) next.healing = clone(source.healing);
  else delete next.healing;
  return next;
}

function normalizedAttackSpellActivity(activity, spellProfile, metadata = null, request = "") {
  const source = metadata ?? spellProfile;
  const next = clone(activity);
  next.activityName = spellActivityDisplayName(activity, spellProfile.name, request);
  next.chargeCost = normalizedSpellUseCost(activity, spellProfile, request);
  next.activationType = next.activationType ?? "action";
  next.range = {
    ...clone(source.range ?? spellProfile.range),
    override: true
  };
  next.target = {
    ...normalizeTarget(source.target ?? spellProfile.target),
    override: true,
    prompt: true
  };
  next.ability = compactText(next.ability) || "spellcasting";
  next.attackType = compactText(next.attackType) || compactText(source.attackType) || "ranged";
  next.attackClassification = compactText(next.attackClassification) || compactText(source.attackClassification) || "spell";
  next.attackBonus = compactText(next.attackBonus) || "@prof";
  next.duration = clone(source.duration ?? next.duration);
  if (source.img) next.activityImg = source.img;
  if (!Array.isArray(next.damageParts) || !next.damageParts.length) {
    next.damageParts = clone(source.damageParts ?? spellProfile.damageParts);
  }
  return next;
}

function spellAliasFromRequest(request, spellName) {
  const escaped = compactText(spellName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const source = String(request ?? "");
  const patterns = [
    new RegExp(`(?:^|[\\n.;])\\s*\\d+\\s*charges?:\\s*([^\\n.:]{2,80})[.:]\\s*cast\\s+${escaped}\\b`, "im"),
    new RegExp(`(?:^|[\\n.;])\\s*([^\\n.:]{2,80})[.:]\\s*cast\\s+${escaped}\\b`, "im")
  ];
  for (const pattern of patterns) {
    const alias = compactText(source.match(pattern)?.[1] ?? "");
    if (alias && alias.toLowerCase() !== spellName.toLowerCase()) return alias;
  }
  return "";
}

function requestedSpellAliases(request) {
  const aliases = new Map();
  for (const profile of SPELL_LIBRARY) {
    const alias = spellAliasFromRequest(request, profile.name);
    if (alias) aliases.set(alias.toLowerCase(), profile.name);
  }
  return aliases;
}

function spellProfileForActivityOrAlias(activityName, request = "") {
  const direct = spellProfileForActivity(activityName);
  if (direct) return direct;
  const alias = requestedSpellAliases(request).get(compactText(activityName).toLowerCase());
  return alias ? spellProfileForActivity(alias) : null;
}

function spellActivityDisplayName(activity, spellName, request = "") {
  const alias = spellAliasFromRequest(request, spellName);
  if (alias) return alias;
  const current = compactText(activity?.activityName);
  if (current && current.toLowerCase() !== `cast ${spellName}`.toLowerCase() && activitySpellName(current).toLowerCase() === spellName.toLowerCase()) {
    return current;
  }
  return `Cast ${spellName}`;
}

const MULTI_STAGE_SPELL_SUFFIXES = Object.freeze({
  "Ice Knife": Object.freeze({
    saveActivities: "Burst"
  })
});

function spellPhaseDisplayName(activity, spellName, listName, request = "") {
  const base = spellActivityDisplayName(activity, spellName, request);
  const suffix = MULTI_STAGE_SPELL_SUFFIXES[spellName]?.[listName];
  if (!suffix) return base;
  const stem = compactText(base).replace(/^Cast\s+/i, "");
  return `${stem} ${suffix}`.trim();
}

function plannedNativeSpellNames(plan) {
  const names = [];
  for (const feature of plan?.native ?? []) {
    if (feature?.type !== "spell") continue;
    const name = compactText(feature.label).replace(/^(?:System|Deterministic local) spell:\s*/i, "");
    if (name && !names.some(existing => existing.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return names;
}

function isGenericSpellPlaceholder(activity = {}) {
  const name = compactText(activity.activityName);
  return /^(?:utility|spell|save|activity)\s*\d+$/i.test(name);
}

function metadataSpellProfile(name, metadata = {}) {
  return {
    name: compactText(metadata.name) || name,
    type: compactText(metadata.type),
    level: Number(metadata.level ?? 0),
    range: clone(metadata.range ?? {}),
    target: clone(metadata.target ?? {}),
    save: clone(metadata.save ?? {}),
    duration: clone(metadata.duration ?? {}),
    damageOnSave: compactText(metadata.damageOnSave),
    damageParts: clone(metadata.damageParts ?? []),
    healing: clone(metadata.healing ?? {}),
    attackType: compactText(metadata.attackType),
    attackClassification: compactText(metadata.attackClassification)
  };
}

function isSaveLikeSpell(metadata = {}) {
  return compactText(metadata.type).toLowerCase() === "save"
    || Array.isArray(metadata.damageParts) && metadata.damageParts.length > 0
    || Boolean(metadata.save?.ability);
}

function isAttackLikeSpell(metadata = {}) {
  return compactText(metadata.type).toLowerCase() === "attack"
    || Boolean(compactText(metadata.attackType))
    || Boolean(compactText(metadata.attackClassification));
}

function spellActivityExists(spec, spellName) {
  const target = compactText(spellName).toLowerCase();
  return ["activities", "saveActivities", "utilityActivities", "attackActivities"]
    .flatMap(listName => Array.isArray(spec?.[listName]) ? spec[listName] : [])
    .some(activity => activitySpellName(activity?.activityName).toLowerCase() === target);
}

function takeGenericSpellPlaceholder(spec) {
  for (const listName of ["utilityActivities", "saveActivities", "activities"]) {
    const activities = Array.isArray(spec[listName]) ? spec[listName] : [];
    const index = activities.findIndex(isGenericSpellPlaceholder);
    if (index >= 0) return { listName, index, activity: activities[index] };
  }
  return null;
}

async function reconcilePlannedSrdSpellActivities(spec, plan, request, options = {}) {
  const spellNames = plannedNativeSpellNames(plan);
  if (!spellNames.length) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  let applied = false;
  const assumptions = [];
  const references = Array.isArray(next.systemReferences) ? [...next.systemReferences] : [];

  for (const spellName of spellNames) {
    if (spellActivityExists(next, spellName)) continue;

    const metadata = await spellDocumentMetadata(spellName, options);
    if (!metadata) continue;
    const profile = metadataSpellProfile(spellName, metadata);
    const placeholder = takeGenericSpellPlaceholder(next);
    const saveLike = isSaveLikeSpell(metadata);
    const attackLike = isAttackLikeSpell(metadata);
    const existing = placeholder?.activity ?? {};
    const activity = attackLike
      ? normalizedAttackSpellActivity(existing, profile, metadata, request)
      : saveLike
        ? normalizedSpellActivity(existing, profile, 1, "", metadata, request)
        : normalizedUtilitySpellActivity(existing, profile, metadata, request);

    if (placeholder) {
      next[placeholder.listName] = next[placeholder.listName].filter((_, index) => index !== placeholder.index);
    }
    const destination = attackLike ? "attackActivities" : saveLike ? "saveActivities" : "utilityActivities";
    next[destination] = [...(Array.isArray(next[destination]) ? next[destination] : []), activity];

    const resolution = typeof options.resolveSpell === "function" ? await options.resolveSpell(spellName) : null;
    if (resolution?.status === "compatible" && !references.some(reference => reference?.uuid === resolution.match?.uuid)) {
      references.push({
        kind: "spell",
        name: metadata.name,
        label: "System spell",
        uuid: resolution.match.uuid,
        packLabel: resolution.match.pack.label,
        documentType: resolution.match.documentType,
        message: `${metadata.name} from ${resolution.match.pack.label}`
      });
    }
    assumptions.push(`${placeholder ? "Replaced a generic activity with" : "Added"} compatible SRD ${metadata.name} activity from the request.`);
    applied = true;
  }

  if (references.length) next.systemReferences = references;
  return { applied, spec: next, assumptions: [...new Set(assumptions)] };
}

function dedupeRecognizedSpellActivities(spec, request) {
  const next = clone(spec);
  let applied = false;
  const assumptions = [];

  for (const listName of ["saveActivities", "activities"]) {
    const activities = Array.isArray(next[listName]) ? [...next[listName]] : [];
    if (!activities.length) continue;

    const bySpell = new Map();
    const passthrough = [];
    for (const activity of activities) {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) {
        passthrough.push(activity);
        continue;
      }
      if (repeatedSpellCount(request, spellProfile.name) > 1) {
        passthrough.push(activity);
        continue;
      }
      const key = spellProfile.name.toLowerCase();
      const prior = bySpell.get(key);
      if (!prior || activityMechanicalScore(activity) > activityMechanicalScore(prior)) {
        bySpell.set(key, activity);
      }
    }

    const deduped = [...passthrough, ...bySpell.values()].map(activity => {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) return activity;
      const normalizedName = spellPhaseDisplayName(activity, spellProfile.name, listName, request);
      if (activity.activityName === normalizedName) return activity;
      applied = true;
      return {
        ...activity,
        activityName: normalizedName
      };
    });

    if (deduped.length !== activities.length) {
      applied = true;
      assumptions.push("Collapsed duplicate named spell activities into a single SRD-compatible activity.");
    }
    next[listName] = deduped;
  }

  const utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  if (utilityActivities.length) {
    const bySpell = new Map();
    const passthrough = [];
    for (const activity of utilityActivities) {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) {
        passthrough.push(activity);
        continue;
      }
      const key = spellProfile.name.toLowerCase();
      const prior = bySpell.get(key);
      if (!prior || activityMechanicalScore(activity) > activityMechanicalScore(prior)) {
        bySpell.set(key, activity);
      }
    }

    const deduped = [...passthrough, ...bySpell.values()].map(activity => {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) return activity;
      const normalizedName = spellPhaseDisplayName(activity, spellProfile.name, "utilityActivities", request);
      if (activity.activityName === normalizedName) return activity;
      applied = true;
      return {
        ...activity,
        activityName: normalizedName
      };
    });

    if (deduped.length !== utilityActivities.length) {
      applied = true;
      assumptions.push("Collapsed duplicate utility spell activities into a single SRD-compatible activity.");
    }
    next.utilityActivities = deduped;
  }

  const attackActivities = Array.isArray(next.attackActivities) ? [...next.attackActivities] : [];
  if (attackActivities.length) {
    next.attackActivities = attackActivities.map(activity => {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) return activity;
      const normalizedName = spellPhaseDisplayName(activity, spellProfile.name, "attackActivities", request);
      if (activity.activityName === normalizedName) return activity;
      applied = true;
      return {
        ...activity,
        activityName: normalizedName
      };
    });
  }

  return { applied, spec: next, assumptions };
}

function applyForgeSpecDefaults(spec) {
  const next = clone(spec);
  let applied = false;
  const assumptions = [];

  if (specNeedsDefaultMagicalBonus(next)) {
    next.magicalBonus = "1";
    applied = true;
    assumptions.push("No magical bonus was supplied; used +1 by default.");
  }

  if (next.save) {
    const repaired = ensureSaveDc(next.save);
    if (Number(repaired.dc) !== Number(next.save?.dc)) {
      next.save = repaired;
      applied = true;
    }
  }

  if (next.conditionOnHit?.save) {
    const repaired = ensureSaveDc(next.conditionOnHit.save);
    if (Number(repaired.dc) !== Number(next.conditionOnHit.save?.dc)) {
      next.conditionOnHit = {
        ...next.conditionOnHit,
        save: repaired
      };
      applied = true;
    }
  }

  for (const listName of ["activities", "saveActivities", "utilityActivities", "attackActivities"]) {
    if (!Array.isArray(next[listName])) continue;
    next[listName] = next[listName].map(activity => {
      if (!activity?.save) return activity;
      const repaired = ensureSaveDc(activity.save);
      if (Number(repaired.dc) === Number(activity.save?.dc)) return activity;
      applied = true;
      return {
        ...activity,
        save: repaired
      };
    });
  }

  if (applied) assumptions.push(`Unspecified save DCs default to ${DEFAULT_SAVE_DC}.`);
  return { applied, spec: next, assumptions: [...new Set(assumptions)] };
}

async function applyDefaultLeveledSpellCharges(spec, request, options = {}) {
  if (!usesSharedCharges(spec, request)) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  let applied = false;
  const assumptions = [];
  const listNames = ["activities", "attackActivities", "saveActivities", "utilityActivities"];

  for (const listName of listNames) {
    const activities = Array.isArray(next[listName]) ? [...next[listName]] : [];
    if (!activities.length) continue;
    const repaired = [];

    for (const activity of activities) {
      const metadata = await spellMetadataForActivity(activity?.activityName, { ...options, request });
      if (!metadata) {
        repaired.push(activity);
        continue;
      }

      const explicitCost = explicitSpellChargeCost(request, metadata.name);
      const desiredCost = explicitCost ?? metadata.level;
      const normalized = clone(activity);
      if (Number(normalized.chargeCost ?? 0) !== desiredCost) {
        normalized.chargeCost = desiredCost;
        applied = true;
      }
      if (metadata.supportsScaling) {
        const scaling = normalized.chargeScaling ?? {};
        if (scaling.allowed !== true || scaling.max !== "@item.uses.value" || scaling.mode !== "amount") {
          normalized.chargeScaling = { allowed: true, max: "@item.uses.value", mode: "amount", formula: "" };
          applied = true;
        }
      }
      repaired.push(normalized);
      if (explicitCost == null && desiredCost === metadata.level) {
        assumptions.push(`${metadata.name} defaults to ${metadata.level} ${metadata.level === 1 ? "charge" : "charges"} because it is a level ${metadata.level} spell.`);
      }
    }

    next[listName] = repaired;
  }

  if (!applied) return { applied: false, spec, assumptions: [] };
  return { applied: true, spec: next, assumptions: [...new Set(assumptions)] };
}

async function repairNamedSrdSpellActivities(spec, request, options = {}) {
  const next = clone(spec);
  let applied = false;
  const assumptions = [];
  const listNames = ["saveActivities", "activities", "attackActivities"];

  for (const listName of listNames) {
    const sourceActivities = Array.isArray(next[listName]) ? [...next[listName]] : [];
    if (!sourceActivities.length) continue;

    const repaired = [];
    for (const activity of sourceActivities) {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) {
        repaired.push(activity);
        continue;
      }
      const metadata = await spellDocumentMetadata(spellProfile.name, options);

      const count = repeatedSpellCount(request, spellProfile.name);
      const missingTemplate = !compactText(activity?.target?.template?.type) || !activity?.target?.template?.size;
      const missingRange = !compactText(activity?.range?.units) && !activity?.range?.value;
      const missingSave = !compactText(activity?.save?.ability) || !activity?.save?.dc;

      if (count > 1) {
        for (let index = 0; index < count; index += 1) {
          const suffix = `${index + 1}/${count}`;
          const normalized = normalizedSpellActivity(activity, spellProfile, count, suffix, metadata, request);
          normalized.activityId = stableId(`${next.name} ${spellProfile.name} ${suffix}`);
          normalized.activityName = `${spellActivityDisplayName(activity, spellProfile.name, request)} ${suffix}`;
          repaired.push(normalized);
        }
        applied = true;
        assumptions.push(`Interpreted repeated ${spellProfile.name} request as ${count} consecutive casts using separate activities.`);
        continue;
      }

      if (missingTemplate || missingRange || missingSave) {
        const normalized = normalizedSpellActivity(activity, spellProfile, 1, "", metadata, request);
        normalized.activityName = spellActivityDisplayName(activity, spellProfile.name, request);
        repaired.push(normalized);
        applied = true;
        assumptions.push(`Applied compatible SRD ${spellProfile.name} targeting details to the generated activity.`);
        continue;
      }

      repaired.push({
        ...activity,
        activityName: spellActivityDisplayName(activity, spellProfile.name, request)
      });
    }

    next[listName] = repaired;
  }

  const sourceUtilities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  if (sourceUtilities.length) {
    const repairedUtilities = [];
    const promotedSaveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
    const promotedAttackActivities = Array.isArray(next.attackActivities) ? [...next.attackActivities] : [];

    for (const activity of sourceUtilities) {
      const spellProfile = spellProfileForActivity(activity?.activityName) ?? spellProfileForActivityOrAlias(activity?.activityName, request);
      if (!spellProfile) {
        repairedUtilities.push(activity);
        continue;
      }

      const metadata = await spellDocumentMetadata(spellProfile.name, options);
      const sourceType = compactText(metadata?.type).toLowerCase() || (spellProfile.save || spellProfile.damageParts?.length ? "save" : "utility");
      const shouldPromoteToSave = sourceType === "save"
        || Boolean(spellProfile.save)
        || Boolean(spellProfile.damageParts?.length);
      const shouldPromoteToAttack = sourceType === "attack" || Boolean(compactText(metadata?.attackType) || compactText(spellProfile.attackType));
      const shouldPromoteToHeal = sourceType === "heal" || Boolean(spellProfile.healing);

      if (shouldPromoteToAttack) {
        promotedAttackActivities.push(normalizedAttackSpellActivity({
          ...activity,
          activityName: spellActivityDisplayName(activity, spellProfile.name, request)
        }, spellProfile, metadata, request));
        assumptions.push(`Promoted ${spellProfile.name} into a structured spell attack using SRD targeting data.`);
        applied = true;
        continue;
      }

      if (shouldPromoteToSave) {
        const count = repeatedSpellCount(request, spellProfile.name);
        if (count > 1) {
          for (let index = 0; index < count; index += 1) {
            const suffix = `${index + 1}/${count}`;
            const normalized = normalizedSpellActivity(activity, spellProfile, count, suffix, metadata, request);
            normalized.activityId = stableId(`${next.name} ${spellProfile.name} ${suffix}`);
            normalized.activityName = `${spellActivityDisplayName(activity, spellProfile.name, request)} ${suffix}`;
            promotedSaveActivities.push(normalized);
          }
          assumptions.push(`Interpreted repeated ${spellProfile.name} request as ${count} consecutive casts using separate activities.`);
        } else {
          const normalized = normalizedSpellActivity(activity, spellProfile, 1, "", metadata, request);
          normalized.activityName = spellActivityDisplayName(activity, spellProfile.name, request);
          promotedSaveActivities.push(normalized);
          assumptions.push(`Promoted ${spellProfile.name} into a structured spell activity using SRD targeting data.`);
        }
        applied = true;
        continue;
      }

      if (shouldPromoteToHeal) {
        repairedUtilities.push(normalizedUtilitySpellActivity({
          ...activity,
          activityName: spellActivityDisplayName(activity, spellProfile.name, request)
        }, spellProfile, metadata, request));
        assumptions.push(`Promoted ${spellProfile.name} into a structured healing activity using SRD targeting data.`);
        applied = true;
        continue;
      }

      const missingTemplate = !compactText(activity?.target?.template?.type) || !activity?.target?.template?.size;
      const missingRange = !compactText(activity?.range?.units) && !activity?.range?.value;
      const missingDuration = !activity?.duration?.units && activity?.duration?.value == null;
      if (missingTemplate || missingRange || missingDuration) {
        repairedUtilities.push(normalizedUtilitySpellActivity({
          ...activity,
          activityName: spellActivityDisplayName(activity, spellProfile.name, request)
        }, spellProfile, metadata, request));
        assumptions.push(`Applied compatible SRD ${spellProfile.name} utility targeting details to the generated activity.`);
        applied = true;
        continue;
      }

      repairedUtilities.push({
        ...activity,
        activityName: spellActivityDisplayName(activity, spellProfile.name, request)
      });
    }

    next.utilityActivities = repairedUtilities;
    next.saveActivities = promotedSaveActivities;
    next.attackActivities = promotedAttackActivities;
  }

  if (!applied) return { applied: false, spec };
  return {
    applied: true,
    spec: next,
    assumptions: [...new Set(assumptions)]
  };
}

async function autoSelectSrdChoiceSpells(spec, request, options = {}) {
  const requestedCount = requestedSpellChoiceCount(request);
  if (requestedCount < 1) return { applied: false, spec };
  if (!ACTIVITY_CAPABLE_KINDS.has(spec?.kind)) return { applied: false, spec };
  if (hasExplicitSpellActivities(spec)) return { applied: false, spec };

  const tags = inferDamageTags(request, spec);
  const resolveSpell = options.resolveSpell;
  if (typeof resolveSpell !== "function") throw new Error("autoSelectSrdChoiceSpells requires a resolveSpell function.");

  const chosen = [];
  for (const profile of rankedSpellProfiles(tags)) {
    const resolution = await resolveSpell(profile.name);
    if (resolution?.status !== "compatible") continue;
    const metadata = await spellDocumentMetadata(profile.name, options);
    chosen.push({ profile, resolution, metadata });
    if (chosen.length >= requestedCount) break;
  }

  if (chosen.length !== requestedCount) {
    return {
      applied: false,
      spec,
      warning: `Unable to find ${requestedCount} compatible SRD spell${requestedCount === 1 ? "" : "s"} for automatic selection.`
    };
  }

  const next = clone(spec);
  next.uses = next.uses ?? { max: parseChargeMax(request), recovery: [], autoDestroy: false };
  if (!String(next.uses?.max ?? "").trim()) next.uses.max = parseChargeMax(request);
  next.saveActivities = [
    ...(Array.isArray(next.saveActivities) ? next.saveActivities : []),
    ...chosen.map(({ profile }) => buildSaveActivity(next.name, profile, null, request))
  ];
  next.saveActivities = next.saveActivities.map(activity => {
    const spellName = activitySpellName(activity.activityName);
    const chosenEntry = chosen.find(entry => entry.profile.name === spellName);
    return chosenEntry ? buildSaveActivity(next.name, chosenEntry.profile, chosenEntry.metadata, request) : activity;
  });
  next.systemReferences = [
    ...(Array.isArray(next.systemReferences) ? next.systemReferences : []),
    ...chosen.map(({ profile, resolution }) => ({
      kind: "spell",
      name: profile.name,
      label: "System spell",
      uuid: resolution.match.uuid,
      packLabel: resolution.match.pack.label,
      documentType: resolution.match.documentType,
      message: `${profile.name} from ${resolution.match.pack.label}`
    }))
  ];
  if (Array.isArray(next.unresolvedMechanics)) {
    next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => !isSpellChoiceMechanic(mechanic));
    if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  }

  return {
    applied: true,
    spec: next,
    chosenSpells: chosen.map(({ profile }) => profile.name),
    assumption: `Selected compatible SRD spells automatically: ${chosen.map(({ profile }) => profile.name).join(", ")}.`
  };
}

export {
  SPELL_LIBRARY,
  applyForgeSpecDefaults,
  applyDefaultLeveledSpellCharges,
  autoSelectSrdChoiceSpells,
  dedupeRecognizedSpellActivities,
  inferDamageTags,
  localSpellProfileByName,
  parseChargeMax,
  reconcilePlannedSrdSpellActivities,
  repairNamedSrdSpellActivities,
  requestedSpellChoiceCount
};
