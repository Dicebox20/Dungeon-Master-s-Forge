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

const { forceExplicitChoiceOnAttack, itemHasExplicitActivityChoices } = await import("../scripts/forge-engine.js");

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

console.log("forge-engine choice tests passed");
