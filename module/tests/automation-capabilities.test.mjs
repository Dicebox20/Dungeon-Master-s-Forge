import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomationCapabilitySnapshot, resolveAutomationRoute } from "../scripts/automation-capabilities.js";

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
  assert.deepEqual(snapshot.modules.find(module => module.id === "midi-qol"), {
    id: "midi-qol",
    title: "Midi-QOL",
    active: true,
    version: "14.0.11",
    compatibility: null,
    requires: []
  });
  assert.deepEqual(resolveAutomationRoute("conditionOnHit", snapshot), {
    recipe: "conditionOnHit",
    layer: "Midi-QOL + Item Macro",
    selectedLayer: "Midi-QOL + Item Macro",
    dependencies: ["midi-qol", "itemacro"],
    dependencyLabels: ["Midi-QOL", "Item Macro"],
    dependencyStates: [
      { id: "midi-qol", label: "Midi-QOL", active: true, installed: true, version: "14.0.11" },
      { id: "itemacro", label: "Item Macro", active: true, installed: true, version: "3.0.1" }
    ],
    available: true,
    status: "available",
    fallback: "DND5e core attack and review note",
    missingModules: [],
    missingSettings: [],
    reason: "The advertised layer is available in this world."
  });
  assert.equal(snapshot.providerContext.routes.find(route => route.recipe === "conditionOnHit").selectedLayer, "Midi-QOL + Item Macro");
});

test("capability snapshots do not advertise dependency-bound recipes when disabled", () => {
  const snapshot = buildAutomationCapabilitySnapshot({ game: fakeGame(), config: {} });
  assert.deepEqual(snapshot.supportedRecipes, ["multiActivityResource", "animationVisual"]);
});

test("capability routing can select Item Macro independently while preserving combined dependencies", () => {
  const snapshot = buildAutomationCapabilitySnapshot({
    game: fakeGame(),
    config: { itemMacroAutomation: true }
  });
  assert.equal(snapshot.supportedRecipes.includes("conditionOnHit"), false);
  assert.equal(snapshot.supportedRecipes.includes("selfTargetLight"), true);
  assert.equal(resolveAutomationRoute("conditionOnHit", snapshot).selectedLayer, "DND5e core (fallback)");
  assert.equal(resolveAutomationRoute("selfTargetLight", snapshot).selectedLayer, "Item Macro");
});

test("capability snapshots capture version-safe runtime evidence without secrets", () => {
  const runtime = {
    CONFIG: { DND5E: { activityTypes: { save: {}, attack: {}, utility: {} } } },
    Hooks: { events: new Map([["dnd5e.preUseActivity", []], ["midi-qol.RollComplete", []], ["unrelated", []]]) },
    MidiQOL: {
      configSettings: () => ({
        enableWorkflow: true,
        autoApplyDamage: true,
        gmAutoDamage: false,
        secretKey: "must not be captured"
      })
    }
  };
  const snapshot = buildAutomationCapabilitySnapshot({ game: fakeGame(), runtime });
  assert.deepEqual(snapshot.runtime.activityTypes, ["attack", "save", "utility"]);
  assert.deepEqual(snapshot.runtime.hooks, ["dnd5e.preUseActivity", "midi-qol.RollComplete"]);
  assert.deepEqual(snapshot.runtime.midiQolSettings, {
    enableWorkflow: true,
    autoApplyDamage: true,
    gmAutoDamage: false
  });
  assert.equal(JSON.stringify(snapshot).includes("secretKey"), false);
});
