const AUTOMATION_CONTRACT_VERSION = "1.0";

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

function normalizeAutomationContract(value) {
  if (value == null) return undefined;
  if (!isObject(value)) throw new Error("Automation contract must be an object.");

  const allowed = new Set([
    "version", "recipe", "trigger", "workflowPass", "targetSource", "targetFilter",
    "resourcePolicy", "effectRecipe", "duration", "authority", "idempotencyScope",
    "fallback", "requires"
  ]);
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) throw new Error(`Automation contract contains unsupported field "${unknown}".`);

  const recipe = cleanText(value.recipe, "recipe");
  if (!AUTOMATION_RECIPES.includes(recipe)) throw new Error(`Unsupported automation recipe "${recipe}".`);
  const version = String(value.version ?? AUTOMATION_CONTRACT_VERSION).trim();
  if (version !== AUTOMATION_CONTRACT_VERSION) throw new Error(`Automation contract version must be ${AUTOMATION_CONTRACT_VERSION}.`);

  const workflowPass = String(value.workflowPass ?? (recipe === "conditionOnHit" ? "postActiveEffects" : "activity"));
  if (!AUTOMATION_WORKFLOW_PASSES.includes(workflowPass)) throw new Error(`Unsupported automation workflow pass "${workflowPass}".`);
  const targetSource = String(value.targetSource ?? (recipe === "conditionOnHit" ? "hitTargets" : "self"));
  if (!AUTOMATION_TARGET_SOURCES.includes(targetSource)) throw new Error(`Unsupported automation target source "${targetSource}".`);

  const normalized = {
    version,
    recipe,
    trigger: String(value.trigger ?? AUTOMATION_TRIGGER_DEFAULTS[recipe]),
    workflowPass,
    targetSource,
    authority: String(value.authority ?? "local-trusted-engine"),
    idempotencyScope: String(value.idempotencyScope ?? "per-activation"),
    fallback: String(value.fallback ?? "manual-review")
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

function automationDependencies(recipe) {
  return [...(AUTOMATION_DEPENDENCIES[recipe] ?? [])];
}

function automationReviewNote(contract, route = null) {
  const normalized = normalizeAutomationContract(contract);
  if (!normalized) return null;
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
      message: `${status} ${route.selectedLayer} layer for ${normalized.recipe} via the trusted ${normalized.workflowPass} path with ${normalized.targetSource} as its target source${target}.`,
      handling: `Required modules: ${required}. ${route.available ? "This layer is available in the current world." : `${route.reason} ${route.fallback}.`} Authority: ${normalized.authority}; fallback: ${normalized.fallback}.${evidence}`
    };
  }
  return {
    state: "note",
    label: "Automation contract",
    message: `${normalized.recipe} uses the trusted ${normalized.workflowPass} path with ${normalized.targetSource} as its target source${target}.`,
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
  normalizeAutomationContract
};
