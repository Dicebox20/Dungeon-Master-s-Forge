import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  SAFE_BEHAVIOR_TYPES,
  buildRegionBehaviorOperations,
  compileSceneRegionRequest,
  effectSourceItems,
  selectedRegionDocuments,
  validateSceneRegionPlan
} from "../scripts/scene-region-forge.js";

const releaseSweep = JSON.parse(fs.readFileSync(new URL("../../testing/scene-region-beta-v1-sweep.json", import.meta.url), "utf8"));

test("compiles a native multi-behavior Region request", () => {
  const plan = compileSceneRegionRequest('Make this magical difficult terrain, suppress weather, pause the game once, and display "The dream shifts" once.', {
    movementActions: ["walk", "fly"]
  });
  assert.deepEqual(plan.behaviors.map(entry => entry.type), [
    "dnd5e.difficultTerrain",
    "suppressWeather",
    "pauseGame",
    "displayScrollingText"
  ]);
  assert.equal(plan.behaviors[0].system.magical, true);
  assert.equal(plan.behaviors[2].system.once, true);
  assert.equal(plan.behaviors[3].system.text, "The dream shifts");
});

test("uses explicit movement multipliers instead of duplicating difficult terrain", () => {
  const plan = compileSceneRegionRequest("Movement costs 3x inside this rubble field.", {
    movementActions: ["walk", "fly"]
  });
  assert.equal(plan.behaviors.length, 1);
  assert.equal(plan.behaviors[0].type, "modifyMovementCost");
  assert.deepEqual(plan.behaviors[0].system.difficulties, { walk: 3, fly: 3 });
});

test("links selected item Active Effects through the native behavior", () => {
  const plan = compileSceneRegionRequest("Apply the selected item's buff while a token is inside the aura.", {
    effectSourceName: "Dreamward Cloak",
    effectUuids: ["Item.abc.ActiveEffect.one", "Item.abc.ActiveEffect.two"]
  });
  assert.equal(plan.behaviors[0].type, "applyActiveEffect");
  assert.deepEqual(plan.behaviors[0].system.effects, ["Item.abc.ActiveEffect.one", "Item.abc.ActiveEffect.two"]);
  assert.match(plan.assumptions[0], /removes them on exit/i);
});

test("preserves an effect request as a warning when no item effect is selected", () => {
  const plan = compileSceneRegionRequest("Apply a buff inside this area and make it difficult terrain.");
  assert.equal(plan.behaviors.length, 1);
  assert.equal(plan.warnings.length, 1);
});

test("rejects executable Region requests and unsupported behavior types", () => {
  assert.throws(() => compileSceneRegionRequest("Execute a JavaScript script when a token enters."), /does not generate scripts/i);
  assert.throws(() => validateSceneRegionPlan({
    schemaVersion: "1.0",
    behaviors: [{ key: "script", type: "executeScript", system: {} }]
  }), /unsupported/i);
  assert.equal(SAFE_BEHAVIOR_TYPES.includes("executeScript"), false);
});

test("builds create, update, and Forge-owned delete operations without touching unrelated behaviors", () => {
  const current = [
    { id: "keep", type: "suppressWeather", flags: {}, system: {} },
    { id: "old-dark", type: "adjustDarknessLevel", flags: { "dungeon-masters-forge": { sceneRegion: { key: "darkness" } } }, system: {} },
    { id: "old-pause", type: "pauseGame", flags: { "dungeon-masters-forge": { sceneRegion: { key: "pause" } } }, system: {} }
  ];
  const plan = compileSceneRegionRequest("Set darkness to 0.8 and make this difficult terrain.");
  const operations = buildRegionBehaviorOperations(current, plan);
  assert.deepEqual(operations.updates.map(entry => entry._id), ["old-dark"]);
  assert.deepEqual(operations.creates.map(entry => entry.type), ["dnd5e.difficultTerrain"]);
  assert.deepEqual(operations.deletes, ["old-pause"]);
  assert.equal(operations.deletes.includes("keep"), false);
});

test("discovers one controlled Region and world items with enabled effects", () => {
  const region = { documentName: "Region", id: "r1" };
  assert.deepEqual(selectedRegionDocuments({ regions: { controlled: [{ document: region }] } }), [region]);
  const items = effectSourceItems({
    items: [
      { id: "i2", name: "No Effects", effects: [] },
      { id: "i1", name: "Aura Item", effects: [{ uuid: "Item.i1.ActiveEffect.e1", name: "Aura", disabled: false }] }
    ]
  });
  assert.deepEqual(items, [{
    id: "i1",
    name: "Aura Item",
    effects: [{ uuid: "Item.i1.ActiveEffect.e1", name: "Aura" }]
  }]);
});

test("compiles the 15-case tiered Scene Region Beta V1 release sweep", () => {
  assert.equal(releaseSweep.scenarios.length, 15);
  assert.deepEqual(
    Object.fromEntries(["simple", "medium", "complex"].map(tier => [tier, releaseSweep.scenarios.filter(entry => entry.tier === tier).length])),
    { simple: 5, medium: 5, complex: 5 }
  );
  for (const scenario of releaseSweep.scenarios) {
    const effectUuids = Array.from({ length: scenario.itemEffectCount }, (_, index) => `Item.${scenario.id}.ActiveEffect.effect${index + 1}`);
    const plan = compileSceneRegionRequest(scenario.regionRequest, {
      effectSourceName: `${scenario.id} item`,
      effectUuids,
      movementActions: ["walk", "fly", "swim"]
    });
    assert.deepEqual(plan.behaviors.map(entry => entry.type), scenario.expectedBehaviorTypes, scenario.id);
    validateSceneRegionPlan(plan);
  }
});
