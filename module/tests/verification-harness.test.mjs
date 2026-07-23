import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VERIFICATION_WORLD_ID,
  VERIFICATION_ACTOR_NAME,
  assertVerificationBoundary,
  buildVerificationExpectation,
  cleanupVerificationRun,
  compareDocumentToExpectation,
  createVerificationFixtureActors,
  executeVerificationMacro,
  normalizeRunTag,
  runVerificationHarness,
  verificationHarnessStatus
} from "../scripts/verification-harness.js";

test("the harness only permits an explicitly enabled GM in the exact test world", () => {
  assert.equal(DEFAULT_VERIFICATION_WORLD_ID, "dmf-test-world");
  assert.equal(VERIFICATION_ACTOR_NAME, "DMF Verification Actor");
  assert.equal(assertVerificationBoundary({
    enabled: true,
    isGM: true,
    worldId: "dmf-test-world",
    expectedWorldId: "dmf-test-world"
  }), true);
  assert.throws(() => assertVerificationBoundary({ enabled: false, isGM: true, worldId: "dmf-test-world" }), /Enable the isolated verification harness/);
  assert.throws(() => assertVerificationBoundary({ enabled: true, isGM: false, worldId: "dmf-test-world" }), /Only a GM/);
  assert.throws(() => assertVerificationBoundary({ enabled: true, isGM: true, worldId: "campaign-world" }), /restricted to the configured test world/);
});

test("run tags are bounded and cannot contain path or shell characters", () => {
  assert.equal(normalizeRunTag("B7-20260716.alpha"), "B7-20260716.alpha");
  assert.throws(() => normalizeRunTag("ab"), /Verification run tags/);
  assert.throws(() => normalizeRunTag("B7/cleanup"), /Verification run tags/);
});

test("the expectation card catches a missing requested activity, effect, use pool, or summon profile", () => {
  const expectation = buildVerificationExpectation({
    kind: "nativeMultiProfileSummon",
    name: "Test Horn B7",
    utilityActivities: [{ name: "Summon Ally" }],
    effects: [{ name: "Ward" }],
    charges: 3,
    summonProfiles: [{ name: "Wolf" }, { name: "Bear" }]
  });
  assert.deepEqual(expectation, {
    kind: "nativeMultiProfileSummon",
    name: "Test Horn B7",
    documentType: "",
    minimumActivities: 1,
    minimumEffects: 1,
    expectedUses: 3,
    minimumSummonProfiles: 2,
    automationRecipe: "",
    automationWorkflowPass: "",
    automationTargetSource: ""
  });

  const incomplete = compareDocumentToExpectation({
    name: "Test Horn B7",
    type: "equipment",
    flags: { "dungeon-masters-forge": { kind: "nativeMultiProfileSummon" } },
    system: { activities: new Map(), uses: { max: 2 } },
    effects: []
  }, expectation);
  assert.equal(incomplete.passed, false);
  assert.equal(incomplete.failures.length, 4);

  const complete = compareDocumentToExpectation({
    name: "Test Horn B7",
    type: "equipment",
    flags: { "dungeon-masters-forge": { kind: "nativeMultiProfileSummon" } },
    system: {
      activities: new Map([["summon", {
        profiles: new Map([["wolf", { name: "Wolf" }], ["bear", { name: "Bear" }]])
      }]]),
      uses: { max: 3 }
    },
    effects: [{ name: "Ward" }]
  }, expectation);
  assert.equal(complete.passed, true);
  assert.equal(complete.failures.length, 0);
  assert.equal(buildVerificationExpectation({ kind: "weaponExtraDamage", name: "Plain Blade" }).expectedUses, null);
});

test("the expectation card verifies safe automation metadata without executing it", () => {
  const spec = {
    kind: "weaponConditionOnHit",
    name: "Gravebell",
    automation: {
      recipe: "conditionOnHit",
      targetSource: "hitTargets",
      requires: ["midi-qol", "itemacro"]
    }
  };
  const expectation = buildVerificationExpectation(spec);
  const document = {
    name: "Gravebell",
    type: "weapon",
    flags: { "dungeon-masters-forge": { kind: "weaponConditionOnHit", automation: spec.automation } },
    system: { activities: new Map(), uses: { max: "" } },
    effects: []
  };
  assert.equal(compareDocumentToExpectation(document, expectation).passed, true);
  assert.throws(
    () => compareDocumentToExpectation({ ...document, flags: { "dungeon-masters-forge": { kind: "weaponConditionOnHit", automation: { ...spec.automation, script: "return 1" } } } }, expectation),
    /unsupported field/
  );
});

test("the expectation card checks sanitized activity kinds and Active Effect keys", () => {
  const expectation = buildVerificationExpectation({
    kind: "baselineStructureFixture",
    name: "Imported Shape Fixture",
    documentType: "equipment",
    expectedActivityTypes: ["attack", "save", "utility"],
    expectedEffectKeys: ["system.traits.dr.value", "system.attributes.init.roll.mode"]
  });
  const document = {
    name: "Imported Shape Fixture",
    type: "equipment",
    flags: { "dungeon-masters-forge": { kind: "baselineStructureFixture" } },
    system: {
      activities: new Map([
        ["attack", { type: "attack" }],
        ["save", { type: "save" }],
        ["utility", { type: "utility" }]
      ]),
      uses: { max: "" }
    },
    effects: [
      { changes: [{ key: "system.traits.dr.value", value: "cold" }] },
      { changes: [{ key: "system.attributes.init.roll.mode", value: "-1" }] }
    ]
  };
  assert.equal(compareDocumentToExpectation(document, expectation).passed, true);
  const missing = compareDocumentToExpectation({
    ...document,
    system: { ...document.system, activities: new Map([["attack", { type: "attack" }]]) },
    effects: []
  }, expectation);
  assert.equal(missing.passed, false);
  assert.equal(missing.failures.length, 4);
});

test("the expectation card preserves every declared automation route", () => {
  const expectation = buildVerificationExpectation({
    kind: "artifactWeaponHybrid",
    name: "Ashen Mercy",
    automationRoutes: [
      { recipe: "conditionOnHit" },
      { recipe: "selfTargetLight" }
    ]
  });
  const document = {
    name: "Ashen Mercy",
    type: "weapon",
    flags: {
      "dungeon-masters-forge": {
        kind: "artifactWeaponHybrid",
        automation: { recipe: "conditionOnHit" },
        automationRoutes: [{ recipe: "conditionOnHit" }, { recipe: "selfTargetLight" }]
      }
    },
    system: { activities: new Map(), uses: { max: "" } },
    effects: []
  };
  const result = compareDocumentToExpectation(document, expectation);
  assert.equal(result.passed, true, result.failures.join("; "));
  assert.deepEqual(result.actual.automationRecipes, ["conditionOnHit", "selfTargetLight"]);
});

test("status remains false outside the exact enabled GM boundary", () => {
  assert.deepEqual(verificationHarnessStatus({
    game: { world: { id: "campaign-world" }, user: { isGM: true } },
    enabled: true,
    expectedWorldId: "dmf-test-world"
  }), {
    enabled: true,
    currentWorldId: "campaign-world",
    expectedWorldId: "dmf-test-world",
    isolated: false,
    ready: false
  });
});

test("explicit macro execution is limited to the enabled GM test world and runs once", async () => {
  let executions = 0;
  const macro = {
    id: "macro-1",
    uuid: "Macro.macro-1",
    name: "DMF Macro [TEST-01]",
    folder: { name: "DMF Verification Macros" },
    async execute(args) {
      executions += 1;
      assert.deepEqual(args, { scope: "test" });
      return "executed";
    }
  };
  const game = {
    world: { id: "dmf-test-world" },
    user: { isGM: true },
    macros: [macro]
  };

  const report = await executeVerificationMacro({
    game,
    enabled: true,
    expectedWorldId: "dmf-test-world",
    macroName: macro.name,
    args: { scope: "test" }
  });
  assert.equal(executions, 1);
  assert.deepEqual(report, {
    executed: true,
    worldId: "dmf-test-world",
    macro: {
      id: "macro-1",
      uuid: "Macro.macro-1",
      name: "DMF Macro [TEST-01]",
      folder: "DMF Verification Macros"
    },
    result: "executed"
  });
  await assert.rejects(
    () => executeVerificationMacro({ game, enabled: false, expectedWorldId: "dmf-test-world", macroId: macro.id }),
    /Enable the isolated verification harness/
  );
});

test("fixture setup creates and then reuses only tagged SRD-backed test actors", async () => {
  const game = { world: { id: "dmf-test-world" }, user: { isGM: true }, folders: [], actors: [], items: [], packs: [] };
  const sourceNames = ["Priest", "Guard", "Goblin", "Wolf", "Ogre"];
  const sourceActors = new Map(sourceNames.map((name, index) => [name, {
    name,
    uuid: `Compendium.dnd5e.actors24.Actor.${index}`,
    toObject() { return { name: this.name, type: "npc", system: {}, flags: {}, ownership: {} }; }
  }]));
  game.packs.push({
    collection: "dnd5e.actors24",
    documentName: "Actor",
    metadata: { id: "dnd5e.actors24", type: "Actor" },
    async getIndex() { return sourceNames.map((name, index) => ({ name, _id: String(index) })); },
    async getDocument(id) { return sourceActors.get(sourceNames[Number(id)]); }
  });
  const folderFactory = {
    create: async data => {
      const folder = { ...data, id: `folder-${game.folders.length}` };
      game.folders.push(folder);
      return folder;
    }
  };
  const actorFactory = {
    create: async data => {
      const actor = {
        ...data,
        id: `actor-${game.actors.length}`,
        uuid: `Actor.actor-${game.actors.length}`,
        async setFlag(scope, key, value) { this.flags ??= {}; this.flags[scope] ??= {}; this.flags[scope][key] = value; },
        async delete() { const index = game.actors.indexOf(this); if (index >= 0) game.actors.splice(index, 1); }
      };
      game.actors.push(actor);
      return actor;
    }
  };

  const first = await createVerificationFixtureActors({
    game,
    Actor: actorFactory,
    Folder: folderFactory,
    enabled: true,
    expectedWorldId: "dmf-test-world",
    runTag: "ACTORS-01"
  });
  assert.equal(first.actors.length, 5);
  assert.equal(first.results.filter(result => result.status === "created").length, 5);
  assert.equal(game.actors.length, 6);
  assert.ok(first.actors.every(actor => actor.flags["dungeon-masters-forge"].verification.fixture === true));

  const second = await createVerificationFixtureActors({
    game,
    Actor: actorFactory,
    Folder: folderFactory,
    enabled: true,
    expectedWorldId: "dmf-test-world",
    runTag: "ACTORS-01"
  });
  assert.equal(second.actors.length, 5);
  assert.equal(second.results.filter(result => result.status === "reused").length, 5);
  assert.equal(game.actors.length, 6);
});

test("a run creates only tagged test copies and cleanup removes only the matching tag", async () => {
  const game = { world: { id: "dmf-test-world" }, user: { isGM: true }, folders: [], actors: [], items: [] };
  const remove = (list, value) => {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
  };
  const folderFactory = {
    create: async data => {
      const folder = { ...data, id: `folder-${game.folders.length}` };
      game.folders.push(folder);
      return folder;
    }
  };
  const actorFactory = {
    create: async data => {
      const actor = {
        ...data,
        id: "verification-actor",
        uuid: "Actor.verification-actor",
        items: [],
        async setFlag(scope, key, value) {
          this.flags ??= {};
          this.flags[scope] ??= {};
          this.flags[scope][key] = value;
        },
        async createEmbeddedDocuments(_type, entries) {
          const copies = entries.map((entry, index) => ({
            ...entry,
            id: `copy-${index}`,
            effects: [],
            system: { activities: new Map(), uses: { max: "" } },
            async delete() { remove(actor.items, this); }
          }));
          actor.items.push(...copies);
          return copies;
        }
      };
      game.actors.push(actor);
      return actor;
    }
  };
  const worldItem = {
    id: "world-item",
    uuid: "Item.world-item",
    name: "Tagged Blade",
    type: "weapon",
    flags: { "dungeon-masters-forge": { kind: "weaponExtraDamage" } },
    toObject() { return { name: this.name, type: this.type, flags: this.flags, effects: [], system: { activities: {}, uses: { max: "" } } }; },
    async setFlag(scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    },
    async delete() { remove(game.items, this); }
  };
  game.items.push(worldItem);
  const untouchedItem = { name: "Campaign Item", flags: {}, async delete() { throw new Error("Campaign item must not be deleted"); } };
  game.items.push(untouchedItem);

  const report = await runVerificationHarness({
    game,
    Actor: actorFactory,
    Folder: folderFactory,
    enabled: true,
    expectedWorldId: "dmf-test-world",
    runTag: "B7-safe",
    specs: [{ kind: "weaponExtraDamage", name: "Tagged Blade" }],
    capabilitySnapshot: { version: "1.0", activeModules: ["midi-qol"], runtime: { activityTypes: ["attack"] } },
    createItems: async (_specs, config) => {
      assert.equal(config.itemFolderName, "DMF Verification Items");
      assert.equal(config.actorFolderName, "DMF Verification Summons");
      assert.equal(config.replaceExistingWorldDocuments, false);
      return { items: [worldItem], actors: [] };
    }
  });
  assert.equal(report.passed, 1);
  assert.deepEqual(report.capabilitySnapshot.runtime.activityTypes, ["attack"]);
  assert.equal(report.documentSnapshots[0].name, "Tagged Blade");
  assert.equal(report.checks[0].documentSnapshot.source.name, "Tagged Blade");
  assert.equal(game.actors.length, 1);
  assert.equal(game.actors[0].items.length, 1);

  const cleanup = await cleanupVerificationRun({ game, runTag: "B7-safe" });
  assert.deepEqual(cleanup, {
    runTag: "B7-safe",
    deletedEmbeddedItems: 1,
    deletedWorldItems: 1,
    deletedActors: 0
  });
  assert.equal(game.items.length, 1);
  assert.equal(game.items[0], untouchedItem);
  assert.equal(game.actors[0].items.length, 0);
});

test("summon actors receive the run tag before harness evidence is returned", async () => {
  const game = { world: { id: "dmf-test-world" }, user: { isGM: true }, folders: [], actors: [], items: [] };
  const folderFactory = { create: async data => ({ ...data, id: `folder-${game.folders.length}` }) };
  const actorFactory = { create: async data => ({
    ...data,
    id: "verification-actor",
    uuid: "Actor.verification-actor",
    items: [],
    async setFlag(scope, key, value) { this.flags ??= {}; this.flags[scope] ??= {}; this.flags[scope][key] = value; },
    async createEmbeddedDocuments() { return []; }
  }) };
  const summon = {
    name: "Friendly Owl",
    uuid: "Actor.summon",
    flags: {},
    async update(data) { Object.assign(this, data); },
    async setFlag(scope, key, value) { this.flags[scope] ??= {}; this.flags[scope][key] = value; }
  };
  const item = { name: "Tagged Item [B13-safe]", uuid: "Item.tagged", flags: {}, type: "equipment", system: { activities: new Map(), uses: { max: "" } }, effects: [], toObject() { return this; }, async setFlag(scope, key, value) { this.flags[scope] ??= {}; this.flags[scope][key] = value; } };
  const report = await runVerificationHarness({
    game, Actor: actorFactory, Folder: folderFactory, enabled: true, expectedWorldId: "dmf-test-world", runTag: "B13-safe",
    specs: [{ kind: "passiveEffectEquipment", name: item.name }],
    createItems: async () => ({ items: [item], actors: [summon] })
  });
  assert.equal(summon.name, "Friendly Owl [B13-safe]");
  assert.equal(report.summonActors[0].name, "Friendly Owl [B13-safe]");
});

export const testedVerificationHarnessCases = 5;
