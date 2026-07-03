import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelOutput, validateForgeRequest } from "../src/contract.mjs";
import { envelope } from "./helpers.mjs";

function ids() {
  let value = 0;
  return () => String(++value).padStart(16, "0");
}

test("valid Forge 1.0 requests are normalized", () => {
  const result = validateForgeRequest(envelope());
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.context.systemId, "dnd5e");
  assert.equal(result.options.unresolvedPolicy, "review");
});

test("unknown client-supported kinds are rejected", () => {
  const payload = envelope();
  payload.context.supportedKinds.push("inventedFactory");
  assert.throws(() => validateForgeRequest(payload), /unknown or duplicate/);
});

test("request character limits are enforced before compilation", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "x".repeat(101) }), { maxRequestChars: 100 }),
    error => error.status === 413 && error.code === "request_too_large" && /100 character limit/.test(error.message)
  );
});

test("separator batches are rejected above the configured item limit", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "First item\n---\nSecond item\n---\nThird item" }), { maxItemsPerRequest: 2 }),
    error => error.status === 413 && error.code === "item_batch_too_large" && /contains 3 items/.test(error.message)
  );
});

test("repeated item-name batches are rejected above the configured item limit", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "Item name: One\n\nItem name: Two" }), { maxItemsPerRequest: 1 }),
    error => error.status === 413 && error.code === "item_batch_too_large" && /at most 1/.test(error.message)
  );
});

test("model output becomes the exact Forge response envelope", () => {
  const request = validateForgeRequest(envelope());
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Mind Crown",
      description: "A psionic crown.",
      attackActivities: [{
        activityName: "Mind Lance",
        damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["psychic"] }]
      }],
      effects: [{
        name: "Mental Ward",
        changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }]
      }],
      unresolvedMechanics: [{
        category: "tableAdjudication",
        label: "Echoing thought",
        requestedText: "Nearby thoughts echo.",
        reason: "Requires table judgment.",
        handling: "Resolve manually.",
        resolved: true
      }]
    }],
    assumptions: ["Uses Intelligence."],
    warnings: [],
    deferred: ["Echoing thought is manual."]
  }, request, { makeId: ids() });

  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.promptVersion, "1.0.0");
  assert.equal(result.requestCount, 1);
  assert.equal(result.specs[0].attackActivities[0].activityId, "0000000000000001");
  assert.equal(result.specs[0].effects[0].effectId, "0000000000000002");
  assert.equal(result.specs[0].unresolvedMechanics[0].id, "0000000000000003");
  assert.equal(result.specs[0].unresolvedMechanics[0].resolved, false);
  assert.equal(result.unresolvedMechanics[0].itemName, "Mind Crown");
});

test("pattern aliases normalize into Forge kinds", () => {
  const request = validateForgeRequest(envelope());
  const result = normalizeModelOutput({
    specs: [{
      pattern: "weaponExtraDamage",
      name: "Alias Blade",
      description: "A test weapon.",
      rarity: "uncommon",
      attunement: "",
      weaponType: "simpleM",
      baseItem: "dagger",
      properties: ["finesse", "light", "thrown", "magical"],
      damage: {
        base: { number: 1, denomination: "d4", bonus: "@mod", types: ["piercing"] },
        versatile: { number: null, denomination: null, bonus: "", types: [] }
      },
      range: { value: 20, long: 60, reach: 5, units: "ft" },
      mastery: "nick",
      extraDamageParts: [{ number: 1, denomination: "d4", bonus: "", types: ["fire"] }],
      attackName: "Alias Strike"
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "weaponExtraDamage");
  assert.deepEqual(result.specs[0].properties, ["fin", "lgt", "thr", "mgc"]);
  assert.equal(result.specs[0].damage.base.denomination, 4);
  assert.equal(result.specs[0].extraDamageParts[0].denomination, 4);
});

test("unsupported generated kinds cannot reach Foundry", () => {
  const request = validateForgeRequest(envelope());
  assert.throws(() => normalizeModelOutput({
    specs: [{ kind: "inventedFactory", name: "Bad Item" }]
  }, request), /unsupported Forge kind/);
});

test("malformed model IDs are replaced with trusted service IDs", () => {
  const request = validateForgeRequest(envelope());
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Bad Wand",
      description: "A wand with a malformed model-generated ID.",
      activityId: "short",
      uses: { max: "3", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] },
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 1, denomination: 6, bonus: "", types: ["fire"] }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].activityId, "0000000000000001");
});
