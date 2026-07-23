import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomationCapabilitySnapshot } from "../scripts/automation-capabilities.js";

function fakeGame() {
  const modules = new Map([
    ["midi-qol", { active: true, version: "14.0.11" }],
    ["dae", { active: true, version: "14.0.12" }],
    ["itemacro", { active: true, version: "3.0.1" }],
    ["autoanimations", { active: true, version: "7.0.16" }],
    ["sequencer", { active: true, version: "4.2.3" }],
    ["ActiveAuras", { active: true, version: "0.12.7" }],
    ["times-up", { active: true, version: "13.1.9" }]
  ]);
  return { version: "14.364.0", system: { id: "dnd5e", version: "5.3.3" }, modules };
}

test("capability snapshots expose supported recipes and v14 compatibility warnings", () => {
  const snapshot = buildAutomationCapabilitySnapshot({
    game: fakeGame(),
    moduleVersion: "2.23.1",
    config: { midiQolAutomation: true, itemMacroAutomation: true, daeAutomation: true }
  });
  assert.deepEqual(snapshot.supportedRecipes, ["conditionOnHit", "selfTargetLight", "multiActivityResource", "daeTransferEffect", "animationVisual"]);
  assert.deepEqual(snapshot.providerContext.settings, {
    midiQolAutomation: true,
    itemMacroAutomation: true,
    daeAutomation: true,
    authorizeGeneratedAutomation: false
  });
  assert.equal(snapshot.warnings.length, 2);
  assert.deepEqual(snapshot.modules.find(module => module.id === "midi-qol"), { id: "midi-qol", active: true, version: "14.0.11" });
});

test("capability snapshots do not advertise dependency-bound recipes when disabled", () => {
  const snapshot = buildAutomationCapabilitySnapshot({ game: fakeGame(), config: {} });
  assert.deepEqual(snapshot.supportedRecipes, ["multiActivityResource", "animationVisual"]);
});
