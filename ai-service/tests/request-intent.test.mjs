import assert from "node:assert/strict";
import test from "node:test";
import { compileWithMock } from "../src/adapters/mock.mjs";
import { normalizeModelOutput, validateForgeRequest } from "../src/contract.mjs";
import { analyzeRequestIntent } from "../src/request-intent.mjs";
import { envelope } from "./helpers.mjs";

function weapon(name) {
  return {
    kind: "weaponExtraDamage",
    name,
    description: `${name} description`,
    weaponType: "martialM",
    damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
    extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["fire"] }]
  };
}

test("separator batches retain item boundaries", () => {
  const intent = analyzeRequestIntent("First blade\nFire damage\n---\nSecond blade\nCold damage");
  assert.equal(intent.count, 2);
  assert.deepEqual(intent.chunks, ["First blade\nFire damage", "Second blade\nCold damage"]);
});

test("repeated Item name fields preserve exact names and order", () => {
  const intent = analyzeRequestIntent("Item name: Ember Edge\nDamage: fire\n\nItem name: Winter Edge\nDamage: cold");
  assert.equal(intent.count, 2);
  assert.equal(intent.hasCompleteExplicitNames, true);
  assert.deepEqual(intent.explicitNames, ["Ember Edge", "Winter Edge"]);
});

test("model output cannot drop a requested batch item", () => {
  const payload = envelope({ request: "First blade\n---\nSecond blade" });
  const request = validateForgeRequest(payload);
  assert.throws(() => normalizeModelOutput({ specs: [weapon("First blade")] }, request), error =>
    error.code === "item_count_mismatch" && /contains 2 items/.test(error.message));
});

test("explicit item names cannot be silently rewritten", () => {
  const payload = envelope({ request: "Item name: Ember Edge\nDamage: fire" });
  const request = validateForgeRequest(payload);
  assert.throws(() => normalizeModelOutput({ specs: [weapon("Different Name")] }, request), error =>
    error.code === "item_name_mismatch" && /Ember Edge/.test(error.message));
});

test("mock mode returns one valid fixture per requested item", async () => {
  const request = validateForgeRequest(envelope({
    request: "Item name: Ember Edge\nDamage: fire\n\nItem name: Winter Edge\nDamage: cold"
  }));
  const result = await compileWithMock(request);
  assert.deepEqual(result.specs.map(spec => spec.name), ["Ember Edge", "Winter Edge"]);
  assert.equal(result.specs.length, 2);
});
