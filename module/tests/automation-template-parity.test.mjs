import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_TEMPLATES as serviceTemplates } from "../../ai-service/src/automation-templates.mjs";
import { AUTOMATION_TEMPLATES as moduleTemplates } from "../scripts/automation-templates.js";

function contractShape(template) {
  return {
    id: template.id,
    label: template.label,
    category: template.category,
    capabilityIds: template.capabilityIds,
    recipes: template.recipes,
    status: template.status,
    trigger: template.trigger,
    targetModel: template.targetModel,
    fields: template.fields,
    requiredModules: template.requiredModules,
    fallback: template.fallback,
    reviewChecks: template.reviewChecks
  };
}

test("service and Foundry automation catalogs share the same contract", () => {
  assert.deepEqual(
    moduleTemplates.map(contractShape),
    serviceTemplates.map(contractShape)
  );
});
