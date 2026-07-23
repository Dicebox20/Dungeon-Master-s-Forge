import { createHash, randomBytes } from "node:crypto";
import { COMPOSITIONAL_CAPABILITIES, FORGE_SCHEMA_VERSION, KNOWN_SPEC_KINDS, MAX_SPECS_PER_REQUEST, PROMPT_VERSION, SERVICE_VERSION } from "./constants.mjs";
import { ServiceError } from "./errors.mjs";
import { validateRemoteContent } from "./remote-content-policy.mjs";
import { analyzeRequestIntent } from "./request-intent.mjs";
import { canonicalize } from "./result-cache.mjs";
import { validateSpecStructure } from "./spec-validation.mjs";
import { applyAutomationCapabilityRoute, normalizeAutomationCapabilities, normalizeAutomationContract } from "./automation-contract.mjs";

const ID_PATTERN = /^[A-Za-z0-9]{16}$/;

const BASE_ITEM_NAMES = Object.freeze([
  "longbow",
  "shortbow",
  "hand crossbow",
  "heavy crossbow",
  "light crossbow",
  "greatsword",
  "glaive",
  "halberd",
  "rapier",
  "trident",
  "longsword",
  "lance",
  "shortsword",
  "scimitar",
  "warhammer",
  "battleaxe",
  "quarterstaff",
  "spear",
  "dagger",
  "mace",
  "staff",
  "wand",
  "rod",
  "bow",
  "crossbow",
  "shield",
  "armor",
  "ring",
  "cloak",
  "boots",
  "helm",
  "helmet",
  "amulet",
  "bracers",
  "gloves",
  "gauntlets",
  "belt",
  "potion",
  "scroll",
  "book",
  "grimoire",
  "key",
  "lantern",
  "orb",
  "crystal"
]);

const FEATURE_NAMES = Object.freeze([
  { pattern: /\bfireball\b/i, label: "Fireball" },
  { pattern: /\b(flame|flaming|fire|burning|ember|inferno)\b/i, label: "Flame" },
  { pattern: /\b(lightning|storm|thunder|thunderbolt)\b/i, label: "Storm" },
  { pattern: /\b(cold|ice|frost|freezing)\b/i, label: "Frost" },
  { pattern: /\b(necrotic|death|grave|shadow)\b/i, label: "Shadow" },
  { pattern: /\b(psychic|mind|mental)\b/i, label: "Mind" },
  { pattern: /\b(radiant|holy|divine|sun|solar)\b/i, label: "Radiance" },
  { pattern: /\b(poison|venom|toxic)\b/i, label: "Venom" },
  { pattern: /\b(acid|corrosive)\b/i, label: "Acid" },
  { pattern: /\b(force|arcane|magic missile)\b/i, label: "Force" },
  { pattern: /\b(healing|heal|restoration)\b/i, label: "Restoration" },
  { pattern: /\b(summon|conjure|calling|call in|calls in)\b/i, label: "Summoning" },
  { pattern: /\b(light|glow|lantern|torch)\b/i, label: "Light" },
  { pattern: /\b(flying|flight|wing|wings)\b/i, label: "Flight" }
]);

const SRD_SPELL_PATTERNS = Object.freeze([
  { pattern: /\bpoison\s+spray\b/i, label: "Poison Spray" },
  { pattern: /\bray\s+of\sickness\b/i, label: "Ray of Sickness" },
  { pattern: /\bcloudkill\b/i, label: "Cloudkill" },
  { pattern: /\bcommand\b/i, label: "Command" },
  { pattern: /\bfly\b/i, label: "Fly" },
  { pattern: /\bfireball\b/i, label: "Fireball" },
  { pattern: /\blightning bolt\b/i, label: "Lightning Bolt" },
  { pattern: /\bshatter\b/i, label: "Shatter" },
  { pattern: /\bclairvoyance\b/i, label: "Clairvoyance" },
  { pattern: /\bdetect thoughts\b/i, label: "Detect Thoughts" },
  { pattern: /\bice storm\b/i, label: "Ice Storm" },
  { pattern: /\bcone of cold\b/i, label: "Cone of Cold" },
  { pattern: /\bflame strike\b/i, label: "Flame Strike" }
]);

// These profiles are deliberately small, published-mechanics recoveries. They
// are used only when a request explicitly names the spell and the model omitted
// or malformed its activity payload.
const RECOVERABLE_SPELL_PROFILES = Object.freeze([
  Object.freeze({
    name: "Poison Spray",
    type: "save",
    defaultChargeCost: 1,
    save: Object.freeze({ ability: "con" }),
    damageOnSave: "none",
    damageParts: Object.freeze([{ number: 1, denomination: 12, bonus: "", types: Object.freeze(["poison"]) }]),
    range: Object.freeze({ value: 30, units: "ft" }),
    target: Object.freeze({ affects: { count: "1", type: "creature", special: "One creature within range" }, prompt: true })
  }),
  Object.freeze({
    name: "Ray of Sickness",
    type: "attack",
    defaultChargeCost: 1,
    attackType: "ranged",
    attackClassification: "spell",
    damageParts: Object.freeze([{ number: 2, denomination: 8, bonus: "", types: Object.freeze(["poison"]) }]),
    range: Object.freeze({ value: 60, units: "ft" }),
    target: Object.freeze({ affects: { count: "1", type: "creature", special: "One creature within range" }, prompt: true })
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
    duration: Object.freeze({ value: 10, units: "minute", concentration: true })
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
    })
  }),
  Object.freeze({
    name: "Detect Thoughts",
    type: "utility",
    defaultChargeCost: 1,
    range: Object.freeze({ units: "self" }),
    target: Object.freeze({ affects: { count: "1", type: "self", special: "Self" }, prompt: false }),
    duration: Object.freeze({ value: 1, units: "minute", concentration: true })
  }),
  Object.freeze({
    name: "Slow",
    type: "save",
    defaultChargeCost: 3,
    save: Object.freeze({ ability: "wis" }),
    damageOnSave: "none",
    damageParts: Object.freeze([]),
    range: Object.freeze({ value: 120, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "cube", size: 40, units: "ft" },
      affects: { count: "6", type: "creature", special: "Up to six creatures in the 40-foot cube" },
      prompt: true
    }),
    duration: Object.freeze({ value: 1, units: "minute", concentration: true })
  }),
  Object.freeze({
    name: "Ice Storm",
    type: "save",
    defaultChargeCost: 4,
    save: Object.freeze({ ability: "dex" }),
    damageOnSave: "half",
    damageParts: Object.freeze([
      { number: 2, denomination: 8, bonus: "", types: Object.freeze(["bludgeoning"]) },
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["cold"]) }
    ]),
    range: Object.freeze({ value: 300, units: "ft" }),
    target: Object.freeze({
      template: { count: "1", type: "cylinder", size: 20, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius, 40-foot-high cylinder" },
      prompt: true
    })
  })
]);

const KNOWN_WEAPON_BASES = Object.freeze({
  dagger: { weaponType: "simpleM", baseItem: "dagger", damage: { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  mace: { weaponType: "simpleM", baseItem: "mace", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  "hand crossbow": { weaponType: "martialR", baseItem: "hand crossbow", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  "heavy crossbow": { weaponType: "martialR", baseItem: "heavy crossbow", damage: { number: 1, denomination: 10, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  "light crossbow": { weaponType: "simpleR", baseItem: "light crossbow", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  sling: { weaponType: "simpleR", baseItem: "sling", damage: { number: 1, denomination: 4, bonus: "@mod", types: ["bludgeoning"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  shortbow: { weaponType: "simpleR", baseItem: "shortbow", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  longbow: { weaponType: "martialR", baseItem: "longbow", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  shortsword: { weaponType: "martialM", baseItem: "shortsword", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  longsword: { weaponType: "martialM", baseItem: "longsword", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] }, versatile: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } },
  warhammer: { weaponType: "martialM", baseItem: "warhammer", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["bludgeoning"] }, versatile: { number: 1, denomination: 10, bonus: "@mod", types: ["bludgeoning"] } },
  battleaxe: { weaponType: "martialM", baseItem: "battleaxe", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] }, versatile: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } },
  quarterstaff: { weaponType: "simpleM", baseItem: "quarterstaff", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] }, versatile: { number: 1, denomination: 8, bonus: "@mod", types: ["bludgeoning"] } },
  spear: { weaponType: "simpleM", baseItem: "spear", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] }, versatile: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } },
  trident: { weaponType: "martialM", baseItem: "trident", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] }, versatile: { number: 1, denomination: 10, bonus: "@mod", types: ["piercing"] } },
  greataxe: { weaponType: "martialM", baseItem: "greataxe", damage: { number: 1, denomination: 12, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  greatsword: { weaponType: "martialM", baseItem: "greatsword", damage: { number: 2, denomination: 6, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  glaive: { weaponType: "martialM", baseItem: "glaive", damage: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  halberd: { weaponType: "martialM", baseItem: "halberd", damage: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  lance: { weaponType: "martialM", baseItem: "lance", damage: { number: 1, denomination: 12, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  rapier: { weaponType: "martialM", baseItem: "rapier", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  scimitar: { weaponType: "martialM", baseItem: "scimitar", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } }
});

const KNOWN_CONDITIONS = Object.freeze([
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function secureId() {
  return randomBytes(8).toString("hex");
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function comparableText(value) {
  return compactText(value).toLowerCase().replace(/[.,!?;:]+$/g, "");
}

function requestClauses(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(clause => clause.trim())
    .filter(Boolean);
}

function matchingClause(text, pattern) {
  const matches = requestClauses(text).filter(clause => pattern.test(clause));
  return matches[matches.length - 1] ?? compactText(text);
}

function titleCase(value) {
  return compactText(value)
    .toLowerCase()
    .split(/\s+/)
    .map(word => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}

function stripRequestBoilerplate(value) {
  return compactText(value)
    .replace(/^\s*item\s+name\s*:\s*.+?\s*(?:\n|$)/i, "")
    .replace(/^\s*(create|make|generate|give me|build|forge)\s+(a|an|the)?\s*/i, "")
    .replace(/^\s*(a|an|the)\s+/i, "")
    .trim();
}

function wordPattern(text) {
  return new RegExp(`\\b${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i");
}

function baseNameFromRequest(request) {
  const text = stripRequestBoilerplate(request);
  for (const base of BASE_ITEM_NAMES) {
    if (wordPattern(base).test(text)) return titleCase(base === "helmet" ? "helm" : base);
  }
  return "Magic Item";
}

function featureNamesFromRequest(request) {
  const text = stripRequestBoilerplate(request);
  const features = [];
  for (const feature of FEATURE_NAMES) {
    if (feature.pattern.test(text) && !features.includes(feature.label)) features.push(feature.label);
  }
  return features.slice(0, 2);
}

function fallbackNameFromRequest(request, index = 0) {
  const base = baseNameFromRequest(request);
  const features = featureNamesFromRequest(request);
  if (features.length === 1) return `${base} of ${features[0]}`;
  if (features.length >= 2) return `${base} of ${features[0]} and ${features[1]}`;

  const cleaned = stripRequestBoilerplate(request)
    .replace(/\b(that|which|with|has|have|can|could|casts?|deals?|does|gives?|when|and)\b.*$/i, "")
    .trim();
  if (cleaned) return titleCase(cleaned).slice(0, 60).trim();
  return index ? `Generated Item ${index + 1}` : "Generated Item";
}

function looksLikePromptCopy(name, request) {
  const cleanName = compactText(name);
  const cleanRequest = stripRequestBoilerplate(request);
  if (!cleanName) return true;
  if (comparableText(cleanName) === comparableText(cleanRequest)) return true;
  if (comparableText(cleanName) === comparableText(request)) return true;
  return cleanName.length > 48 && /\b(that|which|with|has|have|can|could|casts?|deals?|does|gives?|when|and)\b/i.test(cleanName);
}

function normalizeGeneratedName(rawName, intent, index) {
  const name = compactText(rawName);
  const explicitName = intent.explicitNames[index];
  if (explicitName) return name;

  const requestChunk = intent.chunks[index] ?? "";
  if (!name || looksLikePromptCopy(name, requestChunk)) return fallbackNameFromRequest(requestChunk, index);
  return name;
}

const PROPERTY_ALIASES = Object.freeze({
  ammunition: "amm",
  finesse: "fin",
  heavy: "hvy",
  light: "lgt",
  loading: "lod",
  magical: "mgc",
  reach: "rch",
  thrown: "thr",
  twohanded: "two",
  "two-handed": "two",
  versatile: "ver"
});

const RARITY_ALIASES = Object.freeze({
  "very rare": "veryRare",
  veryrare: "veryRare"
});

function normalizeDieDenomination(value) {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    const dieMatch = /^d(\d+)$/.exec(trimmed);
    if (dieMatch) return Number.parseInt(dieMatch[1], 10);
  }
  return value;
}

function parseDiceExpression(value) {
  const text = compactText(value);
  if (!text) return null;
  const match = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i.exec(text);
  if (!match) return null;
  const [, number, denomination, sign, bonusValue] = match;
  const bonus = sign && bonusValue ? `${sign}${bonusValue}` : "";
  return {
    number: Number.parseInt(number, 10),
    denomination: Number.parseInt(denomination, 10),
    bonus
  };
}

function normalizeDamageTypes(value, fallback = []) {
  if (Array.isArray(value)) {
    const normalized = value.map(type => compactText(type)).filter(Boolean);
    return normalized.length ? normalized : [...fallback];
  }
  const text = compactText(value);
  if (text) return [text];
  return [...fallback];
}

function hasMeaningfulNumericValue(value) {
  if (typeof value === "string" && !value.trim()) return false;
  return Number.isFinite(Number(value));
}

function stripRecoverableForbiddenFields(value) {
  if (Array.isArray(value)) return value.map(stripRecoverableForbiddenFields);
  if (!object(value)) return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "flags") continue;
    next[key] = stripRecoverableForbiddenFields(child);
  }
  return next;
}

function stripRepairForbiddenFields(value) {
  if (Array.isArray(value)) return value.map(stripRepairForbiddenFields);
  if (!object(value)) return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:flags|macroCommand|scripts?|command|rawConsole|apiToken|authorization|password|secret)$/i.test(key)) continue;
    next[key] = stripRepairForbiddenFields(child);
  }
  return next;
}

function boundedRepairText(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function boundedRepairRequest(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeRepairContext(value, maxItemsPerRequest) {
  if (!object(value)) {
    throw new ServiceError(400, "invalid_repair_context", "Repair attempts require a bounded repair context.");
  }
  const parentRequestId = boundedRepairText(value.parentRequestId, 100);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(parentRequestId)) {
    throw new ServiceError(400, "invalid_repair_context", "Repair attempts require a valid parent request id.");
  }
  if (Number(value.attempt) !== 1) {
    throw new ServiceError(400, "invalid_repair_attempt", "Only the first user-confirmed repair attempt is allowed.");
  }
  const originalRequest = boundedRepairRequest(value.originalRequest, 12000);
  const repairNotes = boundedRepairText(value.repairNotes, 4000);
  if (!originalRequest || !repairNotes) {
    throw new ServiceError(400, "invalid_repair_context", "Repair attempts require the original request and repair notes.");
  }
  if (!Array.isArray(value.currentReviewedSpecs) || !value.currentReviewedSpecs.length || value.currentReviewedSpecs.length > maxItemsPerRequest) {
    throw new ServiceError(400, "invalid_repair_context", "Repair attempts require a bounded reviewed specs array.");
  }
  const currentReviewedSpecs = stripRepairForbiddenFields(value.currentReviewedSpecs);
  validateRemoteContent(currentReviewedSpecs, { path: "$repair.currentReviewedSpecs" });
  const reviewNotes = Array.isArray(value.reviewNotes)
    ? value.reviewNotes.slice(0, 40).map(note => ({
        state: boundedRepairText(note?.state, 40),
        label: boundedRepairText(note?.label, 160),
        message: boundedRepairText(note?.message, 600),
        handling: boundedRepairText(note?.handling, 600)
      })).filter(note => note.message)
    : [];
  const deterministicFindings = Array.isArray(value.deterministicFindings)
    ? value.deterministicFindings.slice(0, 40).map(entry => boundedRepairText(entry, 600)).filter(Boolean)
    : [];
  const provenance = object(value.provenance)
    ? {
        requestFingerprint: boundedRepairText(value.provenance.requestFingerprint, 120),
        specFingerprint: boundedRepairText(value.provenance.specFingerprint, 120),
        providerLane: boundedRepairText(value.provenance.providerLane, 120)
      }
    : { requestFingerprint: "", specFingerprint: "", providerLane: "" };
  return {
    parentRequestId,
    attempt: 1,
    originalRequest,
    repairNotes,
    currentReviewedSpecs,
    reviewNotes,
    deterministicFindings,
    provenance
  };
}

function unresolvedMechanicExists(spec, matcher) {
  return Array.isArray(spec.unresolvedMechanics)
    && spec.unresolvedMechanics.some(mechanic => object(mechanic) && matcher(mechanic));
}

function allActivityNames(spec) {
  const names = [];
  for (const field of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    if (!Array.isArray(spec[field])) continue;
    for (const activity of spec[field]) {
      if (!object(activity)) continue;
      for (const key of ["activityName", "name", "label", "title", "spellName", "spell", "powerName", "utilityName", "saveName", "attackName"]) {
        const name = compactText(activity[key] || "");
        if (name && !names.includes(name)) names.push(name);
      }
    }
  }
  if (object(spec.summonActivity)) {
    for (const key of ["activityName", "name", "label", "title", "spellName", "spell", "powerName", "utilityName"]) {
      const name = compactText(spec.summonActivity[key] || "");
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

function requestedSpellLabels(text) {
  const labels = [];
  for (const entry of SRD_SPELL_PATTERNS) {
    if (entry.pattern.test(text) && !labels.includes(entry.label)) labels.push(entry.label);
  }
  return labels;
}

function specHasSummonSupport(spec) {
  return object(spec.summonActor)
    || (Array.isArray(spec.summonProfiles) && spec.summonProfiles.some(profile => object(profile)))
    || object(spec.summonActivity);
}

function specHasEnchantSupport(spec) {
  if (spec.kind === "nativeEnchant") return true;
  if (Array.isArray(spec.enchantChanges) && spec.enchantChanges.some(change => object(change) && compactText(change.key))) return true;
  return Array.isArray(spec.utilityActivities) && spec.utilityActivities.some(activity =>
    object(activity)
    && Array.isArray(activity.enchantChanges)
    && activity.enchantChanges.some(change => object(change) && compactText(change.key))
  );
}

function specHasHealingSupport(spec) {
  if (object(spec.healing) && hasMeaningfulNumericValue(spec.healing.number) && hasMeaningfulNumericValue(spec.healing.denomination)) return true;
  return allActivityNames(spec).some(name => /\bheal|healing|restore\b/i.test(name));
}

function specHasSaveDamageSupport(spec) {
  if (spec.kind === "chargedSaveDamage") return true;
  if (object(spec.save) && Array.isArray(spec.damageParts) && spec.damageParts.length) return true;
  if (object(spec.conditionOnHit?.save)) return true;
  for (const field of ["saveActivities", "utilityActivities"]) {
    if (!Array.isArray(spec[field])) continue;
    if (spec[field].some(activity =>
      object(activity) && object(activity.save) && Array.isArray(activity.damageParts) && activity.damageParts.length
    )) return true;
  }
  return false;
}

function specHasToggleLightSupport(spec) {
  if (object(spec.toggleLight)) return true;
  return Array.isArray(spec.utilityActivities) && spec.utilityActivities.some(activity => {
    if (!object(activity)) return false;
    const name = compactText(activity.activityName || activity.name || activity.label || "");
    const description = compactText(activity.description || "");
    return /\b(light|bright|dim|shed|glow|ignite)\b/i.test(`${name} ${description}`);
  });
}

function hasOnlyGenericUtilityNames(spec) {
  const names = allActivityNames(spec);
  if (!names.length) return false;
  return names.every(name => /^((attack|save|utility|activity)\s+\d+|summon ally)$/i.test(name));
}

function isGenericActivityLabel(name) {
  return /^((attack|save|utility|activity)\s+\d+|summon ally)$/i.test(compactText(name));
}

// "Regain charges" is resource recovery, not healing. Only flag a missing
// healing payload when the request actually refers to healing or hit points.
const HEALING_REQUEST_PATTERN = /\b(?:heal|healing)\b|\b(?:restore|regain)\b[^.!?]*(?:hit points?|hp)\b|\bhit points?\b/i;

function appendRequestDerivedUnresolved(spec, requestChunk, warnings = [], deferred = []) {
  const text = compactText(requestChunk || spec.description || "");
  if (!text) return spec;
  const normalized = clone(spec);
  const unresolved = Array.isArray(normalized.unresolvedMechanics)
    ? normalized.unresolvedMechanics.filter(mechanic => object(mechanic))
    : [];
  let changed = false;

  if (/\baura\b/i.test(text) && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
    comparableText(mechanic.category || "") === "allyaura"
    || /ally-affecting aura/i.test(compactText(mechanic.label || ""))
  )) {
    unresolved.push({
      category: "allyAura",
      label: "Ally-affecting aura",
      requestedText: matchingClause(text, /\baura\b/i),
      reason: "No compatible aura automation is available in this Foundry environment.",
      handling: "Adjudicate the aura manually until a compatible aura module is available.",
      resolved: false
    });
    if (!warnings.includes("Automated ally auras are deferred in this Foundry environment.")) {
      warnings.push("Automated ally auras are deferred in this Foundry environment.");
    }
    if (!deferred.includes("The aura was recorded in unresolvedMechanics for explicit review and manual adjudication.")) {
      deferred.push("The aura was recorded in unresolvedMechanics for explicit review and manual adjudication.");
    }
    changed = true;
  }

  const classResourcePattern = /\b(?:ki|focus points?|sorcery points?|bardic inspiration)\b/i;
  if (classResourcePattern.test(text) && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
    comparableText(mechanic.category || "") === "classresource"
    || /class-specific resource/i.test(compactText(mechanic.label || ""))
  )) {
    unresolved.push({
      category: "classResource",
      label: "Class-specific resource",
      requestedText: matchingClause(text, classResourcePattern),
      reason: "Class resource storage varies by rules edition, imported actor, and embedded class feature.",
      handling: "Restore or spend the named resource manually after using the item power.",
      resolved: false
    });
    if (!warnings.includes("Class-specific resource automation is deferred.")) {
      warnings.push("Class-specific resource automation is deferred.");
    }
    if (!deferred.includes("The class-resource clause was recorded in unresolvedMechanics for explicit review.")) {
      deferred.push("The class-resource clause was recorded in unresolvedMechanics for explicit review.");
    }
    changed = true;
  }

  if (/\b(summon|conjure|call forth|call in|calls in|friendly wolf|friendly fiend|githzerai psimaster)\b/i.test(text)
    && !specHasSummonSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "summon"
      || /summon/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "summon",
      label: "Requested summon",
      requestedText: matchingClause(text, /\b(summon|conjure|call forth|call in|calls in|friendly wolf|friendly fiend|githzerai psimaster)\b/i),
      reason: "The request includes a summon, but the generated item does not contain a Foundry summon payload.",
      handling: "Review and add the summon manually, or rephrase the request toward a dedicated summon pattern.",
      resolved: false
    });
    if (!warnings.includes("A requested summon was not preserved in the generated Foundry structure.")) {
      warnings.push("A requested summon was not preserved in the generated Foundry structure.");
    }
    if (!deferred.includes("Requested summon behavior was recorded in unresolvedMechanics for manual review.")) {
      deferred.push("Requested summon behavior was recorded in unresolvedMechanics for manual review.");
    }
    changed = true;
  }

  if (/\b(enchant|enchanted|becomes magical)\b/i.test(text)
    && !specHasEnchantSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "enchant"
      || /enchant/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "enchant",
      label: "Requested enchantment rider",
      requestedText: matchingClause(text, /\b(enchant|enchanted|becomes magical)\b/i),
      reason: "The request includes an enchantment effect, but the generated item does not contain a native enchant payload.",
      handling: "Review and add the enchantment manually, or convert the item to a dedicated enchant pattern.",
      resolved: false
    });
    if (!warnings.includes("A requested enchantment rider was not preserved in the generated Foundry structure.")) {
      warnings.push("A requested enchantment rider was not preserved in the generated Foundry structure.");
    }
    changed = true;
  }

  if (HEALING_REQUEST_PATTERN.test(text)
    && !specHasHealingSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "healing"
      || /healing/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "healing",
      label: "Requested healing payload",
      requestedText: matchingClause(text, HEALING_REQUEST_PATTERN),
      reason: "The request includes healing, but the generated item does not contain a concrete healing payload.",
      handling: "Review and add healing manually, or rephrase toward a dedicated charged-healing pattern.",
      resolved: false
    });
    if (!warnings.includes("A requested healing payload was not preserved in the generated Foundry structure.")) {
      warnings.push("A requested healing payload was not preserved in the generated Foundry structure.");
    }
    changed = true;
  }

  if (/\b(\d+-foot (?:cone|line|radius|cube|emanation)|half on a success|damage on a failed save|deals? \d+d\d+|takes? \d+d\d+)\b/i.test(text)
    && !specHasSaveDamageSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "savedamage"
      || /save-based|area effect/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "saveDamage",
      label: "Requested save-based effect",
      requestedText: matchingClause(text, /\b(\d+-foot (?:cone|line|radius|cube|emanation)|half on a success|damage on a failed save|deals? \d+d\d+|takes? \d+d\d+)\b/i),
      reason: "The request includes a save-based or area damage effect, but the generated item does not contain a concrete save-damage payload.",
      handling: "Review and add the save-based activity manually, or rephrase toward a dedicated charged-save pattern.",
      resolved: false
    });
    if (!warnings.includes("A requested save-based effect was not preserved in the generated Foundry structure.")) {
      warnings.push("A requested save-based effect was not preserved in the generated Foundry structure.");
    }
    changed = true;
  }

  if (/\b(bright light|dim light|sheds? light|ignite)\b/i.test(text)
    && !specHasToggleLightSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "lighttoggle"
      || /light toggle|light effect/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "lightToggle",
      label: "Requested light effect",
      requestedText: matchingClause(text, /\b(bright light|dim light|sheds? light|ignite)\b/i),
      reason: "The request includes a toggleable light effect, but the generated item does not contain light-toggle data.",
      handling: "Review and add a toggle-light activity manually, or rephrase toward an artifact weapon light pattern.",
      resolved: false
    });
    if (!warnings.includes("A requested light effect was not preserved in the generated Foundry structure.")) {
      warnings.push("A requested light effect was not preserved in the generated Foundry structure.");
    }
    changed = true;
  }

  const requestedSpells = requestedSpellLabels(text);
  const activityNames = allActivityNames(normalized).map(comparableText);
  const missingSpells = requestedSpells.filter(label => !activityNames.some(name => name.includes(label.toLowerCase())));
  if (missingSpells.length
    && hasOnlyGenericUtilityNames(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "namedspell"
      || /named spell/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "namedSpell",
      label: "Requested named spell activities",
      requestedText: `Requested spells: ${missingSpells.join(", ")}`,
      reason: "The request names specific spells, but the generated activities only preserved generic placeholders.",
      handling: "Review and replace generic utility activities with the named SRD spells or equivalent manual activities.",
      resolved: false
    });
    if (!warnings.includes("Specific named spells were reduced to generic utility placeholders.")) {
      warnings.push("Specific named spells were reduced to generic utility placeholders.");
    }
    if (!deferred.includes("Named spell preservation requires review when the model returns only generic utility activities.")) {
      deferred.push("Named spell preservation requires review when the model returns only generic utility activities.");
    }
    changed = true;
  }

  if (!changed) return spec;
  normalized.unresolvedMechanics = unresolved;
  return normalized;
}

function normalizeDamagePart(part, fallback = {}) {
  if (Array.isArray(part)) {
    const [diceText, typeText] = part;
    const parsed = parseDiceExpression(diceText);
    if (!parsed) return part;
    return {
      ...parsed,
      types: normalizeDamageTypes(typeText, normalizeDamageTypes(fallback.types, []))
    };
  }
  if (typeof part === "string") {
    const parsed = parseDiceExpression(part);
    if (!parsed) return part;
    return {
      ...parsed,
      types: normalizeDamageTypes(fallback.types, [])
    };
  }
  if (!object(part)) return part;

  const normalized = clone(part);
  if ("denomination" in normalized) normalized.denomination = normalizeDieDenomination(normalized.denomination);
  if (normalized.bonus === 0) normalized.bonus = "";

  const diceCandidate = [
    normalized.formula,
    normalized.expression,
    normalized.dice,
    normalized.roll,
    typeof normalized.denomination === "string" && /d/i.test(normalized.denomination) ? normalized.denomination : "",
    typeof normalized.number === "string" && /d/i.test(normalized.number) ? normalized.number : ""
  ].map(value => compactText(value)).find(Boolean) ?? "";
  const parsed = parseDiceExpression(diceCandidate);

  if (!hasMeaningfulNumericValue(normalized.number) && parsed) normalized.number = parsed.number;
  if (!hasMeaningfulNumericValue(normalized.denomination) && parsed) normalized.denomination = parsed.denomination;
  if ((normalized.bonus == null || normalized.bonus === "") && parsed?.bonus) normalized.bonus = parsed.bonus;
  normalized.types = normalizeDamageTypes(
    normalized.types ?? normalized.type ?? normalized.damageType,
    normalizeDamageTypes(fallback.types, [])
  );

  return normalized;
}

function mergeIndexedCollections(normalized, field) {
  const collected = [];
  if (Array.isArray(normalized[field])) collected.push(...normalized[field]);
  for (const [key, value] of Object.entries(normalized)) {
    if (key === field) continue;
    if (!new RegExp(`^${field}\\d+$`).test(key)) continue;
    if (Array.isArray(value)) collected.push(...value);
    delete normalized[key];
  }
  if (collected.length) normalized[field] = collected;
}

function normalizeActivityAlias(activity) {
  if (!object(activity)) return activity;
  const normalized = clone(activity);
  if (!normalized.activityId && normalized.id) normalized.activityId = normalized.id;
  if (!normalized.activityName) {
    normalized.activityName = compactText(
      normalized.name
      || normalized.label
      || normalized.title
      || normalized.spellName
      || normalized.powerName
      || ""
    );
  }
  return normalized;
}

function normalizeEffectAlias(effect) {
  if (!object(effect)) return effect;
  const normalized = clone(effect);
  if (!normalized.effectId && normalized.id) normalized.effectId = normalized.id;
  if (!normalized.name) normalized.name = compactText(normalized.label || normalized.title || normalized.effectName || "");
  return normalized;
}

function normalizeEffectChange(change) {
  if (!object(change)) return null;
  const normalized = clone(change);
  const key = compactText(normalized.key ?? normalized.path ?? normalized.field ?? "");
  if (!key) return null;
  const value = normalized.value ?? normalized.amount ?? normalized.bonus ?? null;
  if (value == null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  normalized.key = key;
  normalized.value = value;
  return normalized;
}

function normalizeEffectCollections(normalized) {
  for (const field of ["effects", "passiveEffects"]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field]
      .map(effect => {
        const next = normalizeEffectAlias(effect);
        if (!object(next)) return null;
        next.changes = Array.isArray(next.changes)
          ? next.changes.map(normalizeEffectChange).filter(Boolean)
          : [];
        return next.changes.length ? next : null;
      })
      .filter(Boolean);
  }
}

function normalizeProperties(properties) {
  if (!Array.isArray(properties)) return properties;
  return properties.map(entry => {
    const key = String(entry ?? "").trim().toLowerCase();
    return PROPERTY_ALIASES[key] ?? entry;
  });
}

function normalizeRemoteSpecAliases(rawSpec) {
  if (!object(rawSpec)) return rawSpec;
  const normalized = clone(rawSpec);
  if (!normalized.kind && typeof normalized.type === "string") normalized.kind = normalized.type;
  if (!normalized.kind && typeof normalized.pattern === "string") normalized.kind = normalized.pattern;
  if (typeof normalized.rarity === "string") {
    const key = normalized.rarity.trim().toLowerCase();
    normalized.rarity = RARITY_ALIASES[key] ?? normalized.rarity;
  }
  if (Array.isArray(normalized.properties)) normalized.properties = normalizeProperties(normalized.properties);
  for (const field of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    mergeIndexedCollections(normalized, field);
  }

  if (object(normalized.damage)) {
    if (normalized.damage.base != null) normalized.damage.base = normalizeDamagePart(normalized.damage.base);
    if (normalized.damage.versatile != null) normalized.damage.versatile = normalizeDamagePart(normalized.damage.versatile, normalized.damage.base ?? {});
  }

  for (const field of ["extraDamageParts", "damageParts"]) {
    if (Array.isArray(normalized[field])) normalized[field] = normalized[field].map(part => normalizeDamagePart(part));
  }
  if (normalized.healing != null) normalized.healing = normalizeDamagePart(normalized.healing, { types: ["healing"] });

  for (const field of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map(activity => {
      if (!object(activity)) return activity;
      const next = normalizeActivityAlias(activity);
      if (Array.isArray(next.damageParts)) next.damageParts = next.damageParts.map(part => normalizeDamagePart(part));
      return next;
    });
  }
  normalizeEffectCollections(normalized);
  if (object(normalized.summonActivity)) normalized.summonActivity = normalizeActivityAlias(normalized.summonActivity);

  return normalized;
}

function textForSpecInference(spec, requestChunk) {
  return compactText([
    requestChunk,
    spec.name,
    spec.baseItem,
    spec.itemType,
    spec.equipmentType,
    spec.description
  ].filter(Boolean).join(" ")).toLowerCase();
}

function detectKnownWeaponBase(spec, requestChunk) {
  const text = textForSpecInference(spec, requestChunk);
  const explicit = compactText(spec.baseItem).toLowerCase();
  if (KNOWN_WEAPON_BASES[explicit]) return KNOWN_WEAPON_BASES[explicit];
  return Object.entries(KNOWN_WEAPON_BASES).find(([name]) => wordPattern(name).test(text))?.[1] ?? null;
}

function detectConditionFromText(text) {
  for (const condition of KNOWN_CONDITIONS) {
    if (wordPattern(condition).test(text)) return condition;
  }
  return "";
}

function looksLikeEnchantRequest(text) {
  return /\b(oil|unguent|salve|balm|coating)\b/i.test(text)
    && /\b(weapon|armor|shield)\b/i.test(text)
    && /\b(apply|coat|anoint|smear|enchant|imbue|magical)\b/i.test(text);
}

function looksLikeSingleSummonRequest(text) {
  return /\b(summon|conjure|call forth|calls forth|call in|calls in|creates?)\b/i.test(text)
    && !/\bchoose\b/i.test(text)
    && !/\bprofiles?\b/i.test(text);
}

function inferEnchantRestrictionType(text) {
  if (/\bshield\b/i.test(text)) return "shield";
  if (/\b(armor|plate|mail|leather|breastplate|half plate|scale mail)\b/i.test(text)) return "armor";
  return "weapon";
}

function inferDurationSeconds(text, fallback = 3600) {
  const match = /\b(\d+)\s*(seconds?|minutes?|hours?)\b/i.exec(text);
  if (!match) return fallback;
  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("second")) return value;
  if (unit.startsWith("minute")) return value * 60;
  return value * 3600;
}

const GENERIC_SUMMON_TERMS = new Set(["ally", "companion", "creature", "familiar", "spirit", "summon"]);

function extractNamedSrdSummon(text) {
  const candidates = [...String(text ?? "").matchAll(/\b(?:summon|summons|conjure|conjures|call forth|calls forth|call in|calls in)\s+(?:(?:a|an|the)\s+)?([a-z][a-z' -]{0,80})/gi)]
    .map(match => match[1]
      .split(/\s+(?:that|which|who|for|within|in|at|as|to|and|with|from|while|until|whose|serves?|obeys?|appears?)\b/i)[0]
      .replace(/^(?:(?:a|an|the|one)\s+)?(?:friendly|loyal|tame)\s+/i, "")
      .replace(/^(?:a|an|the|one)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim())
    .filter(candidate => candidate
      && candidate.length <= 60
      && /^[a-z][a-z' -]*$/i.test(candidate)
      && !GENERIC_SUMMON_TERMS.has(candidate.toLowerCase()));
  return candidates.length ? titleCase(candidates.at(-1)) : "";
}

function suggestedSummonType(text) {
  if (/\bfiend|demon|devil|yugoloth\b/i.test(text)) return "fiend";
  if (/\bundead|skeleton|zombie|ghost\b/i.test(text)) return "undead";
  if (/\bconstruct|golem\b/i.test(text)) return "construct";
  if (/\bcelestial|angel\b/i.test(text)) return "celestial";
  if (/\bfey|pixie|sprite\b/i.test(text)) return "fey";
  if (/\belemental\b/i.test(text)) return "elemental";
  return "beast";
}

function suggestedSrdActorName(text) {
  if (/\b(?:familiar|cat)\b/i.test(text)) return "Cat";
  if (/\b(?:mount|horse)\b/i.test(text)) return "Riding Horse";
  if (/\b(?:companion|ally|guardian)\b/i.test(text)) return "Wolf";
  return "";
}

function summonActorFromSuggestion(suggestion, options = {}) {
  const displayName = titleCase(options.displayName || suggestion || "Companion");
  const actor = object(options.actor) ? clone(options.actor) : {};
  const hp = object(actor.hp) ? actor.hp : {};
  const type = compactText(actor.type) || options.type || "beast";
  const srdActorName = titleCase(options.srdActorName || actor.srdActorName || suggestion || "");
  return {
    ...actor,
    name: options.useSuggestedName ? `Friendly ${displayName}` : (compactText(actor.name) || `Friendly ${displayName}`),
    ...(srdActorName ? { srdActorName } : {}),
    // SRD content is preferred but never required: the renderer creates this
    // declarative fallback when a matching system actor is not installed.
    requireSrdActor: false,
    type,
    ac: Number.isFinite(Number(actor.ac)) ? Number(actor.ac) : 12,
    hp: {
      ...hp,
      value: Number.isFinite(Number(hp.value ?? hp.max)) ? Number(hp.value ?? hp.max) : 11,
      max: Number.isFinite(Number(hp.max ?? hp.value)) ? Number(hp.max ?? hp.value) : 11
    },
    movement: object(actor.movement) ? actor.movement : { walk: 30, units: "ft" },
    size: compactText(actor.size) || "med"
  };
}

function freeForgeFiendProfiles(text) {
  if (!/\bfiend\b/i.test(text) && !(/\bdemon\b/i.test(text) && /\bdevil\b/i.test(text) && /\byugoloth\b/i.test(text))) return [];
  return [
    { profileName: "Demon", actor: summonActorFromSuggestion("Quasit", { displayName: "Fiend (Demon)", type: "fiend" }) },
    { profileName: "Devil", actor: summonActorFromSuggestion("Imp", { displayName: "Fiend (Devil)", type: "fiend" }) },
    { profileName: "Yugoloth", actor: summonActorFromSuggestion("Mezzoloth", { displayName: "Fiend (Yugoloth)", type: "fiend" }) }
  ];
}

function isGenericSummonSuggestion(value) {
  const text = comparableText(value);
  return !text
    || /^(?:one )?(?:friendly )?(?:beast|creature|companion|summoned ally)$/.test(text)
    || /^(?:one )?friendly .+\s+or\s+.+$/.test(text);
}

function explicitSummonProfileNames(text) {
  const match = compactText(text).match(/\b(?:pick|choose)(?:\s+one)?(?:\s+(?:friendly|summoned))?(?:\s+(?:beast|creature|ally|profile))?\s*:?\s*([^.;]+)/i);
  if (!match) return [];
  return match[1]
    .replace(/\s+when\b.*$/i, "")
    .split(/\s*,\s*(?:or\s+)?|\s+or\s+/i)
    .map(value => titleCase(value.replace(/^(?:a|an|the)\s+/i, "").trim()))
    .filter(value => value && !isGenericSummonSuggestion(value) && value.split(/\s+/).length <= 4)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 6);
}

function normalizeFreeForgeSrdSummons(spec, requestChunk, supportedKinds) {
  const text = textForSpecInference(spec, requestChunk);
  const requestedSummon = /\b(?:summon|summons|conjure|conjures|call forth|calls forth|call in|calls in)\b/i.test(text);
  const containsSummonData = object(spec.summonActor)
    || (Array.isArray(spec.summonProfiles) && spec.summonProfiles.length > 0)
    || object(spec.summonActivity);
  if (!requestedSummon && !containsSummonData) return spec;

  const normalized = clone(spec);
  const fiendProfiles = freeForgeFiendProfiles(text);
  const explicitProfiles = explicitSummonProfileNames(text);
  const requestsAllFiendProfiles = /\bdemon\b/i.test(text) && /\bdevil\b/i.test(text) && /\byugoloth\b/i.test(text);
  const creatureName = extractNamedSrdSummon(text);
  const existingActor = normalized.summonActor ?? normalized.actor ?? normalized.summon ?? normalized.creature;
  const existingProfiles = Array.isArray(normalized.summonProfiles)
    ? normalized.summonProfiles.filter(profile => object(profile))
    : [];
  const pureProfileSummon = requestsAllFiendProfiles
    && !/\b(?:armor class|attack rolls?|bonus|cast|damage|heal(?:ing)?|resistance|saving throws?|spell save|temporary hit points|toggle)\b/i.test(text);
  if (
    pureProfileSummon
    && supportedKinds.includes("nativeMultiProfileSummon")
    && ["casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite"].includes(normalized.kind)
  ) {
    const summonUtility = (Array.isArray(normalized.utilityActivities) ? normalized.utilityActivities : [])
      .find(activity => object(activity) && /\b(?:summon|conjure|call)\b/i.test(compactText(activity.activityName)));
    normalized.kind = "nativeMultiProfileSummon";
    normalized.summonProfiles = fiendProfiles;
    normalized.activationType = compactText(normalized.activationType || summonUtility?.activationType) || "action";
    normalized.duration = normalized.duration ?? inferDurationSeconds(text);
    delete normalized.summonActor;
    delete normalized.summonActivity;
    delete normalized.activities;
    delete normalized.attackActivities;
    delete normalized.saveActivities;
    delete normalized.utilityActivities;
    return normalized;
  }
  if (
    requestsAllFiendProfiles
    && ["nativeSummon", "nativeMultiProfileSummon"].includes(normalized.kind)
  ) {
    normalized.kind = "nativeMultiProfileSummon";
    normalized.summonProfiles = fiendProfiles;
    delete normalized.summonActor;
    return normalized;
  }
  if (fiendProfiles.length && !existingProfiles.length) {
    normalized.summonProfiles = fiendProfiles;
    normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
    delete normalized.summonActor;
    return normalized;
  }
  if (
    explicitProfiles.length >= 2
    && supportedKinds.includes("nativeMultiProfileSummon")
    && ["nativeSummon", "nativeMultiProfileSummon"].includes(normalized.kind)
  ) {
    normalized.kind = "nativeMultiProfileSummon";
    normalized.summonProfiles = explicitProfiles.map(profileName => ({
      profileName,
      actor: summonActorFromSuggestion(profileName, {
        srdActorName: profileName,
        type: suggestedSummonType(text),
        useSuggestedName: true
      })
    }));
    normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
    if (Array.isArray(normalized.unresolvedMechanics)) {
      normalized.unresolvedMechanics = normalized.unresolvedMechanics.filter(mechanic => {
        const category = comparableText(mechanic?.category);
        return !["summon", "beastchoice", "summonchoice", "profilechoice"].includes(category);
      });
      if (!normalized.unresolvedMechanics.length) delete normalized.unresolvedMechanics;
    }
    delete normalized.summonActor;
    return normalized;
  }
  const selectedSrdActorName = creatureName || compactText(existingActor?.srdActorName) || suggestedSrdActorName(text);
  const suggestion = selectedSrdActorName || compactText(existingActor?.name) || "Companion";
  const actor = summonActorFromSuggestion(suggestion, {
    actor: existingActor,
    srdActorName: selectedSrdActorName,
    type: suggestedSummonType(text),
    useSuggestedName: Boolean(creatureName)
  });
  if (normalized.kind === "nativeSummon" || (normalized.kind === "nativeMultiProfileSummon" && existingProfiles.length < 2)) {
    // A vague request does not justify inventing multiple selectable profiles.
    // Preserve a working single companion instead of rejecting the item.
    normalized.kind = "nativeSummon";
    normalized.summonActor = actor;
    delete normalized.summonProfiles;
    return normalized;
  }
  normalized.summonProfiles = existingProfiles.length
    ? existingProfiles.map((profile, index) => {
      const profileName = compactText(profile.profileName) || `Companion ${index + 1}`;
      const existingSrdName = compactText(profile.actor?.srdActorName);
      const existingDisplayName = compactText(profile.actor?.name);
      const explicitProfileName = compactText(profile.profileName);
      // A single explicit creature in the request outranks a model placeholder
      // such as "Profile Separate" or "One Friendly Giant Scorpion".
      const requestedProfileName = creatureName && existingProfiles.length === 1 ? creatureName : "";
      const suggestion = requestedProfileName || (
        !isGenericSummonSuggestion(existingSrdName)
          ? existingSrdName
          : explicitProfileName || (!isGenericSummonSuggestion(existingDisplayName) ? existingDisplayName : creatureName) || profileName
      );
      const replaceGenericName = isGenericSummonSuggestion(existingSrdName)
        || isGenericSummonSuggestion(existingDisplayName.replace(/^friendly\s+/i, ""));
      return {
        ...profile,
        profileName,
        actor: summonActorFromSuggestion(suggestion, {
          actor: profile.actor,
          srdActorName: suggestion,
          type: suggestedSummonType(text),
          useSuggestedName: replaceGenericName
        })
      };
    })
    : [{ profileName: creatureName || "Companion", actor }];
  normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
  delete normalized.summonActor;
  return normalized;
}

function parseLightRadii(text) {
  const normalizedText = compactText(text);
  const bright = Number(normalizedText.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?bright\s+light/i)?.[1] ?? 20);
  const dimBeforeMatch = normalizedText.match(/\b(additional\s+|another\s+)?(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?dim\s+light/i);
  const dimAfterMatch = normalizedText.match(/\bdim\s+light\s+for\s+(\d+)\s*(additional|extra)?\s*[- ]?(?:foot|feet|ft\.?)\b/i);
  const dimValue = Number(dimBeforeMatch?.[2] ?? dimAfterMatch?.[1] ?? 20);
  const isAdditional = Boolean(dimBeforeMatch?.[1] || dimAfterMatch?.[2]);
  return { bright, dim: isAdditional ? bright + dimValue : Math.max(bright, dimValue) };
}

function inferUsesFromText(text, { consumed = false, defaultMax = "" } = {}) {
  const wordUses = /\b(once|twice|thrice)\b/i.exec(text)?.[1]?.toLowerCase();
  const wordMax = { once: "1", twice: "2", thrice: "3" }[wordUses ?? ""];
  const numericMax = /\b(\d+)\s+(?:charges?|uses?|times?)\b/i.exec(text)?.[1] ?? "";
  const max = numericMax || wordMax || (consumed ? "1" : defaultMax);

  let recovery = [];
  if (/short\s+rest/i.test(text)) {
    recovery = [{ period: "sr", type: "recoverAll", formula: "" }];
  } else if (/long\s+rest/i.test(text)) {
    recovery = [{ period: "lr", type: "recoverAll", formula: "" }];
  } else if (/dawn|daily/i.test(text)) {
    const formula = /\bregains?\s+([^.;\n]+?)\s+(?:charges?|uses?)\b/i.exec(text)?.[1]?.trim() ?? "";
    recovery = [{ period: "dawn", type: formula ? "formula" : "recoverAll", formula }];
  }

  const autoDestroy = consumed || /\b(consumed?|destroyed|single use|one use)\b/i.test(text);
  if (!autoDestroy && !recovery.length && max) {
    recovery = [{ period: "lr", type: "recoverAll", formula: "" }];
  }
  if (!max && !recovery.length && !autoDestroy) return null;
  return { max, recovery, autoDestroy };
}

function normalizeConditionOnHit(spec, requestChunk) {
  if (spec.kind !== "weaponConditionOnHit" || !object(spec.conditionOnHit)) return spec;
  const normalized = clone(spec);
  const condition = normalized.conditionOnHit;
  const text = textForSpecInference(spec, requestChunk);

  condition.condition = compactText(condition.condition || condition.conditionName || condition.name || detectConditionFromText(text));
  if (!object(condition.save) && object(condition.savingThrow)) condition.save = clone(condition.savingThrow);
  if (object(condition.save)) {
    if (!condition.save.ability && condition.save.saveAbility) condition.save.ability = condition.save.saveAbility;
    if ((condition.save.dc == null || condition.save.dc === "") && condition.save.saveDc != null) condition.save.dc = condition.save.saveDc;
  }

  if (!compactText(condition.targetCreatureType)) {
    const targetType = /\b(?:against|target(?:ing)?)\s+(?:a|an|the)?\s*(undead|construct|fiend|beast|humanoid|fey|elemental|celestial)\b/i.exec(text)?.[1];
    if (targetType) condition.targetCreatureType = targetType.toLowerCase();
  }
  if (condition.targetCreatureType) {
    const normalizedTargetType = compactText(condition.targetCreatureType).toLowerCase();
    condition.targetCreatureType = /^(?:undead|construct|fiend|beast|humanoid|fey|elemental|celestial)$/.test(normalizedTargetType)
      ? normalizedTargetType
      : "";
    if (!condition.targetCreatureType) delete condition.targetCreatureType;
  }

  if (!Number.isFinite(Number(condition.durationSeconds))) {
    const seconds = Number(condition.duration?.seconds ?? condition.seconds);
    const rounds = Number(condition.duration?.rounds ?? condition.rounds);
    const minutes = Number(condition.duration?.minutes ?? condition.minutes);
    if (Number.isFinite(seconds)) condition.durationSeconds = seconds;
    else if (Number.isFinite(rounds)) condition.durationSeconds = rounds * 6;
    else if (Number.isFinite(minutes)) condition.durationSeconds = minutes * 60;
    else if (/\buntil (?:the )?(?:start|end) of (?:your|the wielder'?s?) next turn\b/i.test(text) || /\bfor 1 round\b/i.test(text)) condition.durationSeconds = 6;
    else if (/\bfor 1 minute\b/i.test(text)) condition.durationSeconds = 60;
  }

  return normalized;
}

function extractExtraDamagePartsFromText(text) {
  const matches = [];
  const normalizedText = compactText(text);
  const extraRegex = /\bextra\s+(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)\s+damage\b/ig;
  for (const match of normalizedText.matchAll(extraRegex)) {
    const dice = parseDiceExpression(match[1]);
    if (!dice) continue;
    matches.push({
      number: dice.number,
      denomination: dice.denomination,
      bonus: dice.bonus,
      types: [match[2].toLowerCase()]
    });
  }

  if (matches.length > 0) return matches;

  const plusRegex = /\b(?:plus|and)\s+(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)\s+damage\b/ig;
  for (const match of normalizedText.matchAll(plusRegex)) {
    const dice = parseDiceExpression(match[1]);
    if (!dice) continue;
    matches.push({
      number: dice.number,
      denomination: dice.denomination,
      bonus: dice.bonus,
      types: [match[2].toLowerCase()]
    });
  }
  return matches;
}

function extractHealingPartFromText(text) {
  const normalizedText = compactText(text);
  const match = /\b(?:regain|restore|heals?|healing\s*:?)\b[^.]*?(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+hit points?\b/i.exec(normalizedText);
  if (!match) return null;
  const dice = parseDiceExpression(match[1]);
  if (!dice) return null;
  return {
    number: dice.number,
    denomination: dice.denomination,
    bonus: dice.bonus,
    types: ["healing"]
  };
}

const ARMOR_CHASSIS = Object.freeze([
  { pattern: /\bhalf\s*plate\b/i, equipmentType: "medium", baseItem: "halfplate", armorValue: 15, armorDex: 2, weight: 40, label: "half plate" },
  { pattern: /\bbreastplate\b/i, equipmentType: "medium", baseItem: "breastplate", armorValue: 14, armorDex: 2, weight: 20, label: "breastplate" },
  { pattern: /\bscale\s+mail\b/i, equipmentType: "medium", baseItem: "scalemail", armorValue: 14, armorDex: 2, weight: 45, label: "scale mail" },
  { pattern: /\bplate(?:\s+armor)?\b/i, equipmentType: "heavy", baseItem: "plate", armorValue: 18, armorDex: null, weight: 65, strength: 15, label: "plate armor" },
  { pattern: /\bchain\s+mail\b/i, equipmentType: "heavy", baseItem: "chainmail", armorValue: 16, armorDex: null, weight: 55, strength: 13, label: "chain mail" },
  { pattern: /\bstudded\s+leather(?:\s+armor)?\b/i, equipmentType: "light", baseItem: "studded", armorValue: 12, armorDex: null, weight: 13, label: "studded leather" },
  { pattern: /\bleather(?:\s+armor)?\b/i, equipmentType: "light", baseItem: "leather", armorValue: 11, armorDex: null, weight: 10, label: "leather armor" }
]);

const DAMAGE_RESISTANCE_TYPES = Object.freeze([
  "acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"
]);

function explicitArmorProfile(text) {
  return ARMOR_CHASSIS.find(profile => profile.pattern.test(text)) ?? null;
}

function explicitMagicalBonus(text) {
  const match = /\B\+(\d+)\b(?!\s*d)/i.exec(compactText(text));
  return match?.[1] ?? "";
}

function requestedResistanceTypes(text) {
  const source = compactText(text);
  return DAMAGE_RESISTANCE_TYPES.filter(type => new RegExp(`\\b(?:resistance to\\s+|resistance\\s*:\\s*)${type}(?: damage)?\\b`, "i").test(source));
}

function explicitWeaponAttackDamageBonus(text) {
  const match = /\b(?:adds?|gives?|grants?|provides?)\s+\+(\d+)\s+(?:bonus\s+)?to\s+(?:weapon\s+)?attack\s+and\s+damage\s+rolls?\b/i.exec(compactText(text));
  return match?.[1] ?? "";
}

function isPassiveTrinketRequest(text) {
  const source = compactText(text);
  return /\b(?:trinket|wondrous item|charm|talisman|token|relic|bauble)\b/i.test(source)
    && !/\b(?:weapon|sword|axe|mace|dagger|bow|crossbow|shield|armor|plate|mail)\b/i.test(source);
}

function normalizePassiveWeaponBonusTrinket(spec, requestChunk, supportedKinds) {
  // This recovery corrects a model-selected chassis, so use the request rather
  // than model-provided description or base-item text as the source of truth.
  const text = compactText(requestChunk || spec.description || spec.name || "");
  const bonus = explicitWeaponAttackDamageBonus(text);
  if (!bonus || !isPassiveTrinketRequest(text) || !supportedKinds.includes("passiveEffectEquipment")) return spec;

  const normalized = clone(spec);
  normalized.kind = "passiveEffectEquipment";
  normalized.equipmentType = "wondrous";
  normalized.effects = [{
    effectId: normalized.effects?.[0]?.effectId ?? "",
    name: `${normalized.name || "Trinket"} Weapon Boon`,
    changes: [
      { key: "system.bonuses.mwak.attack", mode: "ADD", value: bonus },
      { key: "system.bonuses.rwak.attack", mode: "ADD", value: bonus },
      { key: "system.bonuses.mwak.damage", mode: "ADD", value: bonus },
      { key: "system.bonuses.rwak.damage", mode: "ADD", value: bonus }
    ]
  }];
  if (/\b(?:requires? attunement|when attuned|while attuned|attuned)\b/i.test(text)) {
    normalized.attunement = "required";
  }
  delete normalized.armorValue;
  delete normalized.magicalBonus;
  delete normalized.baseItem;
  return normalized;
}

function requestedAttunementState(requestChunk) {
  const text = compactText(requestChunk);
  if (!text) return null;
  if (/\b(?:(?:does|do)(?:\s+not|n't)\s+(?:need|require)\s+attunement|no\s+attunement(?:\s+needed)?|attunement\s*:\s*(?:not required|no|none))\b/i.test(text)) return "";
  if (/\b(?:(?:needs?|requires?|requiring)\s+attunement|required\s+by|when attuned|while attuned|attunement\s*:\s*required)\b/i.test(text)) return "required";
  return null;
}

function magicalPropertyCount(spec) {
  const properties = [
    Number(spec.magicalBonus) > 0,
    Array.isArray(spec.extraDamageParts) && spec.extraDamageParts.length > 0,
    object(spec.conditionOnHit),
    Array.isArray(spec.effects) && spec.effects.length > 0,
    Array.isArray(spec.passiveEffects) && spec.passiveEffects.length > 0,
    Array.isArray(spec.enchantChanges) && spec.enchantChanges.length > 0,
    object(spec.toggleLight),
    object(spec.healing),
    object(spec.summonActor) || (Array.isArray(spec.summonProfiles) && spec.summonProfiles.length > 0),
    ["activities", "attackActivities", "saveActivities", "utilityActivities"].some(field =>
      Array.isArray(spec[field]) && spec[field].some(activity => {
        const name = compactText(activity?.activityName ?? activity?.name);
        return name && !/^attack with\b/i.test(name) && !/^[a-z]+\s+attack$/i.test(name);
      })
    )
  ];
  return properties.filter(Boolean).length;
}

function alignAttunementToRequest(spec, requestChunk) {
  const requested = requestedAttunementState(requestChunk);
  if (requested != null) return { ...spec, attunement: requested };
  if (compactText(spec.attunement) || magicalPropertyCount(spec) < 2) return spec;
  return { ...spec, attunement: "required" };
}

function normalizeExplicitArmorChassis(spec, requestChunk, supportedKinds) {
  const profile = explicitArmorProfile(requestChunk);
  if (!profile) return spec;

  const normalized = clone(spec);
  const hasActivePowers = ["activities", "saveActivities", "attackActivities", "utilityActivities"]
    .some(field => Array.isArray(normalized[field]) && normalized[field].some(object))
    || object(normalized.summonActor)
    || object(normalized.summonActivity)
    || (Array.isArray(normalized.summonProfiles) && normalized.summonProfiles.some(object));
  const suiteKind = /\b(?:legendary|artifact)\b/i.test(compactText(requestChunk))
    && supportedKinds.includes("legendaryEquipmentSuite")
    ? "legendaryEquipmentSuite"
    : (supportedKinds.includes("equipmentPowerSuite") ? "equipmentPowerSuite" : "");
  normalized.kind = hasActivePowers && suiteKind ? suiteKind : "shieldArmorBonus";
  normalized.itemType = "equipment";
  normalized.equipmentType = profile.equipmentType;
  normalized.baseItem = profile.baseItem;
  normalized.armorValue = profile.armorValue;
  normalized.armorDex = profile.armorDex;
  normalized.weight = normalized.weight ?? profile.weight;
  if (profile.strength != null) normalized.strength = normalized.strength ?? profile.strength;
  const bonus = explicitMagicalBonus(requestChunk);
  normalized.magicalBonus = bonus || String(normalized.magicalBonus ?? "").trim() || "1";
  return normalized;
}

function normalizeRequestedResistances(spec, requestChunk) {
  const resistances = requestedResistanceTypes(requestChunk);
  if (!resistances.length || !["passiveEffectEquipment", "shieldArmorBonus"].includes(spec.kind)) return spec;

  const normalized = clone(spec);
  const effects = Array.isArray(normalized.effects) ? normalized.effects.filter(effect => object(effect)) : [];
  const effect = effects[0] ?? { name: `${normalized.name} Benefits`, changes: [] };
  const changes = Array.isArray(effect.changes) ? effect.changes.filter(change => object(change) && compactText(change.key)) : [];
  for (const type of resistances) {
    if (!changes.some(change => change.key === "system.traits.dr.value" && comparableText(change.value) === type)) {
      changes.push({ key: "system.traits.dr.value", mode: "ADD", value: type });
    }
  }
  effect.changes = changes;
  effects[0] = effect;
  normalized.effects = effects;
  return normalized;
}

function extractSaveDamagePartFromText(text) {
  const match = /\b(?:taking|dealing|deals?|damage\s+on\s+(?:a\s+)?failed\s+save\s*:)\s+(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)(?:\s+damage)?\b/i.exec(compactText(text));
  if (!match) return null;
  const dice = parseDiceExpression(match[1]);
  if (!dice) return null;
  return { ...dice, types: [match[2].toLowerCase()] };
}

const SKILL_ALIASES = new Map([
  ["acrobatics", "acr"], ["animal handling", "ani"], ["arcana", "arc"],
  ["athletics", "ath"], ["deception", "dec"], ["history", "his"],
  ["insight", "ins"], ["intimidation", "itm"], ["investigation", "inv"],
  ["medicine", "med"], ["nature", "nat"], ["perception", "prc"],
  ["performance", "prf"], ["persuasion", "per"], ["religion", "rel"],
  ["sleight of hand", "slt"], ["stealth", "ste"], ["survival", "sur"]
]);

function requestedAdvantageSkill(text) {
  const match = compactText(text).match(/\badvantage\s+on\s+(?:(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*)?\(?([A-Za-z ]+?)\)?\s+checks?\b/i);
  return SKILL_ALIASES.get(comparableText(match?.[1]));
}

function normalizeRequestedSkillAdvantage(spec, requestChunk) {
  const text = compactText(requestChunk);
  const skillId = requestedAdvantageSkill(text);
  if (!skillId) return spec;
  if (!["passiveEffectEquipment", "casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite"].includes(spec.kind)) return spec;

  const normalized = clone(spec);
  const effects = Array.isArray(normalized.effects) ? normalized.effects.filter(object) : [];
  const effect = effects[0] ?? { name: `${normalized.name || "Item"} Skill`, changes: [] };
  const changes = Array.isArray(effect.changes) ? effect.changes.filter(object) : [];
  const canonicalKey = `system.skills.${skillId}.roll.mode`;
  const repairedChanges = changes.filter(change => {
    const key = compactText(change.key);
    if (key === canonicalKey) return true;
    if (!key.startsWith("system.skills.")) return true;
    return !/\.(?:adv|advantage|bonuses\.check)$/.test(key) && !/advantage/i.test(compactText(change.value));
  });
  if (!repairedChanges.some(change => compactText(change.key) === canonicalKey)) {
    repairedChanges.push({ key: canonicalKey, mode: "ADD", value: "1" });
  }
  effect.changes = repairedChanges;
  effects[0] = effect;
  normalized.effects = effects;
  return normalized;
}

function normalizeRequestedDarkvision(spec, requestChunk) {
  const text = compactText(requestChunk);
  const distance = Number(
    text.match(/\bdarkvision(?:\s+(?:out\s+to|of|within))?\s+(\d+)\s*(?:foot|feet|ft\.?)\b/i)?.[1]
    ?? text.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+darkvision\b/i)?.[1]
  );
  if (!Number.isFinite(distance) || distance <= 0) return spec;
  if (!["passiveEffectEquipment", "casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite"].includes(spec.kind)) return spec;

  const normalized = clone(spec);
  const effects = Array.isArray(normalized.effects) ? normalized.effects.filter(object) : [];
  const effect = effects[0] ?? { name: `${normalized.name || "Item"} Darkvision`, changes: [] };
  const malformedKeys = new Set([
    "system.attributes.darkvision.enabled",
    "system.attributes.darkvision.distance",
    "system.attributes.senses.darkvision"
  ]);
  const changes = Array.isArray(effect.changes)
    ? effect.changes.filter(change => object(change) && !malformedKeys.has(compactText(change.key)))
    : [];
  const canonicalKey = "system.attributes.senses.ranges.darkvision";
  const existing = changes.find(change => compactText(change.key) === canonicalKey);
  if (existing) {
    existing.mode = "ADD";
    existing.value = String(distance);
  } else {
    changes.push({ key: canonicalKey, mode: "ADD", value: String(distance) });
  }
  effect.changes = changes;
  effects[0] = effect;
  normalized.effects = effects;
  return normalized;
}

function normalizeExplicitSpellAttackSuite(spec, requestChunk, supportedKinds) {
  const text = textForSpecInference(spec, requestChunk);
  const attackMatch = /\b(?:make|makes?)\s+(?:a\s+)?(ranged|melee)\s+spell\s+attack\b/i.exec(text);
  const damage = extractSaveDamagePartFromText(text);
  if (!attackMatch || !damage || !supportedKinds.includes("equipmentPowerSuite")) return spec;
  if (!["casterUtilityEquipment", "legendaryEquipmentSuite", "passiveEffectEquipment"].includes(spec.kind)) return spec;

  const normalized = clone(spec);
  const attackActivities = Array.isArray(normalized.attackActivities) ? normalized.attackActivities.filter(object) : [];
  const utilityActivities = Array.isArray(normalized.utilityActivities) ? normalized.utilityActivities.filter(object) : [];
  const recoveredActivity = attackActivities.find(activity => Array.isArray(activity.damageParts) && activity.damageParts.length)
    ?? utilityActivities.find(activity => /\b(?:spell\s+attack|attack|damage)\b/i.test(activity.activityName ?? activity.name ?? ""))
    ?? {};
  const chargeCost = Number(compactText(text).match(/\bspend\s+(\d+)\s+charges?\b/i)?.[1] ?? recoveredActivity.chargeCost ?? 1);
  const range = inferExplicitFeetValue(text);
  const inferredUses = inferUsesFromText(text, {
    defaultMax: object(normalized.uses) ? String(normalized.uses.max ?? "").trim() : ""
  });

  normalized.kind = "equipmentPowerSuite";
  normalized.attackActivities = [{
    ...recoveredActivity,
    activityName: fallbackActivityName(recoveredActivity, `Use ${normalized.name}`),
    activationType: recoveredActivity.activationType || "action",
    chargeCost: Number.isFinite(chargeCost) && chargeCost > 0 ? chargeCost : 1,
    ability: recoveredActivity.ability || "spellcasting",
    attackType: attackMatch[1].toLowerCase(),
    attackClassification: "spell",
    damageParts: Array.isArray(recoveredActivity.damageParts) && recoveredActivity.damageParts.length
      ? recoveredActivity.damageParts
      : [damage],
    range: range == null ? (object(recoveredActivity.range) ? recoveredActivity.range : { value: null, units: "self" }) : { value: range, units: "ft" },
    target: object(recoveredActivity.target) ? recoveredActivity.target : {
      affects: { count: "1", type: "creature" },
      prompt: true
    }
  }];
  normalized.utilityActivities = utilityActivities.filter(activity => activity !== recoveredActivity);
  if (inferredUses) {
    const uses = object(normalized.uses) ? normalized.uses : {};
    normalized.uses = {
      ...uses,
      max: String(uses.max ?? "").trim() || inferredUses.max || "1",
      recovery: Array.isArray(uses.recovery) ? uses.recovery : inferredUses.recovery
    };
  }
  return normalized;
}

function normalizeWandSaveActivity(spec, requestChunk) {
  const text = compactText(requestChunk);
  if (!/\b(?:wand|rod)\b/i.test(text) || !/\b(?:saving throw|[a-z]+\s+save|save\s*:)\b/i.test(text)) return spec;
  const damage = extractSaveDamagePartFromText(text);
  if (!damage) return spec;

  const template = inferTemplateFromText(text);
  const saveAbility = inferExplicitSaveAbility(text)
    || ({ strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" }[
      text.match(/\bsaving throw\s*:\s*(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/i)?.[1]?.toLowerCase()
    ] ?? "dex");
  const saveDc = Number.parseInt(text.match(/\bdc\s*(\d+)/i)?.[1] ?? "", 10);
  if (!template || !Number.isFinite(saveDc)) return spec;

  const normalized = clone(spec);
  normalized.kind = "chargedSaveDamage";
  normalized.itemType = "equipment";
  normalized.equipmentType = /\brod\b/i.test(text) ? "rod" : "wand";
  normalized.baseItem = normalized.equipmentType;
  normalized.activityName = compactText(normalized.activityName) || `Cast ${normalized.name}`;
  normalized.activationType = "action";
  normalized.chargeCost = Number(normalized.chargeCost) > 0 ? Number(normalized.chargeCost) : 1;
  normalized.save = { ability: saveAbility, dc: saveDc };
  normalized.damageOnSave = /half(?:\s+as\s+much)?\s+(?:damage\s+)?on\s+(?:a\s+)?success/i.test(text) ? "half" : "none";
  normalized.damageParts = [damage];
  normalized.target = {
    ...(object(normalized.target) ? normalized.target : {}),
    template,
    affects: { type: "creature" },
    prompt: true
  };
  normalized.range = { value: null, units: "self" };
  delete normalized.weaponType;
  delete normalized.damage;
  delete normalized.extraDamageParts;
  delete normalized.properties;
  return normalized;
}

function normalizeWeaponExtraDamageParts(spec, requestChunk) {
  if (!["weaponExtraDamage", "weaponConditionOnHit", "artifactWeaponHybrid"].includes(spec.kind)) return spec;
  const normalized = clone(spec);
  const currentParts = Array.isArray(normalized.extraDamageParts)
    ? normalized.extraDamageParts.filter(part => object(part))
    : [];
  if (currentParts.length) {
    normalized.extraDamageParts = currentParts;
    return normalized;
  }
  const inferredParts = extractExtraDamagePartsFromText(textForSpecInference(spec, requestChunk));
  if (inferredParts.length) normalized.extraDamageParts = inferredParts;
  return normalized;
}

function enchantDamageChange(part) {
  return {
    key: "system.damage.parts",
    mode: "ADD",
    value: {
      number: Number(part.number),
      denomination: Number(part.denomination),
      bonus: part.bonus ?? "",
      types: normalizeDamageTypes(part.types, [])
    }
  };
}

function extractHealingClause(text) {
  const source = compactText(text);
  if (!source) return "The item includes a healing power.";
  const match = source.match(/[^.!?]*\b(?:restore|regain|heal|healing|hit points?)\b[^.!?]*(?:[.!?]|$)/i);
  return compactText(match?.[0] ?? source);
}

function singleSummonProfileFromSpec(spec, requestChunk) {
  const actor = clone(
    spec.summonActor
    ?? spec.actor
    ?? spec.summon
    ?? spec.creature
    ?? spec.actorData
    ?? spec.profile?.actor
    ?? spec.summonProfiles?.[0]?.actor
    ?? {}
  );
  if (!object(actor) || Object.keys(actor).length === 0) return null;
  return {
    profileName: compactText(spec.profileName || spec.summonProfiles?.[0]?.profileName || actor.name || "Summoned Ally"),
    actor
  };
}

function preserveHybridHealingAsUnresolved(spec, requestChunk) {
  if (!object(spec.healing)) return spec;
  const normalized = clone(spec);
  const unresolved = Array.isArray(normalized.unresolvedMechanics)
    ? normalized.unresolvedMechanics.filter(mechanic => object(mechanic))
    : [];
  const requestedText = extractHealingClause(requestChunk || normalized.description || "");
  if (!unresolved.some(mechanic =>
    /healing/i.test(compactText(mechanic.label || ""))
    || comparableText(mechanic.requestedText || "") === comparableText(requestedText)
  )) {
    unresolved.push({
      category: "tableAdjudication",
      label: "Healing power needs manual review",
      requestedText,
      reason: "This hybrid item mixed reusable summon or spell powers with healing in a shape that does not map cleanly to one supported automated suite schema.",
      handling: "The summon and spell activities were preserved. Review the healing clause manually or edit the JSON to add a custom healing activity.",
      resolved: false
    });
  }
  normalized.unresolvedMechanics = unresolved;
  delete normalized.healing;
  return normalized;
}

function splitSharedActivities(activityList) {
  const derivedSaveActivities = [];
  const derivedAttackActivities = [];
  const derivedUtilityActivities = [];
  for (const activity of activityList) {
    if (object(activity.save) && Array.isArray(activity.damageParts)) derivedSaveActivities.push(activity);
    else if (Array.isArray(activity.damageParts)) derivedAttackActivities.push(activity);
    else derivedUtilityActivities.push(activity);
  }
  return {
    derivedSaveActivities,
    derivedAttackActivities,
    derivedUtilityActivities
  };
}

function normalizeMixedStaffSuite(spec, requestChunk) {
  if (spec.kind !== "multiActivityStaff") return spec;
  const activityList = Array.isArray(spec.activities) ? spec.activities.filter(activity => object(activity)) : [];
  const saveActivities = Array.isArray(spec.saveActivities) ? spec.saveActivities.filter(activity => object(activity)) : [];
  const attackActivities = Array.isArray(spec.attackActivities) ? spec.attackActivities.filter(activity => object(activity)) : [];
  const utilityActivities = Array.isArray(spec.utilityActivities) ? spec.utilityActivities.filter(activity => object(activity)) : [];
  const summonProfiles = Array.isArray(spec.summonProfiles) ? spec.summonProfiles.filter(profile => object(profile)) : [];
  const singleSummonProfile = singleSummonProfileFromSpec(spec, requestChunk);
  const hasSingleSummonProfile = object(singleSummonProfile);
  const mergedSummonProfiles = summonProfiles.length ? summonProfiles : (hasSingleSummonProfile ? [singleSummonProfile] : []);
  const sharedActivitySplit = splitSharedActivities(activityList);
  const sharedActivitiesNeedSuite = activityList.length >= 2 && (
    sharedActivitySplit.derivedAttackActivities.length || sharedActivitySplit.derivedUtilityActivities.length
  );

  if (
    (mergedSummonProfiles.length && (activityList.length || saveActivities.length || attackActivities.length || utilityActivities.length)) ||
    sharedActivitiesNeedSuite
  ) {
    const normalized = clone(spec);
    const derivedSaveActivities = [...saveActivities, ...sharedActivitySplit.derivedSaveActivities];
    const derivedAttackActivities = [...attackActivities, ...sharedActivitySplit.derivedAttackActivities];
    const derivedUtilityActivities = [...utilityActivities, ...sharedActivitySplit.derivedUtilityActivities];

    normalized.kind = "equipmentPowerSuite";
    normalized.saveActivities = derivedSaveActivities.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Save ${index + 1}`)
    }));
    normalized.attackActivities = derivedAttackActivities.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Attack ${index + 1}`),
      damageParts: Array.isArray(activity.damageParts) ? activity.damageParts : []
    }));
    normalized.utilityActivities = derivedUtilityActivities.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Utility ${index + 1}`)
    }));
    if (mergedSummonProfiles.length) {
      normalized.summonProfiles = mergedSummonProfiles;
      normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
    }
    delete normalized.activities;
    return preserveHybridHealingAsUnresolved(normalized, requestChunk);
  }

  if (saveActivities.length + attackActivities.length + utilityActivities.length >= 2) {
    const normalized = clone(spec);
    normalized.kind = "equipmentPowerSuite";
    const utilitySaveActivities = utilityActivities.filter(activity => object(activity.save) && Array.isArray(activity.damageParts));
    const utilityOnlyActivities = utilityActivities.filter(activity => !utilitySaveActivities.includes(activity));
    normalized.saveActivities = [...saveActivities, ...utilitySaveActivities].map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Save ${index + 1}`)
    }));
    normalized.attackActivities = attackActivities.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Attack ${index + 1}`),
      damageParts: Array.isArray(activity.damageParts) ? activity.damageParts : []
    }));
    normalized.utilityActivities = utilityOnlyActivities.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Utility ${index + 1}`)
    }));
    if (mergedSummonProfiles.length) {
      normalized.summonProfiles = mergedSummonProfiles;
      normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
    }
    delete normalized.activities;
    return preserveHybridHealingAsUnresolved(normalized, requestChunk);
  }

  if (activityList.length >= 2) return spec;

  const attackLike = activityList.filter(activity =>
    Array.isArray(activity.damageParts) && !object(activity.save) && (
      activity.attackBonus != null || activity.toHit != null || /to hit/i.test(compactText(activity.description || activity.activityName || ""))
    )
  );
  const saveLike = activityList.filter(activity => object(activity.save));
  if (attackLike.length + saveLike.length >= 2) {
    const normalized = clone(spec);
    normalized.kind = "equipmentPowerSuite";
    normalized.saveActivities = saveLike.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Save ${index + 1}`)
    }));
    normalized.attackActivities = attackLike.map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Attack ${index + 1}`),
      damageParts: Array.isArray(activity.damageParts) ? activity.damageParts : []
    }));
    normalized.utilityActivities = Array.isArray(normalized.utilityActivities) ? normalized.utilityActivities : [];
    if (mergedSummonProfiles.length) {
      normalized.summonProfiles = mergedSummonProfiles;
      normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
    }
    delete normalized.activities;
    return preserveHybridHealingAsUnresolved(normalized, requestChunk);
  }

  return spec;
}

function auraActivityText(activity) {
  if (!object(activity)) return "";
  return compactText([
    activity.activityName,
    activity.name,
    activity.label,
    activity.description,
    activity.chatFlavor
  ].filter(Boolean).join(" ")).toLowerCase();
}

function normalizeActorTokenAuraActivities(spec, requestChunk) {
  if (!object(spec) || !/\baura\b/i.test(textForSpecInference(spec, requestChunk))) return spec;

  const normalized = clone(spec);
  let changed = false;
  for (const field of ["activities", "saveActivities", "utilityActivities"]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map(activity => {
      if (!object(activity) || !/\baura\b|\bstart(?:s)?\s+(?:its|their)\s+turn\b/i.test(auraActivityText(activity))) {
        return activity;
      }
      const target = object(activity.target) ? activity.target : {};
      const affects = object(target.affects) ? target.affects : {};
      changed = true;
      return {
        ...activity,
        range: { ...(object(activity.range) ? activity.range : {}), value: null, units: "self" },
        target: {
          ...target,
          affects: { ...affects, count: "1", type: "self", special: "Wielder's actor token" },
          prompt: false
        }
      };
    });
  }
  return changed ? normalized : spec;
}

function normalizeMalformedUtilitySaveActivities(spec, requestChunk) {
  if (!isSuiteKind(spec.kind) || !Array.isArray(spec.saveActivities)) return spec;

  const normalized = clone(spec);
  const requestText = compactText(requestChunk);
  const utilityActivities = Array.isArray(normalized.utilityActivities)
    ? normalized.utilityActivities.filter(object)
    : [];
  const validSaveActivities = [];

  for (const activity of normalized.saveActivities.filter(object)) {
    const hasSaveAbility = compactText(activity.save?.ability);
    const hasDamage = Array.isArray(activity.damageParts) && activity.damageParts.length > 0;
    const isNoSaveAuraDamage = hasDamage
      && /\baura\b/i.test(requestText)
      && /\baura\b|\bstart(?:s)?\s+(?:its|their)\s+turn\b|\bhostile\b/i.test(auraActivityText(activity));
    if (isNoSaveAuraDamage) {
      const utilityActivity = { ...activity };
      delete utilityActivity.save;
      delete utilityActivity.damageOnSave;
      delete utilityActivity.damageParts;
      utilityActivity.description = [
        compactText(utilityActivity.description),
        "Manual review: aura damage remains deferred; activation is anchored to the wielder's actor token."
      ].filter(Boolean).join(" ");
      utilityActivities.push(utilityActivity);
      continue;
    }
    if (hasSaveAbility || hasDamage) {
      validSaveActivities.push(activity);
      continue;
    }

    // Models occasionally place no-save spells such as Teleport in the save
    // collection. Only reroute entries with no damage; damaging saves must
    // still fail validation rather than receiving an invented save ability.
    const utilityActivity = { ...activity };
    delete utilityActivity.save;
    delete utilityActivity.damageOnSave;
    delete utilityActivity.damageParts;
    utilityActivities.push(utilityActivity);
  }

  normalized.saveActivities = validSaveActivities;
  normalized.utilityActivities = utilityActivities;
  return normalized;
}

function normalizeMalformedAttackActivities(spec) {
  if (!isSuiteKind(spec.kind) || !Array.isArray(spec.attackActivities)) return spec;

  const normalized = clone(spec);
  const utilityActivities = Array.isArray(normalized.utilityActivities)
    ? normalized.utilityActivities.filter(object)
    : [];
  const saveActivities = Array.isArray(normalized.saveActivities)
    ? normalized.saveActivities.filter(object)
    : [];
  const validAttackActivities = [];

  for (const activity of normalized.attackActivities.filter(object)) {
    const hasDamage = Array.isArray(activity.damageParts) && activity.damageParts.length > 0;
    if (hasDamage) {
      validAttackActivities.push(activity);
      continue;
    }

    const hasSaveAbility = compactText(activity.save?.ability);
    if (hasSaveAbility) {
      const saveActivity = { ...activity };
      delete saveActivity.attackBonus;
      delete saveActivity.attackType;
      delete saveActivity.attackClassification;
      delete saveActivity.ability;
      delete saveActivity.damageParts;
      saveActivities.push(saveActivity);
      continue;
    }

    const utilityActivity = { ...activity };
    delete utilityActivity.attackBonus;
    delete utilityActivity.attackType;
    delete utilityActivity.attackClassification;
    delete utilityActivity.ability;
    delete utilityActivity.save;
    delete utilityActivity.damageOnSave;
    delete utilityActivity.damageParts;
    utilityActivities.push(utilityActivity);
  }

  normalized.attackActivities = validAttackActivities;
  normalized.saveActivities = saveActivities;
  normalized.utilityActivities = utilityActivities;
  return normalized;
}

function normalizeSharedActivitySuite(spec, requestChunk) {
  if (!["equipmentPowerSuite", "legendaryEquipmentSuite", "casterUtilityEquipment"].includes(spec.kind)) return spec;
  const activityList = Array.isArray(spec.activities) ? spec.activities.filter(activity => object(activity)) : [];
  const saveActivities = Array.isArray(spec.saveActivities) ? spec.saveActivities.filter(activity => object(activity)) : [];
  const attackActivities = Array.isArray(spec.attackActivities) ? spec.attackActivities.filter(activity => object(activity)) : [];
  const utilityActivities = Array.isArray(spec.utilityActivities) ? spec.utilityActivities.filter(activity => object(activity)) : [];
  const summonProfiles = Array.isArray(spec.summonProfiles) ? spec.summonProfiles.filter(profile => object(profile)) : [];
  const singleSummonProfile = singleSummonProfileFromSpec(spec, requestChunk);
  const mergedSummonProfiles = summonProfiles.length ? summonProfiles : (object(singleSummonProfile) ? [singleSummonProfile] : []);

  if (!activityList.length && !mergedSummonProfiles.length) return spec;

  const normalized = clone(spec);
  if (activityList.length) {
    const split = splitSharedActivities(activityList);
    normalized.saveActivities = [...saveActivities, ...split.derivedSaveActivities].map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Save ${index + 1}`)
    }));
    normalized.attackActivities = [...attackActivities, ...split.derivedAttackActivities].map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Attack ${index + 1}`),
      damageParts: Array.isArray(activity.damageParts) ? activity.damageParts : []
    }));
    normalized.utilityActivities = [...utilityActivities, ...split.derivedUtilityActivities].map((activity, index) => ({
      ...activity,
      activityName: fallbackActivityName(activity, `Utility ${index + 1}`)
    }));
    delete normalized.activities;
  }

  if (mergedSummonProfiles.length) {
    normalized.summonProfiles = mergedSummonProfiles;
    normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
  }

  return preserveHybridHealingAsUnresolved(normalized, requestChunk);
}

function normalizeSuiteSummonShape(spec) {
  if (!["equipmentPowerSuite", "legendaryEquipmentSuite", "casterUtilityEquipment"].includes(spec.kind)) return spec;
  if (!Array.isArray(spec.summonProfiles) || !spec.summonProfiles.some(profile => object(profile))) return spec;
  if (object(spec.summonActivity)) return spec;
  return {
    ...clone(spec),
    summonActivity: {}
  };
}

function fallbackActivityName(activity, fallbackLabel) {
  const candidates = [
    activity?.activityName,
    activity?.name,
    activity?.label,
    activity?.title,
    activity?.spellName,
    object(activity?.spell) ? activity.spell.name ?? activity.spell.label ?? activity.spell.title : activity?.spell,
    activity?.powerName,
    activity?.utilityName,
    activity?.saveName,
    activity?.attackName
  ]
    .map(value => compactText(value || ""))
    .filter(Boolean);

  const specific = candidates.find(name => !isGenericActivityLabel(name));
  if (specific) return specific;
  return candidates[0] || fallbackLabel;
}

function normalizeActivityNames(spec) {
  const normalized = clone(spec);
  for (const [field, label] of [
    ["activities", "Activity"],
    ["attackActivities", "Attack"],
    ["saveActivities", "Save"],
    ["utilityActivities", "Utility"]
  ]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map((activity, index) => {
      if (!object(activity)) return activity;
      return {
        ...activity,
        activityName: fallbackActivityName(activity, `${label} ${index + 1}`)
      };
    });
  }
  if (object(normalized.summonActivity)) {
    normalized.summonActivity = {
      ...normalized.summonActivity,
      activityName: fallbackActivityName(normalized.summonActivity, "Summon Ally")
    };
  }
  return normalized;
}

function inferSpecKind(spec, requestChunk, supportedKinds) {
  const text = textForSpecInference(spec, requestChunk);
  const supports = kind => supportedKinds.includes(kind);
  const candidates = [];
  const addCandidate = (kind, score, reason = "") => {
    if (!supports(kind)) return;
    candidates.push({ kind, score, reason });
  };

  const hasSuiteActivities =
    (Array.isArray(spec.attackActivities) && spec.attackActivities.length)
    || (Array.isArray(spec.saveActivities) && spec.saveActivities.length)
    || (Array.isArray(spec.utilityActivities) && spec.utilityActivities.length);
  const hasSharedActivities = Array.isArray(spec.activities) && spec.activities.length;
  const hasWeaponBase = Boolean(detectKnownWeaponBase(spec, requestChunk));
  const hasSingleSummonActor = (object(spec.summonActor) || object(spec.actor) || object(spec.profile?.actor))
    && looksLikeSingleSummonRequest(text);
  const hasMultiSummonProfiles = Array.isArray(spec.summonProfiles) && spec.summonProfiles.length >= 2;
  const looksArmorLike = /\b(shield|armor|plate|leather|breastplate)\b/i.test(text);
  const looksLegendary = /\blegendary\b/i.test(text);

  // Prefer simpler, structurally obvious families first. More complex hybrids can still
  // be normalized later, but the dominant base family should be cheap to validate.
  if (looksLikeEnchantRequest(text)) addCandidate("nativeEnchant", 160, "explicit enchant request");
  if (hasSharedActivities && (hasSingleSummonActor || hasMultiSummonProfiles || object(spec.healing))) {
    addCandidate("equipmentPowerSuite", 152, "shared activities plus summon or healing payload");
  }
  if (hasSharedActivities && spec.activities.length >= 2) addCandidate("multiActivityStaff", 150, "multiple shared-charge staff activities");
  if (spec.healing) addCandidate("chargedHealing", 145, "explicit healing payload");
  if (spec.save && Array.isArray(spec.damageParts)) addCandidate("chargedSaveDamage", 140, "explicit save-plus-damage payload");
  if (spec.conditionOnHit) addCandidate("weaponConditionOnHit", 138, "explicit condition rider");
  if ((Array.isArray(spec.extraDamageParts) || /\bextra\b.*\bdamage\b|\bon hit\b/i.test(text)) && hasWeaponBase) {
    addCandidate("weaponExtraDamage", 132, "weapon with extra on-hit damage");
  }

  if (hasSuiteActivities) {
    if (looksLegendary) addCandidate("legendaryEquipmentSuite", 126, "legendary suite payload");
    addCandidate("equipmentPowerSuite", 124, "attack/save/utility suite payload");
    addCandidate("casterUtilityEquipment", 118, "fallback utility suite payload");
  }

  if (Array.isArray(spec.effects) && spec.effects.length) addCandidate("passiveEffectEquipment", 120, "passive effects payload");
  if ((spec.armorValue || spec.magicalBonus) && looksArmorLike) addCandidate("shieldArmorBonus", 122, "armor or shield payload");

  // Summons are intentionally lower-priority than explicit reusable equipment/activity
  // structures so hybrid prompts keep a stable base item shape when possible.
  if (hasMultiSummonProfiles) addCandidate("nativeMultiProfileSummon", hasSuiteActivities ? 92 : 116, "multiple summon profiles");
  if (hasSingleSummonActor) addCandidate("nativeSummon", hasSuiteActivities ? 90 : 114, "single summon actor");

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.kind ?? "";
}

function requestUsesStaffWeaponBase(requestChunk) {
  const text = compactText(requestChunk);
  return /\b(?:quarterstaff|staff)\b/i.test(text) && !/\b(?:wand|rod)\b/i.test(text);
}

function normalizeSingleActivityStaff(spec, requestChunk) {
  if (spec.kind !== "multiActivityStaff" || !Array.isArray(spec.activities) || spec.activities.length !== 1) return spec;
  if (
    object(spec.healing)
    || object(spec.summonActor)
    || object(spec.actor)
    || object(spec.profile?.actor)
    || (Array.isArray(spec.summonProfiles) && spec.summonProfiles.some(profile => object(profile)))
  ) return spec;
  // A real staff still needs its base weapon attack alongside a single named
  // power. Only collapse wand/rod-shaped one-power outputs into save damage.
  if (requestUsesStaffWeaponBase(requestChunk)) return spec;
  const activity = spec.activities[0];
  if (!object(activity) || !object(activity.save) || !Array.isArray(activity.damageParts)) return spec;
  const normalized = clone(spec);
  normalized.kind = "chargedSaveDamage";
  normalized.activityId = activity.activityId ?? normalized.activityId;
  normalized.activityName = activity.activityName ?? normalized.activityName;
  normalized.activationType = activity.activationType ?? normalized.activationType;
  normalized.chargeCost = activity.chargeCost ?? normalized.chargeCost;
  normalized.range = activity.range ?? normalized.range;
  normalized.target = activity.target ?? normalized.target;
  normalized.duration = activity.duration ?? normalized.duration;
  normalized.save = activity.save;
  normalized.damageOnSave = activity.damageOnSave ?? normalized.damageOnSave ?? "half";
  normalized.damageParts = activity.damageParts;
  delete normalized.activities;
  return normalized;
}

function promoteChargedStaffSpec(spec, requestChunk) {
  if (spec.kind !== "chargedSaveDamage" || !requestUsesStaffWeaponBase(requestChunk)) return spec;

  const activityCandidates = [
    ...(Array.isArray(spec.activities) ? spec.activities : []),
    ...(Array.isArray(spec.saveActivities) ? spec.saveActivities : []),
    ...(Array.isArray(spec.utilityActivities) ? spec.utilityActivities : [])
  ].filter(activity => object(activity) && object(activity.save) && Array.isArray(activity.damageParts) && activity.damageParts.length);
  const topLevelPower = object(spec.save) && Array.isArray(spec.damageParts) && spec.damageParts.length
    ? {
        activityId: spec.activityId,
        activityName: spec.activityName,
        activationType: spec.activationType,
        chargeCost: spec.chargeCost,
        range: spec.range,
        target: spec.target,
        duration: spec.duration,
        save: spec.save,
        damageOnSave: spec.damageOnSave,
        damageParts: spec.damageParts
      }
    : null;
  const powers = topLevelPower ? [topLevelPower, ...activityCandidates] : activityCandidates;
  if (!powers.length) return spec;

  const normalized = clone(spec);
  normalized.kind = "multiActivityStaff";
  normalized.itemType = "equipment";
  normalized.baseItem = normalized.baseItem || "quarterstaff";
  normalized.activities = powers.map((power, index) => ({
    activityId: power.activityId,
    activityName: power.activityName || `Charged Power ${index + 1}`,
    activationType: power.activationType || "action",
    chargeCost: power.chargeCost ?? 1,
    range: power.range,
    target: power.target,
    duration: power.duration,
    save: power.save,
    damageOnSave: power.damageOnSave || "half",
    damageParts: power.damageParts
  }));
  delete normalized.activityId;
  delete normalized.activityName;
  delete normalized.activationType;
  delete normalized.chargeCost;
  delete normalized.range;
  delete normalized.target;
  delete normalized.duration;
  delete normalized.save;
  delete normalized.damageOnSave;
  delete normalized.damageParts;
  delete normalized.saveActivities;
  delete normalized.utilityActivities;
  return normalized;
}

function normalizeWeaponBase(spec, requestChunk) {
  if (!["weaponExtraDamage", "weaponConditionOnHit", "artifactWeaponHybrid"].includes(spec.kind)) return spec;
  const base = detectKnownWeaponBase(spec, requestChunk);
  if (!base) return spec;
  const normalized = clone(spec);
  normalized.weaponType = normalized.weaponType || base.weaponType;
  normalized.baseItem = normalized.baseItem || base.baseItem;
  const currentBase = object(normalized.damage?.base) ? normalized.damage.base : {};
  normalized.damage = {
    ...(object(normalized.damage) ? normalized.damage : {}),
    base: {
      number: hasMeaningfulNumericValue(currentBase.number) ? Number(currentBase.number) : base.damage.number,
      denomination: hasMeaningfulNumericValue(currentBase.denomination) ? Number(currentBase.denomination) : base.damage.denomination,
      bonus: currentBase.bonus == null ? base.damage.bonus : String(currentBase.bonus),
      types: normalizeDamageTypes(currentBase.types, base.damage.types)
    },
    versatile: object(normalized.damage?.versatile) ? normalized.damage.versatile : clone(base.versatile)
  };
  return normalized;
}

function normalizeToggleLight(spec, requestChunk) {
  if (spec.kind !== "artifactWeaponHybrid" || !object(spec.toggleLight)) return spec;
  const normalized = clone(spec);
  const text = textForSpecInference(spec, requestChunk);
  const inferred = parseLightRadii(text);
  const bright = Number.parseInt(String(normalized.toggleLight.bright ?? "").match(/\d+/)?.[0] ?? "", 10);
  const dim = Number.parseInt(String(normalized.toggleLight.dim ?? "").match(/\d+/)?.[0] ?? "", 10);
  normalized.toggleLight = {
    ...normalized.toggleLight,
    bright: Number.isFinite(bright) ? bright : inferred.bright,
    dim: Number.isFinite(dim) ? dim : inferred.dim
  };
  if (!compactText(normalized.toggleLight.activityName)) normalized.toggleLight.activityName = "Ignite the Flame";
  if (!compactText(normalized.toggleLight.effectName) || /\btemplate\b/i.test(compactText(normalized.toggleLight.effectName))) {
    normalized.toggleLight.effectName = `${normalized.name} Ignited`;
  }
  return normalized;
}

function normalizeConsumedHealingUses(spec, requestChunk) {
  if (!["chargedHealing", "nativeEnchant", "nativeSummon", "nativeMultiProfileSummon"].includes(spec.kind) || !object(spec.uses)) return spec;
  const text = textForSpecInference(spec, requestChunk);
  const max = String(spec.uses.max ?? "").trim();
  const explicitlyConsumed = /\b(consumed?|destroyed|single use|one use|one-and-done)\b/i.test(text);
  const inherentConsumable = ["chargedHealing", "nativeEnchant"].includes(spec.kind);
  const looksConsumed = explicitlyConsumed || (inherentConsumable && (
    spec.uses.autoDestroy === true || max === "1" || /\b(potion|drink)\b/i.test(text)
  ));
  if (!looksConsumed) return spec;
  const normalized = clone(spec);
  if (normalized.kind === "chargedHealing") {
    normalized.itemType = normalized.itemType || "consumable";
    normalized.consumableType = normalized.consumableType || "potion";
  }
  normalized.uses = {
    ...normalized.uses,
    max: max || "1",
    recovery: Array.isArray(normalized.uses.recovery) ? normalized.uses.recovery : [],
    autoDestroy: true
  };
  return normalized;
}

function normalizeMissingUses(spec, requestChunk) {
  const usesKinds = new Set([
    "chargedHealing",
    "chargedSaveDamage",
    "multiActivityStaff",
    "casterUtilityEquipment",
    "equipmentPowerSuite",
    "legendaryEquipmentSuite",
    "artifactWeaponHybrid",
    "nativeEnchant",
    "nativeSummon",
    "nativeMultiProfileSummon"
  ]);
  if (!usesKinds.has(spec.kind)) return spec;

  const text = textForSpecInference(spec, requestChunk);
  const consumedKinds = new Set(["chargedHealing", "nativeEnchant"]);
  const inferred = inferUsesFromText(text, {
    consumed: consumedKinds.has(spec.kind),
    // Summon activities require a use pool even when a terse prompt omits a
    // recharge clause. A max of one does not make the item consumable.
    defaultMax: object(spec.uses)
      ? String(spec.uses.max ?? "").trim()
      : (["nativeSummon", "nativeMultiProfileSummon"].includes(spec.kind) ? "1" : "")
  });
  if (!inferred) return spec;

  const normalized = clone(spec);
  const existing = object(normalized.uses) ? normalized.uses : {};
  const existingMax = String(existing.max ?? "").trim();
  const existingRecovery = Array.isArray(existing.recovery) ? existing.recovery : [];
  const inferredRecovery = Array.isArray(inferred.recovery) ? inferred.recovery : [];
  const recovery = inferredRecovery.length
    ? inferredRecovery
    : existingRecovery.length
    ? existingRecovery.map((entry, index) => {
      const inferredEntry = inferredRecovery[index];
      if (!object(entry) || !object(inferredEntry) || compactText(entry.formula) || !compactText(inferredEntry.formula)) return entry;
      return { ...entry, formula: inferredEntry.formula };
    })
    : inferredRecovery;
  normalized.uses = {
    ...existing,
    max: existingMax || inferred.max || "1",
    recovery
  };
  const explicitlyConsumed = /\b(consumed?|destroyed|single use|one use|one-and-done)\b/i.test(text);
  if ((consumedKinds.has(spec.kind) && (inferred.autoDestroy || normalized.uses.max === "1")) || explicitlyConsumed) {
    normalized.uses.autoDestroy = true;
    normalized.uses.recovery = Array.isArray(normalized.uses.recovery) ? normalized.uses.recovery : [];
  } else if (["nativeSummon", "nativeMultiProfileSummon"].includes(spec.kind) && normalized.uses.recovery.length) {
    // A reusable summon item with a rest-based recovery must not be destroyed
    // simply because its use maximum is one.
    normalized.uses.autoDestroy = false;
  }
  return normalized;
}

function extractNamedCastSpell(text) {
  const match = compactText(text).match(/\bcasts?\s+([a-z][a-z' -]*?)(?=\s+(?:on|upon)\b|[.;]|$)/i);
  return match ? titleCase(match[1]) : "";
}

function normalizeNonHealingSpellConsumable(spec, requestChunk, supportedKinds) {
  if (spec.kind !== "chargedHealing" || !supportedKinds.includes("casterUtilityEquipment")) return spec;

  const text = textForSpecInference(spec, requestChunk);
  const spellName = extractNamedCastSpell(requestChunk);
  const isConsumable = /\b(?:potion|tonic|draught|elixir)\b/i.test(text);
  if (!isConsumable || !spellName || extractHealingPartFromText(requestChunk)) return spec;

  const normalized = clone(spec);
  const existingActivities = Array.isArray(normalized.utilityActivities)
    ? normalized.utilityActivities.filter(object)
    : [];
  normalized.kind = "casterUtilityEquipment";
  normalized.itemType = "consumable";
  normalized.consumableType = normalized.consumableType || "potion";
  normalized.uses = {
    ...(object(normalized.uses) ? normalized.uses : {}),
    max: "1",
    recovery: [],
    autoDestroy: true
  };
  normalized.utilityActivities = existingActivities.length ? existingActivities : [{
    ...(normalized.activityId ? { activityId: normalized.activityId } : {}),
    activityName: `Cast ${spellName}`,
    activationType: "action",
    chargeCost: 1,
    range: { units: "self" },
    target: { affects: { count: "1", type: "self", special: "The drinker" }, prompt: false }
  }];
  normalized.effects = Array.isArray(normalized.effects) ? normalized.effects : [];
  delete normalized.healing;
  delete normalized.activityId;
  return normalized;
}

function recoverableSpellProfiles(requestChunk) {
  const text = compactText(requestChunk);
  return RECOVERABLE_SPELL_PROFILES.filter(profile =>
    new RegExp(`\\b${profile.name.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)
  );
}

function activityMentionsSpell(activity, spellName) {
  const text = compactText([
    activity?.activityName,
    activity?.name,
    activity?.label,
    activity?.title,
    activity?.spellName,
    activity?.spell
  ].filter(Boolean).join(" "));
  return new RegExp(`\\b${spellName.replace(/\s+/g, "\\s+")}\\b`, "i").test(text);
}

function requestedSpellChargeCost(requestChunk, spellName, fallback) {
  const escaped = spellName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const match = compactText(requestChunk).match(new RegExp(`(?:spend\\s+)?(\\d+)\\s*charges?\\s+to\\s+cast\\s+${escaped}\\b`, "i"));
  return match ? Number(match[1]) : fallback;
}

function explicitSpellChargeCosts(requestChunk) {
  const costs = [];
  const pattern = /(?:\bspend\s+)?(\d+)\s*charges?\s+to\s+cast\s+([a-z][a-z' -]*?)(?=\s+at\s+DC\b|\s+or\s+\d+\s*charges?\b|[.,;]|$)/ig;
  for (const match of compactText(requestChunk).matchAll(pattern)) {
    const spellName = compactText(match[2]);
    const chargeCost = Number(match[1]);
    if (spellName && Number.isFinite(chargeCost) && chargeCost > 0) costs.push({ spellName, chargeCost });
  }
  return costs;
}

function normalizeExplicitSpellChargeCosts(spec, requestChunk) {
  const costs = explicitSpellChargeCosts(requestChunk);
  if (!costs.length) return spec;

  const normalized = clone(spec);
  for (const field of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map(activity => {
      if (!object(activity)) return activity;
      const explicit = costs.find(entry => activityMentionsSpell(activity, entry.spellName));
      return explicit ? { ...activity, chargeCost: explicit.chargeCost } : activity;
    });
  }
  return normalized;
}

function normalizeExplicitActivityChargeCosts(spec, requestChunk) {
  const text = compactText(requestChunk);
  const summonCosts = [...text.matchAll(/\b(?:spend|expend|use)\s+(\d+)\s+charges?\s+to\s+(?:summon|conjure|call\s+(?:forth|in))\b/gi)]
    .map(match => Number(match[1]))
    .filter(cost => Number.isFinite(cost) && cost > 0);
  if (summonCosts.length !== 1) return spec;

  const normalized = clone(spec);
  let changed = false;
  for (const field of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map(activity => {
      if (!object(activity)) return activity;
      const type = compactText(activity.type).toLowerCase();
      const name = compactText(activity.activityName);
      if (type !== "summon" && !/\bsummon\b/i.test(name)) return activity;
      if (Number(activity.chargeCost) === summonCosts[0]) return activity;
      changed = true;
      return { ...activity, chargeCost: summonCosts[0] };
      });
  }
  if (Array.isArray(normalized.summonProfiles) && normalized.summonProfiles.length) {
    const summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
    if (Number(summonActivity.chargeCost) !== summonCosts[0]) {
      normalized.summonActivity = { ...summonActivity, chargeCost: summonCosts[0] };
      changed = true;
    }
  }
  return changed ? normalized : spec;
}

function requestedSpellDc(requestChunk, fallback = 13) {
  const match = compactText(requestChunk).match(/\bDC\s*(\d+)\b/i);
  return match ? Number(match[1]) : fallback;
}

function isSuiteKind(kind) {
  return ["casterUtilityEquipment", "equipmentPowerSuite", "legendaryEquipmentSuite", "artifactWeaponHybrid"].includes(kind);
}

function normalizeNamedSpellSuite(spec, requestChunk, supportedKinds) {
  const profiles = recoverableSpellProfiles(requestChunk);
  if (!profiles.length) return spec;

  const text = textForSpecInference(spec, requestChunk);
  const normalized = clone(spec);
  const hasCasterBonus = /\bspell\s+(?:attack(?:\s+rolls?)?|save\s+dc)\b/i.test(text);
  const staffActivities = [
    ...(Array.isArray(normalized.activities) ? normalized.activities : []),
    ...(Array.isArray(normalized.saveActivities) ? normalized.saveActivities : []),
    ...(Array.isArray(normalized.utilityActivities) ? normalized.utilityActivities : [])
  ].filter(object);
  const sharedStaffActivities = Array.isArray(normalized.activities) ? normalized.activities.filter(object) : [];
  const malformedNamedStaffSpell = normalized.kind === "multiActivityStaff" && profiles.some(profile =>
    profile.type === "save"
    && staffActivities.some(activity => activityMentionsSpell(activity, profile.name) && !object(activity.save))
  );
  const nonDamageNamedStaffSpell = normalized.kind === "multiActivityStaff" && profiles.some(profile =>
    profile.type === "save"
    && !profile.damageParts.length
    && staffActivities.some(activity => activityMentionsSpell(activity, profile.name))
  );
  const missingSharedStaffActivities = normalized.kind === "multiActivityStaff"
    && sharedStaffActivities.length === 0
    && staffActivities.length > 0;
  const hasNonDamageStaffActivity = normalized.kind === "multiActivityStaff"
    && sharedStaffActivities.some(activity => !object(activity.save) || !Array.isArray(activity.damageParts) || !activity.damageParts.length);
  const staffHybrid = (malformedNamedStaffSpell || hasNonDamageStaffActivity)
    && /\b(?:heal|healing|restore|summon|conjure|call forth|call in|calls in)\b/i.test(text);
  const passiveCasterUtility = normalized.kind === "passiveEffectEquipment" && hasCasterBonus;
  const emptyNamedStaffSuite = normalized.kind === "multiActivityStaff" && staffActivities.length === 0;
  const namedEquipmentSuite = isSuiteKind(normalized.kind);

  // Do not replace a valid multi-spell staff merely because its request also
  // mentions an unsupported feature. Only intervene when the named spell data
  // itself is malformed, which would otherwise fail service validation.
  if (
    !passiveCasterUtility
    && !staffHybrid
    && !emptyNamedStaffSuite
    && !nonDamageNamedStaffSpell
    && !missingSharedStaffActivities
    && !namedEquipmentSuite
  ) return spec;

  if (passiveCasterUtility && supportedKinds.includes("casterUtilityEquipment")) {
    normalized.kind = "casterUtilityEquipment";
  } else if (emptyNamedStaffSuite || nonDamageNamedStaffSpell || missingSharedStaffActivities) {
    const explicitStaffChassis = /\b(?:quarterstaff|staff)\b/i.test(text);
    if (explicitStaffChassis && supportedKinds.includes("equipmentPowerSuite")) {
      normalized.kind = "equipmentPowerSuite";
    } else if (supportedKinds.includes("casterUtilityEquipment")) {
      normalized.kind = "casterUtilityEquipment";
    } else if (supportedKinds.includes("equipmentPowerSuite")) {
      normalized.kind = "equipmentPowerSuite";
    }
  } else if (staffHybrid && supportedKinds.includes("equipmentPowerSuite")) {
    // The staff renderer only accepts save-and-damage activities. A hybrid
    // staff must use the suite renderer so healing and summons stay valid.
    normalized.kind = "equipmentPowerSuite";
    const base = detectKnownWeaponBase(normalized, requestChunk);
    if (base) {
      normalized.weaponType = normalized.weaponType || base.weaponType;
      normalized.baseItem = normalized.baseItem || base.baseItem;
      normalized.damage = normalized.damage || {
        base: clone(base.damage),
        versatile: clone(base.versatile)
      };
    }
  }

  if (!isSuiteKind(normalized.kind)) return spec;

  const sharedActivities = Array.isArray(normalized.activities) ? normalized.activities.filter(object) : [];
  normalized.utilityActivities = Array.isArray(normalized.utilityActivities) ? normalized.utilityActivities.filter(object) : [];
  normalized.saveActivities = Array.isArray(normalized.saveActivities) ? normalized.saveActivities.filter(object) : [];
  normalized.attackActivities = Array.isArray(normalized.attackActivities) ? normalized.attackActivities.filter(object) : [];

  for (const profile of profiles) {
    const matchingShared = sharedActivities.filter(activity => activityMentionsSpell(activity, profile.name));
    const matchingSave = normalized.saveActivities.filter(activity => activityMentionsSpell(activity, profile.name));
    const matchingUtility = normalized.utilityActivities.filter(activity => activityMentionsSpell(activity, profile.name));
    const matchingAttack = normalized.attackActivities.filter(activity => activityMentionsSpell(activity, profile.name));
    const existing = [...matchingShared, ...matchingSave, ...matchingAttack, ...matchingUtility][0] ?? {};
    const baseActivity = {
      activityName: `Cast ${profile.name}`,
      activationType: existing.activationType || "action",
      chargeCost: Number.isFinite(Number(existing.chargeCost))
        ? Number(existing.chargeCost)
        : requestedSpellChargeCost(requestChunk, profile.name, profile.defaultChargeCost),
      range: clone(profile.range),
      target: clone(profile.target),
      ...(profile.duration ? { duration: clone(profile.duration) } : {})
    };

    normalized.saveActivities = normalized.saveActivities.filter(activity => !activityMentionsSpell(activity, profile.name));
    normalized.attackActivities = normalized.attackActivities.filter(activity => !activityMentionsSpell(activity, profile.name));
    normalized.utilityActivities = normalized.utilityActivities.filter(activity => !activityMentionsSpell(activity, profile.name));
    if (Array.isArray(normalized.activities)) {
      normalized.activities = normalized.activities.filter(activity => !activityMentionsSpell(activity, profile.name));
    }
    if (profile.type === "save") {
      normalized.saveActivities.push({
        ...baseActivity,
        save: { ...clone(profile.save), dc: requestedSpellDc(requestChunk) },
        damageOnSave: profile.damageOnSave,
        damageParts: clone(profile.damageParts)
      });
    } else if (profile.type === "attack") {
      normalized.attackActivities.push({
        ...baseActivity,
        attackType: profile.attackType || "ranged",
        attackClassification: profile.attackClassification || "spell",
        attackBonus: "@prof",
        damageParts: clone(profile.damageParts)
      });
    } else {
      normalized.utilityActivities.push(baseActivity);
    }
  }

  if (staffHybrid) {
    const healing = extractHealingPartFromText(text);
    if (healing && !normalized.utilityActivities.some(activity => object(activity.healing))) {
      normalized.utilityActivities.push({
        activityName: "Healing Touch",
        activationType: "action",
        chargeCost: Number(compactText(text).match(/spend\s+(\d+)\s+charges?\s+to\s+(?:restore|heal)/i)?.[1] ?? 1),
        healing,
        range: { value: 5, units: "ft" },
        target: { affects: { count: "1", type: "creature" }, prompt: true }
      });
    }
    delete normalized.activities;
  }

  const inferredUses = inferUsesFromText(text, {
    defaultMax: object(normalized.uses) ? String(normalized.uses.max ?? "").trim() : ""
  });
  if (inferredUses) {
    const uses = object(normalized.uses) ? normalized.uses : {};
    normalized.uses = {
      ...uses,
      max: String(uses.max ?? "").trim() || inferredUses.max || "1",
      recovery: Array.isArray(uses.recovery) ? uses.recovery : inferredUses.recovery
    };
  }
  return normalized;
}

function clearResolvedNamedSpellReview(spec, requestChunk) {
  if (!Array.isArray(spec?.unresolvedMechanics) || !spec.unresolvedMechanics.length) return spec;
  const profiles = recoverableSpellProfiles(requestChunk);
  if (!profiles.length) return spec;
  const activities = ["activities", "saveActivities", "attackActivities", "utilityActivities"]
    .flatMap(field => Array.isArray(spec?.[field]) ? spec[field] : []);
  if (!profiles.every(profile => activities.some(activity => activityMentionsSpell(activity, profile.name)))) return spec;

  const normalized = clone(spec);
  normalized.unresolvedMechanics = normalized.unresolvedMechanics.filter(mechanic => {
    const category = compactText(mechanic?.category).toLowerCase();
    const label = compactText(mechanic?.label).toLowerCase();
    const requestedText = compactText(mechanic?.requestedText).toLowerCase();
    if (category !== "unmappedspell" && !/spellcasting activities|unmapped spell/.test(label)) return true;
    return !profiles.every(profile => requestedText.includes(profile.name.toLowerCase()) || label.includes("spellcasting activities"));
  });
  if (!normalized.unresolvedMechanics.length) delete normalized.unresolvedMechanics;
  return normalized;
}

function looksLikeThrowableConsumableRequest(text) {
  const source = compactText(text);
  if (!source) return false;
  if (!/\b(?:grenade|bomb|flask|vial|alchemist(?:'s)?\s+fire|acid\s+flask|holy\s+water)\b/i.test(source)) return false;
  return /\b(?:throw|thrown|hurl|lob|splash|burst|explode|explodes?|hit)\b/i.test(source);
}

function inferThrowableConsumableName(text) {
  const source = compactText(text);
  if (/\balchemist(?:'s)?\s+fire\b/i.test(source)) return "Alchemist Fire";
  if (/\bacid\s+flask\b/i.test(source)) return "Acid Flask";
  if (/\bholy\s+water\b/i.test(source)) return "Holy Water";
  return "";
}

function inferThrowableConsumableType(text) {
  return /\b(?:acid|poison)\b/i.test(text) ? "poison" : "trinket";
}

function inferFeetValue(text, fallback = null) {
  const match = String(text ?? "").match(/\bwithin\s+(\d+)\s*feet?\b/i)
    ?? String(text ?? "").match(/\brange\s*:\s*(\d+)\s*feet?\b/i)
    ?? String(text ?? "").match(/\brange\s+of\s+(\d+)\s*feet?\b/i)
    ?? String(text ?? "").match(/\bto\s+a\s+point\s+within\s+(\d+)\s*feet?\b/i)
    ?? String(text ?? "").match(/\b(\d+)\s*[- ]?foot\b/i);
  return match ? Number(match[1]) : fallback;
}

function inferExplicitFeetValue(text) {
  return inferFeetValue(text, null);
}

function inferTemplateFromText(text) {
  const source = compactText(text);
  if (!source) return null;
  const sphere = source.match(/\b(\d+)\s*[- ]?foot(?:-radius)?\s+sphere\b/i)
    ?? source.match(/\b(\d+)\s*[- ]?foot(?:\s+radius)?\s+sphere\b/i);
  if (sphere) return { type: "sphere", size: Number(sphere[1]), units: "ft" };
  const cone = source.match(/\b(\d+)\s*[- ]?foot\s+cone\b/i);
  if (cone) return { type: "cone", size: Number(cone[1]), units: "ft" };
  const cube = source.match(/\b(\d+)\s*[- ]?foot\s+cube\b/i);
  if (cube) return { type: "cube", size: Number(cube[1]), units: "ft" };
  const line = source.match(/\b(\d+)\s*[- ]?foot\s+line\b/i);
  if (line) return { type: "line", size: Number(line[1]), units: "ft" };
  return null;
}

function inferExplicitSaveAbility(text) {
  const match = compactText(text).match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+sav(?:e|ing throw)/i)
    ?? compactText(text).match(/\bsave ability\s*:\s*(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/i);
  if (!match) return "";
  const ability = match[1].slice(0, 3).toLowerCase();
  return ["str", "dex", "con", "int", "wis", "cha"].includes(ability) ? ability : "";
}

function stripThrowableConsumableNoiseEffects(effects, text) {
  if (!Array.isArray(effects)) return [];
  const explicitAttackBonus = /\b(?:\+\d+|bonus)\s+to\s+(?:spell\s+)?attack(?: rolls?)?\b/i.test(text);
  return effects.filter(effect => {
    if (!object(effect)) return false;
    const name = compactText(effect.name);
    const changes = Array.isArray(effect.changes) ? effect.changes.filter(change => object(change) && compactText(change.key)) : [];
    if (!changes.length) return false;
    if (/\btemplate\b/i.test(name)) return false;
    if (!explicitAttackBonus && changes.every(change => /system\.bonuses\.(?:m|r)sak\.attack/i.test(compactText(change.key)))) {
      return false;
    }
    return true;
  });
}

function normalizeThrowableConsumableSpec(spec, requestChunk) {
  const text = textForSpecInference(spec, requestChunk);
  if (!looksLikeThrowableConsumableRequest(text)) return spec;

  const normalized = clone(spec);
  const explicitRequestText = compactText(requestChunk);
  const canonicalName = inferThrowableConsumableName(text);
  if (canonicalName) normalized.name = canonicalName;
  normalized.itemType = "consumable";
  normalized.consumableType = normalized.consumableType || inferThrowableConsumableType(text);
  delete normalized.equipmentType;

  const currentMax = String(normalized.uses?.max ?? "").trim();
  normalized.uses = {
    ...(object(normalized.uses) ? normalized.uses : {}),
    max: currentMax || "1",
    recovery: [],
    autoDestroy: true
  };

  const explicitMagicalBonus = explicitRequestText.match(/\B\+(\d)\b(?!\s*d)/)?.[1] ?? "";
  normalized.magicalBonus = explicitMagicalBonus;
  normalized.effects = stripThrowableConsumableNoiseEffects(normalized.effects, text);

  const explicitThrownRange = inferExplicitFeetValue(explicitRequestText);
  const thrownRange = explicitThrownRange ?? inferFeetValue(text, 20);
  const template = inferTemplateFromText(explicitRequestText) ?? inferTemplateFromText(text);
  const explicitSaveAbility = inferExplicitSaveAbility(explicitRequestText);

  const directWeaponKind = ["weaponExtraDamage", "weaponConditionOnHit", "artifactWeaponHybrid"].includes(normalized.kind);
  if (directWeaponKind) {
    const saveActivity = [
      ...(Array.isArray(normalized.saveActivities) ? normalized.saveActivities : []),
      ...(Array.isArray(normalized.activities) ? normalized.activities : [])
    ].find(activity => object(activity?.save) && Array.isArray(activity?.damageParts));
    if (saveActivity || (object(normalized.save) && Array.isArray(normalized.damageParts))) {
      const source = saveActivity ?? normalized;
      normalized.kind = "chargedSaveDamage";
      normalized.activityId = normalized.activityId ?? source.activityId;
      normalized.activityName = normalized.activityName ?? source.activityName ?? "Throw";
      normalized.save = source.save;
      normalized.damageParts = source.damageParts;
      delete normalized.saveActivities;
      delete normalized.activities;
    } else {
      const existingAttack = (Array.isArray(normalized.attackActivities) ? normalized.attackActivities : [])
        .find(activity => Array.isArray(activity?.damageParts));
      const damageParts = existingAttack?.damageParts
        ?? normalized.extraDamageParts
        ?? normalized.damageParts
        ?? (object(normalized.damage) ? [normalized.damage.base] : []);
      normalized.kind = "equipmentPowerSuite";
      normalized.attackActivities = existingAttack
        ? [existingAttack]
        : damageParts.filter(part => object(part) && Number(part.denomination) > 0).length
          ? [{
              activityName: "Throw",
              activationType: "action",
              chargeCost: 1,
              damageParts: damageParts.filter(part => object(part) && Number(part.denomination) > 0)
            }]
          : [];
      delete normalized.weaponType;
      delete normalized.baseItem;
      delete normalized.damage;
      delete normalized.extraDamageParts;
      delete normalized.conditionOnHit;
    }
  }

  if (normalized.kind === "chargedSaveDamage") {
    if (!normalized.uses.autoDestroy && !normalized.uses.recovery.length) {
      normalized.uses.recovery = [{ period: "", type: "recoverAll", formula: "" }];
    }
    normalized.range = object(normalized.range) ? normalized.range : {};
    normalized.range.value = explicitThrownRange ?? (
      Number.isFinite(Number(normalized.range.value)) ? Number(normalized.range.value) : thrownRange
    );
    normalized.range.units = compactText(normalized.range.units) && compactText(normalized.range.units).toLowerCase() !== "self"
      ? normalized.range.units
      : "ft";
    if (explicitSaveAbility) {
      normalized.save = {
        ...(object(normalized.save) ? normalized.save : {}),
        ability: explicitSaveAbility
      };
    }
    normalized.target = object(normalized.target) ? normalized.target : {};
    if (template) {
      normalized.target.template = {
        ...(object(normalized.target.template) ? normalized.target.template : {}),
        ...template
      };
      normalized.target.affects = {
        ...(object(normalized.target.affects) ? normalized.target.affects : {}),
        type: compactText(normalized.target.affects?.type) || "creature"
      };
      normalized.target.prompt = true;
    } else {
      normalized.target.affects = {
        ...(object(normalized.target.affects) ? normalized.target.affects : {}),
        count: compactText(normalized.target.affects?.count) || "1",
        type: compactText(normalized.target.affects?.type) || "creature"
      };
      normalized.target.prompt = true;
    }
    return normalized;
  }

  if (normalized.kind !== "equipmentPowerSuite") return normalized;

  const attackActivities = Array.isArray(normalized.attackActivities) ? normalized.attackActivities : [];
  normalized.attackActivities = attackActivities.map(activity => {
    const next = clone(activity);
    if (!explicitMagicalBonus) next.attackBonus = "";
    if (Array.isArray(next.damageParts)) {
      next.damageParts = next.damageParts.filter(part => Number(part?.number) > 0 && Number(part?.denomination) > 0);
    }
    next.activationType = compactText(next.activationType) || "action";
    next.chargeCost = Number.isFinite(Number(next.chargeCost)) && Number(next.chargeCost) > 0 ? Number(next.chargeCost) : 1;
    next.ability = compactText(next.ability) || "dex";
    next.attackType = compactText(next.attackType) || "ranged";
    next.attackClassification = compactText(next.attackClassification) || "weapon";
    next.range = object(next.range) ? next.range : {};
    next.range.value = explicitThrownRange ?? (
      Number.isFinite(Number(next.range.value)) ? Number(next.range.value) : thrownRange
    );
    next.range.units = compactText(next.range.units) && compactText(next.range.units).toLowerCase() !== "self"
      ? next.range.units
      : "ft";
    next.target = object(next.target) ? next.target : {};
    if (template) {
      next.target.template = {
        ...(object(next.target.template) ? next.target.template : {}),
        ...template
      };
      next.target.affects = {
        ...(object(next.target.affects) ? next.target.affects : {}),
        type: compactText(next.target.affects?.type) || "creature"
      };
      next.target.prompt = true;
    } else {
      next.target.template = {
        count: "",
        contiguous: false,
        stationary: false,
        type: "",
        size: "",
        width: "",
        height: "",
        units: "ft"
      };
      next.target.affects = {
        ...(object(next.target.affects) ? next.target.affects : {}),
        count: compactText(next.target.affects?.count) || "1",
        type: compactText(next.target.affects?.type) || "creature",
        special: compactText(next.target.affects?.special) || ""
      };
      next.target.prompt = true;
    }
    return next;
  });

  return normalized;
}

function normalizeNativeEnchant(spec, requestChunk, supportedKinds) {
  const text = textForSpecInference(spec, requestChunk);
  const shouldNormalize = spec.kind === "nativeEnchant" || looksLikeEnchantRequest(text);
  if (!supportedKinds.includes("nativeEnchant") || !shouldNormalize) return spec;

  const normalized = clone(spec);
  normalized.kind = "nativeEnchant";
  normalized.itemType = normalized.itemType || "consumable";
  normalized.consumableType = normalized.consumableType || "potion";
  normalized.uses = {
    max: String(normalized.uses?.max ?? "1").trim() || "1",
    recovery: Array.isArray(normalized.uses?.recovery) ? normalized.uses.recovery : [],
    autoDestroy: true,
    ...(object(normalized.uses) ? normalized.uses : {})
  };
  normalized.uses.max = String(normalized.uses.max ?? "1").trim() || "1";
  normalized.uses.recovery = Array.isArray(normalized.uses.recovery) ? normalized.uses.recovery : [];
  normalized.uses.autoDestroy = true;
  normalized.duration = object(normalized.duration) ? normalized.duration : { seconds: inferDurationSeconds(text, 3600) };
  if (!Number.isFinite(Number(normalized.duration.seconds))) {
    normalized.duration.seconds = inferDurationSeconds(text, 3600);
  }
  normalized.restrictions = object(normalized.restrictions)
    ? normalized.restrictions
    : { type: inferEnchantRestrictionType(text) };
  if (!compactText(normalized.restrictions.type)) {
    normalized.restrictions.type = inferEnchantRestrictionType(text);
  }

  const currentChanges = Array.isArray(normalized.enchantChanges)
    ? normalized.enchantChanges.filter(change => object(change) && compactText(change.key))
    : [];
  if (!currentChanges.some(change => change.key === "system.properties")) {
    currentChanges.unshift({ key: "system.properties", mode: "ADD", value: "mgc" });
  }

  const candidateParts = [
    ...(Array.isArray(normalized.damageParts) ? normalized.damageParts : []),
    ...(Array.isArray(normalized.extraDamageParts) ? normalized.extraDamageParts : []),
    ...extractExtraDamagePartsFromText(text)
  ].filter(part => object(part) && hasMeaningfulNumericValue(part.number) && hasMeaningfulNumericValue(part.denomination));
  if (candidateParts.length && !currentChanges.some(change => change.key === "system.damage.parts")) {
    currentChanges.push(enchantDamageChange(candidateParts[0]));
  }
  normalized.enchantChanges = currentChanges;
  return normalized;
}

function normalizeNativeSummonShape(spec, requestChunk, supportedKinds) {
  const text = textForSpecInference(spec, requestChunk);
  const hasSingleProfileActor = Array.isArray(spec.summonProfiles)
    && spec.summonProfiles.length === 1
    && object(spec.summonProfiles[0]?.actor);
  const summonLike = looksLikeSingleSummonRequest(text)
    && (object(spec.summonActor) || object(spec.actor) || object(spec.profile?.actor) || hasSingleProfileActor);
  if (!supportedKinds.includes("nativeSummon") || (!summonLike && spec.kind !== "nativeSummon")) return spec;
  if (
    ["multiActivityStaff", "equipmentPowerSuite", "legendaryEquipmentSuite", "casterUtilityEquipment"].includes(spec.kind)
    && (
    (Array.isArray(spec.activities) && spec.activities.length)
    || (Array.isArray(spec.saveActivities) && spec.saveActivities.length)
    || (Array.isArray(spec.attackActivities) && spec.attackActivities.length)
    || (Array.isArray(spec.utilityActivities) && spec.utilityActivities.length)
    )
  ) {
    return spec;
  }

  const normalized = clone(spec);
  normalized.kind = "nativeSummon";
  if (!object(normalized.summonActor)) {
    normalized.summonActor = clone(
      normalized.actor
      ?? normalized.summon
      ?? normalized.creature
      ?? normalized.actorData
      ?? normalized.profile?.actor
      ?? normalized.summonProfiles?.[0]?.actor
      ?? {}
    );
  }
  if (!compactText(normalized.profileName)) {
    normalized.profileName = compactText(
      normalized.profileName
      || normalized.summonProfiles?.[0]?.profileName
      || normalized.summonActor?.name
      || "Summoned Ally"
    );
  }
  return normalized;
}

function normalizeHealingFromText(spec, requestChunk) {
  if (spec.kind !== "chargedHealing") return spec;
  const normalized = clone(spec);
  const healing = object(normalized.healing) ? normalized.healing : {};
  // The request is the source of truth when it explicitly supplies a healing
  // formula. Smaller models often emit the chassis correctly but replace the
  // requested dice with a generic potion value.
  const explicit = extractHealingPartFromText(requestChunk);
  if (explicit) {
    normalized.healing = explicit;
    return normalized;
  }
  const needsHealingRecovery = !hasMeaningfulNumericValue(healing.number)
    || !hasMeaningfulNumericValue(healing.denomination)
    || normalizeDamageTypes(healing.types, []).length === 0;
  if (!needsHealingRecovery) return normalized;

  const inferred = extractHealingPartFromText(textForSpecInference(spec, requestChunk));
  if (!inferred) return normalized;
  normalized.healing = {
    number: hasMeaningfulNumericValue(healing.number) ? Number(healing.number) : inferred.number,
    denomination: hasMeaningfulNumericValue(healing.denomination) ? Number(healing.denomination) : inferred.denomination,
    bonus: healing.bonus == null ? inferred.bonus : String(healing.bonus || inferred.bonus),
    types: normalizeDamageTypes(healing.types, inferred.types)
  };
  return normalized;
}

function explicitHealingChargeCostFromText(text) {
  const clause = extractHealingClause(text);
  const match = clause.match(/\b(?:spend|expend|use|burn)\s+(\d+)\s+charges?\b/i);
  return match ? Number(match[1]) : null;
}

function normalizeHealingActivitiesFromText(spec, requestChunk) {
  const explicitHealing = extractHealingPartFromText(requestChunk);
  const explicitChargeCost = explicitHealingChargeCostFromText(requestChunk);
  if (!explicitHealing && explicitChargeCost == null) return spec;

  const fields = ["activities", "attackActivities", "saveActivities", "utilityActivities"];
  const normalized = clone(spec);
  let changed = false;
  for (const field of fields) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map(activity => {
      if (!object(activity) || !object(activity.healing)) return activity;
      const next = { ...activity };
      if (explicitHealing) {
        next.healing = explicitHealing;
        changed = true;
      }
      if (explicitChargeCost != null) {
        next.chargeCost = explicitChargeCost;
        changed = true;
      }
      return next;
    });
  }
  return changed ? normalized : spec;
}

function normalizeRecoverableModelSlip(spec, requestChunk, supportedKinds) {
  let normalized = clone(spec);
  if (!compactText(normalized.kind)) normalized.kind = inferSpecKind(normalized, requestChunk, supportedKinds);
  normalized = normalizeMissingUses(normalized, requestChunk);
  normalized = normalizeExplicitSpellAttackSuite(normalized, requestChunk, supportedKinds);
  normalized = normalizeNamedSpellSuite(normalized, requestChunk, supportedKinds);
  normalized = clearResolvedNamedSpellReview(normalized, requestChunk);
  normalized = normalizePassiveWeaponBonusTrinket(normalized, requestChunk, supportedKinds);
  normalized = normalizeExplicitArmorChassis(normalized, requestChunk, supportedKinds);
  normalized = normalizeRequestedResistances(normalized, requestChunk);
  normalized = normalizeRequestedSkillAdvantage(normalized, requestChunk);
  normalized = normalizeRequestedDarkvision(normalized, requestChunk);
  normalized = normalizeThrowableConsumableSpec(normalized, requestChunk);
  normalized = normalizeNativeEnchant(normalized, requestChunk, supportedKinds);
  normalized = normalizeNativeSummonShape(normalized, requestChunk, supportedKinds);
  normalized = normalizeConditionOnHit(normalized, requestChunk);
  normalized = normalizeWeaponExtraDamageParts(normalized, requestChunk);
  normalized = normalizeWandSaveActivity(normalized, requestChunk);
  normalized = promoteChargedStaffSpec(normalized, requestChunk);
  normalized = normalizeSingleActivityStaff(normalized, requestChunk);
  normalized = normalizeMixedStaffSuite(normalized, requestChunk);
  normalized = normalizeSharedActivitySuite(normalized, requestChunk);
  normalized = normalizeMalformedAttackActivities(normalized);
  normalized = normalizeActorTokenAuraActivities(normalized, requestChunk);
  normalized = normalizeMalformedUtilitySaveActivities(normalized, requestChunk);
  normalized = normalizeSuiteSummonShape(normalized);
  normalized = normalizeFreeForgeSrdSummons(normalized, requestChunk, supportedKinds);
  normalized = normalizeToggleLight(normalized, requestChunk);
  normalized = normalizeActivityNames(normalized);
  normalized = normalizeExplicitSpellChargeCosts(normalized, requestChunk);
  normalized = normalizeExplicitActivityChargeCosts(normalized, requestChunk);
  normalized = normalizeWeaponBase(normalized, requestChunk);
  normalized = normalizeNonHealingSpellConsumable(normalized, requestChunk, supportedKinds);
  normalized = normalizeConsumedHealingUses(normalized, requestChunk);
  normalized = normalizeHealingFromText(normalized, requestChunk);
  normalized = normalizeHealingActivitiesFromText(normalized, requestChunk);
  return normalized;
}

function validateForgeRequest(payload, limits = {}) {
  const maxRequestChars = limits.maxRequestChars ?? 20000;
  const maxItemsPerRequest = limits.maxItemsPerRequest ?? MAX_SPECS_PER_REQUEST;
  if (!object(payload)) throw new ServiceError(400, "invalid_request", "Request body must be a JSON object.");
  if (payload.schemaVersion !== FORGE_SCHEMA_VERSION) {
    throw new ServiceError(400, "unsupported_schema", `schemaVersion must be ${FORGE_SCHEMA_VERSION}.`);
  }

  const request = String(payload.request ?? "").trim();
  if (!request) throw new ServiceError(400, "missing_request", "Describe at least one item.");
  if (request.length > maxRequestChars) {
    throw new ServiceError(413, "request_too_large", `Item request exceeds the ${maxRequestChars.toLocaleString("en-US")} character limit.`);
  }
  rejectExcessiveScaleRequest(request);
  const intent = analyzeRequestIntent(request);
  if (intent.count > maxItemsPerRequest) {
    throw new ServiceError(413, "item_batch_too_large", `Item request contains ${intent.count} items; this service allows at most ${maxItemsPerRequest} per request.`);
  }

  const context = object(payload.context) ? payload.context : {};
  const suppliedKinds = Array.isArray(context.supportedKinds) ? context.supportedKinds.map(String) : [];
  const supportedKinds = [...new Set(suppliedKinds)].filter(kind => KNOWN_SPEC_KINDS.includes(kind));
  if (!supportedKinds.length) {
    throw new ServiceError(400, "missing_supported_kinds", "context.supportedKinds must include at least one known Forge spec kind.");
  }
  if (supportedKinds.length !== suppliedKinds.length) {
    throw new ServiceError(400, "unknown_supported_kind", "context.supportedKinds contains an unknown or duplicate spec kind.");
  }
  const suppliedCapabilities = Array.isArray(context.supportedCapabilities)
    ? context.supportedCapabilities.map(String)
    : [...COMPOSITIONAL_CAPABILITIES];
  const supportedCapabilities = [...new Set(suppliedCapabilities)]
    .filter(capability => COMPOSITIONAL_CAPABILITIES.includes(capability));
  if (supportedCapabilities.length !== suppliedCapabilities.length) {
    throw new ServiceError(400, "unknown_supported_capability", "context.supportedCapabilities contains an unknown or duplicate capability.");
  }
  const automationCapabilities = normalizeAutomationCapabilities(context.automationCapabilities);

  const options = object(payload.options) ? payload.options : {};
  const requestMode = payload.requestMode == null ? "compile" : String(payload.requestMode).trim();
  if (!["compile", "repair-attempt"].includes(requestMode)) {
    throw new ServiceError(400, "invalid_request_mode", "requestMode must be compile or repair-attempt.");
  }
  const repair = requestMode === "repair-attempt"
    ? normalizeRepairContext(payload.repair, maxItemsPerRequest)
    : null;
  if (repair && repair.originalRequest !== request) {
    throw new ServiceError(400, "invalid_repair_context", "The repair context must preserve the original request exactly.");
  }
  return {
    schemaVersion: FORGE_SCHEMA_VERSION,
    requestMode,
    request,
    context: {
      foundryVersion: String(context.foundryVersion ?? ""),
      systemId: String(context.systemId ?? "dnd5e"),
      systemVersion: String(context.systemVersion ?? ""),
      moduleVersion: String(context.moduleVersion ?? ""),
      supportedKinds,
      supportedCapabilities,
      automationCapabilities
    },
    options: {
      model: String(options.model ?? "").trim(),
      unresolvedPolicy: options.unresolvedPolicy === "block" ? "block" : "review"
    },
    repair
  };
}

function ensureId(target, key, makeId) {
  if (!object(target)) return;
  if (!target[key] || !ID_PATTERN.test(String(target[key]))) target[key] = makeId();
  if (!ID_PATTERN.test(String(target[key]))) {
    throw new ServiceError(502, "invalid_model_output", `Generated ${key} must be exactly 16 alphanumeric characters.`);
  }
}

function normalizeSpecIds(spec, makeId) {
  const normalized = clone(spec);
  for (const key of ["activityId", "profileId", "effectId"]) {
    if (normalized[key]) ensureId(normalized, key, makeId);
  }

  for (const listName of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    for (const activity of normalized[listName] ?? []) {
      ensureId(activity, "activityId", makeId);
      for (const profile of activity?.summonProfiles ?? []) ensureId(profile, "profileId", makeId);
    }
  }
  for (const listName of ["effects", "passiveEffects"]) {
    for (const effect of normalized[listName] ?? []) ensureId(effect, "effectId", makeId);
  }
  for (const profile of normalized.summonProfiles ?? []) ensureId(profile, "profileId", makeId);
  if (normalized.summonActivity) {
    ensureId(normalized.summonActivity, "activityId", makeId);
    for (const profile of normalized.summonActivity.summonProfiles ?? []) ensureId(profile, "profileId", makeId);
  }
  if (normalized.toggleLight) {
    ensureId(normalized.toggleLight, "activityId", makeId);
    ensureId(normalized.toggleLight, "effectId", makeId);
  }
  for (const mechanic of normalized.unresolvedMechanics ?? []) ensureId(mechanic, "id", makeId);

  if (["chargedHealing", "chargedSaveDamage", "nativeEnchant", "nativeMultiProfileSummon", "nativeSummon"].includes(normalized.kind)) {
    ensureId(normalized, "activityId", makeId);
  }
  if (normalized.kind === "nativeEnchant") {
    ensureId(normalized, "effectId", makeId);
  }
  if (normalized.kind === "nativeSummon") {
    ensureId(normalized, "profileId", makeId);
  }
  return normalized;
}

function preparedSpecFingerprint(specs) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(specs)))
    .digest("hex")}`;
}

function stringArray(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(entry => typeof entry !== "string")) {
    throw new ServiceError(502, "invalid_model_output", `Generated ${field} must be an array of strings.`);
  }
  return value.map(entry => entry.trim()).filter(Boolean);
}

function validateUnresolved(spec) {
  if (spec.unresolvedMechanics == null) return [];
  if (!Array.isArray(spec.unresolvedMechanics)) {
    throw new ServiceError(502, "invalid_model_output", `${spec.name} unresolvedMechanics must be an array.`);
  }
  for (const mechanic of spec.unresolvedMechanics) {
    for (const field of ["category", "label", "requestedText", "reason", "handling"]) {
      if (typeof mechanic[field] !== "string" || !mechanic[field].trim()) {
        throw new ServiceError(502, "invalid_model_output", `${spec.name} has an incomplete unresolved mechanic.`);
      }
    }
    mechanic.resolved = false;
  }
  return spec.unresolvedMechanics;
}

function normalizeModelOutput(modelOutput, envelope, options = {}) {
  if (!object(modelOutput)) throw new ServiceError(502, "invalid_model_output", "The model did not return a JSON object.");
  const sanitizedModelOutput = stripRecoverableForbiddenFields(modelOutput);
  validateRemoteContent(sanitizedModelOutput, { path: "$model" });
  if (!Array.isArray(sanitizedModelOutput.specs) || !sanitizedModelOutput.specs.length) {
    throw new ServiceError(502, "invalid_model_output", "The model did not return any item specs.");
  }
  if (sanitizedModelOutput.specs.length > MAX_SPECS_PER_REQUEST) {
    throw new ServiceError(502, "invalid_model_output", `The model returned more than ${MAX_SPECS_PER_REQUEST} item specs.`);
  }

  const intent = analyzeRequestIntent(envelope.request);
  if (sanitizedModelOutput.specs.length !== intent.count) {
    throw new ServiceError(
      502,
      "item_count_mismatch",
      `The request contains ${intent.count} item${intent.count === 1 ? "" : "s"}, but the model returned ${sanitizedModelOutput.specs.length}.`
    );
  }

  const makeId = options.makeId ?? secureId;
  const names = new Set();
  const warnings = stringArray(sanitizedModelOutput.warnings, "warnings");
  const deferred = stringArray(sanitizedModelOutput.deferred, "deferred");
  const specs = sanitizedModelOutput.specs.map((rawSpec, index) => {
    if (!object(rawSpec)) throw new ServiceError(502, "invalid_model_output", `Generated spec ${index + 1} is not an object.`);
    const requestChunk = intent.chunks[index] ?? envelope.request;
    const remoteSpec = normalizeRecoverableModelSlip(
      normalizeRemoteSpecAliases(rawSpec),
      requestChunk,
      envelope.context.supportedKinds
    );
    const rawName = String(remoteSpec.name ?? "").trim();
    const name = normalizeGeneratedName(rawName, intent, index);
    const kind = String(remoteSpec.kind ?? "").trim();
    if (!name) throw new ServiceError(502, "invalid_model_output", `Generated spec ${index + 1} is missing a name.`);
    if (intent.hasCompleteExplicitNames && name.toLowerCase() !== intent.explicitNames[index].toLowerCase()) {
      throw new ServiceError(
        502,
        "item_name_mismatch",
        `Generated item ${index + 1} must preserve the requested name "${intent.explicitNames[index]}".`
      );
    }
    if (names.has(name.toLowerCase())) throw new ServiceError(502, "invalid_model_output", `Generated item name is duplicated: ${name}.`);
    if (!envelope.context.supportedKinds.includes(kind)) {
      throw new ServiceError(502, "unsupported_generated_kind", `${name} uses unsupported Forge kind ${kind || "(missing)"}.`);
    }
    names.add(name.toLowerCase());
    const spec = normalizeSpecIds(appendRequestDerivedUnresolved(alignAttunementToRequest({
      ...remoteSpec,
      name,
      kind,
      description: typeof remoteSpec.description === "string" && remoteSpec.description.trim()
        ? remoteSpec.description
        : envelope.request
    }, requestChunk), requestChunk, warnings, deferred), makeId);
    if (spec.automation != null) {
      spec.automation = applyAutomationCapabilityRoute(
        normalizeAutomationContract(spec.automation, `$specs[${index}].automation`),
        envelope.context.automationCapabilities,
        `$specs[${index}].automation`
      );
    }
    validateRemoteContent(spec, { path: `$specs[${index}]` });
    validateUnresolved(spec);
    validateSpecStructure(spec);
    return spec;
  });

  const unresolvedMechanics = specs.flatMap(spec => (spec.unresolvedMechanics ?? []).map(mechanic => ({ itemName: spec.name, ...mechanic })));
  if (envelope.options.unresolvedPolicy === "block" && unresolvedMechanics.length) {
    warnings.push("The request selected block policy and contains unresolved mechanics; Foundry creation will remain blocked until they are resolved.");
  }

  return {
    schemaVersion: FORGE_SCHEMA_VERSION,
    compilerVersion: `dmf-ai-service/${SERVICE_VERSION}`,
    promptVersion: PROMPT_VERSION,
    requestMode: envelope.requestMode,
    preparedSpecFingerprint: preparedSpecFingerprint(specs),
    request: envelope.request,
    requestCount: specs.length,
    specs,
    decisions: specs.map(spec => ({
      name: spec.name,
      pattern: spec.kind,
      unresolvedCount: spec.unresolvedMechanics?.length ?? 0
    })),
    assumptions: stringArray(sanitizedModelOutput.assumptions, "assumptions"),
    warnings,
    deferred,
    unresolvedMechanics
  };
}

function rejectExcessiveScaleRequest(request) {
  const text = String(request ?? "");
  const normalized = text.toLowerCase();
  const duplicateEffectPattern = /\b(\d{2,4})\s+(fireballs?|lightning bolts?|magic missiles?|meteors?|meteor swarms?|summons?|summoned creatures?|creatures?|copies|instances)\b/g;
  for (const match of normalized.matchAll(duplicateEffectPattern)) {
    const count = Number(match[1] ?? 0);
    const subject = String(match[2] ?? "effects").trim();
    if (count >= 25) {
      throw new ServiceError(
        400,
        "unsupported_scale",
        `The request asks for ${count} simultaneous ${subject}, which is beyond Dungeon Master's Forge's supported item scale. Please describe a bounded item power instead.`
      );
    }
  }

  const simultaneousPattern = /\b(\d{2,4})\b(?=[^.]{0,60}\b(?:at once|all at once|simultaneous(?:ly)?|in one action)\b)/g;
  for (const match of normalized.matchAll(simultaneousPattern)) {
    const count = Number(match[1] ?? 0);
    if (count >= 10) {
      throw new ServiceError(
        400,
        "unsupported_scale",
        `The request asks for ${count} simultaneous effects at once, which is beyond Dungeon Master's Forge's supported item scale. Please describe a more bounded power.`
      );
    }
  }
}

export { ID_PATTERN, normalizeModelOutput, secureId, validateForgeRequest };
