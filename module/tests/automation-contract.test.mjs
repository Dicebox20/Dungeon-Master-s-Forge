import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_CONTRACT_VERSION,
  automationReviewNote,
  normalizeAutomationContract
} from "../scripts/automation-contract.js";

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
