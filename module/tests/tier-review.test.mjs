import assert from "node:assert/strict";
import { compileItemRequest } from "../scripts/request-compiler.js";
import { reviewTierFit } from "../scripts/tier-review.js";

const summon = compileItemRequest("Create a rare item that summons a friendly wolf once per long rest.");
const summonReview = reviewTierFit(summon.specs, "journeyman");
assert.equal(summonReview.noteCount, 1);
assert.equal(summonReview.items[0].notes[0].requiredTierId, "master");

const poisonDagger = compileItemRequest(`
Nightvenom Fang
Legendary dagger requiring attunement. Its attacks deal an extra 1d4 poison damage.
The target must make a DC 13 Constitution save or be poisoned for 30 seconds.
`);
const poisonReview = reviewTierFit(poisonDagger.specs, "journeyman");
assert.deepEqual(
  poisonReview.items[0].notes.map(note => note.featureId).sort(),
  ["activityMacro", "advancedAutomation", "midiQol"]
);

const winterStaff = compileItemRequest(`
Staff of Winter's Judgment
Rare staff requiring attunement by a wizard. It has 10 charges and a spell save DC of 15.
It casts Ice Storm for 4 charges and Cone of Cold for 5 charges.
Ice Storm deals 2d8 bludgeoning plus 4d6 cold damage. Cone of Cold deals 8d8 cold damage. Half damage on a successful save.
The staff regains 1d6 + 4 charges daily at dawn.
`);
const adeptReview = reviewTierFit(winterStaff.specs, "adept");
assert.deepEqual(adeptReview.items[0].notes.map(note => note.featureId), ["multiActivityItems"]);

const masterReview = reviewTierFit(winterStaff.specs, "master");
assert.equal(masterReview.noteCount, 0);

export const testedTierReviewCount = 6;
