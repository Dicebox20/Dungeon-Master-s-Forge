import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_CONTRACT_VERSION,
  automationReviewNote,
  normalizeAutomationContract,
  normalizeAutomationMetadata
} from "../scripts/automation-contract.js";
import { AUTOMATION_PRODUCTION_TEMPLATES, AUTOMATION_TEMPLATES } from "../scripts/automation-templates.js";

test("automation contracts normalize to a bounded declarative shape", () => {
  const contract = normalizeAutomationContract({
    recipe: "conditionOnHit",
    targetFilter: { creatureType: "Undead" },
    effectRecipe: "apply-condition",
    requires: ["midi-qol", "itemacro"]
  });
  assert.equal(contract.version, AUTOMATION_CONTRACT_VERSION);
  assert.equal(contract.workflowPass, "postActiveEffects");
  assert.equal(contract.targetSource, "hitTargets");
  assert.deepEqual(contract.targetFilter, { creatureType: "undead" });
  assert.deepEqual(automationReviewNote(contract), {
    state: "note",
    label: "Automation contract",
    message: "conditionOnHit uses the trusted postActiveEffects path with hitTargets as its target source; filters to undead targets.",
    handling: "Authority: local-trusted-engine; fallback: manual-review; dependencies: midi-qol, itemacro."
  });
});

test("automation contracts reject executable or unbounded fields", () => {
  assert.throws(() => normalizeAutomationContract({ recipe: "conditionOnHit", script: "return 1" }), /unsupported field/);
  assert.throws(() => normalizeAutomationContract({ recipe: "conditionOnHit", targetFilter: { tokenName: "Target" } }), /targetFilter only supports/);
  assert.throws(() => normalizeAutomationContract({ recipe: "conditionOnHit", requires: ["unknown-module"] }), /unsupported dependency/);
});

test("automation templates are declarative, production-gated, and recipe-bound", () => {
  assert.equal(normalizeAutomationContract({ templateId: "workflow-condition-rider", recipe: "conditionOnHit" }).templateId, "workflow-condition-rider");
  assert.throws(
    () => normalizeAutomationContract({ templateId: "actor-sourced-concentration-aura", recipe: "conditionOnHit" }),
    /not a production template/
  );
  assert.throws(
    () => normalizeAutomationContract({ templateId: "self-token-light-toggle", recipe: "conditionOnHit" }),
    /does not match recipe/
  );
});

test("model automation labels normalize to the canonical production contract", () => {
  const normalized = normalizeAutomationContract({
    recipe: "workflow-condition-rider",
    workflowPass: "on-hit",
    authority: "trusted-local",
    fallback: "Use the core attack workflow if the trusted automation layer is unavailable."
  });
  assert.equal(normalized.templateId, "workflow-condition-rider");
  assert.equal(normalized.recipe, "conditionOnHit");
  assert.equal(normalized.workflowPass, "postActiveEffects");
  assert.equal(normalized.authority, "local-trusted-engine");
  assert.equal(normalized.fallback, "core-only");
});

test("template description fields are bounded metadata and do not enter the runtime contract", () => {
  const normalized = normalizeAutomationContract({
    recipe: "conditionOnHit",
    fields: ["condition", "save", "duration", "targetFilter"]
  });
  assert.equal(normalized.fields, undefined);
  assert.throws(
    () => normalizeAutomationContract({ recipe: "conditionOnHit", fields: ["x".repeat(61)] }),
    /metadata array|short printable string/
  );
});

test("legacy declarative payloads become visible automation routes without executable fields", () => {
  const normalized = normalizeAutomationMetadata({
    kind: "artifactWeaponHybrid",
    name: "Ashen Mercy",
    conditionOnHit: { condition: "stunned" },
    toggleLight: { bright: 20, dim: 40 }
  });
  assert.equal(normalized.automation.recipe, "conditionOnHit");
  assert.deepEqual(normalized.automationRoutes.map(route => route.recipe), ["conditionOnHit", "selfTargetLight"]);
  assert.equal(normalized.automationRoutes[1].targetSource, "self");
  assert.equal("macroCommand" in normalized.automationRoutes[0], false);
  assert.equal("script" in normalized.automationRoutes[1], false);
});

for (const template of AUTOMATION_PRODUCTION_TEMPLATES) {
  test(`every production automation template normalizes its model labels: ${template.id}`, () => {
    const recipe = template.recipes[0];
    const normalized = normalizeAutomationContract({
      recipe: template.id,
      trigger: template.trigger.replaceAll("-", " "),
      targetSource: recipe === "conditionOnHit" ? "hit targets" : "self target",
      workflowPass: recipe === "conditionOnHit" ? "on-hit" : "activity",
      authority: "trusted-local",
      fallback: "Use the core route with manual review if needed.",
      fields: template.fields,
      ...(template.requiredModules.length ? { requires: template.requiredModules } : {})
    });

    assert.equal(normalized.templateId, template.id);
    assert.equal(normalized.recipe, recipe);
    assert.equal(normalized.trigger, template.trigger);
    assert.equal(normalized.targetSource, recipe === "conditionOnHit" ? "hitTargets" : "self");
    assert.equal(normalized.workflowPass, recipe === "conditionOnHit" ? "postActiveEffects" : "activity");
    assert.equal(normalized.authority, "local-trusted-engine");
    assert.equal(normalized.fallback, "core-only");
    assert.deepEqual(normalized.requires, template.requiredModules.length ? template.requiredModules : undefined);
    assert.equal(normalized.fields, undefined);
  });
}

for (const template of AUTOMATION_TEMPLATES.filter(candidate => candidate.status === "planned")) {
  test(`planned automation remains deferred: ${template.id}`, () => {
    assert.throws(
      () => normalizeAutomationContract({ recipe: template.id }),
      /not a production template/
    );
  });
}
