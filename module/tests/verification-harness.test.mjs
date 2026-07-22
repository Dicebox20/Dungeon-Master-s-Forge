import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VERIFICATION_WORLD_ID,
  VERIFICATION_ACTOR_NAME,
  assertVerificationBoundary,
  buildVerificationExpectation,
  cleanupVerificationRun,
  compareDocumentToExpectation,
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
    minimumSummonProfiles: 2
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
    createItems: async (_specs, config) => {
      assert.equal(config.itemFolderName, "DMF Verification Items");
      assert.equal(config.actorFolderName, "DMF Verification Summons");
      assert.equal(config.replaceExistingWorldDocuments, false);
      return { items: [worldItem], actors: [] };
    }
  });
  assert.equal(report.passed, 1);
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
