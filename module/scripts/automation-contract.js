import { AUTOMATION_PRODUCTION_TEMPLATES, automationTemplateById } from "./automation-templates.js";

const AUTOMATION_CONTRACT_VERSION = "1.0";
const AUTOMATION_TEMPLATE_VERSION = "1.0";

const AUTOMATION_RECIPES = Object.freeze([
  "conditionOnHit",
  "selfTargetLight",
  "multiActivityResource",
  "daeTransferEffect",
  "animationVisual"
]);

const AUTOMATION_DEPENDENCIES = Object.freeze({
  conditionOnHit: ["midi-qol", "itemacro"],
  selfTargetLight: ["itemacro"],
  multiActivityResource: [],
  daeTransferEffect: ["dae"],
  animationVisual: ["autoanimations", "sequencer"]
});

const AUTOMATION_WORKFLOW_PASSES = Object.freeze(["postActiveEffects", "activity"]);
const AUTOMATION_TARGET_SOURCES = Object.freeze(["hitTargets", "failedSaves", "self", "selectedTargets"]);
const AUTOMATION_AUTHORITIES = Object.freeze(["workflow-roller", "gm", "local-trusted-engine"]);
const AUTOMATION_FALLBACKS = Object.freeze(["manual-review", "core-only", "disabled"]);
const AUTOMATION_RESOURCE_POLICIES = Object.freeze(["item-uses", "shared-item-uses", "none", "manual-review"]);
const AUTOMATION_EFFECT_RECIPES = Object.freeze([
  "apply-condition",
  "toggle-light",
  "consume-item-use",
  "transfer-effect",
  "play-animation"
]);
const AUTOMATION_IDEMPOTENCY_SCOPES = Object.freeze(["per-workflow", "per-item-use", "per-target", "per-activation"]);
const AUTOMATION_TRIGGER_DEFAULTS = Object.freeze({
  conditionOnHit: "attack-hit",
  selfTargetLight: "utility-activation",
  multiActivityResource: "activity-activation",
  daeTransferEffect: "effect-application",
  animationVisual: "activity-activation"
});
const WORKFLOW_PASS_ALIASES = Object.freeze({
  "on-hit": "postActiveEffects",
  "on hit": "postActiveEffects",
  "attack-hit": "postActiveEffects",
  "attack hit": "postActiveEffects",
  "post-active-effects": "postActiveEffects"
});
const TRIGGER_ALIASES = Object.freeze({
  "attack hit": "attack-hit",
  "on hit": "attack-hit",
  "utility activation": "utility-activation",
  "self activation": "utility-activation",
  "toggle light": "utility-activation",
  "activity activation": "activity-activation",
  "item activation": "activity-activation",
  "on use": "activity-activation",
  "effect application": "effect-application",
  "on equip": "effect-application",
  equipped: "effect-application"
});
const TARGET_SOURCE_ALIASES = Object.freeze({
  "hit target": "hitTargets",
  "hit targets": "hitTargets",
  "attack targets": "hitTargets",
  "failed save": "failedSaves",
  "failed saves": "failedSaves",
  "self target": "self",
  "self token": "self",
  "actor token": "self",
  wielder: "self",
  "selected target": "selectedTargets",
  "selected targets": "selectedTargets",
  "chosen targets": "selectedTargets"
});
const AUTHORITY_ALIASES = Object.freeze({
  "trusted-local": "local-trusted-engine",
  "local trusted": "local-trusted-engine",
  "local-trusted": "local-trusted-engine"
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, field, max = 80) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(`Automation contract ${field} must be a short printable string.`);
  }
  return text;
}

function normalizeRecipe(value) {
  const raw = cleanText(value, "recipe");
  const template = automationTemplateById(raw);
  if (template) {
    if (template.status !== "production") throw new Error(`Automation recipe "${raw}" is not a production template.`);
    return { recipe: template.recipes[0], templateId: raw };
  }
  return { recipe: raw };
}

function normalizeEnumAlias(value, aliases, fallback) {
  const raw = String(value ?? fallback).trim();
  return aliases[raw.toLowerCase()] ?? raw;
}

function normalizeFallback(value) {
  const raw = String(value ?? "manual-review").trim();
  if (AUTOMATION_FALLBACKS.includes(raw)) return raw;
  return /\bcore\b/i.test(raw) ? "core-only" : "manual-review";
}

function normalizeAutomationContract(value) {
  if (value == null) return undefined;
  if (!isObject(value)) throw new Error("Automation contract must be an object.");

  const allowed = new Set([
    "version", "templateId", "recipe", "trigger", "workflowPass", "targetSource", "targetFilter",
    "resourcePolicy", "effectRecipe", "duration", "authority", "idempotencyScope",
    "fallback", "requires", "fields"
  ]);
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) throw new Error(`Automation contract contains unsupported field "${unknown}".`);
  if (value.fields != null) {
    if (!Array.isArray(value.fields) || value.fields.length > 20) throw new Error("Automation contract fields must be a short metadata array.");
    value.fields.forEach(field => cleanText(field, "fields", 60));
  }

  const recipeResult = normalizeRecipe(value.recipe);
  const recipe = recipeResult.recipe;
  if (!AUTOMATION_RECIPES.includes(recipe)) throw new Error(`Unsupported automation recipe "${recipe}".`);
  const explicitTemplateId = value.templateId == null ? undefined : cleanText(value.templateId, "templateId");
  const templateId = explicitTemplateId ?? recipeResult.templateId;
  const template = templateId ? automationTemplateById(templateId) : null;
  if (templateId && (!template || template.status !== "production")) throw new Error(`Automation template "${templateId}" is not a production template.`);
  if (template && !template.recipes.includes(recipe)) throw new Error(`Automation template "${templateId}" does not match recipe "${recipe}".`);
  const version = String(value.version ?? AUTOMATION_CONTRACT_VERSION).trim();
  if (version !== AUTOMATION_CONTRACT_VERSION) throw new Error(`Automation contract version must be ${AUTOMATION_CONTRACT_VERSION}.`);

  const workflowPass = normalizeEnumAlias(value.workflowPass, WORKFLOW_PASS_ALIASES, recipe === "conditionOnHit" ? "postActiveEffects" : "activity");
  if (!AUTOMATION_WORKFLOW_PASSES.includes(workflowPass)) throw new Error(`Unsupported automation workflow pass "${workflowPass}".`);
  const targetSource = normalizeEnumAlias(value.targetSource, TARGET_SOURCE_ALIASES, recipe === "conditionOnHit" ? "hitTargets" : "self");
  if (!AUTOMATION_TARGET_SOURCES.includes(targetSource)) throw new Error(`Unsupported automation target source "${targetSource}".`);

  const normalized = {
    version,
    ...(templateId ? { templateId } : {}),
    recipe,
    trigger: normalizeEnumAlias(value.trigger, TRIGGER_ALIASES, AUTOMATION_TRIGGER_DEFAULTS[recipe]),
    workflowPass,
    targetSource,
    authority: normalizeEnumAlias(value.authority, AUTHORITY_ALIASES, "local-trusted-engine"),
    idempotencyScope: String(value.idempotencyScope ?? "per-activation"),
    fallback: normalizeFallback(value.fallback)
  };
  if (!normalized.trigger || normalized.trigger.length > 60 || /[\u0000-\u001f\u007f]/.test(normalized.trigger)) {
    throw new Error("Automation contract trigger must be a short printable string.");
  }
  if (!AUTOMATION_AUTHORITIES.includes(normalized.authority)) throw new Error(`Unsupported automation authority "${normalized.authority}".`);
  if (!AUTOMATION_IDEMPOTENCY_SCOPES.includes(normalized.idempotencyScope)) throw new Error(`Unsupported automation idempotency scope "${normalized.idempotencyScope}".`);
  if (!AUTOMATION_FALLBACKS.includes(normalized.fallback)) throw new Error(`Unsupported automation fallback "${normalized.fallback}".`);

  if (value.targetFilter != null) {
    if (!isObject(value.targetFilter)) throw new Error("Automation contract targetFilter must be an object.");
    const filterKeys = Object.keys(value.targetFilter);
    if (filterKeys.some(key => key !== "creatureType")) throw new Error("Automation contract targetFilter only supports creatureType.");
    normalized.targetFilter = {
      ...(value.targetFilter.creatureType == null ? {} : { creatureType: cleanText(value.targetFilter.creatureType, "targetFilter.creatureType", 40).toLowerCase() })
    };
    if (!Object.keys(normalized.targetFilter).length) delete normalized.targetFilter;
  }

  if (value.resourcePolicy != null) {
    normalized.resourcePolicy = String(value.resourcePolicy);
    if (!AUTOMATION_RESOURCE_POLICIES.includes(normalized.resourcePolicy)) throw new Error(`Unsupported automation resource policy "${normalized.resourcePolicy}".`);
  }
  if (value.effectRecipe != null) {
    normalized.effectRecipe = String(value.effectRecipe);
    if (!AUTOMATION_EFFECT_RECIPES.includes(normalized.effectRecipe)) throw new Error(`Unsupported automation effect recipe "${normalized.effectRecipe}".`);
  }
  if (value.duration != null) {
    if (!isObject(value.duration)) throw new Error("Automation contract duration must be an object.");
    const durationKeys = Object.keys(value.duration);
    if (durationKeys.some(key => !["seconds", "rounds", "concentration"].includes(key))) throw new Error("Automation contract duration contains an unsupported field.");
    const duration = {};
    for (const key of ["seconds", "rounds"]) {
      if (value.duration[key] == null) continue;
      const number = Number(value.duration[key]);
      if (!Number.isFinite(number) || number <= 0 || number > 86400) throw new Error(`Automation contract duration.${key} must be a positive bounded number.`);
      duration[key] = number;
    }
    if (value.duration.concentration != null) duration.concentration = value.duration.concentration === true;
    if (Object.keys(duration).length) normalized.duration = duration;
  }
  if (value.requires != null) {
    if (!Array.isArray(value.requires) || value.requires.length > 5) throw new Error("Automation contract requires must be a short array.");
    const requires = [...new Set(value.requires.map(entry => cleanText(entry, "requires", 40)))];
    const allowedDependencies = new Set(["midi-qol", "dae", "itemacro", "autoanimations", "sequencer"]);
    if (requires.some(entry => !allowedDependencies.has(entry))) throw new Error("Automation contract requires contains an unsupported dependency.");
    normalized.requires = requires;
  }
  return normalized;
}

function inferredAutomationContracts(spec = {}) {
  const inferred = [];
  if (spec.conditionOnHit && typeof spec.conditionOnHit === "object" && !Array.isArray(spec.conditionOnHit)) {
    inferred.push({
      version: AUTOMATION_CONTRACT_VERSION,
      recipe: "conditionOnHit",
      trigger: "attack-hit",
      workflowPass: "postActiveEffects",
      targetSource: "hitTargets",
      effectRecipe: "apply-condition",
      authority: "local-trusted-engine",
      idempotencyScope: "per-workflow",
      fallback: "manual-review",
      requires: ["midi-qol", "itemacro"],
      fields: ["conditionOnHit"]
    });
  }
  if (spec.toggleLight && typeof spec.toggleLight === "object" && !Array.isArray(spec.toggleLight)) {
    inferred.push({
      version: AUTOMATION_CONTRACT_VERSION,
      recipe: "selfTargetLight",
      trigger: "utility-activation",
      workflowPass: "activity",
      targetSource: "self",
      effectRecipe: "toggle-light",
      authority: "local-trusted-engine",
      idempotencyScope: "per-activation",
      fallback: "manual-review",
      requires: ["itemacro"],
      fields: ["toggleLight"]
    });
  }
  return inferred;
}

function normalizeAutomationMetadata(spec = {}) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return spec;
  const explicit = [];
  if (spec.automation != null) explicit.push(normalizeAutomationContract(spec.automation));
  for (const value of spec.automationRoutes ?? []) {
    explicit.push(normalizeAutomationContract(value));
  }
  const seen = new Set();
  const routes = [...explicit, ...inferredAutomationContracts(spec).map(normalizeAutomationContract)]
    .filter(route => {
      if (!route || seen.has(route.recipe)) return false;
      seen.add(route.recipe);
      return true;
    });
  if (!routes.length) return spec;
  return {
    ...spec,
    automation: routes[0],
    ...(routes.length > 1 ? { automationRoutes: routes } : {})
  };
}

function automationDependencies(recipe) {
  return [...(AUTOMATION_DEPENDENCIES[recipe] ?? [])];
}

function automationReviewNote(contract, route = null) {
  const normalized = normalizeAutomationContract(contract);
  if (!normalized) return null;
  const template = normalized.templateId ? automationTemplateById(normalized.templateId) : null;
  const templateLabel = template ? `${template.label} (${template.category})` : null;
  const target = normalized.targetFilter?.creatureType ? `; filters to ${normalized.targetFilter.creatureType} targets` : "";
  const dependencies = normalized.requires?.length ? `; dependencies: ${normalized.requires.join(", ")}` : "";
  if (route) {
    const required = route.dependencyLabels?.length ? route.dependencyLabels.join(", ") : "none";
    const status = route.available ? "Selected" : "Fallback";
    const dependencyEvidence = (route.dependencyStates ?? [])
      .filter(dependency => dependency.active && !dependency.installed)
      .map(dependency => `${dependency.label} has no reported version`);
    const evidence = dependencyEvidence.length
      ? ` Evidence warning: ${dependencyEvidence.join("; ")}.`
      : " Final DataModel and safe-use checks remain required before treating this route as verified.";
    return {
      state: route.available ? "note" : "review",
      label: "Automation layer",
      message: `${status} ${route.selectedLayer} layer for ${templateLabel ? `${templateLabel} / ` : ""}${normalized.recipe} via the trusted ${normalized.workflowPass} path with ${normalized.targetSource} as its target source${target}.`,
      handling: `Required modules: ${required}. ${route.available ? "This layer is available in the current world." : `${route.reason} ${route.fallback}.`} Authority: ${normalized.authority}; fallback: ${normalized.fallback}.${evidence}`
    };
  }
  return {
    state: "note",
    label: "Automation contract",
    message: `${templateLabel ? `${templateLabel} / ` : ""}${normalized.recipe} uses the trusted ${normalized.workflowPass} path with ${normalized.targetSource} as its target source${target}.`,
    handling: `Authority: ${normalized.authority}; fallback: ${normalized.fallback}${dependencies}.`
  };
}

export {
  AUTOMATION_AUTHORITIES,
  AUTOMATION_CONTRACT_VERSION,
  AUTOMATION_DEPENDENCIES,
  AUTOMATION_EFFECT_RECIPES,
  AUTOMATION_FALLBACKS,
  AUTOMATION_IDEMPOTENCY_SCOPES,
  AUTOMATION_RECIPES,
  AUTOMATION_RESOURCE_POLICIES,
  AUTOMATION_TARGET_SOURCES,
  AUTOMATION_WORKFLOW_PASSES,
  automationDependencies,
  automationReviewNote,
  inferredAutomationContracts,
  normalizeAutomationContract,
  normalizeAutomationMetadata
};
