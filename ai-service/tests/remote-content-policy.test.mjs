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

test("remote specs cannot set Foundry flags or macro registration data", () => {
  assert.throws(() => normalizeModelOutput({
    specs: [{ ...baseWeapon, flags: { "midi-qol": { onUseMacroName: "evil" } } }]
  }, request), error => error.code === "unsafe_model_output" && /flags/.test(error.message));
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
