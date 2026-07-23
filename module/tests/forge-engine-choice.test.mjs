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
globalThis.CONST ??= {
  DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 },
  TOKEN_DISPOSITIONS: { FRIENDLY: 1 }
};

const { activityNeedsTargetConfirmation, applyMidiQolActivityDefaults, clonedSrdSummonActorData, forceExplicitChoiceOnAttack, forceSummonUseConfirmation, isFriendlySummon, itemHasExplicitActivityChoices, multiActivityStaffActivityLists, normalizeActorAuraActivitySpec, normalizeSrdActorLookupName, partitionItemActivityChanges, suppressMidiTargetConfirmationForUtility } = await import("../scripts/forge-engine.js");

const forgeEngineSource = await (await import("node:fs/promises")).readFile(new URL("../scripts/forge-engine.js", import.meta.url), "utf8");
assert.doesNotMatch(
  forgeEngineSource,
  /img: activitySpec\.activityImg \?\? actorsByProfileId/,
  "Healing activities must not depend on summon-only actor state."
);
assert.match(
  forgeEngineSource,
  /const template = target\?\.template \?\? \{\};[\s\S]*const affects = target\?\.affects \?\? \{\};/,
  "Activity targets must tolerate an explicitly null target card."
);

assert.equal(itemHasExplicitActivityChoices({}), false);
assert.equal(itemHasExplicitActivityChoices({
  kind: "artifactWeaponHybrid",
  saveActivities: [{ activityId: "CastBurning12345" }]
}), true);

assert.deepEqual(
  partitionItemActivityChanges({
    "system.activities.Attack123": { type: "attack" },
    "-=system.activities.Old456": null,
    "flags.midi-qol.onUseMacroName": "[postActiveEffects]ActivityMacro-Attack123"
  }),
  {
    activityChanges: [["Attack123", { type: "attack" }]],
    activityDeletes: ["Old456"],
    otherChanges: { "flags.midi-qol.onUseMacroName": "[postActiveEffects]ActivityMacro-Attack123" }
  }
);
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

const guardedAttack = forceExplicitChoiceOnAttack(originalAttack, { midiQol: true });
assert.equal(originalAttack.otherActivityId, "");
assert.equal(guardedAttack.otherActivityId, "none");
assert.equal(guardedAttack.otherActivityUuid, "");
assert.equal(guardedAttack.midiProperties.triggeredActivityId, "none");
assert.equal(guardedAttack.midiProperties.otherActivityCompatible, true);

const summonWithConfirmation = forceSummonUseConfirmation({
  midiProperties: { forceConsumeDialog: "default", autoConsume: false }
}, { midiQol: true, profileCount: 3, useCost: 1 });
assert.equal(summonWithConfirmation.midiProperties.forceConsumeDialog, "always");
assert.equal(summonWithConfirmation.midiProperties.autoConsume, false);

assert.equal(
  forceSummonUseConfirmation({ midiProperties: { forceConsumeDialog: "default" } }, { midiQol: true, profileCount: 1, useCost: 1 }).midiProperties.forceConsumeDialog,
  "always"
);
assert.deepEqual(
  forceSummonUseConfirmation({ midiProperties: { forceConsumeDialog: "default" } }, { midiQol: true, profileCount: 3, useCost: 0 }),
  { midiProperties: { forceConsumeDialog: "default" } }
);

assert.equal(activityNeedsTargetConfirmation({ affects: { type: "self" } }), false);
assert.equal(activityNeedsTargetConfirmation({ affects: { type: "creature" } }), true);
assert.equal(activityNeedsTargetConfirmation({ prompt: true }), true);
assert.deepEqual(
  normalizeActorAuraActivitySpec({
    activityName: "Radiant Aura",
    range: { value: 30, units: "ft" },
    target: { template: { type: "sphere", size: 20, units: "ft" }, prompt: true }
  }),
  {
    activityName: "Radiant Aura",
    range: { value: null, units: "self" },
    target: {
      template: { type: "sphere", size: 20, units: "ft" },
      prompt: false,
      affects: { count: "1", type: "self", special: "Wielder's actor token" }
    }
  }
);
assert.deepEqual(
  applyMidiQolActivityDefaults({ name: "Unchanged" }, { enabled: false, target: { affects: { type: "creature" } }, useCost: 1 }),
  { name: "Unchanged" }
);
assert.deepEqual(
  applyMidiQolActivityDefaults({ name: "Focused Burst" }, { enabled: true, target: { affects: { type: "creature" } }, useCost: 1 }),
  {
    name: "Focused Burst",
    midiProperties: { confirmTargets: "always", forceConsumeDialog: "always" }
  }
);
assert.equal(suppressMidiTargetConfirmationForUtility({
  activityName: "Misty Step",
  target: { affects: { type: "space" } }
}), true);
assert.equal(suppressMidiTargetConfirmationForUtility({
  activityName: "Clairvoyance",
  target: { affects: { type: "space" }, prompt: true }
}), false);
assert.deepEqual(
  applyMidiQolActivityDefaults({ name: "Misty Step" }, {
    enabled: true,
    target: { affects: { type: "space" }, prompt: true },
    suppressTargetConfirmation: true
  }),
  { name: "Misty Step", midiProperties: { confirmTargets: "default" } }
);
assert.equal(isFriendlySummon({ description: "Summon a friendly black bear pal." }), true);
assert.equal(isFriendlySummon({ description: "Summon a hostile imp." }), false);
assert.equal(normalizeSrdActorLookupName("One Friendly Elephant"), "Elephant");
assert.equal(normalizeSrdActorLookupName("Friendly Worg"), "Worg");
assert.equal(normalizeSrdActorLookupName("Elephant"), "Elephant");

const clonedSrdActor = clonedSrdSummonActorData({
  name: "Pseudodragon",
  uuid: "Compendium.dnd5e.actors24.ActorPseudodragon",
  toObject: () => ({
    _id: "SourceActor000001",
    name: "Pseudodragon",
    img: "pseudodragon.webp",
    prototypeToken: { disposition: 0, texture: { src: "pseudodragon.webp" } },
    items: [{ _id: "SourceItem0000001", name: "Sting" }],
    effects: [{ _id: "SourceEffect00001", name: "Magic Resistance" }],
    flags: { dnd5e: { sourceId: "Compendium.dnd5e.actors24.ActorPseudodragon" } }
  })
}, { name: "Friendly Pseudodragon" }, { id: "ForgeSummons" }, { template: "srd-summon-actor", engine: "test" });
assert.equal(clonedSrdActor._id, undefined);
assert.equal(clonedSrdActor.items[0]._id, undefined);
assert.equal(clonedSrdActor.effects[0]._id, undefined);
assert.equal(clonedSrdActor.name, "Friendly Pseudodragon");
assert.equal(clonedSrdActor.folder, "ForgeSummons");
assert.equal(clonedSrdActor.prototypeToken.disposition, 1);
assert.equal(clonedSrdActor.flags.dnd5e.sourceId, "Compendium.dnd5e.actors24.ActorPseudodragon");
assert.equal(clonedSrdActor.flags["dungeon-masters-forge"].sourceActorName, "Pseudodragon");

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
