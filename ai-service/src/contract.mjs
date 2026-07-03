import { randomBytes } from "node:crypto";
import { FORGE_SCHEMA_VERSION, KNOWN_SPEC_KINDS, MAX_SPECS_PER_REQUEST, PROMPT_VERSION, SERVICE_VERSION } from "./constants.mjs";
import { ServiceError } from "./errors.mjs";
import { validateRemoteContent } from "./remote-content-policy.mjs";
import { analyzeRequestIntent } from "./request-intent.mjs";
import { validateSpecStructure } from "./spec-validation.mjs";

const ID_PATTERN = /^[A-Za-z0-9]{16}$/;

const BASE_ITEM_NAMES = Object.freeze([
  "hand crossbow",
  "heavy crossbow",
  "light crossbow",
  "greatsword",
  "longsword",
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

function normalizeDamagePart(part) {
  if (!object(part)) return part;
  if ("denomination" in part) part.denomination = normalizeDieDenomination(part.denomination);
  if (part.bonus === 0) part.bonus = "";
  return part;
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

  if (object(normalized.damage)) {
    if (object(normalized.damage.base)) normalized.damage.base = normalizeDamagePart(normalized.damage.base);
    if (object(normalized.damage.versatile)) normalized.damage.versatile = normalizeDamagePart(normalized.damage.versatile);
  }

  for (const field of ["extraDamageParts", "damageParts"]) {
    if (Array.isArray(normalized[field])) normalized[field] = normalized[field].map(normalizeDamagePart);
  }
  if (object(normalized.healing)) normalized.healing = normalizeDamagePart(normalized.healing);

  for (const field of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    if (!Array.isArray(normalized[field])) continue;
    normalized[field] = normalized[field].map(activity => {
      if (!object(activity)) return activity;
      const next = clone(activity);
      if (Array.isArray(next.damageParts)) next.damageParts = next.damageParts.map(normalizeDamagePart);
      return next;
    });
  }

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
  validateRemoteContent(modelOutput, { path: "$model" });
  if (!Array.isArray(modelOutput.specs) || !modelOutput.specs.length) {
    throw new ServiceError(502, "invalid_model_output", "The model did not return any item specs.");
  }
  if (modelOutput.specs.length > MAX_SPECS_PER_REQUEST) {
    throw new ServiceError(502, "invalid_model_output", `The model returned more than ${MAX_SPECS_PER_REQUEST} item specs.`);
  }

  const intent = analyzeRequestIntent(envelope.request);
  if (modelOutput.specs.length !== intent.count) {
    throw new ServiceError(
      502,
      "item_count_mismatch",
      `The request contains ${intent.count} item${intent.count === 1 ? "" : "s"}, but the model returned ${modelOutput.specs.length}.`
    );
  }

  const makeId = options.makeId ?? secureId;
  const names = new Set();
  const specs = modelOutput.specs.map((rawSpec, index) => {
    if (!object(rawSpec)) throw new ServiceError(502, "invalid_model_output", `Generated spec ${index + 1} is not an object.`);
    const remoteSpec = normalizeRemoteSpecAliases(rawSpec);
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
    const spec = normalizeSpecIds({
      ...remoteSpec,
      name,
      kind,
      description: typeof remoteSpec.description === "string" && remoteSpec.description.trim()
        ? remoteSpec.description
        : envelope.request
    }, makeId);
    validateRemoteContent(spec, { path: `$specs[${index}]` });
    validateUnresolved(spec);
    validateSpecStructure(spec);
    return spec;
  });

  const unresolvedMechanics = specs.flatMap(spec => (spec.unresolvedMechanics ?? []).map(mechanic => ({ itemName: spec.name, ...mechanic })));
  const warnings = stringArray(modelOutput.warnings, "warnings");
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
    assumptions: stringArray(modelOutput.assumptions, "assumptions"),
    warnings,
    deferred: stringArray(modelOutput.deferred, "deferred"),
    unresolvedMechanics
  };
}

export { ID_PATTERN, normalizeModelOutput, secureId, validateForgeRequest };
