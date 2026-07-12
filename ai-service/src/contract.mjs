import { randomBytes } from "node:crypto";
import { FORGE_SCHEMA_VERSION, KNOWN_SPEC_KINDS, MAX_SPECS_PER_REQUEST, PROMPT_VERSION, SERVICE_VERSION } from "./constants.mjs";
import { ServiceError } from "./errors.mjs";
import { validateRemoteContent } from "./remote-content-policy.mjs";
import { analyzeRequestIntent } from "./request-intent.mjs";
import { validateSpecStructure } from "./spec-validation.mjs";

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
  { pattern: /\b(summon|conjure|calling)\b/i, label: "Summoning" },
  { pattern: /\b(light|glow|lantern|torch)\b/i, label: "Light" },
  { pattern: /\b(flying|flight|wing|wings)\b/i, label: "Flight" }
]);

const SRD_SPELL_PATTERNS = Object.freeze([
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

const KNOWN_WEAPON_BASES = Object.freeze({
  dagger: { weaponType: "simpleM", baseItem: "dagger", damage: { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  mace: { weaponType: "simpleM", baseItem: "mace", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  "hand crossbow": { weaponType: "martialR", baseItem: "hand crossbow", damage: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  "heavy crossbow": { weaponType: "martialR", baseItem: "heavy crossbow", damage: { number: 1, denomination: 10, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  "light crossbow": { weaponType: "simpleR", baseItem: "light crossbow", damage: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
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

  if (/\b(summon|conjure|call forth|friendly wolf|friendly fiend|githzerai psimaster)\b/i.test(text)
    && !specHasSummonSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "summon"
      || /summon/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "summon",
      label: "Requested summon",
      requestedText: matchingClause(text, /\b(summon|conjure|call forth|friendly wolf|friendly fiend|githzerai psimaster)\b/i),
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

  if (/\b(restore|regain|heal|healing|hit points?)\b/i.test(text)
    && !specHasHealingSupport(normalized)
    && !unresolvedMechanicExists({ unresolvedMechanics: unresolved }, mechanic =>
      comparableText(mechanic.category || "") === "healing"
      || /healing/i.test(compactText(mechanic.label || ""))
    )) {
    unresolved.push({
      category: "healing",
      label: "Requested healing payload",
      requestedText: matchingClause(text, /\b(restore|regain|heal|healing|hit points?)\b/i),
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
  return /\b(summon|conjure|call forth|calls forth|creates?)\b/i.test(text)
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

function inferCommonSummonActor(text) {
  if (/\bdire\s+wolf\b/i.test(text)) {
    return {
      name: "Friendly Dire Wolf",
      type: "beast",
      ac: 14,
      hp: { value: 37, max: 37 }
    };
  }
  if (/\bwolf\b/i.test(text)) {
    return {
      name: "Friendly Wolf",
      type: "beast",
      ac: 13,
      hp: { value: 11, max: 11 }
    };
  }
  if (/\bcat\b/i.test(text)) {
    return {
      name: "Friendly Cat",
      type: "beast",
      ac: 12,
      hp: { value: 2, max: 2 }
    };
  }
  return null;
}

function parseLightRadii(text) {
  const normalizedText = compactText(text);
  const bright = Number(normalizedText.match(/\b(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?bright\s+light/i)?.[1] ?? 20);
  const dimMatch = normalizedText.match(/\b(additional\s+|another\s+)?(\d+)\s*[- ]?(?:foot|feet|ft\.?)\s+(?:of\s+)?dim\s+light/i);
  const dimValue = Number(dimMatch?.[2] ?? 20);
  return { bright, dim: dimMatch?.[1] ? bright + dimValue : Math.max(bright, dimValue) };
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

  if (!Number.isFinite(Number(condition.durationSeconds))) {
    const seconds = Number(condition.duration?.seconds ?? condition.seconds);
    const rounds = Number(condition.duration?.rounds ?? condition.rounds);
    const minutes = Number(condition.duration?.minutes ?? condition.minutes);
    if (Number.isFinite(seconds)) condition.durationSeconds = seconds;
    else if (Number.isFinite(rounds)) condition.durationSeconds = rounds * 6;
    else if (Number.isFinite(minutes)) condition.durationSeconds = minutes * 60;
    else if (/\buntil the end of\b/i.test(text) || /\bfor 1 round\b/i.test(text)) condition.durationSeconds = 6;
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
  const match = /\b(?:regain|restore|heals?|healing)\b[^.]*?(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+hit points?\b/i.exec(normalizedText);
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

  if (mergedSummonProfiles.length && (activityList.length || saveActivities.length || attackActivities.length || utilityActivities.length)) {
    const normalized = clone(spec);
    const split = splitSharedActivities(activityList);
    const derivedSaveActivities = [...saveActivities, ...split.derivedSaveActivities];
    const derivedAttackActivities = [...attackActivities, ...split.derivedAttackActivities];
    const derivedUtilityActivities = [...utilityActivities, ...split.derivedUtilityActivities];

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
    normalized.summonProfiles = mergedSummonProfiles;
    normalized.summonActivity = object(normalized.summonActivity) ? normalized.summonActivity : {};
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
    activity?.spell,
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

function normalizeSingleActivityStaff(spec) {
  if (spec.kind !== "multiActivityStaff" || !Array.isArray(spec.activities) || spec.activities.length !== 1) return spec;
  if (
    object(spec.healing)
    || object(spec.summonActor)
    || object(spec.actor)
    || object(spec.profile?.actor)
    || (Array.isArray(spec.summonProfiles) && spec.summonProfiles.some(profile => object(profile)))
  ) return spec;
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
  const looksConsumed = spec.uses.autoDestroy === true || max === "1" || /\b(potion|drink|consumed?|one use|single use)\b/i.test(text);
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
    "nativeEnchant",
    "nativeSummon",
    "nativeMultiProfileSummon"
  ]);
  if (!usesKinds.has(spec.kind)) return spec;

  const text = textForSpecInference(spec, requestChunk);
  const consumedKinds = new Set(["chargedHealing", "nativeEnchant", "nativeSummon", "nativeMultiProfileSummon"]);
  const inferred = inferUsesFromText(text, {
    consumed: consumedKinds.has(spec.kind),
    defaultMax: object(spec.uses) ? String(spec.uses.max ?? "").trim() : ""
  });
  if (!inferred) return spec;

  const normalized = clone(spec);
  const existing = object(normalized.uses) ? normalized.uses : {};
  const existingMax = String(existing.max ?? "").trim();
  normalized.uses = {
    ...existing,
    max: existingMax || inferred.max || "1",
    recovery: Array.isArray(existing.recovery) ? existing.recovery : inferred.recovery
  };
  if (consumedKinds.has(spec.kind) && (inferred.autoDestroy || normalized.uses.max === "1")) {
    normalized.uses.autoDestroy = true;
    normalized.uses.recovery = Array.isArray(normalized.uses.recovery) ? normalized.uses.recovery : [];
  }
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
    recovery: Array.isArray(normalized.uses?.recovery) ? normalized.uses.recovery : [],
    autoDestroy: true
  };

  const explicitMagicalBonus = explicitRequestText.match(/\B\+(\d)\b(?!\s*d)/)?.[1] ?? "";
  normalized.magicalBonus = explicitMagicalBonus;
  normalized.effects = stripThrowableConsumableNoiseEffects(normalized.effects, text);

  const explicitThrownRange = inferExplicitFeetValue(explicitRequestText);
  const thrownRange = explicitThrownRange ?? inferFeetValue(text, 20);
  const template = inferTemplateFromText(explicitRequestText) ?? inferTemplateFromText(text);

  if (normalized.kind === "chargedSaveDamage") {
    if (!normalized.uses.recovery.length) {
      normalized.uses.recovery = [{ period: "", type: "recoverAll", formula: "" }];
    }
    normalized.range = object(normalized.range) ? normalized.range : {};
    normalized.range.value = explicitThrownRange ?? (
      Number.isFinite(Number(normalized.range.value)) ? Number(normalized.range.value) : thrownRange
    );
    normalized.range.units = compactText(normalized.range.units) && compactText(normalized.range.units).toLowerCase() !== "self"
      ? normalized.range.units
      : "ft";
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
    ...(Array.isArray(normalized.extraDamageParts) ? normalized.extraDamageParts : [])
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
  if (!object(normalized.summonActor) || Object.keys(normalized.summonActor).length === 0) {
    const inferredActor = inferCommonSummonActor(text);
    if (inferredActor) normalized.summonActor = inferredActor;
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

function normalizeRecoverableModelSlip(spec, requestChunk, supportedKinds) {
  let normalized = clone(spec);
  if (!compactText(normalized.kind)) normalized.kind = inferSpecKind(normalized, requestChunk, supportedKinds);
  normalized = normalizeMissingUses(normalized, requestChunk);
  normalized = normalizeThrowableConsumableSpec(normalized, requestChunk);
  normalized = normalizeNativeEnchant(normalized, requestChunk, supportedKinds);
  normalized = normalizeNativeSummonShape(normalized, requestChunk, supportedKinds);
  normalized = normalizeConditionOnHit(normalized, requestChunk);
  normalized = normalizeWeaponExtraDamageParts(normalized, requestChunk);
  normalized = normalizeSingleActivityStaff(normalized);
  normalized = normalizeMixedStaffSuite(normalized, requestChunk);
  normalized = normalizeSharedActivitySuite(normalized, requestChunk);
  normalized = normalizeSuiteSummonShape(normalized);
  normalized = normalizeToggleLight(normalized, requestChunk);
  normalized = normalizeActivityNames(normalized);
  normalized = normalizeWeaponBase(normalized, requestChunk);
  normalized = normalizeConsumedHealingUses(normalized, requestChunk);
  normalized = normalizeHealingFromText(normalized, requestChunk);
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

  const options = object(payload.options) ? payload.options : {};
  return {
    schemaVersion: FORGE_SCHEMA_VERSION,
    request,
    context: {
      foundryVersion: String(context.foundryVersion ?? ""),
      systemId: String(context.systemId ?? "dnd5e"),
      systemVersion: String(context.systemVersion ?? ""),
      moduleVersion: String(context.moduleVersion ?? ""),
      supportedKinds
    },
    options: {
      model: String(options.model ?? "").trim(),
      unresolvedPolicy: options.unresolvedPolicy === "block" ? "block" : "review"
    }
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
    for (const activity of normalized[listName] ?? []) ensureId(activity, "activityId", makeId);
  }
  for (const listName of ["effects", "passiveEffects"]) {
    for (const effect of normalized[listName] ?? []) ensureId(effect, "effectId", makeId);
  }
  for (const profile of normalized.summonProfiles ?? []) ensureId(profile, "profileId", makeId);
  if (normalized.summonActivity) ensureId(normalized.summonActivity, "activityId", makeId);
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
    const remoteSpec = normalizeRecoverableModelSlip(
      normalizeRemoteSpecAliases(rawSpec),
      intent.chunks[index] ?? envelope.request,
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
    const requestChunk = intent.chunks[index] ?? envelope.request;
    const spec = normalizeSpecIds(appendRequestDerivedUnresolved({
      ...remoteSpec,
      name,
      kind,
      description: typeof remoteSpec.description === "string" && remoteSpec.description.trim()
        ? remoteSpec.description
        : envelope.request
    }, requestChunk, warnings, deferred), makeId);
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
