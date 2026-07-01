import assert from "node:assert/strict";
import {
  FEATURE_IDS,
  TIER_IDS,
  featureLabel,
  featuresForTier,
  getTier,
  listTiers,
  supportsFeature
} from "../scripts/tier-catalog.js";

const tiers = listTiers();
assert.equal(tiers.length, 5);
assert.deepEqual(tiers.map(tier => tier.id), TIER_IDS);

assert.equal(getTier("apprentice")?.label, "Apprentice");
assert.equal(getTier("foundingPatron")?.priceUsdMonthly, 49.99);
assert.equal(getTier("missing"), null);

assert.equal(supportsFeature("apprentice", FEATURE_IDS.BASIC_ITEMS), true);
assert.equal(supportsFeature("apprentice", FEATURE_IDS.MIDI_QOL), false);
assert.equal(supportsFeature("master", FEATURE_IDS.MIDI_QOL), true);
assert.equal(supportsFeature("foundingPatron", FEATURE_IDS.IMAGE_GENERATION), true);
assert.equal(supportsFeature("journeyman", FEATURE_IDS.MONKS_ACTIVE_TILES), false);

assert.deepEqual(featuresForTier("adept"), [
  FEATURE_IDS.BASIC_ITEMS,
  FEATURE_IDS.CUSTOM_PASSIVES,
  FEATURE_IDS.ACTIVE_EFFECTS_BASIC,
  FEATURE_IDS.SRD_SPELLS_4
]);

assert.equal(featureLabel(FEATURE_IDS.ACTIVITY_MACRO), "Activity Macro compatibility");
assert.equal(featureLabel("unknownFeature"), "unknownFeature");

assert.throws(() => supportsFeature("missing", FEATURE_IDS.BASIC_ITEMS), /Unknown Forge tier/);
assert.throws(() => featuresForTier("missing"), /Unknown Forge tier/);

export const testedTierCatalogCount = 14;
