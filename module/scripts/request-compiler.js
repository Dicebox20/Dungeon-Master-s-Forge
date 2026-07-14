import { splitItemRequests } from "./request-normalization.js";
import { consumableProjectileFallbackImage } from "./system-art-enrichment.js";

const COMPILER_VERSION = "2.4.0";
const DEFAULT_SAVE_DC = 13;

const KNOWN_CASTING_SPELLS = /\b(?:clairvoyance|command|ice\s+storm|cone\s+of\s+cold|flame\s+strike|burning\s+hands|thunderwave|ice\s+knife|ray\s+of\s+sickness)\b/i;

const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder"
];

const WEAPONS = {
  dagger: { weaponType: "simpleM", baseItem: "dagger", damage: [1, 4, "piercing"], properties: ["mgc", "fin", "lgt", "thr"], range: { value: 20, long: 60, reach: 5, units: "ft" }, img: "icons/weapons/daggers/dagger-curved-red.webp" },
  greataxe: { weaponType: "martialM", baseItem: "greataxe", damage: [1, 12, "slashing"], properties: ["mgc", "hvy", "two"], img: "icons/weapons/axes/axe-double.webp" },
  lance: { weaponType: "martialM", baseItem: "lance", damage: [1, 10, "piercing"], properties: ["mgc", "rch"], img: "icons/weapons/polearms/spear-flared-silver-pink.webp" },
  longsword: { weaponType: "martialM", baseItem: "longsword", damage: [1, 8, "slashing"], versatile: [1, 10, "slashing"], properties: ["mgc", "ver"], img: "icons/weapons/swords/sword-guard.webp" },
  mace: { weaponType: "simpleM", baseItem: "mace", damage: [1, 6, "bludgeoning"], properties: ["mgc"], img: "icons/weapons/maces/mace-round-spiked-black.webp" },
  quarterstaff: { weaponType: "simpleM", baseItem: "quarterstaff", damage: [1, 6, "bludgeoning"], versatile: [1, 8, "bludgeoning"], properties: ["mgc", "ver"], img: "icons/weapons/staves/staff-ornate.webp" },
  rapier: { weaponType: "martialM", baseItem: "rapier", damage: [1, 8, "piercing"], properties: ["mgc", "fin"], img: "icons/weapons/swords/sword-guard-steel-green.webp" },
  shortsword: { weaponType: "martialM", baseItem: "shortsword", damage: [1, 6, "piercing"], properties: ["mgc", "fin", "lgt"], img: "icons/weapons/swords/shortsword-guard.webp" },
  spear: { weaponType: "simpleM", baseItem: "spear", damage: [1, 6, "piercing"], versatile: [1, 8, "piercing"], properties: ["mgc", "thr", "ver"], range: { value: 20, long: 60, reach: 5, units: "ft" }, img: "icons/weapons/polearms/spear-hooked-broad.webp" },
  trident: { weaponType: "martialM", baseItem: "trident", damage: [1, 6, "piercing"], versatile: [1, 8, "piercing"], properties: ["mgc", "thr", "ver"], range: { value: 20, long: 60, reach: 5, units: "ft" }, img: "icons/weapons/polearms/trident-silver-blue.webp" },
  warhammer: { weaponType: "martialM", baseItem: "warhammer", damage: [1, 8, "bludgeoning"], versatile: [1, 10, "bludgeoning"], properties: ["mgc", "ver"], img: "icons/weapons/hammers/hammer-double-steel.webp" },
  rifle: { weaponType: "martialR", baseItem: "", damage: [1, 10, "piercing"], properties: ["mgc", "amm", "fir", "lod", "two"], range: { value: 80, long: 240, reach: null, units: "ft" }, img: "icons/weapons/guns/gun-rifle.webp" },
  musket: { weaponType: "martialR", baseItem: "musket", damage: [1, 12, "piercing"], properties: ["mgc", "amm", "fir", "lod", "two"], range: { value: 40, long: 120, reach: null, units: "ft" }, img: "icons/weapons/guns/gun-rifle.webp" }
};

const CREATURES = {
  cat: { size: "tiny", type: "beast", ac: 12, hp: 2, walk: 40, abilities: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 }, attack: [1, 1, "slashing"], img: "icons/creatures/mammals/cat-hunched-glowing-red.webp" },
  wolf: { size: "med", type: "beast", ac: 13, hp: 11, walk: 40, abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 }, attack: [2, 4, "piercing"], img: "icons/creatures/mammals/wolf-howl-moon-black.webp" }
};

const SAVE_SPELLS = {
  "ice storm": {
    name: "Ice Storm",
    img: "icons/magic/air/weather-clouds-snow.webp",
    chargeCost: 4,
    range: { value: 300, units: "ft" },
    target: {
      template: { count: "1", type: "cylinder", size: 20, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius, 40-foot-high cylinder" },
      prompt: true
    },
    saveAbility: "dex",
    damageParts: [
      { number: 2, denomination: 8, bonus: "", types: ["bludgeoning"] },
      { number: 4, denomination: 6, bonus: "", types: ["cold"] }
    ]
  },
  "cone of cold": {
    name: "Cone of Cold",
    img: "icons/magic/water/projectiles-ice-faceted-salvo-blue.webp",
    chargeCost: 5,
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cone", size: 60, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 60-foot cone" },
      prompt: true
    },
    saveAbility: "con",
    damageParts: [{ number: 8, denomination: 8, bonus: "", types: ["cold"] }]
  }
};

const FIEND_SUMMON_PROFILES = {
  demon: {
    name: "Demon",
    img: "icons/creatures/abilities/mouth-teeth-rows-red.webp",
    hp: 50,
    movement: { walk: 40, climb: 40, units: "ft" },
    attack: {
      name: "Bite",
      img: "icons/creatures/abilities/fangs-teeth-bite-red.webp",
      damage: { number: 1, denomination: 12, bonus: "9", types: ["necrotic"] }
    }
  },
  devil: {
    name: "Devil",
    img: "icons/creatures/unholy/demon-horned-winged-laughing.webp",
    hp: 40,
    movement: { walk: 40, fly: 60, units: "ft" },
    attack: {
      name: "Fiery Strike",
      img: "icons/magic/fire/projectile-fireball-orange.webp",
      damage: { number: 2, denomination: 6, bonus: "9", types: ["fire"] },
      range: { value: 150, units: "ft" }
    }
  },
  yugoloth: {
    name: "Yugoloth",
    img: "icons/creatures/unholy/demon-fanged-horned-yellow.webp",
    hp: 60,
    movement: { walk: 40, units: "ft" },
    attack: {
      name: "Claws",
      img: "icons/creatures/claws/claw-talons-glowing-orange.webp",
      damage: { number: 1, denomination: 8, bonus: "9", types: ["slashing"] }
    }
  }
};

function titleCase(value) {
  return value.replace(/\b\w/g, character => character.toUpperCase());
}

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

function requestClauses(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .split(/\n+|(?<=[.!?;])\s+/)
    .map(value => value.trim())
    .filter(Boolean);
}

function matchingClause(text, pattern) {
  const matches = requestClauses(text).filter(clause => pattern.test(clause));
  return matches[matches.length - 1] ?? String(text).trim();
}

function withoutMatchingClauses(text, pattern) {
  return requestClauses(text).filter(clause => !pattern.test(clause)).join("\n");
}

function unresolvedMechanic(name, category, label, requestedText, reason, handling) {
  return {
    id: stableId(`${name} ${category} ${requestedText}`),
    category,
    label,
    requestedText,
    reason,
    handling,
    resolved: false
  };
}

function collectUnresolvedMechanics(context) {
  const { request, name, warnings, deferred } = context;
  const mechanics = [];

  if (/\baura\b/i.test(request)) {
    mechanics.push(unresolvedMechanic(
      name,
      "allyAura",
      "Ally-affecting aura",
      matchingClause(request, /\baura\b/i),
      "No compatible aura automation is available in this Foundry environment.",
      "Adjudicate the aura manually until a compatible aura module is available."
    ));
    warnings.push("Automated ally auras are deferred in this Foundry environment.");
    deferred.push("The aura was recorded in unresolvedMechanics for explicit review and manual adjudication.");
  }

  if (/\b(?:ki|focus points?|sorcery points?|bardic inspiration)\b/i.test(request)) {
    mechanics.push(unresolvedMechanic(
      name,
      "classResource",
      "Class-specific resource",
      matchingClause(request, /\b(?:ki|focus points?|sorcery points?|bardic inspiration)\b/i),
      "Class resource storage varies by rules edition, imported actor, and embedded class feature.",
      "Restore or spend the named resource manually after using the item power."
    ));
    warnings.push("Class-specific resource automation is deferred.");
    deferred.push("The class-resource clause was recorded in unresolvedMechanics for explicit review.");
  }

  const unknownSpellClauses = requestClauses(request)
    .filter(clause => /\bcasts?\b/i.test(clause) && !KNOWN_CASTING_SPELLS.test(clause));
  for (const clause of unknownSpellClauses) {
    mechanics.push(unresolvedMechanic(
      name,
      "unmappedSpell",
      "Unmapped spell casting",
      clause,
      "The named spell is not yet in the deterministic local spell map.",
      "Review the spell clause and add an activity manually or use a future provider mapping."
    ));
  }
  if (unknownSpellClauses.length) {
    warnings.push("One or more named spells are not yet in the local spell map.");
    deferred.push("Each unmapped spell clause was recorded in unresolvedMechanics for explicit review.");
  }

  return mechanics;
}

function parseFields(request) {
  const fields = {};
  for (const line of request.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]{2,40}):\s*(.+?)\s*$/);
    if (match) fields[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return fields;
}

function firstTitleLine(request) {
  const line = request.split(/\r?\n/).map(value => value.trim()).find(Boolean) ?? "";
  if (!line || line.includes(":") || line.length > 80 || /^(make|create|build|design)\b/i.test(line)) return "";
  return line;
}

function detectWeapon(text) {
  return Object.keys(WEAPONS).find(name => new RegExp(`\\b${name}\\b`, "i").test(text));
}

function detectCreature(text) {
  return Object.keys(CREATURES).find(name => new RegExp(`\\b${name}\\b`, "i").test(text));
}

function detectSaveSpells(text) {
  return Object.entries(SAVE_SPELLS)
    .filter(([key]) => new RegExp(`\\b${key.replace(/ /g, "\\s+")}\\b`, "i").test(text))
    .map(([, profile]) => profile);
}

function detectThrowableConsumableSubject(text) {
  if (/\balchemist(?:'s)?\s+fire\b/i.test(text)) return "alchemist fire";
  if (/\bacid\s+flask\b/i.test(text)) return "acid flask";
  if (/\bholy\s+water\b/i.test(text)) return "holy water";
  if (/\bgrenade\b/i.test(text)) return "grenade";
  if (/\bbomb\b/i.test(text)) return "bomb";
  if (/\bflask\b/i.test(text)) return "flask";
  if (/\bvial\b/i.test(text)) return "vial";
  return "";
}

function looksLikeThrowableConsumable(text) {
  if (!/\b(?:grenade|bomb|flask|vial|alchemist(?:'s)?\s+fire|acid\s+flask|holy\s+water)\b/i.test(text)) return false;
  return /\b(?:throw|thrown|hurl|lob|splash|burst|explode|explodes?)\b/i.test(text);
}

function detectFiendProfiles(text) {
  const normalized = text.replace(/yuguloth/gi, "yugoloth");
  return Object.entries(FIEND_SUMMON_PROFILES)
    .filter(([key]) => new RegExp(`\\b${key}\\b`, "i").test(normalized))
    .map(([, profile]) => profile);
}

function detectRarity(text) {
  const rarities = [
    ["artifact", "artifact"], ["legendary", "legendary"], ["very rare", "veryRare"],
    ["rare", "rare"], ["uncommon", "uncommon"], ["common", "common"]
  ];
  return rarities.find(([label]) => text.toLowerCase().includes(label))?.[1] ?? "uncommon";
}

function detectName(request, fields, subject, assumptions) {
  const explicit = fields["item name"] ?? fields.name;
  if (explicit) return explicit;
  if (/\balchemist(?:'s)?\s+fire\b/i.test(request)) return "Alchemist Fire";
  if (/\bacid\s+flask\b/i.test(request)) return "Acid Flask";
  if (/\bholy\s+water\b/i.test(request)) return "Holy Water";
  const title = firstTitleLine(request);
  if (title) return title;
  const named = request.match(/\b(?:named|called)\s+["']?([^"'.,;\n]+)["']?/i)?.[1]?.trim();
  if (named) return named;

  const damageType = DAMAGE_TYPES.find(type => new RegExp(`\\b${type}\\b`, "i").test(request));
  const inferred = damageType ? `${titleCase(damageType)} ${titleCase(subject)}` : `Forge ${titleCase(subject)}`;
  assumptions.push(`No item name was supplied; inferred "${inferred}".`);
  return inferred;
}

function parseDamage(text) {
  const parts = [];
  const pattern = /(\d+)d(\d+)(?:\s*\+\s*([+-]?\d+))?\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)(?:\s+damage)?/gi;
  for (const match of text.matchAll(pattern)) {
    parts.push({
      number: Number(match[1]),
      denomination: Number(match[2]),
      bonus: match[3] ?? "",
      types: [match[4].toLowerCase()],
      index: match.index ?? 0
    });
  }
  return parts;
}

function parseUses(text, fallback = null) {
  const wordUses = text.match(/\b(once|twice|thrice)\b/i)?.[1]?.toLowerCase();
  const wordValue = { once: "1", twice: "2", thrice: "3" }[wordUses];
  const uses = text.match(/\b(\d+)\s+(?:charges?|uses?|times?)\b/i)?.[1] ?? wordValue ?? fallback;
  if (uses == null) return null;

  let recovery = [];
  if (/short\s+rest/i.test(text)) recovery = [{ period: "sr", type: "recoverAll", formula: "" }];
  else if (/long\s+rest/i.test(text)) recovery = [{ period: "lr", type: "recoverAll", formula: "" }];
  else if (/dawn|daily/i.test(text)) {
    const formula = text.match(/regains?\s+([^.;\n]+?)\s+(?:charges?|uses?)/i)?.[1]?.trim() ?? "";
    recovery = [{ period: "dawn", type: formula ? "formula" : "recoverAll", formula }];
  }

  return { max: String(uses), recovery, autoDestroy: /consumed|destroyed|one[- ]use/i.test(text) };
}

function parseSave(text, rarity) {
  const abilityNames = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
  const abilityPattern = "(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)";
  const dcFirst = text.match(new RegExp(`dc\\s*(\\d+)\\s*${abilityPattern}(?:\\s+saving)?\\s+(?:throw|save)`, "i"));
  const abilityFirst = text.match(new RegExp(`${abilityPattern}(?:\\s+saving)?\\s+(?:throw|save)(?:[^\\d]|\\b(?:dc)\\b){0,16}(?:(\\d+)(?!\\s*d))?`, "i"));
  const match = dcFirst ?? abilityFirst;
  if (!match) return null;

  const abilityText = dcFirst ? match[2] : match[1];
  const dcText = dcFirst ? match[1] : match[2];
  const defaultDc = DEFAULT_SAVE_DC;
  return { ability: abilityNames[abilityText.toLowerCase()] ?? abilityText.toLowerCase(), dc: Number(dcText ?? defaultDc) };
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function hasDefaultableMagicalBonus(spec = {}) {
  const current = normalizeMagicalBonusText(spec.magicalBonus);
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

function normalizeSaveEntry(save, assumptions) {
  if (!save || typeof save !== "object") return save;
  const next = { ...save };
  const dc = Number(next.dc);
  if (!Number.isFinite(dc) || dc <= 0) {
    next.dc = DEFAULT_SAVE_DC;
    assumptions.push(`No save DC was supplied; used DC ${DEFAULT_SAVE_DC}.`);
  }
  return next;
}

function applyLocalCompilerDefaults(spec, assumptions = []) {
  const next = structuredClone(spec);
  if (hasDefaultableMagicalBonus(next)) {
    next.magicalBonus = "1";
    assumptions.push("No magical bonus was supplied; used +1 by default.");
  }

  if (next.save) next.save = normalizeSaveEntry(next.save, assumptions);
  if (next.conditionOnHit?.save) {
    next.conditionOnHit = {
      ...next.conditionOnHit,
      save: normalizeSaveEntry(next.conditionOnHit.save, assumptions)
    };
  }

  for (const listName of ["activities", "saveActivities", "utilityActivities", "attackActivities"]) {
    if (!Array.isArray(next[listName])) continue;
    next[listName] = next[listName].map(activity => {
      if (!activity?.save) return activity;
      return {
        ...activity,
        save: normalizeSaveEntry(activity.save, assumptions)
      };
    });
  }

  return next;
}

function parseActivation(text) {
  if (/bonus action/i.test(text)) return "bonus";
  if (/reaction/i.test(text)) return "reaction";
  return "action";
}

function parseRange(text, fallback = { units: "self" }) {
  const match = text.match(/\b(\d+)\s*[- ]?(?:foot|feet)\b/i) ?? text.match(/\b(\d+)\s*ft\.?\b/i);
  return match ? { value: Number(match[1]), units: "ft" } : fallback;
}

function parseTarget(text) {
  const radiusArea = text.match(/\b(\d+)\s*[- ]?(?:foot|feet)\s*[- ]?radius\s+(sphere|cylinder)\b/i);
  if (radiusArea) {
    return {
      template: { count: "1", type: radiusArea[2].toLowerCase(), size: Number(radiusArea[1]), units: "ft" },
      affects: { type: "creature", choice: false },
      prompt: true
    };
  }
  const area = text.match(/\b(\d+)\s*[- ]?(?:foot|feet)\s+(cone|cube|line|radius|sphere|cylinder)\b/i);
  if (!area) return { affects: { count: "1", type: "creature" }, prompt: true };
  return {
    template: { count: "1", type: area[2].toLowerCase(), size: Number(area[1]), units: "ft" },
    affects: { type: "creature", choice: false },
    prompt: true
  };
}

function consumableProjectileImg(text) {
  return consumableProjectileFallbackImage({ itemType: "consumable" }, text)
    || "icons/consumables/potions/potion-flask-corked-orange.webp";
}

function parseDuration(text, fallback = { value: 1, units: "hour", seconds: 3600, concentration: false }) {
  const match = text.match(/\b(\d+)\s*(seconds?|minutes?|hours?)\b/i);
  if (!match) return fallback;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const units = unit.startsWith("second") ? "second" : unit.startsWith("minute") ? "minute" : "hour";
  const multiplier = units === "second" ? 1 : units === "minute" ? 60 : 3600;
  return { value, units, seconds: value * multiplier, concentration: /concentration/i.test(text) };
}

function baseDamage(part) {
  return { number: part[0], denomination: part[1], bonus: "@mod", types: [part[2]] };
}

function diePart(part) {
  return { number: part.number, denomination: part.denomination, bonus: part.bonus, types: part.types };
}

function spellChargeCost(text, spell, fallback) {
  const spellPattern = spell.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const occurrences = Array.from(text.matchAll(new RegExp(spellPattern, "gi")));
  for (const occurrence of occurrences) {
    const clause = text.slice(occurrence.index, (occurrence.index ?? 0) + 180);
    const cost = clause.match(/(?:costs?|spend|expend(?:s)?)\s*(\d+)\s*charges?/i)?.[1]
      ?? clause.match(/[:\-]\s*(\d+)\s*charges?/i)?.[1];
    if (cost) return Number(cost);
  }
  return fallback;
}

function compileMultiSpellItem(context, spells) {
  const { request, name, rarity, attunement, assumptions } = context;
  const uses = parseUses(request, "10");
  if (!/\b\d+\s+charges?\b/i.test(request)) assumptions.push("No shared charge maximum was supplied; used 10 charges.");
  const saveDc = Number(request.match(/\b(?:spell\s+save\s+)?dc\s*(\d+)/i)?.[1]
    ?? (["legendary", "artifact"].includes(rarity) ? 18 : rarity === "veryRare" ? 16 : rarity === "rare" ? 15 : 13));

  return {
    kind: "multiActivityStaff",
    name,
    img: /\bwand\b/i.test(request)
      ? "icons/weapons/wands/wand-gem-violet.webp"
      : "icons/weapons/staves/staff-ornate-blue-jewel.webp",
    description: request,
    rarity,
    attunement,
    equipmentType: "wondrous",
    baseItem: /\bwand\b/i.test(request) ? "" : "staff",
    properties: ["mgc", "foc"],
    uses,
    activities: spells.map((spell, index) => ({
      activityId: stableId(`${name} ${spell.name}`),
      activityName: `Cast ${spell.name}`,
      activityImg: spell.img,
      sort: index * 100000,
      activationType: "action",
      chargeCost: spellChargeCost(request, spell, spell.chargeCost),
      chatFlavor: `Spend charges to cast ${spell.name} from ${name}.`,
      range: spell.range,
      target: spell.target,
      save: { ability: spell.saveAbility, dc: saveDc },
      damageOnSave: "half",
      damageParts: spell.damageParts
    }))
  };
}

function compileMultiProfileFiendSummon(context, profiles) {
  const { request, name, rarity, attunement, assumptions } = context;
  const uses = parseUses(request, "1");
  if (!/\b(?:once|twice|thrice|\d+\s+(?:charges?|uses?|times?))\b/i.test(request)) {
    assumptions.push("No use limit was supplied; used one use.");
  }
  const abilities = { str: 13, dex: 16, con: 15, int: 10, wis: 10, cha: 16 };

  return {
    kind: "nativeMultiProfileSummon",
    name,
    img: "icons/commodities/stone/stone-symbol-pentagram-purple.webp",
    description: request,
    rarity,
    attunement,
    equipmentType: "wondrous",
    properties: ["mgc"],
    uses,
    activityId: stableId(`${name} Call Fiend`),
    activityName: "Call Fiendish Spirit",
    activityImg: "icons/magic/symbols/runes-star-pentagon-orange.webp",
    activationType: parseActivation(request),
    chargeCost: 1,
    chatFlavor: `Choose ${profiles.map(profile => profile.name).join(", ")}, then place the friendly spirit within range.`,
    duration: { value: 1, units: "hour", concentration: true },
    range: parseRange(request, { value: 90, units: "ft" }),
    target: {
      affects: { count: "1", type: "space", special: "An unoccupied space you can see within range" },
      prompt: true
    },
    summonProfiles: profiles.map(profile => ({
      profileId: stableId(`${name} ${profile.name}`),
      profileName: profile.name,
      actor: {
        name: `Forge Summon - ${name} - ${profile.name}`,
        tokenName: `Fiend Spirit ${profile.name}`,
        img: profile.img,
        tokenImg: profile.img,
        tokenWidth: 2,
        tokenHeight: 2,
        size: "lg",
        type: "fiend",
        subtype: profile.name,
        alignment: "Neutral",
        ac: 18,
        hp: { value: profile.hp, max: profile.hp },
        movement: profile.movement,
        abilities,
        darkvision: 60,
        items: [{
          name: profile.attack.name,
          img: profile.attack.img,
          damage: profile.attack.damage,
          range: profile.attack.range,
          description: `${profile.attack.name} attack for the ${profile.name} fiend spirit.`
        }]
      }
    }))
  };
}

function compileNativeEnchant(context) {
  const { request, name, rarity, attunement, assumptions, warnings } = context;
  const damageParts = parseDamage(request);
  const damageType = DAMAGE_TYPES.find(type => new RegExp(`\\b${type}\\s+damage\\b`, "i").test(request));
  if (!damageParts.length && damageType) {
    damageParts.push({ number: 1, denomination: 4, bonus: "", types: [damageType] });
    assumptions.push(`No die was supplied for the ${damageType} enchantment damage; used 1d4.`);
  }
  if (!damageParts.length) warnings.push("No supported extra-damage enchantment was detected; review the enchantment changes before creation.");

  const targetType = /\b(?:armor|shield)\b/i.test(request) ? "equipment" : "weapon";
  const targetLabel = targetType === "weapon" ? "One weapon" : "One suit of armor or shield";
  const duration = parseDuration(request);
  const uses = parseUses(request, "1");
  const changes = [{ key: "system.properties", mode: "ADD", value: "mgc" }];
  if (damageParts[0]) {
    changes.push({
      key: "system.damage.parts",
      mode: "ADD",
      value: { damage: diePart(damageParts[0]) }
    });
  }

  return {
    kind: "nativeEnchant",
    name,
    img: "icons/consumables/potions/flask-red-bubbles-vortex.webp",
    description: request,
    rarity,
    attunement,
    itemType: "consumable",
    consumableType: "potion",
    properties: ["mgc"],
    uses: { ...uses, autoDestroy: true },
    effectId: stableId(`${name} Effect`),
    effectName: `${name} Enchantment`,
    effectImg: "icons/magic/fire/dagger-rune-enchant-flame-orange.webp",
    activityId: stableId(`${name} Apply`),
    activityName: `Apply ${name}`,
    activityImg: "icons/magic/fire/dagger-rune-enchant-flame-orange.webp",
    activationType: parseActivation(request),
    chargeCost: 1,
    chatFlavor: `Apply ${name} to ${targetLabel.toLowerCase()} within reach.`,
    duration,
    range: { units: "touch" },
    target: { affects: { count: "1", type: "object", special: targetLabel }, prompt: false },
    restrictions: {
      allowMagical: /\b(?:magical|magic)\s+(?:weapon|armor|shield)s?\b/i.test(request),
      categories: [],
      properties: [],
      type: targetType
    },
    enchantChanges: changes
  };
}

function compileEquipmentAttack(context) {
  const { request, name, rarity, attunement, assumptions } = context;
  const damageParts = parseDamage(request);
  if (!damageParts.length) {
    const damageType = DAMAGE_TYPES.find(type => new RegExp(`\\b${type}\\b`, "i").test(request)) ?? "force";
    damageParts.push({ number: 2, denomination: 6, bonus: "", types: [damageType] });
    assumptions.push(`No attack damage formula was supplied; used 2d6 ${damageType} damage.`);
  }
  const uses = parseUses(request) ?? { max: "", recovery: [], autoDestroy: false };
  const abilityNames = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
  const abilityText = request.match(/\b(?:using|uses?|with)\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/i)?.[1]?.toLowerCase();
  const attackType = /\bmelee\b/i.test(request) ? "melee" : "ranged";
  const chargeCost = Number(request.match(/(?:spend|costs?|expend)\s*(\d+)\s*charges?/i)?.[1] ?? 0);

  return {
    kind: "equipmentPowerSuite",
    name,
    img: /\b(?:helm|helmet|circlet|crown)\b/i.test(request)
      ? "icons/equipment/head/helm-barbute-horned-purple.webp"
      : "icons/equipment/neck/amulet-round-blue.webp",
    description: request,
    rarity,
    attunement,
    equipmentType: "wondrous",
    properties: ["mgc"],
    uses,
    effects: [],
    utilityActivities: [],
    saveActivities: [],
    attackActivities: [{
      activityId: stableId(`${name} Attack`),
      activityName: request.match(/\b(?:called|named)\s+["']?([^"'.,;\n]+)/i)?.[1]?.trim() ?? `${name} Attack`,
      activityImg: "icons/magic/control/energy-stream-link-teal.webp",
      activationType: parseActivation(request),
      chargeCost,
      chatFlavor: `Make the ${attackType} attack granted by ${name}.`,
      range: attackType === "melee" ? { value: 5, units: "ft" } : parseRange(request, { value: 60, units: "ft" }),
      target: { affects: { count: "1", type: "enemy" }, prompt: true },
      ability: abilityNames[abilityText] ?? (/psychic/i.test(request) ? "int" : "spellcasting"),
      attackBonus: "@prof",
      attackType,
      attackClassification: "spell",
      damageParts: damageParts.map(diePart)
    }]
  };
}

function compileThrowableConsumableAttack(context) {
  const { request, name, rarity, attunement, warnings, deferred } = context;
  const damageParts = parseDamage(request);
  if (!damageParts.length) {
    const damageType = DAMAGE_TYPES.find(type => new RegExp(`\\b${type}\\b`, "i").test(request)) ?? "fire";
    damageParts.push({ number: 1, denomination: 4, bonus: "", types: [damageType] });
  }
  const uses = parseUses(request, "1") ?? { max: "1", recovery: [], autoDestroy: true };
  const target = { affects: { count: "1", type: "enemy" }, prompt: true };
  const range = parseRange(request, { value: 20, units: "ft" });
  const ongoingClause = /\b(?:at the start of each of its turns|until .* extinguish|until extinguished|ongoing|continues? to burn)\b/i.test(request);

  const spec = {
    kind: "equipmentPowerSuite",
    name,
    img: consumableProjectileImg(request),
    description: request,
    rarity,
    attunement,
    itemType: "consumable",
    consumableType: /\b(?:acid|poison)\b/i.test(request) ? "poison" : "trinket",
    properties: [],
    uses: { ...uses, autoDestroy: true },
    effects: [],
    utilityActivities: [],
    saveActivities: [],
    attackActivities: [{
      activityId: stableId(`${name} Throw`),
      activityName: /\balchemist(?:'s)?\s+fire\b/i.test(request) ? "Throw Alchemist Fire" : `Throw ${name}`,
      activityImg: consumableProjectileImg(request),
      activationType: parseActivation(request),
      chargeCost: 1,
      chatFlavor: `Throw ${name}.`,
      range,
      target,
      ability: "dex",
      attackBonus: "@prof",
      attackType: "ranged",
      attackClassification: "weapon",
      damageParts: damageParts.map(diePart)
    }]
  };

  if (ongoingClause) {
    warnings.push("The projectile's ongoing burn or extinguish clause requires manual follow-through after the initial hit.");
    deferred.push("The ongoing damage clause was preserved for table handling after the initial thrown attack resolves.");
    spec.unresolvedMechanics = [
      unresolvedMechanic(
        name,
        "tableAdjudication",
        "Ongoing thrown-consumable effect",
        matchingClause(request, /\b(?:at the start of each of its turns|until .* extinguish|until extinguished|ongoing|continues? to burn)\b/i),
        "The initial thrown attack is supported, but the follow-up burning or extinguish sequence is not fully automated for consumable projectiles.",
        "Resolve the initial attack natively, then track the ongoing damage or extinguish condition manually."
      )
    ];
  }

  return spec;
}

function compileThrowableConsumableSave(context) {
  const spec = compileSaveDamage(context);
  return {
    ...spec,
    img: consumableProjectileImg(context.request),
    itemType: "consumable",
    consumableType: /\b(?:acid|poison)\b/i.test(context.request) ? "poison" : "trinket",
    uses: {
      ...(spec.uses ?? { max: "1", recovery: [] }),
      autoDestroy: true
    },
    activityName: /\b(?:grenade|bomb)\b/i.test(context.request) ? `Throw ${context.name}` : (spec.activityName ?? `Use ${context.name}`)
  };
}

function parseLightRadii(text) {
  const bright = Number(text.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?bright\s+light/i)?.[1] ?? 20);
  const dimMatch = text.match(/\b(additional\s+)?(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?dim\s+light/i);
  const dimValue = Number(dimMatch?.[2] ?? 20);
  return { bright, dim: dimMatch?.[1] ? bright + dimValue : Math.max(bright, dimValue) };
}

function compileHybridArtifact(context) {
  const { request, name, rarity, attunement, weaponName, assumptions } = context;
  const flameIndex = request.search(/\bflame\s+strike\b/i);
  const weaponClause = flameIndex >= 0 ? request.slice(0, flameIndex) : request;
  const weaponSpec = compileWeapon({
    ...context,
    request: weaponClause,
    lower: weaponClause.toLowerCase()
  });
  const flameClause = flameIndex >= 0 ? request.slice(flameIndex) : "";
  const flameDamage = parseDamage(flameClause);
  if (!flameDamage.length) {
    flameDamage.push(
      { number: 4, denomination: 6, bonus: "", types: ["fire"] },
      { number: 4, denomination: 6, bonus: "", types: ["radiant"] }
    );
    assumptions.push("No Flame Strike damage was supplied; used the tested 4d6 fire plus 4d6 radiant profile.");
  }
  const save = parseSave(flameClause || request, rarity) ?? { ability: "dex", dc: 18 };
  const radii = parseLightRadii(request);
  const acChanges = passiveChanges(request).filter(change => change.key === "system.attributes.ac.bonus");
  if (!acChanges.length) assumptions.push("No passive AC bonus was supplied; the artifact has no passive armor effect.");

  return {
    ...weaponSpec,
    kind: "artifactWeaponHybrid",
    name,
    img: weaponName === "greataxe"
      ? "icons/weapons/axes/axe-double-fire-orange.webp"
      : weaponSpec.img,
    description: request,
    rarity,
    attunement,
    uses: parseUses(request, "1"),
    attackName: `Attack with ${name}`,
    passiveEffects: acChanges.length ? [{
      effectId: stableId(`${name} Armor`),
      name: `${name} Guard`,
      changes: acChanges
    }] : [],
    toggleLight: {
      activityId: stableId(`${name} Ignite`),
      activityName: "Ignite the Flame",
      activityImg: "icons/magic/fire/flame-burning-campfire-orange.webp",
      activationType: "bonus",
      effectId: stableId(`${name} Light`),
      effectName: `${name} Ignited`,
      effectImg: "icons/magic/fire/flame-burning-campfire-orange.webp",
      flagKey: `${stableId(name)}Light`,
      bright: radii.bright,
      dim: radii.dim,
      color: "#ff7a18",
      alpha: 0.35,
      animation: { type: "torch", speed: 3, intensity: 4 },
      onChat: `${name} ignites, shedding bright light for ${radii.bright} feet and dim light to ${radii.dim} feet.`,
      offChat: `${name}'s light fades.`,
      chatFlavor: `Toggle ${name}'s light.`,
      duration: { value: 10, units: "minute" },
      range: { units: "self" },
      target: { affects: { count: "1", type: "self" }, prompt: false }
    },
    utilityActivities: [],
    saveActivities: [{
      activityId: stableId(`${name} Flame Strike`),
      activityName: "Flame Strike",
      activityImg: "icons/magic/fire/beam-strike-sky-yellow-red.webp",
      activationType: "action",
      chargeCost: 1,
      chatFlavor: `Call down Flame Strike from ${name}.`,
      range: { value: 60, units: "ft" },
      target: {
        template: { count: "1", type: "cylinder", size: 10, height: 40, units: "ft" },
        affects: { type: "creature", special: "Creatures in the 10-foot-radius, 40-foot-high cylinder" },
        prompt: true
      },
      save,
      damageOnSave: "half",
      damageParts: flameDamage.map(diePart)
    }]
  };
}

function compileWeapon(context) {
  const { request, lower, name, rarity, attunement, weaponName, assumptions, warnings, deferred } = context;
  const weapon = WEAPONS[weaponName];
  const damageParts = parseDamage(request);
  const explicitBase = /base damage|deals?\s+\d+d\d+\s+\w+\s+damage/i.test(request) && !/additional|extra|plus/i.test(request.slice(0, damageParts[0]?.index ?? 0));
  let weaponBase = weapon.damage;
  let extra = damageParts;

  if (explicitBase && damageParts.length) {
    const first = damageParts[0];
    weaponBase = [first.number, first.denomination, first.types[0]];
    extra = damageParts.slice(1);
  }

  const namedDamageType = DAMAGE_TYPES.find(type => new RegExp(`\\b${type}\\s+damage\\b`, "i").test(request));
  if (!extra.length && namedDamageType && namedDamageType !== weaponBase[2]) {
    extra.push({ number: 1, denomination: 4, bonus: "", types: [namedDamageType] });
    assumptions.push(`No die was supplied for the ${namedDamageType} damage; used 1d4.`);
  }

  const magicalBonus = request.match(/\+(\d+)\b/)?.[1] ?? "";
  const condition = ["blinded", "charmed", "deafened", "frightened", "paralyzed", "poisoned", "prone", "restrained", "stunned", "unconscious"]
    .find(status => new RegExp(`\\b${status}\\b`, "i").test(lower)) ?? null;
  const save = parseSave(request, rarity);
  const durationSeconds = Number(request.match(/\b(\d+)\s+seconds?\b/i)?.[1] ?? 30);
  const kind = condition && save ? "weaponConditionOnHit" : "weaponExtraDamage";

  if (condition && !save) {
    warnings.push("The request mentions the poisoned condition without a saving throw, so it was left descriptive only.");
    deferred.push("Apply the poisoned condition manually unless a save is added.");
  }

  return {
    kind,
    name,
    img: weapon.img,
    description: request,
    rarity,
    attunement,
    weaponType: weapon.weaponType,
    baseItem: weapon.baseItem,
    properties: weapon.properties,
    damage: {
      base: baseDamage(weaponBase),
      versatile: weapon.versatile ? baseDamage(weapon.versatile) : { number: null, denomination: null, bonus: "", types: [] }
    },
    magicalBonus,
    range: weapon.range ?? { value: null, long: null, reach: 5, units: "ft" },
    extraDamageParts: extra.map(diePart),
    attackName: `Attack with ${name}`,
    ...(kind === "weaponConditionOnHit" ? {
      conditionOnHit: {
        macroName: `${name} - ${titleCase(condition)}`,
        save,
        condition,
        effectName: `${name} - ${titleCase(condition)}`,
        durationSeconds,
        img: "icons/svg/poison.svg"
      }
    } : {})
  };
}

function passiveChanges(request) {
  const changes = [];
  const shared = request.match(/\+(\d+)\s+(?:bonus\s+)?to\s+([^.;\n]+)/i);
  const sharedValue = shared?.[1];
  const sharedTargets = shared?.[2] ?? "";
  const ac = request.match(/\+(\d+)\s+(?:bonus\s+)?to\s+ac/i)?.[1]
    ?? request.match(/ac\s*\+(\d+)/i)?.[1]
    ?? (/\bac\b/i.test(sharedTargets) ? sharedValue : null);
  const saves = request.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:all\s+)?saving throws?/i)?.[1]
    ?? (/saving throws?/i.test(sharedTargets) ? sharedValue : null);
  const spell = request.match(/\+(\d+)\s+(?:bonus\s+)?to\s+spell\s+(?:attack|atk)/i)?.[1]
    ?? (/spell\s+(?:attack|atk)/i.test(sharedTargets) ? sharedValue : null);
  const spellDc = request.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:spell\s+)?(?:save\s+)?dc/i)?.[1]
    ?? (/spell\s+(?:save\s+)?dc|spell\s+dc\s+save/i.test(sharedTargets) ? sharedValue : null);
  if (ac) changes.push({ key: "system.attributes.ac.bonus", mode: "ADD", value: ac });
  if (saves) changes.push({ key: "system.bonuses.abilities.save", mode: "ADD", value: saves });
  if (spell) {
    changes.push({ key: "system.bonuses.msak.attack", mode: "ADD", value: spell });
    changes.push({ key: "system.bonuses.rsak.attack", mode: "ADD", value: spell });
  }
  if (spellDc) changes.push({ key: "system.bonuses.spell.dc", mode: "ADD", value: spellDc });
  for (const type of DAMAGE_TYPES) {
    if (new RegExp(`resistance to ${type}(?: damage)?`, "i").test(request)) {
      changes.push({ key: "system.traits.dr.value", mode: "ADD", value: type });
    }
  }
  return changes;
}

function equipmentType(text) {
  if (/\bshield\b/i.test(text)) return "shield";
  if (/\b(?:plate|chain mail|leather armor|armor)\b/i.test(text)) return "heavy";
  return "wondrous";
}

function compilePassiveEquipment(context) {
  const { request, name, rarity, attunement, assumptions, warnings } = context;
  const changes = passiveChanges(withoutMatchingClauses(request, /\baura\b/i));
  if (!changes.length) warnings.push("No supported passive bonus was detected; this item will primarily contain its description.");
  const type = equipmentType(request);
  const armorBonus = request.match(/\+(\d+)\s+(?:plate|armor|shield)/i)?.[1] ?? "";
  const armorValue = type === "shield" ? 2 : /\bplate\b/i.test(request) ? 18 : 0;
  if (type === "heavy" && !/\bplate\b/i.test(request)) assumptions.push("The armor base was not specific enough to infer a complete armor profile.");

  return {
    kind: type === "shield" ? "shieldArmorBonus" : "passiveEffectEquipment",
    name,
    img: type === "shield" ? "icons/equipment/shield/heater-steel-boss-red.webp" : "icons/equipment/head/helm-barbute-steel.webp",
    description: request,
    rarity,
    attunement,
    equipmentType: type,
    armorValue,
    magicalBonus: armorBonus,
    properties: ["mgc"],
    effects: changes.length ? [{
      effectId: stableId(`${name} Passive`),
      name: `${name} Benefits`,
      changes
    }] : []
  };
}

function compileCasterEquipment(context) {
  const { request, name, rarity, attunement, warnings } = context;
  const changes = passiveChanges(withoutMatchingClauses(request, /\baura\b/i));
  const uses = parseUses(request, "1");
  const utilityActivities = [];
  const saveActivities = [];

  if (/\bclairvoyance\b/i.test(request)) {
    utilityActivities.push({
      activityId: stableId(`${name} Clairvoyance`),
      activityName: "Cast Clairvoyance",
      activationType: "action",
      chargeCost: 1,
      range: { value: 1, units: "mi" },
      duration: { value: 10, units: "minute", concentration: true },
      chatFlavor: "Cast Clairvoyance using the item's charged power."
    });
  }

  if (/\bcommand\b/i.test(request)) {
    const suppliedSave = parseSave(request, rarity);
    saveActivities.push({
      activityId: stableId(`${name} Command`),
      activityName: "Cast Command",
      activationType: "action",
      chargeCost: 1,
      range: { value: 60, units: "ft" },
      target: { affects: { count: "1", type: "creature" }, prompt: true },
      duration: { value: 1, units: "round", concentration: false },
      save: suppliedSave ?? { ability: "wis", dc: DEFAULT_SAVE_DC },
      damageOnSave: "none",
      damageParts: [],
      chatFlavor: "The target makes the Command spell's Wisdom saving throw."
    });
  }

  const useSuite = saveActivities.length > 0;
  return {
    kind: useSuite ? "legendaryEquipmentSuite" : "casterUtilityEquipment",
    name,
    img: /\b(?:helm|helmet|crown)\b/i.test(request)
      ? "icons/equipment/head/helm-barbute-steel.webp"
      : "icons/equipment/neck/amulet-round-blue.webp",
    description: request,
    rarity,
    attunement,
    equipmentType: "wondrous",
    properties: ["mgc"],
    uses,
    effects: changes.length ? [{
      effectId: stableId(`${name} Passive`),
      name: `${name} Benefits`,
      changes
    }] : [],
    utilityActivities,
    saveActivities
  };
}

function compileHealing(context) {
  const { request, name, rarity, attunement, assumptions } = context;
  const healing = request.match(/(\d+)d(\d+)(?:\s*\+\s*([+-]?\d+))?\s+(?:hit points?|healing)/i);
  if (!healing) assumptions.push("No healing formula was supplied; used 2d4 + 2 healing.");
  const uses = parseUses(request, "1");
  return {
    kind: "chargedHealing",
    name,
    img: "icons/consumables/potions/potion-bottle-corked-red.webp",
    description: request,
    rarity,
    attunement,
    consumableType: "potion",
    uses: { ...uses, autoDestroy: uses?.autoDestroy || uses?.max === "1" },
    activityId: stableId(`${name} Heal`),
    activityName: `Use ${name}`,
    activationType: parseActivation(request),
    chargeCost: 1,
    range: { units: "self" },
    target: { affects: { count: "1", type: "self" }, prompt: false },
    healing: {
      number: Number(healing?.[1] ?? 2),
      denomination: Number(healing?.[2] ?? 4),
      bonus: healing?.[3] ?? "2",
      types: ["healing"]
    }
  };
}

function compileSaveDamage(context) {
  const { request, name, rarity, attunement, assumptions } = context;
  const damage = parseDamage(request);
  const save = parseSave(request, rarity) ?? { ability: "dex", dc: DEFAULT_SAVE_DC };
  if (!parseSave(request, rarity)) assumptions.push(`No saving throw was supplied; used DC ${save.dc} Dexterity.`);
  if (!damage.length) {
    const type = DAMAGE_TYPES.find(value => new RegExp(`\\b${value}\\b`, "i").test(request)) ?? "force";
    damage.push({ number: 2, denomination: 6, bonus: "", types: [type] });
    assumptions.push(`No damage formula was supplied; used 2d6 ${type} damage.`);
  }
  const uses = parseUses(request, /potion|consumable/i.test(request) ? "1" : "1");
  const isEquipment = /\b(?:wand|staff|rod|helm|ring|amulet|crown)\b/i.test(request);
  return {
    kind: "chargedSaveDamage",
    name,
    img: isEquipment ? "icons/weapons/wands/wand-carved-stone-shard.webp" : "icons/consumables/potions/potion-flask-corked-orange.webp",
    description: request,
    rarity,
    attunement,
    itemType: isEquipment ? "equipment" : "consumable",
    equipmentType: "wondrous",
    consumableType: "potion",
    uses: { ...uses, autoDestroy: !isEquipment && uses?.max === "1" },
    activityId: stableId(`${name} Save`),
    activityName: `Use ${name}`,
    activationType: parseActivation(request),
    chargeCost: Number(request.match(/spend\s+(\d+)\s+charges?/i)?.[1] ?? 1),
    range: /originating from (?:the wielder|you)|\bself\b/i.test(request) ? { units: "self" } : parseRange(request),
    target: parseTarget(request),
    save,
    damageOnSave: /half|half as much|half damage/i.test(request) ? "half" : "none",
    damageParts: damage.map(diePart)
  };
}

function compileSummon(context) {
  const { request, name, rarity, attunement, creatureName, assumptions, warnings } = context;
  const creature = CREATURES[creatureName];
  if (!creature) throw new Error("The local compiler currently supports cat and wolf summon profiles. Use JSON review for other creatures.");
  assumptions.push(`Used the Forge's conservative ${creatureName} summon profile; review its actor statistics before creation.`);
  if (/multiple|choose|choice| or /i.test(request)) warnings.push("Multiple summon choices require explicit profile details and were not inferred by the local compiler.");
  const uses = parseUses(request, "1");
  return {
    kind: "nativeSummon",
    name,
    img: creature.img,
    description: request,
    rarity,
    attunement,
    equipmentType: equipmentType(request),
    armorValue: /\bplate\b/i.test(request) ? 18 : 0,
    magicalBonus: request.match(/\+(\d+)\s+(?:plate|armor|shield)/i)?.[1] ?? "",
    properties: ["mgc"],
    uses,
    activityId: stableId(`${name} Summon`),
    profileId: stableId(`${name} ${creatureName} Profile`),
    activityName: `Summon ${titleCase(creatureName)}`,
    profileName: titleCase(creatureName),
    activationType: parseActivation(request),
    chargeCost: 1,
    range: parseRange(request, { value: 30, units: "ft" }),
    duration: { value: 1, units: "hour", concentration: false },
    summonActor: {
      name: `Forge Summon - ${titleCase(creatureName)}`,
      img: creature.img,
      tokenImg: creature.img,
      size: creature.size,
      type: creature.type,
      alignment: "Friendly",
      ac: creature.ac,
      hp: { value: creature.hp, max: creature.hp },
      movement: { walk: creature.walk, units: "ft" },
      abilities: creature.abilities,
      items: [{ name: `${titleCase(creatureName)} Attack`, img: creature.img, damage: baseDamage(creature.attack) }]
    }
  };
}

function compileOne(request) {
  const trimmed = String(request ?? "").trim();
  if (!trimmed) throw new Error("Describe an item before compiling.");

  const lower = trimmed.toLowerCase();
  const fields = parseFields(trimmed);
  const assumptions = [];
  const warnings = [];
  const deferred = [];
  const weaponName = detectWeapon(trimmed);
  const creatureName = detectCreature(trimmed);
  const saveSpells = detectSaveSpells(trimmed);
  const fiendProfiles = detectFiendProfiles(trimmed);
  const throwableSubject = detectThrowableConsumableSubject(trimmed);
  const rarity = detectRarity(fields.rarity ?? trimmed);
  const attunement = /attunement\s*:\s*(?:not required|no|none)|does not require attunement|no attunement/i.test(trimmed)
    ? ""
    : /attunement|required by|requires? attunement/i.test(trimmed) ? "required" : "";
  const subject = weaponName
    ?? throwableSubject
    ?? (creatureName && /summon/i.test(trimmed) ? `${creatureName} summoning item` : /potion/i.test(trimmed) ? "potion" : /shield/i.test(trimmed) ? "shield" : /helm|helmet/i.test(trimmed) ? "helm" : "item");
  const name = detectName(trimmed, fields, subject, assumptions);
  const context = { request: trimmed, lower, fields, name, rarity, attunement, weaponName, creatureName, assumptions, warnings, deferred };

  let spec;
  let pattern;
  if (weaponName
    && /\b(?:artifact|legendary)\b/i.test(trimmed)
    && /\bflame\s+strike\b/i.test(trimmed)
    && /\b(?:bright|dim)\s+light\b|\bignite\b/i.test(trimmed)) {
    pattern = "artifactWeaponHybrid";
    spec = compileHybridArtifact(context);
  } else if (/\b(?:apply|coat|anoint|enchant)\b/i.test(trimmed)
    && /\b(?:weapon|armor|shield)\b/i.test(trimmed)
    && /\b(?:oil|salve|rune|enchant)/i.test(trimmed)) {
    pattern = "nativeEnchant";
    spec = compileNativeEnchant(context);
  } else if (looksLikeThrowableConsumable(trimmed)) {
    if (parseSave(trimmed, rarity) || /\b(?:each creature|all creatures|cone|cube|line|radius|sphere|cylinder)\b/i.test(trimmed)) {
      pattern = "chargedSaveDamage";
      spec = compileThrowableConsumableSave(context);
    } else {
      pattern = "equipmentPowerSuite";
      spec = compileThrowableConsumableAttack(context);
    }
  } else if (/summon|conjure|call forth/i.test(trimmed) && fiendProfiles.length >= 2) {
    pattern = "nativeMultiProfileSummon";
    spec = compileMultiProfileFiendSummon(context, fiendProfiles);
  } else if (/summon|conjure|call forth/i.test(trimmed) && creatureName) {
    pattern = "nativeSummon";
    spec = compileSummon(context);
  } else if (saveSpells.length >= 2 && /\b(?:staff|wand|rod)\b/i.test(trimmed)) {
    pattern = "multiActivityStaff";
    spec = compileMultiSpellItem(context, saveSpells);
  } else if (!weaponName
    && /\b(?:helm|helmet|circlet|crown|ring|amulet|wand|rod|staff)\b/i.test(trimmed)
    && (/\b(?:ranged|melee)\b[^.\n]{0,80}\battack\b/i.test(trimmed)
      || /\battack\b[^.\n]{0,80}\b(?:ranged|melee)\b/i.test(trimmed))) {
    pattern = "equipmentPowerSuite";
    spec = compileEquipmentAttack(context);
  } else if (weaponName) {
    spec = compileWeapon(context);
    pattern = spec.kind;
  } else if (/heal|healing|hit points?/i.test(trimmed) && /potion|draught|vial|consumable/i.test(trimmed)) {
    pattern = "chargedHealing";
    spec = compileHealing(context);
  } else if (/\bcasts?\b/i.test(trimmed) && /\b(?:clairvoyance|command)\b/i.test(trimmed)) {
    spec = compileCasterEquipment(context);
    pattern = spec.kind;
  } else if (parseSave(trimmed, rarity) || (/damage/i.test(trimmed) && /potion|wand|staff|rod/i.test(trimmed))) {
    pattern = "chargedSaveDamage";
    spec = compileSaveDamage(context);
  } else {
    pattern = "passiveEffectEquipment";
    spec = compilePassiveEquipment(context);
  }

  if (!fields.rarity && !/\b(common|uncommon|rare|very rare|legendary|artifact)\b/i.test(trimmed)) {
    assumptions.push("No rarity was supplied; used uncommon.");
  }
  if (!/attunement|required by|requires? attunement/i.test(trimmed)) {
    assumptions.push("No attunement requirement was supplied; left attunement off.");
  }
  spec = applyLocalCompilerDefaults(spec, assumptions);
  const unresolvedMechanics = collectUnresolvedMechanics(context);
  if (unresolvedMechanics.length) spec.unresolvedMechanics = unresolvedMechanics;

  return { spec, pattern, assumptions, warnings, deferred };
}

function compileItemRequest(request) {
  const requests = splitItemRequests(request);
  if (!requests.length) throw new Error("Describe an item before compiling.");
  const results = requests.map((itemRequest, index) => {
    try {
      return compileOne(itemRequest);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Item request ${index + 1}: ${message}`);
    }
  });
  const prefixNotes = (result, values) => requests.length === 1
    ? values
    : values.map(value => `[${result.spec.name}] ${value}`);

  return {
    compilerVersion: COMPILER_VERSION,
    provider: "local-rules",
    request: String(request).trim(),
    requestCount: requests.length,
    specs: results.map(result => result.spec),
    decisions: results.map(result => ({
      name: result.spec.name,
      pattern: result.pattern,
      unresolvedCount: result.spec.unresolvedMechanics?.length ?? 0
    })),
    assumptions: results.flatMap(result => prefixNotes(result, result.assumptions)),
    warnings: results.flatMap(result => prefixNotes(result, result.warnings)),
    deferred: results.flatMap(result => prefixNotes(result, result.deferred)),
    unresolvedMechanics: results.flatMap(result => (result.spec.unresolvedMechanics ?? []).map(mechanic => ({
      itemName: result.spec.name,
      ...mechanic
    })))
  };
}

export { COMPILER_VERSION, compileItemRequest, splitItemRequests };
