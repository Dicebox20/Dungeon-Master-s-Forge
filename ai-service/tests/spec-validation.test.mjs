import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelOutput, validateForgeRequest } from "../src/contract.mjs";
import { actor, damage, ids, uses, validSpecs } from "./fixtures/valid-specs.mjs";
import { envelope } from "./helpers.mjs";

test("all fourteen remote Forge families pass provider-side structure validation", () => {
  for (const spec of validSpecs) {
    const requestText = spec.kind === "nativeMultiProfileSummon"
      ? "Create an item that can summon a friendly fiend; choose Demon, Devil, or Yugoloth."
      : spec.kind === "nativeSummon"
        ? "Create an item that can summon a friendly wolf."
        : "";
    const request = validateForgeRequest(requestText ? envelope({ request: requestText }) : envelope());
    const result = normalizeModelOutput({ specs: [spec] }, request, { makeId: ids() });
    assert.equal(result.specs[0].kind, spec.kind);
  }
});

test("missing family-specific fields are rejected with item context", () => {
  const request = validateForgeRequest(envelope());
  assert.throws(() => normalizeModelOutput({
    specs: [{ kind: "chargedSaveDamage", name: "Incomplete Wand", description: "Missing its save.", uses: uses(), damageParts: [damage()] }]
  }, request, { makeId: ids() }), /Incomplete Wand \(chargedSaveDamage\) requires save/);
});

test("empty complex suites cannot pass as functioning items", () => {
  const request = validateForgeRequest(envelope());
  assert.throws(() => normalizeModelOutput({
    specs: [{ kind: "legendaryEquipmentSuite", name: "Empty Crown", description: "No mechanics.", effects: [], utilityActivities: [], saveActivities: [] }]
  }, request, { makeId: ids() }), /at least one effect/);
});

test("generic summon profiles downgrade to a working single fallback companion", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a stone that can summon a companion."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeMultiProfileSummon",
      name: "Broken Stone",
      description: "Broken summon.",
      uses: uses(),
      summonProfiles: [{ profileName: "One", actor: actor("One") }]
    }]
  }, request, { makeId: ids() });
  assert.equal(result.specs[0].kind, "nativeSummon");
  assert.equal(result.specs[0].summonActor.name, "One");
  assert.equal(result.specs[0].summonActor.requireSrdActor, false);
});
