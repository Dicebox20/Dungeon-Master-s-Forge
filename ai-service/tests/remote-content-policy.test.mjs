import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelOutput, validateForgeRequest } from "../src/contract.mjs";
import { MAX_STRING_LENGTH, validateRemoteContent } from "../src/remote-content-policy.mjs";
import { envelope } from "./helpers.mjs";

const request = validateForgeRequest(envelope());
const baseWeapon = {
  kind: "weaponExtraDamage",
  name: "Policy Blade",
  description: "A safe declarative item.",
  weaponType: "martialM",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
  extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["fire"] }]
};

test("remote specs cannot inject Item Macro source", () => {
  assert.throws(() => normalizeModelOutput({
    specs: [{
      ...baseWeapon,
      utilityActivities: [{ activityName: "Injected", macroCommand: "game.user.update({role: 4})" }]
    }]
  }, request), error => error.code === "unsafe_model_output" && /macroCommand/.test(error.message));
});

test("top-level Foundry flags are stripped before normalized output reaches Foundry", () => {
  const result = normalizeModelOutput({
    specs: [{ ...baseWeapon, flags: { "midi-qol": { onUseMacroName: "evil" } } }]
  }, request);
  assert.equal(result.specs[0].name, "Policy Blade");
  assert.equal("flags" in result.specs[0], false);
});

test("nested forbidden effect flags on aura-style output degrade into unresolved mechanics", () => {
  const auraRequest = validateForgeRequest(envelope({
    request: "Crown of Shared Aura\nLegendary crown requiring attunement. It emits a 30-foot aura granting allies +1 AC. It restores 1 sorcery point. It casts Fly once per dawn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "passiveEffectEquipment",
      name: "Crown of Shared Aura",
      rarity: "legendary",
      attunement: "required",
      description: "A legendary crown with a defensive aura and a reserve of magic.",
      equipmentType: "wondrous",
      effects: [{
        label: "Shared Aura",
        flags: { dae: { transfer: true }, "midi-qol": { aura: { radius: 30 } } },
        changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }]
      }]
    }]
  }, auraRequest);
  assert.equal(result.specs[0].name, "Crown of Shared Aura");
  assert.equal(result.specs[0].effects[0].flags, undefined);
  assert.deepEqual(
    result.specs[0].unresolvedMechanics.map(mechanic => mechanic.label),
    ["Ally-affecting aura", "Class-specific resource"]
  );
  assert.match(result.warnings.join(" | "), /ally auras/i);
  assert.match(result.deferred.join(" | "), /class-resource clause/i);
});

test("active HTML and JavaScript URLs are rejected", () => {
  assert.throws(() => normalizeModelOutput({
    specs: [{ ...baseWeapon, description: "<img src=x onerror=alert(1)>" }]
  }, request), /active script or event-handler markup/);
  assert.throws(() => normalizeModelOutput({
    specs: [{ ...baseWeapon, img: "javascript:alert(1)" }]
  }, request), /active script or event-handler markup/);
});

test("oversized and deeply nested model output is bounded", () => {
  assert.throws(() => validateRemoteContent("x".repeat(MAX_STRING_LENGTH + 1)), /string length limit/);
  let nested = { value: "end" };
  for (let index = 0; index < 30; index += 1) nested = { next: nested };
  assert.throws(() => validateRemoteContent(nested), /nesting limit/);
});

test("ordinary Command spell text and declarative fields remain allowed", () => {
  const result = normalizeModelOutput({
    specs: [{ ...baseWeapon, description: "The blade can cast Command once per dawn." }]
  }, request);
  assert.equal(result.specs[0].name, "Policy Blade");
});
