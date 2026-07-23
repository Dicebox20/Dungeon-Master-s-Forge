import assert from "node:assert/strict";
import test from "node:test";
import { automationExecutionEntry, buildAutomationExecutionPlan, executionStatus } from "../scripts/automation-execution.js";

test("condition automation is executable only when both trusted workflow layers are enabled", () => {
  const spec = { name: "Rider", conditionOnHit: { condition: "stunned" } };
  assert.equal(buildAutomationExecutionPlan(spec, { midiQolAutomation: true, itemMacroAutomation: true }).entries.length, 1);
  const fallback = buildAutomationExecutionPlan(spec, { midiQolAutomation: true, itemMacroAutomation: false });
  assert.equal(fallback.entries.length, 0);
  assert.deepEqual(fallback.fallbacks[0].missingSettings, ["itemMacroAutomation"]);
});

test("light and utility macro payloads are gated independently by Item Macro", () => {
  const spec = {
    name: "Lantern",
    toggleLight: { activityName: "Ignite" },
    utilityActivities: [{ activityName: "Choose Ward", macroCommand: "return true;" }]
  };
  const plan = buildAutomationExecutionPlan(spec, { itemMacroAutomation: true });
  assert.ok(automationExecutionEntry(plan, "selfTargetLight", "Ignite"));
  assert.ok(automationExecutionEntry(plan, "utilityMacro", "Choose Ward"));
  assert.equal(buildAutomationExecutionPlan(spec, {}).entries.length, 0);
});

test("declarative automation recipes dispatch to their trusted local templates", () => {
  const condition = buildAutomationExecutionPlan({
    name: "Recipe Blade",
    conditionOnHit: { condition: "poisoned" },
    automation: { recipe: "conditionOnHit" }
  }, { midiQolAutomation: true, itemMacroAutomation: true });
  assert.equal(condition.entries.length, 1);
  assert.equal(condition.entries[0].recipe, "conditionOnHit");

  const light = buildAutomationExecutionPlan({
    name: "Recipe Lantern",
    toggleLight: { activityName: "Ignite" },
    automation: { recipe: "selfTargetLight" }
  }, { itemMacroAutomation: true });
  assert.equal(light.entries.length, 1);
  assert.equal(light.entries[0].recipe, "selfTargetLight");
});

test("automation recipes without declarative payloads fail closed with a useful finding", () => {
  const plan = buildAutomationExecutionPlan({
    name: "Unwired Recipe",
    automation: { recipe: "conditionOnHit" }
  }, { midiQolAutomation: true, itemMacroAutomation: true });
  assert.equal(plan.entries.length, 0);
  assert.deepEqual(plan.fallbacks[0].missingFields, ["conditionOnHit"]);
  assert.match(plan.fallbacks[0].reason, /no executable template was generated/i);
});

test("unknown execution recipes never become executable payloads", () => {
  assert.equal(executionStatus("unknown", {}).available, false);
});
