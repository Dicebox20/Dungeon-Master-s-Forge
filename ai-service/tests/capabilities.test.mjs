import assert from "node:assert/strict";
import test from "node:test";
import { serviceCapabilities } from "../src/capabilities.mjs";
import { KNOWN_SPEC_KINDS } from "../src/constants.mjs";
import { config } from "./helpers.mjs";

test("capabilities describe the stable Forge compatibility boundary", () => {
  const result = serviceCapabilities(config());
  assert.deepEqual(result.service, {
    name: "Dungeon Master's Forge AI Service",
    version: "1.3.0"
  });
  assert.equal(result.forge.schemaVersion, "1.0");
  assert.equal(result.forge.promptVersion, "1.0.0");
  assert.deepEqual(result.forge.supportedKinds, KNOWN_SPEC_KINDS);
  assert.deepEqual(result.request, {
    maxCharacters: 20000,
    maxItems: 10,
    unresolvedPolicies: ["review", "block"]
  });
});

test("capabilities keep executable and Hosted Forge providers disabled", () => {
  const features = serviceCapabilities(config()).features;
  assert.equal(features.reviewBeforeCreation, true);
  assert.equal(features.declarativeModelOutputOnly, true);
  assert.equal(features.executableModelOutput, false);
  assert.equal(features.hostedForge, false);
  assert.equal(features.publicFreeTier, false);
});

test("capabilities advertise an explicitly enabled public free tier", () => {
  const features = serviceCapabilities(config({ publicFreeTier: true })).features;
  assert.equal(features.hostedForge, true);
  assert.equal(features.publicFreeTier, true);
});
