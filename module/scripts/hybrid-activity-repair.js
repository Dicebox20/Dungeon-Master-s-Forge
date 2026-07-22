import { extractNamedSrdSummon, genericSrdSummonActor, namedSrdSummonActor } from "./srd-summon-profiles.js";

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

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(value => compactText(value)).filter(Boolean))];
}

function normalizeMagicalBonusText(value) {
  const normalized = compactText(value);
  if (!normalized) return "";
  if (/^(?:true|false|null|undefined|nan)$/i.test(normalized)) return "";
  if (!/^[+-]?\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return "";
    return String(Math.trunc(numeric));
  }
  const unsigned = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  return unsigned === "-0" ? "0" : unsigned;
}

function parseDiceExpression(value) {
  const text = compactText(value);
  if (!text) return null;
  const match = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i.exec(text);
  if (!match) return null;
  const sign = match[3] === "-" ? -1 : 1;
  return {
    number: Number(match[1]),
    denomination: Number(match[2]),
    bonus: match[4] ? String(sign * Number(match[4])) : "",
    types: []
  };
}

const QUARTERSTAFF_BASE = Object.freeze({
  weaponType: "simpleM",
  baseItem: "quarterstaff",
  damage: {
    base: Object.freeze({ number: 1, denomination: 6, bonus: "@mod", types: Object.freeze(["bludgeoning"]) }),
    versatile: Object.freeze({ number: 1, denomination: 8, bonus: "@mod", types: Object.freeze(["bludgeoning"]) })
  },
  properties: Object.freeze(["mgc", "ver"])
});

const KNOWN_WEAPON_BASES = Object.freeze([
  Object.freeze({ pattern: /\btrident\b/i, weaponType: "martialM", baseItem: "trident", damage: Object.freeze({ base: Object.freeze({ number: 1, denomination: 6, bonus: "@mod", types: Object.freeze(["piercing"]) }), versatile: Object.freeze({ number: 1, denomination: 8, bonus: "@mod", types: Object.freeze(["piercing"]) }) }), properties: Object.freeze(["mgc", "thr", "ver"]), range: Object.freeze({ value: 20, long: 60, reach: 5, units: "ft" }) })
]);

const SPELL_PROFILES = Object.freeze([
  Object.freeze({
    name: "Poison Spray",
    type: "save",
    defaultChargeCost: 1,
    save: Object.freeze({ ability: "con" }),
    damageOnSave: "none",
    damageParts: Object.freeze([{ number: 1, denomination: 12, bonus: "", types: Object.freeze(["poison"]) }]),
    range: Object.freeze({ value: 30, units: "ft" }),
    target: Object.freeze({ affects: { count: "1", type: "creature", special: "One creature within range" }, prompt: true }),
    chatFlavor: "Cast Poison Spray using this item's charges."
  }),
  Object.freeze({
    name: "Ray of Sickness",
    type: "attack",
    defaultChargeCost: 1,
    attackType: "ranged",
    attackClassification: "spell",
    damageParts: Object.freeze([{ number: 2, denomination: 8, bonus: "", types: Object.freeze(["poison"]) }]),
    range: Object.freeze({ value: 60, units: "ft" }),
    target: Object.freeze({ affects: { count: "1", type: "creature", special: "One creature within range" }, prompt: true }),
    chatFlavor: "Cast Ray of Sickness using this item's charges."
  }),
  Object.freeze({
    name: "Command",
    type: "save",
    defaultChargeCost: 1,
    save: Object.freeze({ ability: "wis" }),
    damageOnSave: "none",
    damageParts: Object.freeze([]),
    range: Object.freeze({ value: 60, units: "ft" }),
    target: Object.freeze({ affects: { count: "1", type: "creature" }, prompt: true }),
    duration: Object.freeze({ value: 1, units: "round", concentration: false }),
    chatFlavor: "The target makes the Command spell's Wisdom saving throw."
  }),
  Object.freeze({
    name: "Shatter",
    type: "save",
    defaultChargeCost: 2,
    save: Object.freeze({ ability: "con" }),
    damageOnSave: "half",
    damageParts: Object.freeze([{ number: 3, denomination: 8, bonus: "", types: Object.freeze(["thunder"]) }]),
    range: Object.freeze({ value: 60, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "sphere", size: 10, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 10-foot-radius sphere" },
      prompt: true
    }),
    chatFlavor: "Cast Shatter using this item's charges."
  }),
  Object.freeze({
    name: "Tidal Wave",
    type: "save",
    defaultChargeCost: 3,
    save: Object.freeze({ ability: "dex" }),
    damageOnSave: "half",
    damageParts: Object.freeze([{ number: 4, denomination: 8, bonus: "", types: Object.freeze(["bludgeoning"]) }]),
    range: Object.freeze({ value: 120, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "line", size: 30, width: 10, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 30-foot-long, 10-foot-wide area" },
      prompt: true
    }),
    chatFlavor: "Cast Tidal Wave using this item's charges."
  }),
  Object.freeze({
    name: "Fireball",
    type: "save",
    defaultChargeCost: 3,
    save: Object.freeze({ ability: "dex" }),
    damageOnSave: "half",
    damageParts: Object.freeze([{ number: 8, denomination: 6, bonus: "", types: Object.freeze(["fire"]) }]),
    range: Object.freeze({ value: 150, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "sphere", size: 20, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius sphere" },
      prompt: true
    }),
    chatFlavor: "Cast Fireball using this item's charges."
  }),
  Object.freeze({
    name: "Flame Strike",
    type: "save",
    defaultChargeCost: 5,
    save: Object.freeze({ ability: "dex" }),
    damageOnSave: "half",
    damageParts: Object.freeze([
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["fire"]) },
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["radiant"]) }
    ]),
    range: Object.freeze({ value: 60, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "cylinder", size: 10, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 10-foot-radius, 40-foot-high cylinder" },
      prompt: true
    }),
    chatFlavor: "Call down Flame Strike from this item."
  }),
  Object.freeze({
    name: "Moonbeam",
    type: "save",
    defaultChargeCost: 2,
    save: Object.freeze({ ability: "con" }),
    damageOnSave: "half",
    damageParts: Object.freeze([{ number: 2, denomination: 10, bonus: "", types: Object.freeze(["radiant"]) }]),
    range: Object.freeze({ value: 120, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "cylinder", size: 5, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 5-foot-radius, 40-foot-high cylinder" },
      prompt: true
    }),
    duration: Object.freeze({ value: 1, units: "minute", concentration: true }),
    chatFlavor: "Call down a shaft of moonlight using this item's charges."
  }),
  Object.freeze({
    name: "Fog Cloud",
    type: "utility",
    defaultChargeCost: 1,
    range: Object.freeze({ value: 120, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "sphere", size: 20, units: "ft" },
      affects: { type: "space", special: "A 20-foot-radius sphere of fog" },
      prompt: true
    }),
    duration: Object.freeze({ value: 1, units: "hour", concentration: true }),
    chatFlavor: "Create a bank of obscuring fog."
  }),
  Object.freeze({
    name: "Detect Thoughts",
    type: "utility",
    defaultChargeCost: 2,
    range: Object.freeze({ units: "self" }),
    target: Object.freeze({
      affects: { count: "1", type: "self", special: "Self" },
      prompt: false
    }),
    duration: Object.freeze({ value: 1, units: "minute", concentration: true }),
    chatFlavor: "Cast Detect Thoughts using this item's charges."
  }),
  Object.freeze({
    name: "Misty Step",
    type: "utility",
    defaultChargeCost: 2,
    range: Object.freeze({ value: 30, units: "ft" }),
    target: Object.freeze({
      affects: { count: "1", type: "space", special: "An unoccupied space you can see within range" },
      prompt: true
    }),
    duration: Object.freeze({ units: "inst", concentration: false }),
    chatFlavor: "Briefly surrounded by silvery mist, you teleport."
  }),
  Object.freeze({
    name: "Cloudkill",
    type: "save",
    defaultChargeCost: 5,
    save: Object.freeze({ ability: "con" }),
    damageOnSave: "half",
    damageParts: Object.freeze([{ number: 5, denomination: 8, bonus: "", types: Object.freeze(["poison"]) }]),
    range: Object.freeze({ value: 120, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "sphere", size: 20, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius sphere" },
      prompt: true
    }),
    duration: Object.freeze({ value: 10, units: "minute", concentration: true }),
    chatFlavor: "Cast Cloudkill using this item's charges."
  })
]);

const SPELL_PROFILE_BY_NAME = new Map(SPELL_PROFILES.map(profile => [profile.name.toLowerCase(), profile]));
const SUITE_KINDS = new Set(["casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite", "artifactWeaponHybrid", "multiActivityStaff"]);
const PASSIVE_KINDS = new Set(["passiveEffectEquipment", "shieldArmorBonus"]);
const DIRECT_WEAPON_KINDS = new Set(["weaponExtraDamage", "weaponConditionOnHit"]);
const CONDITION_STATUSES = new Set(["blinded", "charmed", "deafened", "frightened", "paralyzed", "poisoned", "prone", "restrained", "stunned", "unconscious"]);
const DAMAGE_RESISTANCE_TYPES = Object.freeze(["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"]);

function spellProfileByName(name) {
  return SPELL_PROFILE_BY_NAME.get(compactText(name).toLowerCase()) ?? null;
}

function spellProfileForActivityName(name) {
  return spellProfileByName(compactText(name).replace(/^cast\s+/i, ""));
}

function rangeFromFeet(text, fallback = null) {
  const raw = compactText(text).match(/\bwithin\s+(\d+)\s*(?:foot|feet|ft\.?)\b/i)?.[1];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return { value, units: "ft" };
}

function parseLightRange(text) {
  const source = compactText(text);
  const direct = source.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)(?:\s+|-)(?:[\w-]+(?:\s+|-)){0,2}?(?:cone|cube|line|radius|sphere|cylinder)\b/i)?.[1];
  if (direct) return Number(direct);
  const radius = source.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)(?:\s+|-)radius\b/i)?.[1];
  return radius ? Number(radius) : null;
}

function hasEffectChange(spec, key) {
  return ["effects", "passiveEffects"].some(listName =>
    Array.isArray(spec?.[listName])
    && spec[listName].some(effect => Array.isArray(effect?.changes)
      && effect.changes.some(change => change?.key === key))
  );
}

function explicitAcBonus(text) {
  const value = Number(compactText(text).match(/\+\s*(\d+)\s+(?:to\s+)?ac\b/i)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function explicitDarkvisionRange(text) {
  const source = compactText(text);
  const value = Number(
    source.match(/\bdarkvision(?:\s+(?:out\s+to|of|within))?\s+(\d+)\s*(?:foot|feet|ft\.?)\b/i)?.[1]
    ?? source.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+darkvision\b/i)?.[1]
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

function repairExplicitAttunement(spec, request) {
  const text = compactText(request);
  if (!/\b(?:does|do)(?:\s+not|n't)\s+(?:need|require)\s+attunement\b|\bno\s+attunement(?:\s+needed)?\b/i.test(text)) {
    return { applied: false, spec, assumptions: [] };
  }
  if (!compactText(spec?.attunement)) return { applied: false, spec, assumptions: [] };
  return {
    applied: true,
    spec: { ...clone(spec), attunement: "" },
    assumptions: ["Applied the request's explicit no-attunement requirement."]
  };
}

function defaultMultiPropertyAttunement(spec, request) {
  const text = compactText(request);
  if (compactText(spec?.attunement) || /\b(?:does|do)(?:\s+not|n't)\s+(?:need|require)\s+attunement\b|\bno\s+attunement(?:\s+needed)?\b/i.test(text)) {
    return { applied: false, spec, assumptions: [] };
  }
  const hasActivePower = ["activities", "attackActivities", "saveActivities", "utilityActivities"]
    .some(listName => (spec[listName] ?? []).some(activity => {
      const name = compactText(activity?.activityName ?? activity?.name);
      return name && !/^attack with\b/i.test(name) && !/^[a-z]+\s+attack$/i.test(name);
    }));
  const propertyGroups = [
    Number(spec?.magicalBonus) > 0,
    Array.isArray(spec?.extraDamageParts) && spec.extraDamageParts.length > 0,
    Boolean(spec?.conditionOnHit),
    Array.isArray(spec?.effects) && spec.effects.length > 0,
    Array.isArray(spec?.passiveEffects) && spec.passiveEffects.length > 0,
    Array.isArray(spec?.enchantChanges) && spec.enchantChanges.length > 0,
    Boolean(spec?.toggleLight),
    Boolean(spec?.healing),
    Boolean(spec?.summonActor) || (Array.isArray(spec?.summonProfiles) && spec.summonProfiles.length > 0),
    hasActivePower
  ].filter(Boolean).length;
  if (propertyGroups < 2) return { applied: false, spec, assumptions: [] };
  return {
    applied: true,
    spec: { ...clone(spec), attunement: "required" },
    assumptions: ["Defaulted attunement to required because the item has multiple magical property groups."]
  };
}

const SKILL_IDS = new Map([
  ["acrobatics", "acr"], ["animal handling", "ani"], ["arcana", "arc"],
  ["athletics", "ath"], ["deception", "dec"], ["history", "his"],
  ["insight", "ins"], ["intimidation", "itm"], ["investigation", "inv"],
  ["medicine", "med"], ["nature", "nat"], ["perception", "prc"],
  ["performance", "prf"], ["persuasion", "per"], ["religion", "rel"],
  ["sleight of hand", "slt"], ["stealth", "ste"], ["survival", "sur"]
]);

function repairRequestedSkillAdvantage(spec, request) {
  const match = compactText(request).match(/\badvantage\s+on\s+(?:(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*)?\(?([A-Za-z ]+?)\)?\s+checks?\b/i);
  const skillId = SKILL_IDS.get(compactText(match?.[1]).toLowerCase());
  if (!skillId) {
    return { applied: false, spec, assumptions: [] };
  }
  const next = clone(spec);
  next.effects = Array.isArray(next.effects) ? next.effects.filter(Boolean) : [];
  const effect = next.effects[0] ?? {
    effectId: stableId(`${next.name} Skill`),
    name: `${next.name} Skill`,
    changes: []
  };
  const canonicalKey = `system.skills.${skillId}.roll.mode`;
  const changes = Array.isArray(effect.changes)
    ? effect.changes.filter(change => {
      const key = compactText(change?.key);
      if (key === canonicalKey) return true;
      if (!key.startsWith("system.skills.")) return true;
      return !/\.(?:adv|advantage|bonuses\.check)$/.test(key) && !/advantage/i.test(compactText(change?.value));
    })
    : [];
  const hasCorrectChange = changes.some(change => compactText(change?.key) === canonicalKey);
  if (!hasCorrectChange) changes.push({ key: canonicalKey, mode: "ADD", value: "1" });
  effect.changes = changes;
  next.effects[0] = effect;
  return {
    applied: !hasCorrectChange || next.attunement !== spec?.attunement,
    spec: next,
    assumptions: hasCorrectChange ? [] : ["Normalized skill advantage to the DND5e 5.x roll-mode field."]
  };
}

function repairRequestedDarkvision(spec, request) {
  const distance = explicitDarkvisionRange(request);
  if (!distance || !["passiveEffectEquipment", "casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite"].includes(spec?.kind)) {
    return { applied: false, spec, assumptions: [] };
  }
  const next = clone(spec);
  next.effects = Array.isArray(next.effects) ? next.effects.filter(Boolean) : [];
  const effect = next.effects[0] ?? {
    effectId: stableId(`${next.name} Darkvision`),
    name: `${next.name} Darkvision`,
    changes: []
  };
  const malformedKeys = new Set([
    "system.attributes.darkvision.enabled",
    "system.attributes.darkvision.distance",
    "system.attributes.senses.darkvision"
  ]);
  const canonicalKey = "system.attributes.senses.ranges.darkvision";
  const changes = Array.isArray(effect.changes)
    ? effect.changes.filter(change => !malformedKeys.has(compactText(change?.key)))
    : [];
  const existing = changes.find(change => compactText(change?.key) === canonicalKey);
  if (existing) {
    existing.mode = "ADD";
    existing.value = String(distance);
  } else {
    changes.push({ key: canonicalKey, mode: "ADD", value: String(distance) });
  }
  effect.changes = changes;
  next.effects[0] = effect;
  return {
    applied: !existing || JSON.stringify(next.effects) !== JSON.stringify(spec.effects),
    spec: next,
    assumptions: existing ? [] : [`Recovered the explicit ${distance}-foot darkvision passive effect from the request text.`]
  };
}

function repairGenericSummonProfileActors(spec, request) {
  if (!Array.isArray(spec?.summonProfiles) || spec.summonProfiles.length < 2) return { applied: false, spec, assumptions: [] };
  const requestText = compactText(request).toLowerCase();
  const next = clone(spec);
  let repaired = 0;
  next.summonProfiles = next.summonProfiles.map(profile => {
    const profileName = compactText(profile?.profileName);
    const actorName = compactText(profile?.actor?.name).replace(/^friendly\s+/i, "");
    const srdName = compactText(profile?.actor?.srdActorName);
    const generic = value => !value
      || /^(?:one )?(?:friendly )?(?:beast|creature|companion|summoned ally)$/.test(value.toLowerCase())
      || /^profile when you use the item$/.test(value.toLowerCase())
      || /^(?:one )?friendly .+\s+or\s+.+$/.test(value.toLowerCase());
    if (!profileName || !requestText.includes(profileName.toLowerCase()) || (!generic(actorName) && !generic(srdName))) return profile;
    repaired += 1;
    return { ...profile, actor: genericSrdSummonActor(profileName) };
  });
  return {
    applied: repaired > 0,
    spec: next,
    assumptions: repaired ? ["Replaced generic summon actors with the explicitly named selectable SRD profiles."] : []
  };
}

function repairRequestedSpellcastingBonuses(spec, request) {
  const match = compactText(request).match(/\+(\d+)\s+to\s+spell\s+attack(?:\s+roll)?s?\s+and\s+spell\s+save\s+DC\b/i);
  if (!match) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.effects = Array.isArray(next.effects) ? next.effects.filter(Boolean) : [];
  const effect = next.effects[0] ?? {
    effectId: stableId(`${next.name} Spellcasting`),
    name: `${next.name} Spellcasting`,
    changes: []
  };
  const requestedValue = String(Number(match[1]));
  const supportedKeys = [
    "system.bonuses.msak.attack",
    "system.bonuses.rsak.attack",
    "system.bonuses.spell.dc"
  ];
  const replacedKeys = new Set([
    "system.attributes.spelldc",
    "system.attributes.spell.dc",
    "system.bonuses.spelldc"
  ]);
  const original = Array.isArray(effect.changes) ? effect.changes.filter(Boolean) : [];
  const changes = original.filter(change => !replacedKeys.has(compactText(change?.key)));
  let changed = changes.length !== original.length;
  for (const key of supportedKeys) {
    const existing = changes.find(change => compactText(change?.key) === key);
    if (existing) {
      if (compactText(existing.value) !== requestedValue || compactText(existing.mode).toUpperCase() !== "ADD") {
        existing.mode = "ADD";
        existing.value = requestedValue;
        changed = true;
      }
    } else {
      changes.push({ key, mode: "ADD", value: requestedValue });
      changed = true;
    }
  }
  effect.changes = changes;
  next.effects[0] = effect;
  return {
    applied: changed,
    spec: next,
    assumptions: changed ? ["Normalized generic spellcasting bonuses to DND5e melee/ranged spell attacks and spell save DC fields."] : []
  };
}

function repairNativeEnchantDamage(spec, request) {
  if (spec?.kind !== "nativeEnchant") return { applied: false, spec, assumptions: [] };
  const parts = parseDamageParts(request);
  if (!parts.length) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.enchantChanges = Array.isArray(next.enchantChanges) ? next.enchantChanges.filter(Boolean) : [];
  const expected = parts[0];
  const matchingDamageChange = next.enchantChanges.find(change => {
    if (compactText(change?.key) !== "system.damage.parts") return false;
    const value = change?.value?.damage ?? change?.value;
    if (value && typeof value === "object") {
      const types = Array.isArray(value.types) ? value.types.map(type => compactText(type).toLowerCase()) : [];
      return Number(value.number) === expected.number
        && Number(value.denomination) === expected.denomination
        && types.includes(expected.types[0]);
    }
    const text = compactText(value).toLowerCase();
    return text.includes(`${expected.number}d${expected.denomination}`)
      && text.includes(expected.types[0]);
  });
  if (!matchingDamageChange) {
    next.enchantChanges = next.enchantChanges.filter(change => compactText(change?.key) !== "system.damage.parts");
    next.enchantChanges.push({ key: "system.damage.parts", mode: "ADD", value: expected });
  }
  next.unresolvedMechanics = (next.unresolvedMechanics ?? []).filter(mechanic => {
    const text = `${compactText(mechanic?.category)} ${compactText(mechanic?.label)} ${compactText(mechanic?.reason)}`;
    return !/weapon damage rider|enchantment rider|weapon enchantment timing|application workflow/i.test(text);
  });
  return {
    applied: !matchingDamageChange,
    spec: next,
    assumptions: matchingDamageChange ? [] : ["Recovered the enchantment's typed damage rider from the request text."]
  };
}

function explicitToggleLight(name, text) {
  const source = compactText(text);
  if (!/\b(?:ignite|extinguish)\b/i.test(source) || !/\bbright\s+light\b/i.test(source)) return null;
  const brightMatch = source.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?bright\s+light|\bbright\s+light\s+(?:for|out\s+to)\s+(\d+)\s*[- ]?(?:foot|feet|ft\.?)/i);
  const bright = Number(brightMatch?.[1] ?? brightMatch?.[2]);
  if (!Number.isFinite(bright) || bright <= 0) return null;
  const dimMatch = source.match(/\b(additional\s+)?(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?dim\s+light|\bdim\s+light\s+(?:for|out\s+to)\s+(additional\s+)?(\d+)\s*(?:more\s+)?(?:foot|feet|ft\.?)/i);
  const dimValue = Number(dimMatch?.[2] ?? dimMatch?.[4] ?? 0);
  const additionalDim = Boolean(dimMatch?.[1] ?? dimMatch?.[3]) || /\bdim\s+light\s+for\s+\d+\s+more\s+(?:foot|feet|ft\.?)\b/i.test(source);
  const dim = Number.isFinite(dimValue) && dimValue > 0
    ? (additionalDim ? bright + dimValue : Math.max(bright, dimValue))
    : bright;
  return {
    activityId: stableId(`${name} Ignite`),
    activityName: "Ignite the Flame",
    activityImg: "icons/magic/fire/flame-burning-campfire-orange.webp",
    activationType: inferActivationType(source),
    effectId: stableId(`${name} Light`),
    effectName: `${name} Ignited`,
    effectImg: "icons/magic/fire/flame-burning-campfire-orange.webp",
    flagKey: `${stableId(name)}Light`,
    bright,
    dim,
    color: "#ff7a18",
    alpha: 0.35,
    animation: { type: "torch", speed: 3, intensity: 4 },
    onChat: `${name} ignites, shedding bright light for ${bright} feet and dim light to ${dim} feet.`,
    offChat: `${name}'s light fades.`,
    chatFlavor: `Toggle ${name}'s light.`,
    duration: { value: 10, units: "minute" },
    range: { units: "self" },
    target: { affects: { count: "1", type: "self" }, prompt: false }
  };
}

function recoverArtifactPassiveFeatures(spec, request) {
  if (spec?.kind !== "artifactWeaponHybrid") return { applied: false, spec, assumptions: [] };
  const next = clone(spec);
  const assumptions = [];
  next.passiveEffects = Array.isArray(next.passiveEffects) ? [...next.passiveEffects] : [];

  const genericEffects = Array.isArray(next.effects) ? next.effects : [];
  const transferableEffects = genericEffects.filter(effect => Array.isArray(effect?.changes) && effect.changes.length);
  let promotedEffects = 0;
  for (const effect of transferableEffects) {
    const alreadyPresent = next.passiveEffects.some(candidate =>
      JSON.stringify(candidate?.changes ?? []) === JSON.stringify(effect.changes ?? [])
    );
    if (alreadyPresent) continue;
    next.passiveEffects.push(effect);
    promotedEffects += 1;
  }
  if (transferableEffects.length) {
    next.effects = genericEffects.filter(effect => !transferableEffects.includes(effect));
    if (!next.effects.length) delete next.effects;
  }
  if (promotedEffects) assumptions.push("Promoted generic passive effects into the artifact weapon renderer.");

  const acBonus = explicitAcBonus(request);
  if (acBonus && !hasEffectChange(next, "system.attributes.ac.bonus")) {
    next.passiveEffects.push({
      effectId: stableId(`${next.name} Guard`),
      name: `${next.name} Guard`,
      changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: String(acBonus) }]
    });
    assumptions.push(`Recovered the explicit +${acBonus} AC passive effect from the request text.`);
  }

  const darkvision = explicitDarkvisionRange(request);
  if (darkvision && !hasEffectChange(next, "system.attributes.senses.ranges.darkvision")) {
    next.passiveEffects.push({
      effectId: stableId(`${next.name} Darkvision`),
      name: `${next.name} Darkvision`,
      changes: [{ key: "system.attributes.senses.ranges.darkvision", mode: "ADD", value: String(darkvision) }]
    });
    assumptions.push(`Recovered the explicit ${darkvision}-foot darkvision passive effect from the request text.`);
  }

  if (!next.toggleLight) {
    const toggleLight = explicitToggleLight(next.name, request);
    if (toggleLight) {
      next.toggleLight = toggleLight;
      assumptions.push("Recovered the explicit ignite/light activity from the request text.");
    }
  }

  if (!assumptions.length) return { applied: false, spec, assumptions };
  return { applied: true, spec: next, assumptions };
}

function parseTemplateTarget(text) {
  const source = compactText(text);
  const size = parseLightRange(source);
  if (!size) return null;
  if (/\bcone\b/i.test(source)) {
    return {
      range: rangeFromFeet(source, { units: "self" }),
      target: {
        template: { count: "1", type: "cone", size, units: "ft" },
        affects: { type: "creature", special: `Creatures in the ${size}-foot cone` },
        prompt: true
      }
    };
  }
  if (/\bcube\b/i.test(source)) {
    return {
      range: rangeFromFeet(source, { units: "self" }),
      target: {
        template: { count: "1", type: "cube", size, units: "ft" },
        affects: { type: "creature", special: `Creatures in the ${size}-foot cube` },
        prompt: true
      }
    };
  }
  if (/\bline\b/i.test(source)) {
    const width = Number(source.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+wide\b/i)?.[1] ?? 5);
    return {
      range: rangeFromFeet(source, { units: "self" }),
      target: {
        template: { count: "1", type: "line", size, width, units: "ft" },
        affects: { type: "creature", special: `Creatures in the ${size}-foot line` },
        prompt: true
      }
    };
  }
  if (/\bsphere|radius\b/i.test(source)) {
    return {
      range: rangeFromFeet(source, { value: 60, units: "ft" }),
      target: {
        template: { count: "1", type: "sphere", size, units: "ft" },
        affects: { type: "creature", special: `Creatures in the ${size}-foot-radius sphere` },
        prompt: true
      }
    };
  }
  if (/\bcylinder\b/i.test(source)) {
    const height = Number(source.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+high\b/i)?.[1] ?? 40);
    return {
      range: rangeFromFeet(source, { value: 60, units: "ft" }),
      target: {
        template: { count: "1", type: "cylinder", size, height, units: "ft" },
        affects: { type: "creature", special: `Creatures in the ${size}-foot-radius, ${height}-foot-high cylinder` },
        prompt: true
      }
    };
  }
  return null;
}

function inferSaveAbility(text, fallback = "dex") {
  const match = compactText(text).match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+sav(?:e|ing throw)/i);
  if (!match) return fallback;
  const key = match[1].slice(0, 3).toLowerCase();
  return key === "int" ? "int" : key === "wis" ? "wis" : key === "cha" ? "cha" : key === "str" ? "str" : key === "con" ? "con" : "dex";
}

function inferSaveDc(text, fallback = null) {
  const match = compactText(text).match(/\bdc\s*(\d+)\b/i);
  return match ? Number(match[1]) : fallback;
}

function inferConditionDurationSeconds(text) {
  const source = compactText(text);
  if (/\b(?:start|end) of (?:your|the wielder'?s?) next turn\b/i.test(source)) return 6;
  const seconds = Number(source.match(/\b(\d+)\s+seconds?\b/i)?.[1]);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const rounds = Number(source.match(/\b(\d+)\s+rounds?\b/i)?.[1]);
  if (Number.isFinite(rounds) && rounds > 0) return rounds * 6;
  return 30;
}

function inferChargeCost(text, pattern, fallback = "") {
  const source = compactText(text);
  const matches = Array.from(source.matchAll(new RegExp(`(?:(?:spend|expend|use|burn)\\s+)?(\\d+)\\s*charges?[^.]{0,160}${pattern}`, "ig")));
  const match = matches.at(-1);
  return match ? Number(match[1]) : fallback;
}

function inferCastChargeCost(text, spellName, fallback = "") {
  const escaped = spellName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const direct = compactText(text).match(new RegExp(`(?:spend\\s+)?(\\d+)\\s*charges?\\s+to\\s+cast\\s+${escaped}\\b`, "i"))?.[1];
  if (direct) return Number(direct);
  return inferChargeCost(text, `(?:to\\s+)?cast\\s+${escaped}\\b`, fallback);
}

function castActivityName(name) {
  return compactText(name).replace(/^cast\s+/i, "");
}

function inferSummonChargeCost(text, creatureLabel, fallback = "") {
  const escaped = creatureLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const direct = compactText(text).match(new RegExp(`(?:(?:spend|burn)\\s+)?(\\d+)\\s*charges?\\s+to\\s+(?:summon|conjure|call\\s+(?:forth|in))\\s+[^.]*${escaped}\\b`, "i"))?.[1];
  if (direct) return Number(direct);
  return inferChargeCost(text, `\\b${escaped}\\b`, fallback);
}

function inferDuration(text, fallback = { value: 1, units: "hour", concentration: false }) {
  const source = compactText(text);
  const match = /\b(\d+)\s*(round|minute|hour|day)s?\b/i.exec(source);
  if (!match) return clone(fallback);
  return {
    value: Number(match[1]),
    units: `${match[2]}${Number(match[1]) === 1 ? "" : "s"}`.replace(/s$/, ""),
    concentration: /\bconcentration\b/i.test(source)
  };
}

function inferActivationType(text) {
  if (/\bbonus action\b/i.test(text)) return "bonus";
  if (/\breaction\b/i.test(text)) return "reaction";
  return "action";
}

function isGenericUtilityName(name) {
  return /^utility\s+\d+$/i.test(compactText(name));
}

function isGenericSaveName(name) {
  return /^save\s+\d+$/i.test(compactText(name));
}

function isPlaceholderSaveName(name) {
  const normalized = compactText(name);
  return isGenericSaveName(normalized) || /^(?:triggered power|secondary effect|breath weapon)$/i.test(normalized);
}

function hasNamedActivity(spec, name) {
  const normalized = compactText(name).toLowerCase();
  return [
    ...(spec.attackActivities ?? []),
    ...(spec.saveActivities ?? []),
    ...(spec.utilityActivities ?? [])
  ].some(activity => compactText(activity?.activityName).toLowerCase() === normalized);
}

function hasNamedSpellActivity(spec, spellName) {
  const normalized = compactText(spellName).toLowerCase();
  return [
    ...(spec.attackActivities ?? []),
    ...(spec.saveActivities ?? []),
    ...(spec.utilityActivities ?? [])
  ].some(activity => {
    const activityName = compactText(activity?.activityName).toLowerCase();
    return activityName === normalized
      || activityName === `cast ${normalized}`
      || activityName.startsWith(`cast ${normalized} (`);
  });
}

function shouldTreatAsStaffWeapon(text) {
  return /\bquarterstaff\b/i.test(text) || (/\bstaff\b/i.test(text) && !/\bwand\b/i.test(text) && !/\brod\b/i.test(text));
}

function splitClauses(text) {
  return compactText(text)
    .split(/(?<=[.;])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function firstMatchingClause(text, pattern, fallback = "") {
  return splitClauses(text).find(clause => pattern.test(clause)) ?? compactText(fallback || text);
}

function spellClause(text, spellName) {
  const escaped = spellName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return firstMatchingClause(text, new RegExp(`\\b${escaped}\\b`, "i"), text);
}

function healingClause(text) {
  return splitClauses(text).find(clause => /\b(?:restore|regain|heal)\b[^.]*\b(?:hit points?|hp)\b/i.test(clause)) ?? "";
}

function summonClause(text) {
  return firstMatchingClause(text, /\b(?:summon|summons|summoned|summoning|conjure|conjures|call forth|calls forth|call in|calls in)\b/i, text);
}

function attackClause(text) {
  return firstMatchingClause(text, /\b(?:melee|ranged)\s+spell attack\b/i, text);
}

function enchantClause(text) {
  return firstMatchingClause(text, /\b(?:enchant|imbue|apply it to|one nonmagical weapon|becomes magical)\b/i, text);
}

function saveDamageClause(text) {
  const clauses = splitClauses(text);
  return clauses.find(clause => (
    /\bdamage\b/i.test(clause)
    && /\b(?:saving throw|dc\s*\d+|exhale|cone|cube|line|sphere|radius|cylinder)\b/i.test(clause)
  )) ?? compactText(text);
}

function firstDiceInText(text) {
  return parseDiceExpression(compactText(text).match(/\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?/i)?.[0] ?? "");
}

function parseDamageParts(text) {
  const matches = Array.from(compactText(text).matchAll(/(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)(?:\s+or\s+([a-z]+))?\s+damage/ig));
  const parts = [];
  for (const match of matches) {
    const dice = parseDiceExpression(match[1]);
    const primaryType = compactText(match[2]);
    if (!dice || !primaryType) continue;
    parts.push({ ...dice, types: [primaryType] });
  }
  return parts;
}

function defaultMagicalBonus(spec) {
  const current = normalizeMagicalBonusText(spec?.magicalBonus);
  if (current && current !== "0") return false;
  return Boolean(
    spec?.weaponType
    || spec?.damage?.base
    || Number(spec?.armorValue ?? 0) > 0
    || compactText(spec?.equipmentType).toLowerCase() === "shield"
    || compactText(spec?.baseItem).toLowerCase() === "shield"
  );
}

function reroutePassiveKind(spec, request) {
  if (!PASSIVE_KINDS.has(spec?.kind)) return { applied: false, spec };
  const text = compactText(request);
  const hasActiveRequest = /\b(spend|charges?|cast|summon|restore|heal|exhale|enchant|imbue|apply|cone|cube|line|sphere|cylinder)\b/i.test(text)
    || (Array.isArray(spec.utilityActivities) && spec.utilityActivities.length)
    || (Array.isArray(spec.saveActivities) && spec.saveActivities.length)
    || (Array.isArray(spec.attackActivities) && spec.attackActivities.length)
    || spec.healing;
  if (!hasActiveRequest) return { applied: false, spec };
  return {
    applied: true,
    spec: {
      ...clone(spec),
      kind: /\blegendary|artifact\b/i.test(text) ? "legendaryEquipmentSuite" : "equipmentPowerSuite"
    }
  };
}

function rerouteExplicitArmorSuite(spec, request) {
  const text = compactText(request);
  const explicitArmor = /\b(?:padded|leather|studded leather|hide|chain shirt|scale mail|breastplate|half plate|ring mail|chain mail|splint|plate)(?:\s+armor)?\b/i.test(text);
  if (!explicitArmor || SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const hasActiveRequest = /\b(?:charges?|cast|summon|summons|conjure|conjures|once per (?:short|long) rest)\b/i.test(text)
    || (Array.isArray(spec?.utilityActivities) && spec.utilityActivities.length > 0)
    || (Array.isArray(spec?.saveActivities) && spec.saveActivities.length > 0)
    || (Array.isArray(spec?.attackActivities) && spec.attackActivities.length > 0)
    || spec?.summonActor
    || (Array.isArray(spec?.summonProfiles) && spec.summonProfiles.length > 0);
  if (!hasActiveRequest) return { applied: false, spec, assumptions: [] };
  return {
    applied: true,
    spec: {
      ...clone(spec),
      kind: /\b(?:legendary|artifact)\b/i.test(text) ? "legendaryEquipmentSuite" : "equipmentPowerSuite"
    },
    assumptions: ["Promoted explicit armor with activated powers into an equipment suite so armor, spells, and summons share one supported chassis."]
  };
}

function rerouteWeaponHybridKind(spec, request) {
  if (!DIRECT_WEAPON_KINDS.has(spec?.kind)) return { applied: false, spec };
  const text = compactText(request);
  const hasHybridRequest = /\b(?:cast|spell|summon|summons|conjure|conjures|call forth|calls forth|call in|calls in|charges?|once per (?:short|long) rest|bonus action|reaction|teleport|misty step|clairvoyance|moonbeam|fog cloud)\b/i.test(text)
    || (Array.isArray(spec.utilityActivities) && spec.utilityActivities.length > 0)
    || (Array.isArray(spec.saveActivities) && spec.saveActivities.length > 0)
    || (Array.isArray(spec.attackActivities) && spec.attackActivities.length > 0)
    || spec.summonActor
    || (Array.isArray(spec.summonProfiles) && spec.summonProfiles.length > 0);
  if (!hasHybridRequest) return { applied: false, spec };
  return {
    applied: true,
    spec: {
      ...clone(spec),
      kind: "artifactWeaponHybrid"
    },
    assumptions: ["Promoted the weapon into a hybrid artifact structure to preserve its spell, summon, or charge-based powers."]
  };
}

function promoteExplicitConditionOnHit(spec, request) {
  if (spec?.kind !== "weaponExtraDamage" || spec?.conditionOnHit) return { applied: false, spec, assumptions: [] };
  const source = compactText(request);
  const condition = [...CONDITION_STATUSES].find(status => new RegExp(`\\bor be ${status}\\b`, "i").test(source));
  const dc = inferSaveDc(source);
  if (!condition || !dc || !/\bon a hit\b/i.test(source) || !/\b(?:saving throw|save)\b/i.test(source)) {
    return { applied: false, spec, assumptions: [] };
  }

  const next = clone(spec);
  next.kind = "weaponConditionOnHit";
  next.conditionOnHit = {
    macroName: `${next.name} - ${condition.charAt(0).toUpperCase()}${condition.slice(1)}`,
    save: { ability: inferSaveAbility(source), dc },
    condition,
    effectName: `${next.name} - ${condition.charAt(0).toUpperCase()}${condition.slice(1)}`,
    durationSeconds: inferConditionDurationSeconds(source),
    img: "icons/svg/aura.svg"
  };
  if (Array.isArray(next.unresolvedMechanics)) {
    next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => !/save rider|saving throw/i.test(compactText(`${mechanic?.label} ${mechanic?.requestedText}`)));
    if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  }
  return {
    applied: true,
    spec: next,
    assumptions: ["Recovered the explicit on-hit condition and saving throw as a condition rider."]
  };
}

function clearDefaultWeaponWorkflowMechanics(spec) {
  if (!spec?.conditionOnHit || !Array.isArray(spec.unresolvedMechanics)) {
    return { applied: false, spec, assumptions: [] };
  }
  const defaultWorkflowPattern = /single[-\s]?target|focused target|target[-\s]?selection|no extra target|verify (?:the )?(?:attack|save|effect)|attack, save, and effect behavior/i;
  const next = clone(spec);
  const before = next.unresolvedMechanics.length;
  next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => !defaultWorkflowPattern.test(compactText([
    mechanic?.label,
    mechanic?.requestedText,
    mechanic?.reason,
    mechanic?.handling
  ].filter(Boolean).join(" "))));
  if (next.unresolvedMechanics.length === before) return { applied: false, spec, assumptions: [] };
  if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  return {
    applied: true,
    spec: next,
    assumptions: ["Applied the default single-target focused attack workflow for the on-hit condition rider."]
  };
}

function repairStaffWeaponBase(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec };
  const text = compactText(request);
  if (!shouldTreatAsStaffWeapon(text) && compactText(spec.baseItem).toLowerCase() !== "staff") return { applied: false, spec };
  const next = clone(spec);
  next.weaponType = next.weaponType || QUARTERSTAFF_BASE.weaponType;
  next.baseItem = "quarterstaff";
  next.damage = next.damage || clone(QUARTERSTAFF_BASE.damage);
  next.damage.base = next.damage.base || clone(QUARTERSTAFF_BASE.damage.base);
  next.damage.versatile = next.damage.versatile || clone(QUARTERSTAFF_BASE.damage.versatile);
  next.properties = uniqueStrings([...(next.properties ?? []), ...QUARTERSTAFF_BASE.properties]);
  delete next.equipmentType;
  return { applied: true, spec: next };
}

function repairKnownWeaponBase(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec };
  const text = [spec.name, spec.baseItem, request].map(compactText).filter(Boolean).join(" ");
  const profile = KNOWN_WEAPON_BASES.find(entry => entry.pattern.test(text));
  if (!profile) return { applied: false, spec };

  const next = clone(spec);
  const changed = next.weaponType !== profile.weaponType
    || next.baseItem !== profile.baseItem
    || !next.damage?.base
    || !next.damage?.versatile;
  if (!changed) return { applied: false, spec };

  next.weaponType = profile.weaponType;
  next.baseItem = profile.baseItem;
  next.damage = {
    ...clone(profile.damage),
    ...(next.damage ?? {}),
    base: next.damage?.base ?? clone(profile.damage.base),
    versatile: next.damage?.versatile ?? clone(profile.damage.versatile)
  };
  next.properties = uniqueStrings([...(next.properties ?? []), ...profile.properties]);
  next.range = { ...clone(profile.range), ...(next.range ?? {}) };
  delete next.equipmentType;
  return {
    applied: true,
    spec: next,
    assumptions: [`Applied the standard DND5e trident weapon base to preserve its weapon document type.`]
  };
}

function recoverWeaponExtraDamage(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind) || !spec?.weaponType || !spec?.baseItem) {
    return { applied: false, spec, assumptions: [] };
  }
  if (Array.isArray(spec.extraDamageParts) && spec.extraDamageParts.length) {
    return { applied: false, spec, assumptions: [] };
  }

  const clauses = Array.from(String(request ?? "").matchAll(
    /\b(?:deals?|adds?|gains?)\s+(?:an?\s+)?extra\s+([^.;\n]+?)\s+(?:on\s+(?:each\s+)?hit|whenever[^.;\n]*\bhits?\b)/ig
  ));
  const parts = clauses.flatMap(match => parseDamageParts(match[1]));
  if (!parts.length) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.extraDamageParts = parts;
  return {
    applied: true,
    spec: next,
    assumptions: ["Recovered the weapon's extra damage rider from the request text."]
  };
}

function applyHybridDefaults(spec) {
  const next = clone(spec);
  let applied = false;
  const assumptions = [];

  if (defaultMagicalBonus(next)) {
    next.magicalBonus = "1";
    applied = true;
    assumptions.push("No magical bonus was supplied; used +1 by default.");
  }

  for (const listName of ["saveActivities", "utilityActivities", "attackActivities"]) {
    if (!Array.isArray(next[listName])) continue;
    next[listName] = next[listName].map(activity => {
      if (!activity?.save) return activity;
      const dc = Number(activity.save.dc);
      if (Number.isFinite(dc) && dc > 0) return activity;
      applied = true;
      return {
        ...activity,
        save: {
          ...activity.save,
          dc: DEFAULT_SAVE_DC
        }
      };
    });
  }

  return { applied, spec: next, assumptions };
}

function spellMentions(request) {
  const source = compactText(request);
  return SPELL_PROFILES.filter(profile => new RegExp(`\\b${profile.name.replace(/\s+/g, "\\s+")}\\b`, "i").test(source));
}

function addNamedSpellActivities(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const next = clone(spec);
  next.saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  next.attackActivities = Array.isArray(next.attackActivities) ? [...next.attackActivities] : [];
  let applied = false;
  const assumptions = [];

  for (const profile of spellMentions(request)) {
    const activityName = `Cast ${profile.name}`;
    if (hasNamedSpellActivity(next, profile.name) || hasNamedActivity(next, activityName) || hasNamedActivity(next, profile.name)) continue;
    const clause = spellClause(request, profile.name);
    const dc = inferSaveDc(clause, profile.save?.dc ?? inferSaveDc(request, 13));
    const baseActivity = {
      activityId: stableId(`${next.name} ${profile.name}`),
      activityName,
      activationType: inferActivationType(clause),
      chargeCost: inferCastChargeCost(clause, profile.name, inferCastChargeCost(request, profile.name, profile.defaultChargeCost)),
      chatFlavor: profile.chatFlavor,
      range: clone(profile.range),
      target: clone(profile.target),
      duration: clone(profile.duration)
    };
    if (profile.type === "utility") {
      next.utilityActivities.push(baseActivity);
    } else if (profile.type === "attack") {
      next.attackActivities.push({
        ...baseActivity,
        ability: "spellcasting",
        attackBonus: "@prof",
        attackType: profile.attackType || "ranged",
        attackClassification: profile.attackClassification || "spell",
        damageParts: clone(profile.damageParts)
      });
    } else {
      next.saveActivities.push({
        ...baseActivity,
        save: {
          ability: profile.save.ability,
          ...(dc ? { dc } : {})
        },
        damageOnSave: profile.damageOnSave,
        damageParts: clone(profile.damageParts)
      });
    }
    applied = true;
    assumptions.push(`Recovered a named ${profile.name} activity from the request text.`);
  }

  return { applied, spec: next, assumptions };
}

function enrichNamedSpellActivities(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const mentionedNames = new Set(spellMentions(request).map(profile => profile.name));
  if (!mentionedNames.size) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.attackActivities = Array.isArray(next.attackActivities) ? [...next.attackActivities] : [];
  next.saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  const assumptions = [];
  const enrichedNames = new Set();
  let applied = false;

  for (const listName of ["saveActivities", "utilityActivities", "attackActivities"]) {
    if (!Array.isArray(next[listName])) continue;
    next[listName] = next[listName].map(activity => {
      const profile = spellProfileForActivityName(activity?.activityName);
      if (!profile || !mentionedNames.has(profile.name)) return activity;

      const explicitDc = Number(activity?.save?.dc);
      const enriched = {
        ...activity,
        range: clone(profile.range),
        target: {
          ...clone(profile.target),
          prompt: true
        },
        duration: clone(profile.duration),
        chatFlavor: profile.chatFlavor
      };

      if (profile.type === "save") {
        enriched.save = {
          ...clone(profile.save),
          ...(Number.isFinite(explicitDc) && explicitDc > 0 ? { dc: explicitDc } : {})
        };
        enriched.damageOnSave = profile.damageOnSave;
        enriched.damageParts = clone(profile.damageParts);
      }

      if (profile.type === "attack") {
        delete enriched.save;
        delete enriched.damageOnSave;
        enriched.ability = "spellcasting";
        enriched.attackBonus = "@prof";
        enriched.attackType = profile.attackType || "ranged";
        enriched.attackClassification = profile.attackClassification || "spell";
        enriched.damageParts = clone(profile.damageParts);
      }

      if (JSON.stringify(enriched) === JSON.stringify(activity)) return activity;
      applied = true;
      enrichedNames.add(profile.name);
      return enriched;
    });
  }

  const moveNamedActivity = (from, to, profileType) => {
    const moved = [];
    next[from] = next[from].filter(activity => {
      const profile = spellProfileForActivityName(activity?.activityName);
      if (!profile || profile.type !== profileType) return true;
      moved.push(activity);
      return false;
    });
    for (const activity of moved) {
      const name = compactText(activity?.activityName).toLowerCase();
      next[to] = next[to].filter(candidate => compactText(candidate?.activityName).toLowerCase() !== name);
      next[to].push(activity);
      applied = true;
      enrichedNames.add(spellProfileForActivityName(activity?.activityName).name);
    }
  };

  moveNamedActivity("saveActivities", "attackActivities", "attack");
  moveNamedActivity("utilityActivities", "attackActivities", "attack");

  for (const name of enrichedNames) {
    assumptions.push(`Applied the deterministic ${name} mechanical profile to the generated activity.`);
  }
  return { applied, spec: next, assumptions };
}

function addNamedAttackActivities(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const pattern = /(\d+)\s*charges?:\s*([^.\n]+)\.\s*Make a\s+(melee|ranged)\s+spell attack([^.]*)\.\s*On a hit,([^.]*)/ig;
  const matches = Array.from(String(request ?? "").matchAll(pattern));
  if (!matches.length) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.attackActivities = Array.isArray(next.attackActivities) ? [...next.attackActivities] : [];
  next.saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  let applied = false;
  const assumptions = [];

  for (const match of matches) {
    const chargeCost = Number(match[1]);
    const activityName = compactText(match[2]);
    const attackType = compactText(match[3]).toLowerCase() === "melee" ? "melee" : "ranged";
    const attackText = compactText(`${match[4]}. ${match[5]}`);
    if (!activityName || next.attackActivities.some(activity => compactText(activity?.activityName).toLowerCase() === activityName.toLowerCase())) continue;
    const damageParts = parseDamageParts(attackText);
    if (!damageParts.length) continue;

    next.attackActivities.push({
      activityId: stableId(`${next.name} ${activityName}`),
      activityName,
      activationType: inferActivationType(attackText || attackClause(request)),
      chargeCost,
      chatFlavor: `Use ${activityName} from ${next.name}.`,
      range: attackType === "melee"
        ? { value: 5, units: "ft" }
        : rangeFromFeet(attackText, { value: 60, units: "ft" }),
      target: { affects: { count: "1", type: "creature" }, prompt: true },
      ability: "spellcasting",
      attackBonus: "@prof",
      attackType,
      attackClassification: "spell",
      damageParts
    });

    const normalizedName = activityName.toLowerCase();
    next.saveActivities = next.saveActivities.filter(activity => compactText(activity?.activityName).toLowerCase() !== normalizedName);
    next.utilityActivities = next.utilityActivities.filter(activity => compactText(activity?.activityName).toLowerCase() !== normalizedName);
    applied = true;
    assumptions.push(`Recovered the named spell attack ${activityName} as a native attack activity.`);
  }

  return { applied, spec: next, assumptions };
}

function recoverUnnamedSpellAttack(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const source = compactText(request);
  const match = source.match(/(?:as an action,?\s*)?(?:the wearer can\s*)?(?:spend\s*(\d+)\s*charges?\s*to\s*)?make a\s+(melee|ranged)\s+spell attack[^.]*?(?:within|against)\s+[^.]*?\bdealing\s+([^.]*)/i);
  if (!match) return { applied: false, spec, assumptions: [] };

  const damageParts = parseDamageParts(match[3]);
  if (!damageParts.length) return { applied: false, spec, assumptions: [] };
  const next = clone(spec);
  next.attackActivities = Array.isArray(next.attackActivities) ? [...next.attackActivities] : [];
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  next.saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  const damageType = compactText(damageParts[0]?.types?.[0]);
  const activityName = `${damageType ? `${damageType[0].toUpperCase()}${damageType.slice(1)}` : "Arcane"} Bolt`;
  if (hasNamedActivity(next, activityName)) return { applied: false, spec, assumptions: [] };

  const attackType = match[2].toLowerCase();
  next.attackActivities.push({
    activityId: stableId(`${next.name} ${activityName}`),
    activityName,
    activationType: inferActivationType(source),
    chargeCost: Number(match[1] ?? inferChargeCost(source, "spell attack", 1)),
    chatFlavor: `Use ${activityName} from ${next.name}.`,
    range: attackType === "melee" ? { value: 5, units: "ft" } : rangeFromFeet(source, { value: 60, units: "ft" }),
    target: { affects: { count: "1", type: "creature" }, prompt: true },
    ability: "spellcasting",
    attackBonus: "@prof",
    attackType,
    attackClassification: "spell",
    damageParts
  });
  const isMalformedDamageActivity = activity => {
    if (!Array.isArray(activity?.damageParts) || !activity.damageParts.length) return false;
    const name = compactText(activity?.activityName);
    const isGeneric = /^(?:utility|triggered power|secondary effect|save)\s*\d*$/i.test(name);
    // A utility spell cannot be the separately requested damaging spell attack.
    const isUtilitySpell = spellProfileForActivityName(name)?.type === "utility";
    return isGeneric || isUtilitySpell;
  };
  next.utilityActivities = next.utilityActivities.filter(activity => !isMalformedDamageActivity(activity));
  next.saveActivities = next.saveActivities.filter(activity => !isMalformedDamageActivity(activity));
  return {
    applied: true,
    spec: next,
    assumptions: [`Recovered the unnamed ${attackType} spell attack as ${activityName}.`]
  };
}

function namedSaveMentions(request) {
  const source = String(request ?? "");
  const patterns = [
    /(?:^|[\n.;])\s*(\d+)\s*charges?:\s*([^\n.:]{2,80})[.:]\s*([^\n]+(?:saving throw|must make|half as much|damage)[^\n]*)/gim,
    /(?:^|[\n.;])\s*(\d+)\s*charge:\s*([^\n.:]{2,80})[.:]\s*([^\n]+(?:saving throw|must make|half as much|damage)[^\n]*)/gim
  ];
  const seen = new Set();
  const mentions = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const chargeCost = Number(match[1]);
      const activityName = compactText(match[2]);
      const body = compactText(match[3]);
      if (!activityName || !body) continue;
      if (!/\b(?:saving throw|must make|half as much|cone|cube|line|sphere|radius|cylinder)\b/i.test(body)) continue;
      const key = `${chargeCost}|${activityName.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mentions.push({ chargeCost, activityName, body });
    }
  }
  return mentions;
}

function buildNamedSaveActivity(itemName, mention, request) {
  const source = `${mention.activityName}. ${mention.body}`;
  const template = parseTemplateTarget(source) ?? parseTemplateTarget(request);
  const damageParts = parseDamageParts(source);
  if (!damageParts.length) return null;
  return {
    activityId: stableId(`${itemName} ${mention.activityName}`),
    activityName: mention.activityName,
    activationType: inferActivationType(source),
    chargeCost: mention.chargeCost,
    chatFlavor: `Use ${mention.activityName} from ${itemName}.`,
    range: clone(template?.range ?? { units: "self" }),
    target: clone(template?.target ?? { affects: { count: "1", type: "creature" }, prompt: true }),
    save: {
      ability: inferSaveAbility(source),
      dc: inferSaveDc(source, inferSaveDc(request, 13))
    },
    damageOnSave: /half/i.test(source) ? "half" : "none",
    damageParts
  };
}

function addNamedSaveActivities(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const mentions = namedSaveMentions(request);
  if (!mentions.length) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  let applied = false;
  const assumptions = [];

  for (const mention of mentions) {
    const candidate = buildNamedSaveActivity(next.name, mention, request);
    if (!candidate) continue;

    const existingIndex = next.saveActivities.findIndex(activity =>
      compactText(activity?.activityName).toLowerCase() === mention.activityName.toLowerCase()
    );
    if (existingIndex >= 0) {
      next.saveActivities[existingIndex] = {
        ...next.saveActivities[existingIndex],
        ...candidate,
        activityId: next.saveActivities[existingIndex].activityId ?? candidate.activityId
      };
      applied = true;
      assumptions.push(`Recovered the named save activity ${mention.activityName} from the request text.`);
      continue;
    }

    const placeholderIndex = next.saveActivities.findIndex(activity => isPlaceholderSaveName(activity?.activityName));
    if (placeholderIndex >= 0) {
      const placeholder = next.saveActivities[placeholderIndex];
      next.saveActivities[placeholderIndex] = {
        ...placeholder,
        ...candidate,
        activityId: placeholder.activityId ?? candidate.activityId
      };
      next.utilityActivities = next.utilityActivities.filter(activity =>
        compactText(activity?.activityName).toLowerCase() !== mention.activityName.toLowerCase()
      );
      applied = true;
      assumptions.push(`Recovered the named save activity ${mention.activityName} from the request text.`);
      continue;
    }

    next.saveActivities.push(candidate);
    applied = true;
    assumptions.push(`Recovered the named save activity ${mention.activityName} from the request text.`);
  }

  return { applied, spec: next, assumptions };
}

function addGenericSaveActivity(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind) || (spec.saveActivities?.length ?? 0) > 0) return { applied: false, spec, assumptions: [] };
  const source = saveDamageClause(request);
  if (!/\b(?:save|saving throw|dc\s*\d+)\b/i.test(source) || !/\bdamage\b/i.test(source)) return { applied: false, spec, assumptions: [] };
  const diceMatch = source.match(/(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)\s+damage/i);
  const dice = parseDiceExpression(diceMatch?.[1] ?? "");
  const damageType = compactText(diceMatch?.[2] ?? "");
  const dc = inferSaveDc(source, inferSaveDc(request, 13));
  if (!dice || !damageType || !dc) return { applied: false, spec, assumptions: [] };

  const template = parseTemplateTarget(source);
  const next = clone(spec);
  next.saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  next.saveActivities.push({
    activityId: stableId(`${next.name} Save`),
    activityName: /\bexhale\b/i.test(source) ? "Breath Weapon" : "Triggered Power",
    activationType: inferActivationType(source),
    chargeCost: inferChargeCost(source, /\b(?:damage|cone|cube|line|sphere|cylinder)\b/.source, ""),
    chatFlavor: /\bexhale\b/i.test(source) ? "Release the item's breath weapon." : "Use the item's damaging power.",
    range: clone(template?.range ?? { units: "self" }),
    target: clone(template?.target ?? { affects: { count: "1", type: "creature" }, prompt: true }),
    save: { ability: inferSaveAbility(source), dc },
    damageOnSave: /half/i.test(source) ? "half" : "none",
    damageParts: [{ ...dice, types: [damageType] }]
  });
  return {
    applied: true,
    spec: next,
    assumptions: ["Recovered a save-based damage activity from the request text."]
  };
}

function repairMalformedSaveActivities(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind) || !Array.isArray(spec?.saveActivities) || !spec.saveActivities.length) {
    return { applied: false, spec, assumptions: [] };
  }

  const next = clone(spec);
  const assumptions = [];
  let applied = false;

  next.saveActivities = next.saveActivities.map(activity => {
    const current = clone(activity);
    const source = [compactText(activity?.chatFlavor), compactText(activity?.activityName), compactText(request)].filter(Boolean).join(". ");
    const template = parseTemplateTarget(source) ?? parseTemplateTarget(request);
    const hasTemplate = Boolean(compactText(current?.target?.template?.type) && compactText(current?.target?.template?.size));
    const hasPrompt = current?.target?.prompt === true;
    const nextActivity = clone(current);

    if (template && !hasTemplate) {
      nextActivity.range = clone(template.range);
      nextActivity.target = clone(template.target);
      applied = true;
    } else if ((template || hasTemplate) && !hasPrompt) {
      nextActivity.target = {
        ...(clone(current?.target) ?? {}),
        prompt: true
      };
      applied = true;
    }

    if (isGenericSaveName(current?.activityName)) {
      const desiredName = /\b(?:exhale|breath weapon|cone)\b/i.test(source) ? "Breath Weapon" : "Triggered Power";
      if (current.activityName !== desiredName) {
        nextActivity.activityName = desiredName;
        applied = true;
      }
    }

    if (/\bcharges?\b/i.test(source)) {
      const activityName = castActivityName(nextActivity.activityName);
      const namedCost = activityName ? inferCastChargeCost(request, activityName, "") : "";
      const inferredCost = namedCost !== ""
        ? namedCost
        : inferChargeCost(source, /\b(?:damage|cone|cube|line|sphere|cylinder|save|saving throw)\b/.source, "");
      if (inferredCost !== "") {
        const currentCost = Number(nextActivity.chargeCost);
        if (!Number.isFinite(currentCost) || currentCost !== Number(inferredCost)) {
          nextActivity.chargeCost = inferredCost;
          applied = true;
        }
      }
    }

    const currentDc = Number(nextActivity?.save?.dc);
    if ((!Number.isFinite(currentDc) || currentDc <= 0) && nextActivity?.save) {
      nextActivity.save = {
        ...nextActivity.save,
        dc: inferSaveDc(source, inferSaveDc(request, 13))
      };
      applied = true;
    }

    return nextActivity;
  });

  if (!applied) return { applied: false, spec, assumptions: [] };
  assumptions.push("Repaired malformed save activities using template and save cues from the request text.");
  return { applied: true, spec: next, assumptions };
}

function looksLikeThrownConsumableRequest(text) {
  const source = compactText(text);
  return /\b(?:grenade|bomb|flask|vial|alchemist(?:'s)?\s+fire|acid\s+flask|holy\s+water)\b/i.test(source)
    && /\b(?:throw|thrown|hurl|lob|splash|burst|explode|explodes?)\b/i.test(source);
}

function repairExplicitConsumableTargets(spec, request) {
  if (!looksLikeThrownConsumableRequest(request)) return { applied: false, spec, assumptions: [] };
  const template = parseTemplateTarget(request);
  const explicitSaveAbility = inferSaveAbility(request, "");
  if (!template && !explicitSaveAbility) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  let applied = false;
  let targetApplied = false;
  let saveApplied = false;
  const fields = ["activities", "attackActivities", "saveActivities", "utilityActivities"];
  for (const field of fields) {
    if (!Array.isArray(next[field])) continue;
    next[field] = next[field].map(activity => {
      if (!activity || typeof activity !== "object") return activity;
      const nextActivity = clone(activity);
      if (explicitSaveAbility && (field === "saveActivities" || activity.save)) {
        if (compactText(activity.save?.ability).toLowerCase() !== explicitSaveAbility) {
          nextActivity.save = {
            ...(clone(activity.save) ?? {}),
            ability: explicitSaveAbility
          };
          applied = true;
          saveApplied = true;
        }
      }
      if (!template) return nextActivity;
      const currentTemplate = activity.target?.template;
      const sameTemplate = currentTemplate?.type === template.target.template.type
        && Number(currentTemplate?.size) === Number(template.target.template.size)
        && Number(currentTemplate?.width ?? 0) === Number(template.target.template.width ?? 0);
      Object.assign(nextActivity, {
        ...activity,
        range: clone(template.range),
        target: {
          ...(clone(activity.target) ?? {}),
          ...clone(template.target),
          template: clone(template.target.template),
          affects: {
            ...(clone(activity.target?.affects) ?? {}),
            ...clone(template.target.affects)
          },
          prompt: true
        }
      });
      if (!sameTemplate || activity.target?.prompt !== true || activity.range?.value !== template.range?.value) {
        applied = true;
        targetApplied = true;
      }
      return nextActivity;
    });
  }

  if (next.kind === "chargedSaveDamage") {
    if (explicitSaveAbility && compactText(next.save?.ability).toLowerCase() !== explicitSaveAbility) {
      next.save = {
        ...(clone(next.save) ?? {}),
        ability: explicitSaveAbility
      };
      applied = true;
      saveApplied = true;
    }
    if (template) {
      if (JSON.stringify(next.target?.template) !== JSON.stringify(template.target.template)
        || next.target?.prompt !== true
        || next.range?.value !== template.range?.value) {
        applied = true;
        targetApplied = true;
      }
      next.range = clone(template.range);
      next.target = clone(template.target);
    }
  }

  if (!applied) return { applied: false, spec, assumptions: [] };
  const assumptions = [];
  if (targetApplied) assumptions.push("Applied explicit consumable range and area template from the request over stale model defaults.");
  if (saveApplied) assumptions.push("Applied the explicit consumable saving throw ability from the request over stale model defaults.");
  return { applied: true, spec: next, assumptions };
}

function addHealingActivity(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind)) return { applied: false, spec, assumptions: [] };
  const clause = healingClause(request);
  const inferredHealing = firstDiceInText(clause);
  const healing = spec?.healing ? clone(spec.healing) : inferredHealing ? { ...inferredHealing, types: ["healing"] } : null;
  if (!healing) return { applied: false, spec, assumptions: [] };
  const next = clone(spec);
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  const chargeCost = inferChargeCost(clause, "\\b(?:restore|regain|heal)\\b", inferChargeCost(request, "\\b(?:restore|regain|heal)\\b", ""));
  const explicitRange = rangeFromFeet(clause, null);
  const targetsCreature = /\b(?:one|a|an)\s+(?:creature|target)\b/i.test(clause) || /\bcreature\b/i.test(clause);
  const target = targetsCreature || /\btouch\b/i.test(clause)
    ? { affects: { count: "1", type: "creature" }, prompt: true }
    : { affects: { count: "1", type: "self" }, prompt: false };
  const existingIndex = next.utilityActivities.findIndex(activity => activity?.healing);
  if (existingIndex >= 0) {
    const existing = clone(next.utilityActivities[existingIndex]);
    if (inferredHealing) existing.healing = { ...inferredHealing, types: ["healing"] };
    if (chargeCost !== "") existing.chargeCost = chargeCost;
    existing.activationType = inferActivationType(clause);
    existing.range = explicitRange ?? (/\btouch\b/i.test(clause) ? { units: "touch" } : existing.range ?? { units: "self" });
    existing.target = target;
    next.utilityActivities[existingIndex] = existing;
  } else {
    next.utilityActivities.push({
      activityId: stableId(`${next.name} Heal`),
      activityName: /\btouch\b/i.test(clause) ? "Healing Touch" : "Restore Vitality",
      activationType: inferActivationType(clause),
      chargeCost,
      chatFlavor: "Restore hit points using this item.",
      range: explicitRange ?? (/\btouch\b/i.test(clause) ? { units: "touch" } : { units: "self" }),
      target,
      healing
    });
  }
  delete next.healing;
  return {
    applied: true,
    spec: next,
    assumptions: ["Recovered a healing activity from the request text."]
  };
}

function explicitSummonProfileNames(text) {
  const match = compactText(text).match(/\b(?:pick|choose)(?:s)?(?:\s+one)?(?:\s+(?:friendly|summoned))?(?:\s+(?:beast|creature|ally|profile))?\s*:?\s*([^.;]+)/i);
  if (!match) return [];
  return match[1]
    .replace(/\s+when\b.*$/i, "")
    .split(/\s*,\s*(?:or\s+)?|\s+or\s+/i)
    .map(value => value.replace(/^(?:a|an|the)\s+/i, "").trim())
    .filter(value => value && value.split(/\s+/).length <= 4)
    .filter((value, index, values) => values.findIndex(candidate => candidate.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 6);
}

function inferSummonActor(request) {
  const source = compactText(request);
  if (/\bfiend\b/i.test(source) || (/\bdemon\b/i.test(source) && /\bdevil\b/i.test(source) && /\byugoloth\b/i.test(source))) {
    return {
      activityName: "Summon Fiend",
      chargeLabel: "fiend",
      profiles: [
        {
          profileName: "Demon",
          actor: namedSrdSummonActor("Fiend (Demon)", "Quasit")
        },
        {
          profileName: "Devil",
          actor: namedSrdSummonActor("Fiend (Devil)", "Imp")
        },
        {
          profileName: "Yugoloth",
          actor: namedSrdSummonActor("Fiend (Yugoloth)", "Mezzoloth")
        }
      ]
    };
  }
  const explicitProfiles = explicitSummonProfileNames(source);
  if (explicitProfiles.length >= 2) {
    return {
      activityName: "Summon Chosen Ally",
      chargeLabel: "summon",
      profiles: explicitProfiles.map(profileName => ({
        profileName,
        actor: genericSrdSummonActor(profileName)
      }))
    };
  }
  const summonPair = source.match(/\b(?:summon|summons|conjure|conjures|call forth|calls forth|call in|calls in)\s+(?:one\s+)?(?:a|an|the)?\s*friendly\s+([a-z][a-z' -]+?)\s+or\s+(?:a|an|the)?\s*([a-z][a-z' -]+?)(?=\s+(?:for|within|that|which|when)\b|[.;]|$)/i);
  if (summonPair) {
    const profiles = [summonPair[1], summonPair[2]]
      .map(profileName => profileName.trim())
      .filter(profileName => profileName && profileName.split(/\s+/).length <= 4)
      .map(profileName => ({
        profileName,
        actor: genericSrdSummonActor(profileName)
      }));
    if (profiles.length === 2) {
      return {
        activityName: "Summon Chosen Ally",
        chargeLabel: "summon",
        profiles
      };
    }
  }
  if (/\breef shark\b/i.test(source) && /\bwolf\b/i.test(source)) {
    return {
      splitActivities: [
        {
          activityName: "Summon Reef Shark",
          chargeLabel: "reef shark",
          profileName: "Reef Shark",
          actor: genericSrdSummonActor("Reef Shark")
        },
        {
          activityName: "Summon Wolf",
          chargeLabel: "wolf",
          profileName: "Wolf",
          actor: genericSrdSummonActor("Wolf")
        }
      ]
    };
  }
  if (/\breef shark\b/i.test(source)) {
    return {
      activityName: "Summon Reef Shark",
      chargeLabel: "shark",
      profiles: [
        {
          profileName: "Reef Shark",
          actor: genericSrdSummonActor("Reef Shark")
        }
      ]
    };
  }
  if (/\bwolf\b/i.test(source)) {
    return {
      activityName: "Summon Wolf",
      chargeLabel: "wolf",
      profiles: [
        {
          profileName: "Wolf",
          actor: genericSrdSummonActor("Wolf")
        }
      ]
    };
  }
  if (/\bcat\b/i.test(source)) {
    return {
      activityName: "Summon Cat",
      chargeLabel: "cat",
      profiles: [
        {
          profileName: "Cat",
          actor: genericSrdSummonActor("Cat")
        }
      ]
    };
  }
  if (/\bpseudodragon\b/i.test(source)) {
    const profileName = "Pseudodragon";
    return {
      activityName: `Summon ${profileName}`,
      chargeLabel: "pseudodragon",
      profiles: [
        {
          profileName,
          actor: genericSrdSummonActor(profileName)
        }
      ]
    };
  }
  const srdCreatureName = extractNamedSrdSummon(source);
  if (srdCreatureName) {
    return {
      activityName: `Summon ${srdCreatureName}`,
      chargeLabel: srdCreatureName.toLowerCase(),
      profiles: [{
        profileName: srdCreatureName,
        actor: genericSrdSummonActor(srdCreatureName)
      }]
    };
  }
  return null;
}

function addSummonActivity(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind) && !["nativeEnchant", "nativeSummon", "nativeMultiProfileSummon"].includes(spec?.kind)) {
    return { applied: false, spec, assumptions: [] };
  }
  const hasTopLevelSummon = (spec.summonProfiles?.length ?? 0) > 0 || spec?.summonActor || spec?.summonActivity;
  if (!hasTopLevelSummon && !/\b(summon|summons|summoned|summoning|conjure|conjures|call forth|calls forth|call in|calls in)\b/i.test(request)) return { applied: false, spec, assumptions: [] };
  const clause = summonClause(request);
  const summonMentionCount = compactText(request).match(/\b(?:summon|summons|summoned|summoning|conjure|conjures|call forth|calls forth|call in|calls in)\b/ig)?.length ?? 0;
  const useFullRequest = summonMentionCount > 1
    || (spec.summonProfiles?.length ?? 0) >= 2
    || explicitSummonProfileNames(request).length >= 2;
  const inferred = inferSummonActor(useFullRequest ? request : (clause || request));
  if (!inferred) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];

  const embeddedSummonIndex = next.utilityActivities.findIndex(activity =>
    Array.isArray(activity?.summonProfiles)
    && activity.summonProfiles.length
    && /\b(?:summon|conjur|call)\b/i.test(compactText(activity?.activityName))
  );
  if (embeddedSummonIndex >= 0 && Array.isArray(inferred.profiles) && inferred.profiles.length) {
    const existing = clone(next.utilityActivities[embeddedSummonIndex]);
    const existingProfiles = Array.isArray(existing.summonProfiles) ? existing.summonProfiles : [];
    existing.activationType = existing.activationType || inferActivationType(clause);
    existing.chargeCost = inferSummonChargeCost(
      clause,
      inferred.chargeLabel ?? inferred.profiles[0]?.profileName?.toLowerCase?.() ?? "summon",
      existing.chargeCost ?? ""
    );
    existing.chatFlavor = inferred.profiles.length > 1
      ? "Choose a summon profile from this item."
      : `Summon a friendly ${inferred.profiles[0].profileName.toLowerCase()} ally.`;
    existing.duration = inferDuration(`${clause} ${request}`);
    existing.range = rangeFromFeet(clause, existing.range ?? { value: 30, units: "ft" });
    existing.target = {
      affects: { count: "1", type: "space", special: "An unoccupied space within range" },
      prompt: true
    };
    delete existing.attack;
    delete existing.damageOnSave;
    delete existing.damageParts;
    delete existing.save;
    existing.summonProfiles = inferred.profiles.map((profile, index) => ({
      profileId: existingProfiles[index]?.profileId ?? stableId(`${next.name} ${profile.profileName}`),
      profileName: profile.profileName,
      actor: profile.actor
    }));
    next.utilityActivities[embeddedSummonIndex] = existing;
    delete next.summonProfiles;
    delete next.summonActivity;
    delete next.summonActor;
    return {
      applied: true,
      spec: next,
      assumptions: [`Replaced a generic summon fallback with the requested ${inferred.profiles.map(profile => profile.profileName).join(" or ")} SRD profile.`]
    };
  }

  if (Array.isArray(inferred.splitActivities) && inferred.splitActivities.length) {
    const range = rangeFromFeet(clause, { value: 30, units: "ft" });
    const duration = inferDuration(`${clause} ${request}`);
    const activationType = next.summonActivity?.activationType || inferActivationType(clause);
    const fallbackChargeCost = next.summonActivity?.chargeCost
      ?? inferChargeCost(clause, "\\b(?:summon|conjure|call forth|calls forth|call in|calls in)\\b", Number(next.uses?.max) > 0 ? 1 : "");
    const existingProfiles = new Map((next.summonProfiles ?? [])
      .map(profile => [compactText(profile?.profileName).toLowerCase(), clone(profile)]));
    let createdAny = false;

    for (const entry of inferred.splitActivities) {
      if (hasNamedActivity(next, entry.activityName)) continue;
      const existingProfile = existingProfiles.get(compactText(entry.profileName).toLowerCase());
      next.utilityActivities.push({
        activityId: stableId(`${next.name} ${entry.activityName}`),
        activityName: entry.activityName,
        activationType,
        chargeCost: inferSummonChargeCost(clause, entry.chargeLabel ?? entry.profileName?.toLowerCase?.() ?? "summon", fallbackChargeCost),
        chatFlavor: `Summon a friendly ${entry.profileName.toLowerCase()} ally.`,
        duration: clone(duration),
        range: clone(range),
        target: {
          affects: { count: "1", type: "space", special: "An unoccupied space within range" },
          prompt: true
        },
        // The request's exact SRD actor wins over any stale model-produced profile.
        summonProfiles: [{
          profileId: existingProfile?.profileId ?? stableId(`${next.name} ${entry.profileName}`),
          profileName: entry.profileName,
          actor: entry.actor
        }]
      });
      createdAny = true;
    }

    if (!createdAny && !hasTopLevelSummon) return { applied: false, spec, assumptions: [] };
    delete next.summonProfiles;
    delete next.summonActivity;
    delete next.summonActor;
    if (Array.isArray(next.unresolvedMechanics)) {
      next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
        const category = compactText(mechanic?.category).toLowerCase();
        const reason = compactText(mechanic?.reason).toLowerCase();
        const requestedText = compactText(mechanic?.requestedText).toLowerCase();
        if (category === "summon") return false;
        if (reason.includes("does not contain a foundry summon payload")) return false;
        if (requestedText.includes("summon")) return false;
        if (category === "unmappedspell"
          && reason.includes("no specific spell")
          && reason.includes("activity")
          && !/\bcast\b/i.test(request)) return false;
        return true;
      });
      if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
    }
    return {
      applied: true,
      spec: next,
      assumptions: ["Split environment-dependent summon choices into separate summon activities."]
    };
  }

  next.summonProfiles = inferred.profiles.map(profile => ({
    profileId: stableId(`${next.name} ${profile.profileName}`),
    profileName: profile.profileName,
    actor: profile.actor
  }));
  next.summonActivity = {
    activityId: stableId(`${next.name} Summon`),
    activityName: inferred.activityName ?? `Summon ${inferred.profiles[0]?.profileName ?? "Creature"}`,
    activationType: inferActivationType(clause),
    chargeCost: inferSummonChargeCost(clause, inferred.chargeLabel ?? inferred.profiles[0]?.profileName?.toLowerCase?.() ?? "summon", inferChargeCost(clause, "\\b(?:summon|conjure|call forth|calls forth|call in|calls in)\\b", "")),
    chatFlavor: inferred.profiles.length > 1
      ? "Choose a summon profile from this item."
      : `Summon a friendly ${inferred.profiles[0].profileName.toLowerCase()} ally.`,
    duration: inferDuration(`${clause} ${request}`),
    range: rangeFromFeet(clause, { value: 30, units: "ft" }),
    target: {
      affects: { count: "1", type: "space", special: "An unoccupied space within range" },
      prompt: true
    }
  };
  if (Array.isArray(next.unresolvedMechanics)) {
    next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
      const category = compactText(mechanic?.category).toLowerCase();
      const reason = compactText(mechanic?.reason).toLowerCase();
      const requestedText = compactText(mechanic?.requestedText).toLowerCase();
      if (category === "summon") return false;
      if (reason.includes("does not contain a foundry summon payload")) return false;
      if (requestedText.includes("summon")) return false;
      if (category === "unmappedspell"
        && reason.includes("no specific spell")
        && reason.includes("activity")
        && !/\bcast\b/i.test(request)) return false;
      return true;
    });
    if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  }
  return {
    applied: true,
    spec: next,
    assumptions: [`Recovered a summon activity for ${inferred.activityName ?? inferred.profiles[0].profileName} from the request text.`]
  };
}

function hasSummonUsePool(spec) {
  const limit = Number(spec?.uses?.max);
  return Number.isFinite(limit) && limit > 0;
}

function normalizeSummonUseConsumption(spec) {
  if (!spec?.summonActivity || !hasSummonUsePool(spec)) return { applied: false, spec, assumptions: [] };
  if (Number(spec.summonActivity.chargeCost) > 0) return { applied: false, spec, assumptions: [] };
  const next = clone(spec);
  next.summonActivity.chargeCost = 1;
  return {
    applied: true,
    spec: next,
    assumptions: ["Bound the recovered summon activity to the item's shared use pool."]
  };
}

function hasStructuredActivityPayload(activity) {
  return Boolean(
    activity?.macroCommand
    || activity?.healing
    || activity?.enchantChanges?.length
    || activity?.summonProfiles?.length
    || activity?.save?.ability
    || activity?.save?.dc != null
    || activity?.damageParts?.length
    || activity?.target?.template?.type
    || activity?.target?.affects?.type
  );
}

function isLikelySummonPlaceholder(activity) {
  if (hasStructuredActivityPayload(activity)) return false;
  return /\b(?:summon|conjur|call(?:ing)?|fiend|whistle)\b/i.test(compactText(activity?.activityName));
}

function dropDuplicateSummonUtilities(spec) {
  if (!(spec?.summonProfiles?.length) && !spec?.summonActor) return { applied: false, spec, assumptions: [] };
  const summonActivityName = compactText(spec?.summonActivity?.activityName).toLowerCase();
  const utilities = Array.isArray(spec?.utilityActivities) ? spec.utilityActivities : [];
  if (!utilities.length) return { applied: false, spec, assumptions: [] };

  let removed = 0;
  const next = clone(spec);
  next.utilityActivities = utilities.filter(activity => {
    const name = compactText(activity?.activityName).toLowerCase();
    if (!name) return true;
    const duplicate = (summonActivityName && name === summonActivityName)
      || /^summon\b/.test(name)
      || isLikelySummonPlaceholder(activity);
    if (duplicate) {
      removed += 1;
      return false;
    }
    return true;
  });

  if (!removed) return { applied: false, spec, assumptions: [] };
  return {
    applied: true,
    spec: next,
    assumptions: ["Removed duplicate summon utility placeholders now that a native summon activity is present."]
  };
}

function promoteSummonOnlyMultiProfileSpec(spec) {
  if ((spec?.summonProfiles?.length ?? 0) < 2 || spec.kind === "nativeMultiProfileSummon") {
    return { applied: false, spec, assumptions: [] };
  }
  const hasOtherActivities = (spec.attackActivities?.length ?? 0) > 0
    || (spec.saveActivities?.length ?? 0) > 0
    || (spec.utilityActivities ?? []).some(hasStructuredActivityPayload)
    || (spec.effects?.length ?? 0) > 0
    || (spec.passiveEffects?.length ?? 0) > 0;
  if (hasOtherActivities) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  next.kind = "nativeMultiProfileSummon";
  next.summonActivity = {
    ...(next.summonActivity ?? {}),
    activityId: next.summonActivity?.activityId ?? stableId(`${next.name} Summon`)
  };
  delete next.utilityActivities;
  return {
    applied: true,
    spec: next,
    assumptions: ["Promoted the summon-only item to the native multi-profile summon renderer."]
  };
}

function clearResolvedSummonMechanics(spec) {
  const hasEmbeddedSummon = (spec?.utilityActivities ?? []).some(activity => activity?.summonProfiles?.length);
  if (!(spec?.summonProfiles?.length) && !spec?.summonActor && !spec?.summonActivity?.activityId && !hasEmbeddedSummon) {
    return { applied: false, spec, assumptions: [] };
  }
  if (!Array.isArray(spec?.unresolvedMechanics) || !spec.unresolvedMechanics.length) {
    return { applied: false, spec, assumptions: [] };
  }

  const next = clone(spec);
  const beforeCount = next.unresolvedMechanics.length;
  next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
    const category = compactText(mechanic?.category).toLowerCase();
    const label = compactText(mechanic?.label).toLowerCase();
    const reason = compactText(mechanic?.reason).toLowerCase();
    const requestedText = compactText(mechanic?.requestedText).toLowerCase();
    if (["summon", "nativesummon", "nativemultiprofilesummon", "beastchoice", "summonchoice", "profilechoice"].includes(category)) return false;
    if (reason.includes("does not contain a foundry summon payload")) return false;
    if (/\b(?:summon|conjure|call\s+(?:forth|in))\b/.test(requestedText)) return false;
    if (category === "unmappedspell" && /infernal calling/.test(`${label} ${reason} ${requestedText}`)
      && /(?:supported spell|summon profile|limited-use casting)/.test(reason)) return false;
    return true;
  });
  if (next.unresolvedMechanics.length === beforeCount) {
    return { applied: false, spec, assumptions: [] };
  }
  if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  return {
    applied: true,
    spec: next,
    assumptions: ["Removed resolved summon review notes now that a native summon payload is present."]
  };
}

function clearResolvedResistanceMechanics(spec) {
  if (!Array.isArray(spec?.unresolvedMechanics) || !spec.unresolvedMechanics.length) {
    return { applied: false, spec, assumptions: [] };
  }

  const resolvedTypes = new Set();
  for (const listName of ["effects", "passiveEffects"]) {
    for (const effect of spec?.[listName] ?? []) {
      for (const change of effect?.changes ?? []) {
        if (compactText(change?.key) !== "system.traits.dr.value") continue;
        const value = typeof change?.value === "object" ? JSON.stringify(change.value) : compactText(change?.value);
        for (const type of DAMAGE_RESISTANCE_TYPES) {
          if (new RegExp(`\\b${type}\\b`, "i").test(value)) resolvedTypes.add(type);
        }
      }
    }
  }
  if (!resolvedTypes.size) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  const beforeCount = next.unresolvedMechanics.length;
  next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
    const text = compactText(`${mechanic?.category} ${mechanic?.label} ${mechanic?.requestedText} ${mechanic?.reason} ${mechanic?.handling}`);
    const describesResistance = /resistan|shrug\s+off|damage[- ]handling|passive defensive/i.test(text);
    if (!describesResistance) return true;
    return ![...resolvedTypes].some(type => new RegExp(`\\b${type}\\b`, "i").test(text));
  });
  if (next.unresolvedMechanics.length === beforeCount) return { applied: false, spec, assumptions: [] };
  if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  return {
    applied: true,
    spec: next,
    assumptions: ["Removed damage-resistance review notes already represented by a native item effect."]
  };
}

function clearResolvedSpellMechanics(spec, request) {
  if (!Array.isArray(spec?.unresolvedMechanics) || !spec.unresolvedMechanics.length) {
    return { applied: false, spec, assumptions: [] };
  }

  const requestedProfiles = spellMentions(request);
  if (!requestedProfiles.length) return { applied: false, spec, assumptions: [] };
  const activities = ["activities", "saveActivities", "utilityActivities", "attackActivities"]
    .flatMap(listName => Array.isArray(spec?.[listName]) ? spec[listName] : []);
  const allRecovered = requestedProfiles.every(profile => hasNamedSpellActivity(spec, profile.name)
    || activities.some(activity => new RegExp(`\\b${profile.name.replace(/\\s+/g, "\\\\s+")}\\b`, "i").test(compactText(activity?.activityName))));
  if (!allRecovered) return { applied: false, spec, assumptions: [] };

  const next = clone(spec);
  const beforeCount = next.unresolvedMechanics.length;
  next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
    const category = compactText(mechanic?.category).toLowerCase();
    const label = compactText(mechanic?.label).toLowerCase();
    const requestedText = compactText(mechanic?.requestedText).toLowerCase();
    if (category !== "unmappedspell" && !/spellcasting activities|unmapped spell/.test(label)) return true;
    return !requestedProfiles.every(profile => requestedText.includes(profile.name.toLowerCase()) || label.includes("spellcasting activities"));
  });
  if (next.unresolvedMechanics.length === beforeCount) return { applied: false, spec, assumptions: [] };
  if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  return {
    applied: true,
    spec: next,
    assumptions: ["Removed named-spell review notes after deterministic SRD activities were recovered."]
  };
}

function addEnchantActivity(spec, request) {
  if (!SUITE_KINDS.has(spec?.kind) || !/\b(enchant|imbue|apply it to|one nonmagical weapon|becomes magical)\b/i.test(request)) {
    return { applied: false, spec, assumptions: [] };
  }
  const next = clone(spec);
  next.utilityActivities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  if (next.utilityActivities.some(activity => Array.isArray(activity?.enchantChanges) && activity.enchantChanges.length)) {
    return { applied: false, spec, assumptions: [] };
  }

  const clauses = splitClauses(request);
  const enchantIndex = clauses.findIndex(clauseText => /\b(enchant|imbue|apply it to|one nonmagical weapon|becomes magical)\b/i.test(clauseText));
  const clause = enchantIndex >= 0
    ? [clauses[enchantIndex], clauses[enchantIndex + 1]].filter(Boolean).join(" ")
    : enchantClause(request);
  const damageMatch = compactText(clause).match(/\bextra\s+(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)\s+damage\b/i);
  const damageDice = parseDiceExpression(damageMatch?.[1] ?? "");
  const damageType = compactText(damageMatch?.[2] ?? "");
  const enchantChanges = [{ key: "system.properties", mode: "ADD", value: "mgc" }];
  const magicalBonus = Number(compactText(clause).match(/\bgains?\s*\+(\d+)\s+to\s+attack\s+and\s+damage\s+rolls\b/i)?.[1] ?? "");
  if (Number.isFinite(magicalBonus) && magicalBonus > 0) {
    enchantChanges.push({
      key: "system.magicalBonus",
      mode: "OVERRIDE",
      value: String(magicalBonus)
    });
  }
  if (damageDice && damageType) {
    enchantChanges.push({
      key: "system.damage.parts",
      mode: "ADD",
      value: {
        number: damageDice.number,
        denomination: damageDice.denomination,
        bonus: damageDice.bonus,
        types: [damageType]
      }
    });
  }

  next.utilityActivities.push({
    activityId: stableId(`${next.name} Enchant`),
    activityName: /\bshield\b/i.test(request) ? "Bless a Weapon" : "Apply Enchantment",
    activationType: inferActivationType(clause),
    chatFlavor: "Enchant a weapon with the item's magic.",
    duration: inferDuration(clause),
    range: { units: "touch" },
    target: { affects: { count: "1", type: "object", special: "Nonmagical weapon" }, prompt: false },
    restrictions: { type: "weapon", allowMagical: false, categories: [], properties: [] },
    effectId: stableId(`${next.name} EnchantFx`),
    effectName: `${next.name} Enchantment`,
    enchantChanges
  });
  if (Array.isArray(next.unresolvedMechanics)) {
    next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
      const category = compactText(mechanic?.category).toLowerCase();
      const label = compactText(mechanic?.label).toLowerCase();
      const reason = compactText(mechanic?.reason).toLowerCase();
      return category !== "enchantment"
        && !label.includes("requested enchantment rider")
        && !reason.includes("enchantment rider was not preserved");
    });
    if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  }
  return {
    applied: true,
    spec: next,
    assumptions: ["Recovered an enchantment activity from the request text."]
  };
}

function dropGenericPlaceholders(spec) {
  const next = clone(spec);
  const originalUtilityCount = (next.utilityActivities ?? []).length;
  next.utilityActivities = (next.utilityActivities ?? []).filter(activity => {
    const name = compactText(activity?.activityName);
    if (!isGenericUtilityName(name)) return true;
    if (activity?.macroCommand || activity?.healing || activity?.enchantChanges?.length) return true;
    return false;
  });
  next.saveActivities = (next.saveActivities ?? []).filter(activity => {
    const name = compactText(activity?.activityName);
    if (!isGenericSaveName(name)) return true;
    if (compactText(activity?.target?.template?.type) || activity?.damageParts?.length || activity?.save?.dc) return true;
    return false;
  });
  next._placeholderDropCount = originalUtilityCount - next.utilityActivities.length;
  return next;
}

function dropRedundantWeaponRiderActivities(spec, request) {
  const riderParts = Array.isArray(spec?.extraDamageParts) ? spec.extraDamageParts : [];
  const requestText = compactText(request);
  if (!riderParts.length || !/\bon (?:a|every|each) hit\b/i.test(requestText)) return { applied: false, spec, assumptions: [] };

  const matchesRider = activity => {
    const parts = Array.isArray(activity?.damageParts) ? activity.damageParts : [];
    return parts.length === riderParts.length && parts.every((part, index) =>
      Number(part?.number) === Number(riderParts[index]?.number)
      && Number(part?.denomination) === Number(riderParts[index]?.denomination)
      && compactText(part?.types?.[0]).toLowerCase() === compactText(riderParts[index]?.types?.[0]).toLowerCase()
    );
  };
  const sameDamagePart = (left, right) =>
    Number(left?.number) === Number(right?.number)
    && Number(left?.denomination) === Number(right?.denomination)
    && compactText(left?.types?.[0]).toLowerCase() === compactText(right?.types?.[0]).toLowerCase();
  const next = clone(spec);
  const original = Array.isArray(next.saveActivities) ? next.saveActivities : [];
  let changed = false;
  next.saveActivities = original.flatMap(activity => {
    const name = compactText(activity?.activityName).toLowerCase();
    const activityName = compactText(activity?.activityName);
    const isGenericPlaceholder = ["triggered power", "secondary effect"].includes(name);
    const isKnownSpell = Boolean(spellProfileForActivityName(activityName));
    const escapedName = activityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const wasExplicitlyNamed = activityName && new RegExp(`\\b${escapedName}\\b`, "i").test(requestText);
    if (matchesRider(activity)) {
      if (!isGenericPlaceholder) return [activity];
      changed = true;
      return [];
    }
    const damageParts = Array.isArray(activity?.damageParts) ? activity.damageParts : [];
    const remainingDamage = damageParts.filter(part => !riderParts.some(rider => sameDamagePart(part, rider)));
    if (remainingDamage.length === damageParts.length || !remainingDamage.length || isKnownSpell || wasExplicitlyNamed) return [activity];
    changed = true;
    return [{ ...activity, damageParts: remainingDamage }];
  });
  if (!changed) return { applied: false, spec, assumptions: [] };
  return {
    applied: true,
    spec: next,
    assumptions: ["Removed a redundant placeholder activity that duplicated the weapon's on-hit damage rider."]
  };
}

function rerouteTemplateUtilityActivities(spec) {
  const next = clone(spec);
  const utilities = Array.isArray(next.utilityActivities) ? [...next.utilityActivities] : [];
  if (!utilities.length) return { applied: false, spec, assumptions: [] };

  const reroutedUtilities = [];
  const saveActivities = Array.isArray(next.saveActivities) ? [...next.saveActivities] : [];
  let moved = 0;

  for (const activity of utilities) {
    const namedSpellProfile = spellProfileForActivityName(activity?.activityName);
    const hasStructuredMechanicalPayload = Boolean(
      compactText(activity?.target?.template?.type)
      || (Array.isArray(activity?.damageParts) && activity.damageParts.length)
      || compactText(activity?.save?.ability)
      || activity?.save?.dc != null
    );
    const isNativeUtility = Boolean(
      namedSpellProfile?.type === "utility"
      || activity?.macroCommand
      || activity?.healing
      || (Array.isArray(activity?.summonProfiles) && activity.summonProfiles.length)
      || (Array.isArray(activity?.enchantChanges) && activity.enchantChanges.length)
    );

    if (hasStructuredMechanicalPayload && !isNativeUtility) {
      saveActivities.push({
        ...activity,
        activityName: isGenericUtilityName(activity?.activityName)
          ? compactText(activity?.target?.template?.type)
            ? "Triggered Power"
            : "Secondary Effect"
          : activity.activityName
      });
      moved += 1;
      continue;
    }

    reroutedUtilities.push(activity);
  }

  if (!moved) return { applied: false, spec, assumptions: [] };
  next.utilityActivities = reroutedUtilities;
  next.saveActivities = saveActivities;
  return {
    applied: true,
    spec: next,
    assumptions: ["Rerouted template or save-based utility placeholders into proper save activities."]
  };
}

function repairHybridSpecFromRequest(spec, request) {
  let next = clone(spec);
  let applied = false;
  const assumptions = [];

  for (const repair of [
    repairExplicitAttunement,
    defaultMultiPropertyAttunement,
    repairRequestedSkillAdvantage,
    repairRequestedDarkvision,
    repairGenericSummonProfileActors,
    repairRequestedSpellcastingBonuses,
    reroutePassiveKind,
    rerouteExplicitArmorSuite,
    promoteExplicitConditionOnHit,
    clearDefaultWeaponWorkflowMechanics,
    rerouteWeaponHybridKind,
    repairStaffWeaponBase,
    repairKnownWeaponBase,
    recoverWeaponExtraDamage,
    applyHybridDefaults,
    recoverArtifactPassiveFeatures,
    addNamedSpellActivities,
    enrichNamedSpellActivities,
    clearResolvedSpellMechanics,
    addNamedAttackActivities,
    addNamedSaveActivities,
    repairMalformedSaveActivities,
    repairExplicitConsumableTargets,
    addGenericSaveActivity,
    recoverUnnamedSpellAttack,
    addHealingActivity,
    addSummonActivity,
    normalizeSummonUseConsumption,
    dropDuplicateSummonUtilities,
    promoteSummonOnlyMultiProfileSpec,
    clearResolvedSummonMechanics,
    clearResolvedResistanceMechanics,
    repairNativeEnchantDamage,
    addEnchantActivity,
    rerouteTemplateUtilityActivities,
    dropRedundantWeaponRiderActivities
  ]) {
    const result = repair(next, request);
    next = result.spec;
    if (result.applied) {
      applied = true;
      assumptions.push(...(result.assumptions ?? []));
    }
  }

  const beforeUtilityCount = (next.utilityActivities ?? []).length;
  const beforeSaveCount = (next.saveActivities ?? []).length;
  next = dropGenericPlaceholders(next);
  const removedPlaceholders = beforeUtilityCount !== (next.utilityActivities ?? []).length
    || beforeSaveCount !== (next.saveActivities ?? []).length;
  if (removedPlaceholders) {
    applied = true;
    assumptions.push("Removed empty placeholder activities that were left behind after repair.");
  }
  delete next._placeholderDropCount;
  return {
    applied,
    spec: next,
    assumptions: uniqueStrings(assumptions)
  };
}

export { repairHybridSpecFromRequest };
