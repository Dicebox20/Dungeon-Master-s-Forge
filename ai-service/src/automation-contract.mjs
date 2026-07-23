import { ServiceError } from "./errors.mjs";

const AUTOMATION_CONTRACT_VERSION = "1.0";
const AUTOMATION_RECIPES = Object.freeze(["conditionOnHit", "selfTargetLight", "multiActivityResource", "daeTransferEffect", "animationVisual"]);
const AUTOMATION_WORKFLOW_PASSES = Object.freeze(["postActiveEffects", "activity"]);
const AUTOMATION_TARGET_SOURCES = Object.freeze(["hitTargets", "failedSaves", "self", "selectedTargets"]);
const AUTOMATION_AUTHORITIES = Object.freeze(["workflow-roller", "gm", "local-trusted-engine"]);
const AUTOMATION_FALLBACKS = Object.freeze(["manual-review", "core-only", "disabled"]);
const AUTOMATION_RESOURCE_POLICIES = Object.freeze(["item-uses", "shared-item-uses", "none", "manual-review"]);
const AUTOMATION_EFFECT_RECIPES = Object.freeze(["apply-condition", "toggle-light", "consume-item-use", "transfer-effect", "play-animation"]);
const AUTOMATION_IDEMPOTENCY_SCOPES = Object.freeze(["per-workflow", "per-item-use", "per-target", "per-activation"]);
const AUTOMATION_DEPENDENCIES = Object.freeze(["midi-qol", "dae", "itemacro", "autoanimations", "sequencer"]);

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message, path = "automation") {
  throw new ServiceError(502, "invalid_model_output", `${path}: ${message}`);
}

function text(value, field, max = 80, path = "automation") {
  const result = String(value ?? "").trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) fail(`${field} must be a short printable string.`, path);
  return result;
}

function normalizeAutomationContract(value, path = "automation") {
  if (value == null) return undefined;
  if (!object(value)) fail("must be an object.", path);
  const allowed = new Set(["version", "recipe", "trigger", "workflowPass", "targetSource", "targetFilter", "resourcePolicy", "effectRecipe", "duration", "authority", "idempotencyScope", "fallback", "requires"]);
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) fail(`contains unsupported field \"${unknown}\".`, path);
  const version = String(value.version ?? AUTOMATION_CONTRACT_VERSION).trim();
  if (version !== AUTOMATION_CONTRACT_VERSION) fail(`version must be ${AUTOMATION_CONTRACT_VERSION}.`, path);
  const recipe = text(value.recipe, "recipe", 80, path);
  if (!AUTOMATION_RECIPES.includes(recipe)) fail(`unsupported recipe \"${recipe}\".`, path);
  const workflowPass = String(value.workflowPass ?? (recipe === "conditionOnHit" ? "postActiveEffects" : "activity"));
  if (!AUTOMATION_WORKFLOW_PASSES.includes(workflowPass)) fail(`unsupported workflow pass \"${workflowPass}\".`, path);
  const targetSource = String(value.targetSource ?? (recipe === "conditionOnHit" ? "hitTargets" : "self"));
  if (!AUTOMATION_TARGET_SOURCES.includes(targetSource)) fail(`unsupported target source \"${targetSource}\".`, path);
  const authority = String(value.authority ?? "local-trusted-engine");
  const idempotencyScope = String(value.idempotencyScope ?? "per-activation");
  const fallback = String(value.fallback ?? "manual-review");
  if (!AUTOMATION_AUTHORITIES.includes(authority)) fail(`unsupported authority \"${authority}\".`, path);
  if (!AUTOMATION_IDEMPOTENCY_SCOPES.includes(idempotencyScope)) fail(`unsupported idempotency scope \"${idempotencyScope}\".`, path);
  if (!AUTOMATION_FALLBACKS.includes(fallback)) fail(`unsupported fallback \"${fallback}\".`, path);
  const normalized = { version, recipe, trigger: text(value.trigger ?? `${recipe}-activation`, "trigger", 60, path), workflowPass, targetSource, authority, idempotencyScope, fallback };
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

function normalizeAutomationCapabilities(value) {
  if (value == null) return null;
  if (!object(value)) throw new ServiceError(400, "invalid_automation_capabilities", "context.automationCapabilities must be an object.");
  const version = String(value.version ?? "").trim();
  if (version !== AUTOMATION_CONTRACT_VERSION) throw new ServiceError(400, "unsupported_automation_capabilities", `context.automationCapabilities.version must be ${AUTOMATION_CONTRACT_VERSION}.`);
  const supportedRecipes = Array.isArray(value.supportedRecipes) ? [...new Set(value.supportedRecipes.map(String))] : [];
  if (supportedRecipes.some(recipe => !AUTOMATION_RECIPES.includes(recipe))) throw new ServiceError(400, "unknown_automation_recipe", "context.automationCapabilities contains an unknown recipe.");
  const activeModules = Array.isArray(value.activeModules) ? [...new Set(value.activeModules.map(String).filter(entry => entry.length <= 40))].slice(0, 20) : [];
  const settings = object(value.settings) ? {
    midiQolAutomation: value.settings.midiQolAutomation === true,
    itemMacroAutomation: value.settings.itemMacroAutomation === true,
    daeAutomation: value.settings.daeAutomation === true,
    authorizeGeneratedAutomation: value.settings.authorizeGeneratedAutomation === true
  } : {};
  return { version, supportedRecipes, activeModules, settings };
}

export { AUTOMATION_CONTRACT_VERSION, AUTOMATION_DEPENDENCIES, AUTOMATION_RECIPES, normalizeAutomationCapabilities, normalizeAutomationContract };
