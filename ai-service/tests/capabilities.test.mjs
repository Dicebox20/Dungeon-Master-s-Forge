import assert from "node:assert/strict";
import test from "node:test";
import { serviceCapabilities } from "../src/capabilities.mjs";
import { COMPOSITIONAL_CAPABILITIES, KNOWN_SPEC_KINDS, PROMPT_VERSION } from "../src/constants.mjs";
import { config } from "./helpers.mjs";

test("capabilities describe the stable Forge compatibility boundary", () => {
  const result = serviceCapabilities(config());
  assert.deepEqual(result.service, {
    name: "Dungeon Master's Forge AI Service",
    version: "1.6.1"
  });
  assert.equal(result.forge.schemaVersion, "1.0");
  assert.equal(result.forge.promptVersion, PROMPT_VERSION);
  assert.deepEqual(result.forge.supportedKinds, KNOWN_SPEC_KINDS);
  assert.equal(result.forge.kindRole, "compatibility-renderer");
  assert.deepEqual(result.forge.compositionalCapabilities, COMPOSITIONAL_CAPABILITIES);
  assert.deepEqual(result.forge.automationContract.recipes, ["conditionOnHit", "selfTargetLight", "multiActivityResource", "daeTransferEffect", "animationVisual"]);
  assert.equal(result.forge.automationContract.declarativeOnly, true);
  assert.equal(result.metering.model, "usage-units");
  assert.deepEqual(result.request, {
    maxCharacters: 20000,
    maxItems: 10,
    unresolvedPolicies: ["review", "block"],
    cacheControlRefresh: true
  });
});

test("capabilities keep executable and Hosted Forge providers disabled", () => {
  const features = serviceCapabilities(config()).features;
  assert.equal(features.reviewBeforeCreation, true);
  assert.equal(features.repairRerun, true);
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
