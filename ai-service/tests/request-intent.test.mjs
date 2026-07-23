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

test("blank-line separated create prompts are treated as multi-item batches", () => {
  const intent = analyzeRequestIntent(
    "Create a rare dagger called Packfang Knife. It deals extra cold damage.\n\nCreate a rare spear called Stormsting Pike. It can unleash thunder.\n\nCreate a rare amulet called Heartglass Pendant. It heals."
  );
  assert.equal(intent.count, 3);
  assert.deepEqual(intent.chunks, [
    "Create a rare dagger called Packfang Knife. It deals extra cold damage.",
    "Create a rare spear called Stormsting Pike. It can unleash thunder.",
    "Create a rare amulet called Heartglass Pendant. It heals."
  ]);
});

test("blank-line separated title sentence prompts are treated as multi-item batches", () => {
  const intent = analyzeRequestIntent(
    "Stormglass Longbow. Very rare longbow +2. It deals an extra 1d6 lightning damage on a hit.\n\nBulwark of the Deep. Legendary shield +2. It can cast Tidal Wave from charges.\n\nLanternpoint Lance. Legendary lance +3. It can ignite to shed bright light."
  );
  assert.equal(intent.count, 3);
  assert.deepEqual(intent.chunks, [
    "Stormglass Longbow. Very rare longbow +2. It deals an extra 1d6 lightning damage on a hit.",
    "Bulwark of the Deep. Legendary shield +2. It can cast Tidal Wave from charges.",
    "Lanternpoint Lance. Legendary lance +3. It can ignite to shed bright light."
  ]);
});

test("ordinary multi-paragraph single-item requests are not split into a batch", () => {
  const intent = analyzeRequestIntent(
    "Create a rare crown called Sunwake Diadem. It grants +1 AC.\n\nWhile attuned, the wearer can cast Fly once per dawn."
  );
  assert.equal(intent.count, 1);
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

test("smart quotes around an explicit item name are presentation-only", () => {
  const payload = envelope({ request: "Item name: “Winterwake Staff [API-TEST-01]”\nBase item: Staff" });
  const request = validateForgeRequest(payload);
  const result = normalizeModelOutput({ specs: [weapon("Winterwake Staff [API-TEST-01]")] }, request);
  assert.equal(result.specs[0].name, "Winterwake Staff [API-TEST-01]");
});

test("mock mode returns one valid fixture per requested item", async () => {
  const request = validateForgeRequest(envelope({
    request: "Item name: Ember Edge\nDamage: fire\n\nItem name: Winter Edge\nDamage: cold"
  }));
  const result = await compileWithMock(request);
  assert.deepEqual(result.specs.map(spec => spec.name), ["Ember Edge", "Winter Edge"]);
  assert.equal(result.specs.length, 2);
});
