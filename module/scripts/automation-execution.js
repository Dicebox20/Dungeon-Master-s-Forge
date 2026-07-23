const AUTOMATION_EXECUTION_REQUIREMENTS = Object.freeze({
  conditionOnHit: Object.freeze({
    settings: Object.freeze(["midiQolAutomation", "itemMacroAutomation"]),
    layer: "Midi-QOL + Item Macro"
  }),
  selfTargetLight: Object.freeze({
    settings: Object.freeze(["itemMacroAutomation"]),
    layer: "Item Macro"
  }),
  utilityMacro: Object.freeze({
    settings: Object.freeze(["itemMacroAutomation"]),
    layer: "Item Macro"
  })
});

function executionStatus(recipe, config = {}) {
  const requirement = AUTOMATION_EXECUTION_REQUIREMENTS[recipe];
  if (!requirement) return { recipe, available: false, layer: "DND5e core", missingSettings: [] };
  const missingSettings = requirement.settings.filter(key => config?.[key] !== true);
  return {
    recipe,
    available: missingSettings.length === 0,
    layer: missingSettings.length ? "DND5e core (fallback)" : requirement.layer,
    requiredSettings: [...requirement.settings],
    missingSettings
  };
}

function buildAutomationExecutionPlan(spec = {}, config = {}) {
  const entries = [];
  const fallbacks = [];
  const seenRecipes = new Set();
  const declaredRecipes = new Set([
    ...(spec.automation ? [spec.automation] : []),
    ...(Array.isArray(spec.automationRoutes) ? spec.automationRoutes : [])
  ].map(route => String(route?.recipe ?? "").trim()).filter(Boolean));
  const add = (recipe, source, activityName) => {
    if (seenRecipes.has(recipe)) return;
    seenRecipes.add(recipe);
    const status = executionStatus(recipe, config);
    const entry = { ...status, source, activityName: String(activityName ?? "").trim() };
    if (status.available) entries.push(entry);
    else fallbacks.push(entry);
  };
  const missingDeclarativePayload = (recipe, source, activityName, field) => {
    if (seenRecipes.has(recipe)) return;
    seenRecipes.add(recipe);
    const status = executionStatus(recipe, config);
    fallbacks.push({
      ...status,
      source,
      activityName: String(activityName ?? "").trim(),
      missingFields: [field],
      reason: `The ${recipe} contract is present without its ${field} payload; no executable template was generated.`
    });
  };

  if (spec.conditionOnHit || declaredRecipes.has("conditionOnHit")) {
    if (!spec.conditionOnHit) {
      missingDeclarativePayload("conditionOnHit", "Automation contract", spec.attackName ?? `Attack with ${spec.name}`, "conditionOnHit");
    } else {
      add("conditionOnHit", "Condition on hit", spec.attackName ?? `Attack with ${spec.name}`);
    }
  }
  if (spec.toggleLight || declaredRecipes.has("selfTargetLight")) {
    if (!spec.toggleLight) {
      missingDeclarativePayload("selfTargetLight", "Automation contract", "Toggle Light", "toggleLight");
    } else {
      add("selfTargetLight", "Light toggle", spec.toggleLight.activityName ?? "Toggle Light");
    }
  }
  if (spec.conditionOnHit && !seenRecipes.has("conditionOnHit")) {
    add("conditionOnHit", "Condition on hit", spec.attackName ?? `Attack with ${spec.name}`);
  }
  for (const activity of spec.utilityActivities ?? []) {
    if (activity?.macroCommand) add("utilityMacro", "Utility activity", activity.activityName ?? `Use ${spec.name}`);
  }

  return { entries, fallbacks };
}

function automationExecutionEntry(plan, recipe, activityName = "") {
  return (plan?.entries ?? []).find(entry => entry.recipe === recipe && (!activityName || entry.activityName === activityName)) ?? null;
}

export {
  AUTOMATION_EXECUTION_REQUIREMENTS,
  automationExecutionEntry,
  buildAutomationExecutionPlan,
  executionStatus
};
