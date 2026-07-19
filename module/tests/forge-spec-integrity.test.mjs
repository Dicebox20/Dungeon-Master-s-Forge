import assert from "node:assert/strict";
import { sanitizeForgeSpec } from "../scripts/forge-spec-integrity.js";

const result = sanitizeForgeSpec({
  name: "Malformed Bulwark",
  weight: { value: "6", units: "lb" },
  effects: [{ changes: [] }, null, "invalid"],
  passiveEffects: [{ effectId: "not-valid", name: "" }],
  utilityActivities: [{ activityId: "short", activityName: "" }, null],
  saveActivities: [{ activityName: "Save 1" }],
  summonActivity: {
    activityId: "summon-short",
    activityName: "Summon Elemental",
    summonProfiles: [
      { profileId: "airElemB8A20", profileName: "Air Elemental" },
      { profileId: "earthElemB8A20", profileName: "Earth Elemental" }
    ]
  },
  unresolvedMechanics: [{ id: "short-unresolved", category: "review", label: "Review", requestedText: "Review", reason: "Review", handling: "Manual" }],
  toggleLight: { activityId: "bad", effectId: "also-bad" }
});

assert.equal(result.applied, true);
assert.equal(result.spec.weight, 6);
assert.equal(result.spec.effects.length, 1);
assert.equal(result.spec.effects[0].name, "Malformed Bulwark Effect");
assert.match(result.spec.effects[0].effectId, /^[A-Za-z0-9]{16}$/);
assert.equal(result.spec.utilityActivities.length, 1);
assert.equal(result.spec.utilityActivities[0].activityName, "Use Malformed Bulwark");
assert.match(result.spec.utilityActivities[0].activityId, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.saveActivities[0].activityId, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.summonActivity.activityId, /^[A-Za-z0-9]{16}$/);
assert.ok(result.spec.summonActivity.summonProfiles.every(profile => /^[A-Za-z0-9]{16}$/.test(profile.profileId)));
assert.match(result.spec.unresolvedMechanics[0].id, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.toggleLight.activityId, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.toggleLight.effectId, /^[A-Za-z0-9]{16}$/);
assert.equal(sanitizeForgeSpec(result.spec).applied, false);

const duplicateIds = sanitizeForgeSpec({
  name: "Duplicate Activity Suite",
  utilityActivities: [
    { activityId: "0000000000000000", activityName: "Detect Thoughts" },
    { activityId: "0000000000000000", activityName: "Clairvoyance" }
  ],
  saveActivities: [{ activityId: "0000000000000000", activityName: "Cone of Cold" }],
  summonActivity: { activityId: "0000000000000000", activityName: "Summon Owl" }
});
const repairedIds = [
  ...duplicateIds.spec.utilityActivities,
  ...duplicateIds.spec.saveActivities,
  duplicateIds.spec.summonActivity
].map(activity => activity.activityId);
assert.equal(new Set(repairedIds).size, repairedIds.length);
assert.ok(repairedIds.every(id => /^[A-Za-z0-9]{16}$/.test(id) && !/^0+$/.test(id)));
assert.equal(duplicateIds.applied, true);

export const testedForgeSpecIntegrityCases = 11;
