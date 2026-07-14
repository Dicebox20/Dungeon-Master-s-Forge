import assert from "node:assert/strict";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeObject(target, source, { inplace = true } = {}) {
  const output = inplace ? target : clone(target);
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const prior = output[key] && typeof output[key] === "object" && !Array.isArray(output[key]) ? output[key] : {};
      output[key] = mergeObject(prior, value, { inplace: false });
    } else {
      output[key] = value;
    }
  }
  return output;
}

globalThis.foundry ??= {
  utils: {
    deepClone: clone,
    mergeObject
  }
};

const { forceExplicitChoiceOnAttack, forceSummonUseConfirmation, itemHasExplicitActivityChoices, multiActivityStaffActivityLists } = await import("../scripts/forge-engine.js");

assert.equal(itemHasExplicitActivityChoices({}), false);
assert.equal(itemHasExplicitActivityChoices({
  kind: "artifactWeaponHybrid",
  saveActivities: [{ activityId: "CastBurning12345" }]
}), true);
assert.equal(itemHasExplicitActivityChoices({
  kind: "artifactWeaponHybrid",
  summonProfiles: [{ profileId: "SummonWolf000001" }]
}), true);

const originalAttack = {
  _id: "Attack0000000001",
  name: "Attack with Ashen Oath",
  otherActivityId: "",
  otherActivityUuid: "Compendium.example.activity",
  midiProperties: {
    otherActivityCompatible: true,
    triggeredActivityId: "Trigger000000001"
  }
};

const guardedAttack = forceExplicitChoiceOnAttack(originalAttack);
assert.equal(originalAttack.otherActivityId, "");
assert.equal(guardedAttack.otherActivityId, "none");
assert.equal(guardedAttack.otherActivityUuid, "");
assert.equal(guardedAttack.midiProperties.triggeredActivityId, "none");
assert.equal(guardedAttack.midiProperties.otherActivityCompatible, true);

const summonWithConfirmation = forceSummonUseConfirmation({
  midiProperties: { forceConsumeDialog: "default", autoConsume: false }
}, { profileCount: 3, useCost: 1 });
assert.equal(summonWithConfirmation.midiProperties.forceConsumeDialog, "always");
assert.equal(summonWithConfirmation.midiProperties.autoConsume, false);

assert.equal(
  forceSummonUseConfirmation({ midiProperties: { forceConsumeDialog: "default" } }, { profileCount: 1, useCost: 1 }).midiProperties.forceConsumeDialog,
  "always"
);
assert.deepEqual(
  forceSummonUseConfirmation({ midiProperties: { forceConsumeDialog: "default" } }, { profileCount: 3, useCost: 0 }),
  { midiProperties: { forceConsumeDialog: "default" } }
);

const staffActivities = multiActivityStaffActivityLists({
  activities: [{ activityId: "LegacySave000001", activityName: "Legacy Save", save: { ability: "dex", dc: 15 } }],
  attackActivities: [{ activityId: "SpellAttack000001", activityName: "Arc Bolt", type: "attack" }],
  saveActivities: [{ activityId: "BurningHands0001", activityName: "Burning Hands", save: { ability: "dex", dc: 15 } }],
  utilityActivities: [{ activityId: "LightPower000001", activityName: "Ignite Staff", type: "utility" }]
});
assert.deepEqual(staffActivities.attack.map(activity => activity.activityName), ["Arc Bolt"]);
assert.deepEqual(staffActivities.save.map(activity => activity.activityName), ["Burning Hands", "Legacy Save"]);
assert.deepEqual(staffActivities.utility.map(activity => activity.activityName), ["Ignite Staff"]);

console.log("forge-engine choice tests passed");
