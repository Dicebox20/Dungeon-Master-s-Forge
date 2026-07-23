import { ServiceError } from "./errors.mjs";
import { AUTOMATION_PRODUCTION_TEMPLATES, AUTOMATION_TEMPLATE_VERSION, automationTemplateById, automationTemplateForRecipe } from "./automation-templates.mjs";

const AUTOMATION_CONTRACT_VERSION = "1.0";
const AUTOMATION_RECIPES = Object.freeze(["conditionOnHit", "selfTargetLight", "multiActivityResource", "daeTransferEffect", "animationVisual"]);
const AUTOMATION_ROUTES = Object.freeze([
  Object.freeze({ recipe: "conditionOnHit", layer: "Midi-QOL + Item Macro", dependencies: ["midi-qol", "itemacro"], fallback: "Core attack workflow with review" }),
  Object.freeze({ recipe: "selfTargetLight", layer: "Item Macro", dependencies: ["itemacro"], fallback: "Portable light metadata with review" }),
  Object.freeze({ recipe: "multiActivityResource", layer: "DND5e core", dependencies: [], fallback: "Core activities with review" }),
  Object.freeze({ recipe: "daeTransferEffect", layer: "Dynamic Active Effects", dependencies: ["dae"], fallback: "Portable effect data with review" }),
  Object.freeze({ recipe: "animationVisual", layer: "Automated Animations + Sequencer", dependencies: ["autoanimations", "sequencer"], fallback: "No animation with review" })
]);
const AUTOMATION_WORKFLOW_PASSES = Object.freeze(["postActiveEffects", "activity"]);
const AUTOMATION_TARGET_SOURCES = Object.freeze(["hitTargets", "failedSaves", "self", "selectedTargets"]);
const AUTOMATION_AUTHORITIES = Object.freeze(["workflow-roller", "gm", "local-trusted-engine"]);
const AUTOMATION_FALLBACKS = Object.freeze(["manual-review", "core-only", "disabled"]);
const AUTOMATION_RESOURCE_POLICIES = Object.freeze(["item-uses", "shared-item-uses", "none", "manual-review"]);
const AUTOMATION_EFFECT_RECIPES = Object.freeze(["apply-condition", "toggle-light", "consume-item-use", "transfer-effect", "play-animation"]);
const AUTOMATION_IDEMPOTENCY_SCOPES = Object.freeze(["per-workflow", "per-item-use", "per-target", "per-activation"]);
const AUTOMATION_DEPENDENCIES = Object.freeze(["midi-qol", "dae", "itemacro", "autoanimations", "sequencer"]);
const WORKFLOW_PASS_ALIASES = Object.freeze({
  "on-hit": "postActiveEffects",
  "on hit": "postActiveEffects",
  "attack-hit": "postActiveEffects",
  "attack hit": "postActiveEffects",
  "post-active-effects": "postActiveEffects"
});
const AUTHORITY_ALIASES = Object.freeze({
  "trusted-local": "local-trusted-engine",
  "local trusted": "local-trusted-engine",
  "local-trusted": "local-trusted-engine"
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

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message, path = "automation") {
  throw new ServiceError(502, "invalid_model_output", `${path}: ${message}`);
}

function normalizeRecipe(value, path) {
  const raw = text(value, "recipe", 80, path);
  const template = automationTemplateById(raw);
  if (template) {
    if (template.status !== "production") fail(`recipe "${raw}" is not a production template.`, path);
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

function text(value, field, max = 80, path = "automation") {
  const result = String(value ?? "").trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) fail(`${field} must be a short printable string.`, path);
  return result;
}

function normalizeAutomationContract(value, path = "automation") {
  if (value == null) return undefined;
  if (!object(value)) fail("must be an object.", path);
  const allowed = new Set(["version", "templateId", "recipe", "trigger", "workflowPass", "targetSource", "targetFilter", "resourcePolicy", "effectRecipe", "duration", "authority", "idempotencyScope", "fallback", "requires", "fields"]);
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) fail(`contains unsupported field \"${unknown}\".`, path);
  if (value.fields != null) {
    if (!Array.isArray(value.fields) || value.fields.length > 20) fail("fields must be a short metadata array.", path);
    value.fields.forEach(field => text(field, "fields", 60, path));
  }
  const version = String(value.version ?? AUTOMATION_CONTRACT_VERSION).trim();
  if (version !== AUTOMATION_CONTRACT_VERSION) fail(`version must be ${AUTOMATION_CONTRACT_VERSION}.`, path);
  const recipeResult = normalizeRecipe(value.recipe, path);
  const recipe = recipeResult.recipe;
  if (!AUTOMATION_RECIPES.includes(recipe)) fail(`unsupported recipe \"${recipe}\".`, path);
  const explicitTemplateId = value.templateId == null ? undefined : text(value.templateId, "templateId", 80, path);
  const templateId = explicitTemplateId ?? recipeResult.templateId;
  const template = templateId ? automationTemplateById(templateId) : null;
  if (templateId && (!template || template.status !== "production")) fail(`templateId \"${templateId}\" is not a production template.`, path);
  if (template && !template.recipes.includes(recipe)) fail(`templateId \"${templateId}\" does not match recipe \"${recipe}\".`, path);
  const workflowPass = normalizeEnumAlias(value.workflowPass, WORKFLOW_PASS_ALIASES, recipe === "conditionOnHit" ? "postActiveEffects" : "activity");
  if (!AUTOMATION_WORKFLOW_PASSES.includes(workflowPass)) fail(`unsupported workflow pass \"${workflowPass}\".`, path);
  const targetSource = normalizeEnumAlias(value.targetSource, TARGET_SOURCE_ALIASES, recipe === "conditionOnHit" ? "hitTargets" : "self");
  if (!AUTOMATION_TARGET_SOURCES.includes(targetSource)) fail(`unsupported target source \"${targetSource}\".`, path);
  const authority = normalizeEnumAlias(value.authority, AUTHORITY_ALIASES, "local-trusted-engine");
  const idempotencyScope = String(value.idempotencyScope ?? "per-activation");
  const fallback = normalizeFallback(value.fallback);
  if (!AUTOMATION_AUTHORITIES.includes(authority)) fail(`unsupported authority \"${authority}\".`, path);
  if (!AUTOMATION_IDEMPOTENCY_SCOPES.includes(idempotencyScope)) fail(`unsupported idempotency scope \"${idempotencyScope}\".`, path);
  if (!AUTOMATION_FALLBACKS.includes(fallback)) fail(`unsupported fallback \"${fallback}\".`, path);
  const normalized = { version, ...(templateId ? { templateId } : {}), recipe, trigger: normalizeEnumAlias(value.trigger, TRIGGER_ALIASES, automationTemplateForRecipe(recipe)?.trigger ?? `${recipe}-activation`), workflowPass, targetSource, authority, idempotencyScope, fallback };
  if (value.targetFilter != null) {
    if (!object(value.targetFilter) || Object.keys(value.targetFilter).some(key => key !== "creatureType")) fail("targetFilter only supports creatureType.", path);
    if (value.targetFilter.creatureType != null) normalized.targetFilter = { creatureType: text(value.targetFilter.creatureType, "targetFilter.creatureType", 40, path).toLowerCase() };
  }
  if (value.resourcePolicy != null) {
    normalized.resourcePolicy = String(value.resourcePolicy);
    if (!AUTOMATION_RESOURCE_POLICIES.includes(normalized.resourcePolicy)) fail(`unsupported resource policy \"${normalized.resourcePolicy}\".`, path);
  }
  if (value.effectRecipe != null) {
    normalized.effectRecipe = String(value.effectRecipe);
    if (!AUTOMATION_EFFECT_RECIPES.includes(normalized.effectRecipe)) fail(`unsupported effect recipe \"${normalized.effectRecipe}\".`, path);
  }
  if (value.duration != null) {
    if (!object(value.duration) || Object.keys(value.duration).some(key => !["seconds", "rounds", "concentration"].includes(key))) fail("duration contains an unsupported field.", path);
    const duration = {};
    for (const key of ["seconds", "rounds"]) {
      if (value.duration[key] == null) continue;
      const number = Number(value.duration[key]);
      if (!Number.isFinite(number) || number <= 0 || number > 86400) fail(`duration.${key} must be a positive bounded number.`, path);
      duration[key] = number;
    }
    if (value.duration.concentration != null) duration.concentration = value.duration.concentration === true;
    if (Object.keys(duration).length) normalized.duration = duration;
  }
  if (value.requires != null) {
    if (!Array.isArray(value.requires) || value.requires.length > 5) fail("requires must be a short array.", path);
    normalized.requires = [...new Set(value.requires.map(entry => text(entry, "requires", 40, path)))];
    if (normalized.requires.some(entry => !AUTOMATION_DEPENDENCIES.includes(entry))) fail("requires contains an unsupported dependency.", path);
  }
  return normalized;
}

function inferredAutomationContracts(spec = {}) {
  const inferred = [];
  if (object(spec.conditionOnHit)) {
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
  if (object(spec.toggleLight)) {
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

function normalizeAutomationCapabilities(value) {
  if (value == null) return null;
  if (!object(value)) throw new ServiceError(400, "invalid_automation_capabilities", "context.automationCapabilities must be an object.");
  const version = String(value.version ?? "").trim();
  if (version !== AUTOMATION_CONTRACT_VERSION) throw new ServiceError(400, "unsupported_automation_capabilities", `context.automationCapabilities.version must be ${AUTOMATION_CONTRACT_VERSION}.`);
  const supportedRecipes = Array.isArray(value.supportedRecipes) ? [...new Set(value.supportedRecipes.map(String))] : [];
  if (supportedRecipes.some(recipe => !AUTOMATION_RECIPES.includes(recipe))) throw new ServiceError(400, "unknown_automation_recipe", "context.automationCapabilities contains an unknown recipe.");
  const supportedTemplates = Array.isArray(value.supportedTemplates) ? [...new Set(value.supportedTemplates.map(String))] : [];
  if (supportedTemplates.some(templateId => !AUTOMATION_PRODUCTION_TEMPLATES.some(template => template.id === templateId))) throw new ServiceError(400, "unknown_automation_template", "context.automationCapabilities contains an unknown or non-production template.");
  const activeModules = Array.isArray(value.activeModules) ? [...new Set(value.activeModules.map(String).filter(entry => entry.length <= 40))].slice(0, 20) : [];
  const settings = object(value.settings) ? {
    midiQolAutomation: value.settings.midiQolAutomation === true,
    itemMacroAutomation: value.settings.itemMacroAutomation === true,
    daeAutomation: value.settings.daeAutomation === true,
    authorizeGeneratedAutomation: value.settings.authorizeGeneratedAutomation === true
  } : {};
  const routes = Array.isArray(value.routes)
    ? value.routes.slice(0, AUTOMATION_RECIPES.length).map((route, index) => {
      if (!object(route)) throw new ServiceError(400, "invalid_automation_capabilities", `context.automationCapabilities.routes[${index}] must be an object.`);
      const recipe = String(route.recipe ?? "").trim();
      if (!AUTOMATION_RECIPES.includes(recipe)) throw new ServiceError(400, "unknown_automation_recipe", "context.automationCapabilities.routes contains an unknown recipe.");
      const dependencies = Array.isArray(route.dependencies) ? [...new Set(route.dependencies.map(String))] : [];
      if (dependencies.some(entry => !AUTOMATION_DEPENDENCIES.includes(entry))) throw new ServiceError(400, "invalid_automation_capabilities", `context.automationCapabilities.routes.${recipe} contains an unsupported dependency.`);
      return {
        recipe,
        layer: text(route.layer, "layer", 100, "context.automationCapabilities.routes"),
        selectedLayer: text(route.selectedLayer ?? route.layer, "selectedLayer", 100, "context.automationCapabilities.routes"),
        dependencies,
        available: route.available === true,
        status: route.status === "available" ? "available" : "fallback",
        fallback: text(route.fallback ?? "Manual review", "fallback", 140, "context.automationCapabilities.routes"),
        missingModules: Array.isArray(route.missingModules) ? [...new Set(route.missingModules.map(String))] : [],
        missingSettings: Array.isArray(route.missingSettings) ? [...new Set(route.missingSettings.map(String))] : []
      };
    })
    : [];
  return { version, supportedRecipes, supportedTemplates, activeModules, settings, routes };
}

function applyAutomationCapabilityRoute(contract, capabilities, path = "automation") {
  if (!contract || !capabilities) return contract;
  if (!capabilities.supportedRecipes.includes(contract.recipe)) {
    throw new ServiceError(502, "invalid_model_output", `${path}.recipe "${contract.recipe}" was not advertised by the active Forge runtime.`);
  }
  if (contract.templateId && !capabilities.supportedTemplates?.includes(contract.templateId)) {
    throw new ServiceError(502, "invalid_model_output", `${path}.templateId \"${contract.templateId}\" was not advertised by the active Forge runtime.`);
  }
  const route = capabilities.routes?.find(candidate => candidate.recipe === contract.recipe);
  if (!route) return contract;
  if (route.available !== true) {
    throw new ServiceError(502, "invalid_model_output", `${path}.recipe "${contract.recipe}" selected an unavailable ${route.layer} layer.`);
  }
  const requires = [...new Set([...(contract.requires ?? []), ...route.dependencies])];
  return requires.length ? { ...contract, requires } : contract;
}

export { AUTOMATION_CONTRACT_VERSION, AUTOMATION_DEPENDENCIES, AUTOMATION_RECIPES, AUTOMATION_ROUTES, AUTOMATION_TEMPLATE_VERSION, applyAutomationCapabilityRoute, inferredAutomationContracts, normalizeAutomationCapabilities, normalizeAutomationContract };
