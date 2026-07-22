import assert from "node:assert/strict";
import { repairHybridSpecFromRequest } from "../scripts/hybrid-activity-repair.js";

const giantToothpickRequest = `Create a Longsword named "Giant's Toothpick" that gives a +2 magical bonus and does an additional 2d4 in poison damage. On a successful hit the target must make a DC 13 constitution saving throw or be poisoned for one minute. It has 12 charges that can be used to cast the spells poison spray, ray of sickness, and cloudkill with charges used based on spell level.`;
const giantToothpickRepair = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Giant's Toothpick",
  description: giantToothpickRequest,
  weaponType: "martialM",
  baseItem: "longsword",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
  extraDamageParts: [{ number: 2, denomination: 4, bonus: "", types: ["poison"] }],
  uses: { max: "12", recovery: [] },
  unresolvedMechanics: [{
    category: "unmappedSpell",
    label: "Spellcasting activities",
    requestedText: "It has 12 charges that can be used to cast the spells poison spray, ray of sickness, and cloudkill with charges used based on spell level.",
    reason: "The spell activities were not fully specified.",
    handling: "Review and add separate activities if needed.",
    resolved: false
  }],
  saveActivities: [],
  attackActivities: [],
  utilityActivities: []
}, giantToothpickRequest);

assert.equal(giantToothpickRepair.applied, true);
assert.deepEqual(
  giantToothpickRepair.spec.saveActivities.map(activity => [activity.activityName, activity.chargeCost]),
  [["Cast Poison Spray", 1], ["Cast Cloudkill", 5]]
);
assert.deepEqual(
  giantToothpickRepair.spec.attackActivities.map(activity => [activity.activityName, activity.chargeCost]),
  [["Cast Ray of Sickness", 1]]
);
assert.equal(giantToothpickRepair.spec.saveActivities[0].save.ability, "con");
assert.equal(giantToothpickRepair.spec.saveActivities[0].damageParts[0].types[0], "poison");
assert.equal(giantToothpickRepair.spec.saveActivities[1].target.template.type, "sphere");
assert.equal(giantToothpickRepair.spec.attackActivities[0].attackType, "ranged");
assert.equal(giantToothpickRepair.spec.unresolvedMechanics, undefined);

const malformedWeaponHybridRepair = repairHybridSpecFromRequest({
  kind: "weaponConditionOnHit",
  name: "Giant's Toothpick",
  description: giantToothpickRequest,
  weaponType: "martialM",
  baseItem: "longsword",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
  extraDamageParts: [{ number: 2, denomination: 4, bonus: "", types: ["poison"] }],
  uses: { max: "12", recovery: [] },
  unresolvedMechanics: [{
    category: "unmappedSpell",
    label: "Cloudkill",
    requestedText: "12 charges can be used to cast poison spray, ray of sickness, and cloudkill"
  }],
  saveActivities: [
    { activityName: "Poison Spray", save: { ability: "con", dc: 13 }, damageParts: [] },
    { activityName: "Ray of Sickness", save: { ability: "dex", dc: 13 }, damageParts: [] }
  ],
  attackActivities: [],
  utilityActivities: []
}, giantToothpickRequest);

assert.equal(malformedWeaponHybridRepair.spec.kind, "artifactWeaponHybrid");
assert.deepEqual(
  malformedWeaponHybridRepair.spec.saveActivities.map(activity => activity.activityName),
  ["Poison Spray", "Cast Cloudkill"]
);
assert.deepEqual(
  malformedWeaponHybridRepair.spec.attackActivities.map(activity => activity.activityName),
  ["Ray of Sickness"]
);
assert.equal(malformedWeaponHybridRepair.spec.attackActivities[0].attackType, "ranged");
assert.equal(malformedWeaponHybridRepair.spec.attackActivities[0].damageParts[0].types[0], "poison");
assert.equal(malformedWeaponHybridRepair.spec.unresolvedMechanics, undefined);

const explicitlyUnbound = repairHybridSpecFromRequest({
  ...malformedWeaponHybridRepair.spec,
  attunement: "required"
}, `${giantToothpickRequest} It does not require attunement.`);
assert.equal(explicitlyUnbound.spec.attunement, "");

const beaconrend = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Beaconrend",
  description: "A blazing glaive with command magic.",
  weaponType: "martialM",
  baseItem: "glaive",
  damage: { base: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } },
  extraDamageParts: [
    { number: 1, denomination: 6, bonus: "", types: ["fire"] },
    { number: 1, denomination: 6, bonus: "", types: ["lightning"] }
  ],
  utilityActivities: [
    { activityId: "Utility000000001", activityName: "Utility 1" },
    { activityId: "Utility000000002", activityName: "Utility 2" }
  ],
  toggleLight: {
    activityId: "Ignite0000000001",
    effectId: "LightFx000000001",
    bright: 20,
    dim: 40
  }
}, "Create a legendary glaive called Beaconrend. It is a +2 glaive that deals an extra 1d6 fire damage and 1d6 lightning damage on every hit. It has 4 charges and regains 1d4 charges daily at dawn. The wielder can spend 1 charge to cast Command at DC 16, or 2 charges to summon a friendly wolf for 1 hour. As a bonus action, the blade can ignite, shedding 20 feet of bright light and 20 feet of dim light.");

assert.equal(beaconrend.applied, true);
assert.equal(beaconrend.spec.saveActivities.length, 1);
assert.equal(beaconrend.spec.saveActivities[0].activityName, "Cast Command");
assert.equal(beaconrend.spec.saveActivities[0].chargeCost, 1);
assert.equal(beaconrend.spec.summonProfiles.length, 1);
assert.equal(beaconrend.spec.summonActivity.activityName, "Summon Wolf");
assert.equal(beaconrend.spec.summonActivity.chargeCost, 2);
assert.equal(beaconrend.spec.summonActivity.activationType, "action");
assert.equal(beaconrend.spec.utilityActivities.length, 0);

const shepherd = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Shepherd of the Ninth Bell",
  description: "A reliquary staff with restorative and summoning magic.",
  utilityActivities: [
    { activityId: "Utility000000003", activityName: "Utility 1" },
    { activityId: "Utility000000004", activityName: "Utility 2" }
  ]
}, "Create a rare staff called Shepherd of the Ninth Bell. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement.");

assert.equal(shepherd.applied, true);
assert.equal(shepherd.spec.baseItem, "quarterstaff");
assert.equal(shepherd.spec.weaponType, "simpleM");
assert.equal(shepherd.spec.utilityActivities[0].activityName, "Healing Touch");
assert.equal(shepherd.spec.utilityActivities[0].chargeCost, 1);
assert.equal(shepherd.spec.saveActivities[0].activityName, "Cast Shatter");
assert.equal(shepherd.spec.saveActivities[0].chargeCost, 2);
assert.equal(shepherd.spec.summonProfiles.length, 1);
assert.equal(shepherd.spec.summonActivity.activityName, "Summon Wolf");
assert.equal(shepherd.spec.summonActivity.chargeCost, 3);

const fiendStaff = repairHybridSpecFromRequest({
  kind: "casterUtilityEquipment",
  name: "Shepherd of the Ninth Bell",
  description: "A reliquary staff with restorative and fiend-summoning magic.",
  utilityActivities: [
    { activityId: "Utility000000005", activityName: "Utility 1" },
    { activityId: "Utility000000006", activityName: "Utility 2" }
  ]
}, "Create a very rare staff called Shepherd of the Ninth Bell. It grants +1 to spell attack rolls and spell save DC while attuned. It has 9 charges and regains 1d6 + 3 charges daily at dawn. The wielder can spend 1 charge to restore 2d8 + 3 hit points to a creature they touch, 3 charges to cast Shatter at DC 15, or 4 charges to summon a friendly fiend for 1 hour, choosing Demon, Devil, or Yugoloth.");

assert.equal(fiendStaff.applied, true);
assert.equal(fiendStaff.spec.baseItem, "quarterstaff");
assert.equal(fiendStaff.spec.utilityActivities[0].chargeCost, 1);
assert.equal(fiendStaff.spec.saveActivities[0].chargeCost, 3);
assert.equal(fiendStaff.spec.summonProfiles.length, 3);
assert.equal(fiendStaff.spec.summonActivity.activityName, "Summon Fiend");
assert.equal(fiendStaff.spec.summonActivity.chargeCost, 4);

const dawnmenderExistingHealing = repairHybridSpecFromRequest({
  kind: "casterUtilityEquipment",
  name: "Dawnmender's Spark [VIDEO-FF-02]",
  uses: { max: "6", recovery: [{ period: "longRest", type: "formula", formula: "1" }] },
  utilityActivities: [{
    activityId: "DawnmenderHeal01",
    activityName: "Restore Vitality",
    chargeCost: 6,
    range: { units: "self" },
    target: { affects: { count: "1", type: "self" }, prompt: false },
    healing: { number: 1, denomination: 6, bonus: "", types: ["healing"] }
  }]
}, "Create a Wand named \"Dawnmender's Spark [VIDEO-FF-02]\" with 6 charges. As an action, it can expend 1 charge to restore 2d8+3 hit points to one creature within 60 feet. All expended charges recover at long rest.");

assert.equal(dawnmenderExistingHealing.applied, true);
assert.deepEqual(dawnmenderExistingHealing.spec.utilityActivities[0].healing, {
  number: 2,
  denomination: 8,
  bonus: "3",
  types: ["healing"]
});
assert.equal(dawnmenderExistingHealing.spec.utilityActivities[0].chargeCost, 1);
assert.deepEqual(dawnmenderExistingHealing.spec.utilityActivities[0].range, { value: 60, units: "ft" });
assert.deepEqual(dawnmenderExistingHealing.spec.utilityActivities[0].target, {
  affects: { count: "1", type: "creature" },
  prompt: true
});

const elementalChoiceGrammar = repairHybridSpecFromRequest({
  kind: "nativeMultiProfileSummon",
  name: "Choirbone Flute",
  summonProfiles: [
    { profileId: "ElementalChoice01", profileName: "Air Elemental", actor: { name: "Friendly Elemental", srdActorName: "Elemental" } },
    { profileId: "ElementalChoice02", profileName: "Water Elemental", actor: { name: "Friendly Elemental", srdActorName: "Elemental" } }
  ],
  summonActivity: { activityId: "ElementalSummon01", activityName: "Summon Elemental" }
}, "The attuned bearer can activate the flute to summon a friendly elemental for 1 hour. The activator chooses Air Elemental or Water Elemental.");

assert.deepEqual(elementalChoiceGrammar.spec.summonProfiles.map(profile => profile.actor.srdActorName), ["Air Elemental", "Water Elemental"]);

const infernalCalling = repairHybridSpecFromRequest({
  kind: "casterUtilityEquipment",
  name: "Infernal Calling Stone",
  uses: { spent: 0, max: "1", recovery: [{ period: "lr", type: "recoverAll" }] },
  utilityActivities: [
    { activityId: "InfernalCall0001", activityName: "Infernal Calling" }
  ]
}, "Create a very rare wondrous item requiring attunement. Once per long rest, as an action, summon a friendly fiend spirit within 90 feet. Choose Demon, Devil, or Yugoloth. The summon lasts 1 hour and requires concentration.");

assert.equal(infernalCalling.applied, true);
assert.equal(infernalCalling.spec.kind, "nativeMultiProfileSummon");
assert.deepEqual(infernalCalling.spec.summonProfiles.map(profile => profile.profileName), ["Demon", "Devil", "Yugoloth"]);
assert.match(infernalCalling.spec.summonActivity.activityId, /^[A-Za-z0-9]{16}$/);
assert.equal(infernalCalling.spec.summonActivity.chargeCost, 1);
assert.equal(infernalCalling.spec.summonActivity.duration.concentration, true);
assert.deepEqual(infernalCalling.spec.utilityActivities, []);

const directInfernalCalling = repairHybridSpecFromRequest({
  kind: "nativeMultiProfileSummon",
  name: "Infernal Calling Stone",
  uses: { spent: 0, max: "1", recovery: [{ period: "lr", type: "recoverAll" }] },
  summonProfiles: [
    { profileId: "InfernalDemon001", profileName: "Demon", actor: { name: "Demon", type: "fiend" } },
    { profileId: "InfernalDevil001", profileName: "Devil", actor: { name: "Devil", type: "fiend" } },
    { profileId: "InfernalYugol001", profileName: "Yugoloth", actor: { name: "Yugoloth", type: "fiend" } }
  ],
  unresolvedMechanics: [{
    category: "unmappedSpell",
    label: "Infernal calling effect",
    reason: "The request does not provide a supported spell, summon profile, or declarative utility effect beyond limited-use casting."
  }]
}, "Once per long rest, as an action, summon a friendly fiend spirit within 90 feet. Choose Demon, Devil, or Yugoloth. The summon lasts 1 hour and requires concentration.");

assert.equal(directInfernalCalling.spec.kind, "nativeMultiProfileSummon");
assert.match(directInfernalCalling.spec.summonActivity.activityId, /^[A-Za-z0-9]{16}$/);
assert.equal(directInfernalCalling.spec.summonActivity.range.value, 90);
assert.equal(directInfernalCalling.spec.summonActivity.range.units, "ft");
assert.equal(directInfernalCalling.spec.summonActivity.duration.value, 1);
assert.equal(directInfernalCalling.spec.summonActivity.duration.units, "hour");
assert.equal(directInfernalCalling.spec.unresolvedMechanics, undefined);
assert.equal(directInfernalCalling.spec.summonActivity.duration.concentration, true);

const wardedInfernalCalling = repairHybridSpecFromRequest({
  kind: "casterUtilityEquipment",
  name: "Warded Infernal Calling Stone",
  uses: { spent: 0, max: "1", recovery: [{ period: "lr", type: "recoverAll" }] },
  effects: [{ effectId: "InfernalWard0001", name: "Infernal Ward", changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }] }],
  utilityActivities: [
    { activityId: "WardedCall000001", activityName: "Infernal Calling" }
  ]
}, "Create a very rare wondrous item. Once per long rest, summon a friendly fiend spirit within 90 feet. Choose Demon, Devil, or Yugoloth.");

assert.equal(wardedInfernalCalling.spec.kind, "casterUtilityEquipment");
assert.equal(wardedInfernalCalling.spec.effects.length, 1);

const cinderwake = repairHybridSpecFromRequest({
  kind: "shieldArmorBonus",
  name: "Cinderwake Aegis",
  description: "A rare shield with fire and weapon blessing powers.",
  armorValue: 2,
  magicalBonus: "1",
  equipmentType: "shield",
  baseItem: "shield"
}, "Create a rare shield called Cinderwake Aegis. It is a +1 shield that grants resistance to fire damage while equipped. Once per long rest, the bearer can use an action to enchant one nonmagical weapon for 1 hour so it becomes magical and deals an extra 1d4 radiant damage. It also has 3 charges, and the bearer can spend 1 charge to exhale a 15-foot cone of fire, dealing 4d6 fire damage with a DC 14 Dexterity save for half. It regains all charges at dawn.");

assert.equal(cinderwake.applied, true);
assert.equal(cinderwake.spec.kind, "equipmentPowerSuite");
assert.equal(cinderwake.spec.saveActivities.length, 1);
assert.equal(cinderwake.spec.saveActivities[0].activityName, "Breath Weapon");
assert.equal(cinderwake.spec.saveActivities[0].damageParts[0].number, 4);
assert.equal(cinderwake.spec.saveActivities[0].damageParts[0].denomination, 6);
assert.deepEqual(cinderwake.spec.saveActivities[0].damageParts[0].types, ["fire"]);
assert.equal(cinderwake.spec.utilityActivities.length, 1);
assert.ok(Array.isArray(cinderwake.spec.utilityActivities[0].enchantChanges));
assert.equal(cinderwake.spec.utilityActivities[0].activityName, "Bless a Weapon");

const malformedStorm = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Storm Herald",
  baseItem: "glaive",
  damage: { base: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } },
  saveActivities: [{
    activityId: "StormHeraldBad01",
    activityName: "Save 1",
    save: { ability: "con", dc: 16 },
    damageParts: [{ number: 4, denomination: 8, bonus: "", types: ["thunder"] }]
  }],
  utilityActivities: [{ activityId: "Utility000000007", activityName: "Utility 1" }]
}, "Create a legendary glaive called Storm Herald. It deals thunder and lightning damage on a hit. As an action, the wielder can unleash a 15-foot frontal cone of thunder and lightning. Creatures in the cone must make a DC 16 Constitution saving throw, taking 4d8 thunder damage on a failed save and half on a success.");

assert.equal(malformedStorm.applied, true);
assert.equal(malformedStorm.spec.saveActivities[0].activityName, "Breath Weapon");
assert.equal(malformedStorm.spec.saveActivities[0].target.template.type, "cone");
assert.equal(malformedStorm.spec.saveActivities[0].target.template.size, 15);
assert.equal(malformedStorm.spec.saveActivities[0].target.prompt, true);
assert.equal(malformedStorm.spec.utilityActivities.length, 0);

const reroutedStormUtility = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Glaive of Storm",
  baseItem: "glaive",
  utilityActivities: [{
    activityId: "UtilityStorm0001",
    activityName: "Utility 1",
    target: {
      template: { count: "1", type: "cone", size: 15, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 15-foot cone" },
      prompt: true
    },
    save: { ability: "con", dc: 16 },
    damageParts: [{ number: 4, denomination: 8, bonus: "", types: ["thunder"] }]
  }]
}, "Create a glaive with a 15-foot cone thunder burst.");

assert.equal(reroutedStormUtility.applied, true);
assert.equal(reroutedStormUtility.spec.utilityActivities.length, 0);
assert.equal(reroutedStormUtility.spec.saveActivities.length, 1);
assert.equal(reroutedStormUtility.spec.saveActivities[0].activityName, "Triggered Power");
assert.equal(reroutedStormUtility.spec.saveActivities[0].target.template.type, "cone");

const staleGrenadeTemplate = repairHybridSpecFromRequest({
  kind: "chargedSaveDamage",
  name: "Thunderclap Grenade",
  save: { ability: "dex", dc: 15 },
  damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["thunder"] }],
  range: { value: 20, units: "ft" },
  target: { template: { type: "burst", size: 5, units: "ft" }, prompt: true }
}, "Create a rare consumable projectile named Thunderclap Grenade. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere must make a DC 15 Constitution saving throw, taking 3d6 thunder damage on a failure, or half as much on a success. The grenade is consumed after one use.");

assert.equal(staleGrenadeTemplate.spec.range.value, 60);
assert.equal(staleGrenadeTemplate.spec.target.template.type, "sphere");
assert.equal(staleGrenadeTemplate.spec.target.template.size, 10);
assert.equal(staleGrenadeTemplate.spec.target.prompt, true);
assert.equal(staleGrenadeTemplate.spec.save.ability, "con");

const celestialGlaive = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Radiant Celestial Glaive",
  baseItem: "glaive",
  utilityActivities: [],
  saveActivities: []
}, "Create a very rare glaive that deals extra radiant damage, can summon a friendly celestial hound for 1 hour, and can cast Moonbeam from its charges.");

assert.equal(celestialGlaive.applied, true);
assert.equal(celestialGlaive.spec.saveActivities[0].activityName, "Cast Moonbeam");
assert.equal(celestialGlaive.spec.summonProfiles[0].profileName, "Celestial Hound");

const surveyorSpectacles = repairHybridSpecFromRequest({
  kind: "passiveEffectEquipment",
  name: "Surveyor Spectacles",
  effects: [{ name: "Surveyor Sight", changes: [
    { key: "system.skills.ith.prc", mode: "CUSTOM", value: "advantage" }
  ] }]
}, "Create spectacles that grant advantage on Intelligence (Investigation) checks and darkvision out to 60 feet.");
assert.ok(surveyorSpectacles.spec.effects.some(effect => effect.changes.some(change => change.key === "system.skills.inv.roll.mode")));
assert.ok(surveyorSpectacles.spec.effects.some(effect => effect.changes.some(change => change.key === "system.attributes.senses.ranges.darkvision")));
assert.equal(surveyorSpectacles.spec.effects.some(effect => effect.changes.some(change => change.key === "system.skills.ith.prc")), false);

const menagerieHorn = repairHybridSpecFromRequest({
  kind: "nativeMultiProfileSummon",
  name: "Menagerie Horn",
  summonProfiles: ["Giant Toad", "Giant Scorpion", "Rhinoceros"].map(profileName => ({
    profileName,
    actor: { name: "Friendly One Friendly Beast", srdActorName: "One Friendly Beast", type: "beast" }
  }))
}, "Pick one friendly beast: Giant Toad, Giant Scorpion, or Rhinoceros when it shows up.");
assert.deepEqual(menagerieHorn.spec.summonProfiles.map(profile => profile.actor.srdActorName), ["Giant Toad", "Giant Scorpion", "Rhinoceros"]);

const skeletalMenagerie = repairHybridSpecFromRequest({
  kind: "nativeMultiProfileSummon",
  name: "Skeletal Menagerie",
  summonProfiles: ["Skeleton", "Zombie"].map(profileName => ({
    profileName,
    actor: {
      name: "Friendly One Friendly Skeleton Or Zombie",
      srdActorName: "One Friendly Skeleton Or Zombie",
      type: "undead"
    }
  }))
}, "As an action, summon one friendly Skeleton or Zombie for 1 hour.");
assert.deepEqual(skeletalMenagerie.spec.summonProfiles.map(profile => profile.actor.srdActorName), ["Skeleton", "Zombie"]);
assert.deepEqual(skeletalMenagerie.spec.summonProfiles.map(profile => profile.actor.name), ["Friendly Skeleton", "Friendly Zombie"]);

const placeholderProfileMenagerie = repairHybridSpecFromRequest({
  kind: "nativeMultiProfileSummon",
  name: "Placeholder Profile Menagerie",
  summonProfiles: ["Dire Wolf", "Giant Spider"].map(profileName => ({
    profileName,
    actor: {
      name: "Friendly Profile When You Use The Item",
      srdActorName: "Profile When You Use The Item",
      type: "beast"
    }
  }))
}, "As an action, summon one friendly Dire Wolf or Giant Spider for 1 hour.");
assert.deepEqual(placeholderProfileMenagerie.spec.summonProfiles.map(profile => profile.actor.srdActorName), ["Dire Wolf", "Giant Spider"]);
assert.deepEqual(placeholderProfileMenagerie.spec.summonProfiles.map(profile => profile.actor.name), ["Friendly Dire Wolf", "Friendly Giant Spider"]);

const collapsedMenagerieHorn = repairHybridSpecFromRequest({
  kind: "nativeSummon",
  name: "Menagerie Horn",
  summonActor: { name: "Chosen Beast", srdActorName: "Chosen Beast", type: "beast" },
  unresolvedMechanics: [{ category: "beastChoice", reason: "Choose the beast at the table." }]
}, "Pick one friendly beast: Giant Toad, Giant Scorpion, or Rhinoceros.");
assert.equal(collapsedMenagerieHorn.spec.kind, "nativeMultiProfileSummon");
assert.deepEqual(collapsedMenagerieHorn.spec.summonProfiles.map(profile => profile.profileName), ["Giant Toad", "Giant Scorpion", "Rhinoceros"]);
assert.equal(collapsedMenagerieHorn.spec.unresolvedMechanics, undefined);

const frostwaveGuardian = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Frostwave Trident",
  baseItem: "trident",
  utilityActivities: [],
  saveActivities: []
}, "Create a trident that can summon a friendly reef shark while in water or a wolf on land.");

assert.equal(frostwaveGuardian.applied, true);
assert.equal(frostwaveGuardian.spec.utilityActivities.length, 2);
assert.deepEqual(frostwaveGuardian.spec.utilityActivities.map(activity => activity.activityName), ["Summon Reef Shark", "Summon Wolf"]);
assert.deepEqual(frostwaveGuardian.spec.utilityActivities.map(activity => activity.summonProfiles[0].profileName), ["Reef Shark", "Wolf"]);
assert.equal(frostwaveGuardian.spec.summonProfiles, undefined);
assert.equal(frostwaveGuardian.spec.summonActivity, undefined);

const frostwaveHybrid = repairHybridSpecFromRequest({
  kind: "weaponExtraDamage",
  name: "Frostwave Trident",
  description: "A trident with cold power, fog magic, and a guardian summon.",
  baseItem: "trident",
  weaponType: "martialM",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } },
  extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["cold"] }]
}, "Create a rare trident called Frostwave Trident. It deals an extra 1d6 cold damage on hit, can cast Fog Cloud from its charges, and once per long rest can summon a friendly reef shark while in water or a wolf on land.");

assert.equal(frostwaveHybrid.applied, true);
assert.equal(frostwaveHybrid.spec.kind, "artifactWeaponHybrid");
assert.equal(frostwaveHybrid.spec.utilityActivities.length, 3);
assert.equal(frostwaveHybrid.spec.utilityActivities[0].activityName, "Cast Fog Cloud");
assert.equal(frostwaveHybrid.spec.utilityActivities[1].activityName, "Summon Reef Shark");
assert.equal(frostwaveHybrid.spec.utilityActivities[2].activityName, "Summon Wolf");
assert.equal(frostwaveHybrid.spec.summonProfiles, undefined);
assert.equal(frostwaveHybrid.spec.summonActivity, undefined);

const quietThunder = repairHybridSpecFromRequest({
  kind: "weaponExtraDamage",
  name: "Mace of Quiet Thunder",
  baseItem: "mace",
  weaponType: "simpleM",
  extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["thunder"] }]
}, "Create a rare magical mace that grants +1 to attack and damage rolls. On a hit, the target must succeed on a DC 13 Constitution saving throw or be deafened until the start of your next turn.");

assert.equal(quietThunder.spec.kind, "weaponConditionOnHit");
assert.equal(quietThunder.spec.conditionOnHit.condition, "deafened");
assert.equal(quietThunder.spec.conditionOnHit.durationSeconds, 6);

const wolfcall = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Wolfcall Trident",
  baseItem: "trident",
  weaponType: "martialM",
  uses: { max: "1", recovery: [{ period: "lr", type: "recoverAll" }] }
}, "Once per long rest, as an action, it summons a friendly wolf within 30 feet for 1 hour.");

assert.equal(wolfcall.spec.summonActivity.activityName, "Summon Wolf");
assert.equal(wolfcall.spec.summonActivity.chargeCost, 1);

const stormwake = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Stormwake Spear",
  extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["lightning"] }],
  saveActivities: [{
    activityId: "StormwakePower01",
    activityName: "Triggered Power",
    save: { ability: "dex", dc: 13 },
    damageParts: [{ number: 1, denomination: 6, bonus: "", types: ["lightning"] }]
  }, {
    activityId: "StormwakeWave001",
    activityName: "Cast Thunderwave",
    save: { ability: "con", dc: 13 },
    damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["thunder"] }]
  }]
}, "It deals an extra 1d6 lightning damage on a hit and can cast Thunderwave once per dawn at DC 13.");

assert.deepEqual(stormwake.spec.saveActivities.map(activity => activity.activityName), ["Cast Thunderwave"]);

const frostwaveSplitExistingSummon = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Frostwave Trident",
  utilityActivities: [{
    activityId: "CastFogCloud0001",
    activityName: "Cast Fog Cloud"
  }],
  summonProfiles: [
    {
      profileId: "FrostwaveTr7aaan",
      profileName: "Reef Shark",
      actor: { name: "Friendly Reef Shark", type: "beast", ac: 12, hp: { value: 22, max: 22 } }
    },
    {
      profileId: "FrostwaveTry84ns",
      profileName: "Wolf",
      actor: { name: "Friendly Wolf", type: "beast", ac: 13, hp: { value: 11, max: 11 } }
    }
  ],
  summonActivity: {
    activityId: "SummonGuardian01",
    activityName: "Summon Guardian Beast",
    activationType: "action",
    chargeCost: 3
  }
}, "Create a rare trident called Frostwave Trident. It deals an extra 1d6 cold damage on hit, can cast Fog Cloud from its charges, and once per long rest can summon a friendly reef shark while in water or a wolf on land.");

assert.equal(frostwaveSplitExistingSummon.applied, true);
assert.equal(frostwaveSplitExistingSummon.spec.utilityActivities.length, 3);
assert.deepEqual(
  frostwaveSplitExistingSummon.spec.utilityActivities.map(activity => activity.activityName),
  ["Cast Fog Cloud", "Summon Reef Shark", "Summon Wolf"]
);
assert.equal(frostwaveSplitExistingSummon.spec.utilityActivities[1].chargeCost, 3);
assert.equal(frostwaveSplitExistingSummon.spec.utilityActivities[2].chargeCost, 3);
assert.equal(frostwaveSplitExistingSummon.spec.utilityActivities[1].summonProfiles[0].profileName, "Reef Shark");
assert.equal(frostwaveSplitExistingSummon.spec.utilityActivities[2].summonProfiles[0].profileName, "Wolf");
assert.equal(frostwaveSplitExistingSummon.spec.summonProfiles, undefined);
assert.equal(frostwaveSplitExistingSummon.spec.summonActivity, undefined);
assert.equal(frostwaveSplitExistingSummon.spec.weaponType, "martialM");
assert.equal(frostwaveSplitExistingSummon.spec.baseItem, "trident");
assert.equal(frostwaveSplitExistingSummon.spec.damage.base.denomination, 6);
assert.equal(frostwaveSplitExistingSummon.spec.damage.versatile.denomination, 8);
assert.equal(frostwaveSplitExistingSummon.spec.range.long, 60);

const celestialDuplicateCleanup = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Radiant Celestial Glaive",
  baseItem: "glaive",
  summonProfiles: [{
    profileId: "CelestialHound01",
    profileName: "Celestial Hound",
    actor: { name: "Friendly Celestial Hound", type: "celestial", ac: 14, hp: { value: 22, max: 22 } }
  }],
  summonActivity: {
    activityId: "SummonHound0001",
    activityName: "Summon Celestial Hound"
  },
  utilityActivities: [{
    activityId: "SummonUtil000001",
    activityName: "Summon Celestial Hound"
  }],
  saveActivities: [],
  unresolvedMechanics: [{
    category: "summon",
    label: "Requested summon",
    requestedText: "Summon a friendly celestial hound.",
    reason: "The request includes a summon, but the generated item does not contain a Foundry summon payload."
  }]
}, "Create a very rare glaive called Radiant Celestial Glaive. It deals extra radiant damage, can summon a friendly celestial hound for 1 hour, and can cast Moonbeam from its charges.");

assert.equal(celestialDuplicateCleanup.applied, true);
assert.equal(celestialDuplicateCleanup.spec.utilityActivities.length, 0);
assert.equal(celestialDuplicateCleanup.spec.summonProfiles.length, 1);
assert.equal(celestialDuplicateCleanup.spec.summonActivity.activityName, "Summon Celestial Hound");
assert.equal(celestialDuplicateCleanup.spec.saveActivities[0].activityName, "Cast Moonbeam");
assert.equal(celestialDuplicateCleanup.spec.unresolvedMechanics, undefined);

const eclipseSovereign = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Eclipse Sovereign",
  baseItem: "longsword",
  weaponType: "martialM",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
  magicalBonus: "",
  saveActivities: [{
    activityId: "EclipseBoltBad01",
    activityName: "Eclipse Bolt",
    save: { ability: "dex", dc: 0 },
    damageParts: [{ number: 3, denomination: 10, bonus: "", types: ["radiant"] }]
  }],
  utilityActivities: []
}, `Create an artifact longsword named Eclipse Sovereign.

It is a magical longsword that requires attunement by a spellcaster or paladin.

1 charge: Eclipse Bolt. Make a ranged spell attack against one creature within 120 feet. On a hit, the target takes 3d10 radiant or necrotic damage, chosen when used.

3 charges: Summon Eclipse Hound. As an action, summon a shadow mastiff for 1 minute. It obeys the wielder and acts after the wielder's turn.

2 charges: Blessing of the Black Sun. Touch one weapon. For 1 hour, that weapon becomes magical and gains +1 to attack and damage rolls. It also deals an extra 1d4 necrotic damage on hit.`);

assert.equal(eclipseSovereign.applied, true);
assert.equal(eclipseSovereign.spec.magicalBonus, "1");
assert.equal(eclipseSovereign.spec.attackActivities[0].activityName, "Eclipse Bolt");
assert.equal(eclipseSovereign.spec.attackActivities[0].attackType, "ranged");
assert.equal(eclipseSovereign.spec.attackActivities[0].chargeCost, 1);
assert.equal(eclipseSovereign.spec.attackActivities[0].range.value, 120);
assert.equal(eclipseSovereign.spec.saveActivities.some(activity => activity.activityName === "Eclipse Bolt"), false);
assert.equal(eclipseSovereign.spec.summonActivity.activityName, "Summon Shadow Mastiff");
assert.equal(eclipseSovereign.spec.summonProfiles[0].profileName, "Shadow Mastiff");
assert.equal(eclipseSovereign.spec.summonProfiles[0].actor.srdActorName, "Shadow Mastiff");
assert.equal(eclipseSovereign.spec.summonProfiles[0].actor.requireSrdActor, true);
assert.equal(eclipseSovereign.spec.utilityActivities.some(activity => activity.activityName === "Apply Enchantment"), true);
assert.deepEqual(
  eclipseSovereign.spec.utilityActivities.find(activity => activity.activityName === "Apply Enchantment").enchantChanges.map(change => change.key),
  ["system.properties", "system.magicalBonus", "system.damage.parts"]
);

const namedSaveRecovery = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Eclipse Sovereign",
  baseItem: "longsword",
  weaponType: "martialM",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
  magicalBonus: "3",
  saveActivities: [
    {
      activityId: "TriggeredPower001",
      activityName: "Triggered Power",
      save: { ability: "dex", dc: 0 },
      damageParts: [{ number: 6, denomination: 6, bonus: "", types: ["fire"] }]
    },
    {
      activityId: "SecondaryEffect01",
      activityName: "Secondary Effect",
      save: { ability: "dex", dc: 0 },
      damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["radiant"] }]
    }
  ],
  utilityActivities: []
}, `Create an artifact longsword named Eclipse Sovereign.

2 charges: Shadowflame Cone. Each creature in a 15-foot cone must make a DC 17 Dexterity saving throw, taking 6d6 fire damage and 6d6 necrotic damage on a failed save, or half as much on a success.

3 charges: Starfall Burst. Choose a point within 120 feet. Each creature in a 20-foot-radius sphere must make a DC 17 Dexterity saving throw, taking 8d6 radiant damage on a failed save, or half as much on a success.`);

assert.equal(namedSaveRecovery.applied, true);
assert.deepEqual(
  namedSaveRecovery.spec.saveActivities.map(activity => activity.activityName),
  ["Shadowflame Cone", "Starfall Burst"]
);
assert.equal(namedSaveRecovery.spec.saveActivities.find(activity => activity.activityName === "Shadowflame Cone").target.template.type, "cone");
assert.equal(namedSaveRecovery.spec.saveActivities.find(activity => activity.activityName === "Starfall Burst").target.template.type, "sphere");
assert.equal(namedSaveRecovery.spec.saveActivities.find(activity => activity.activityName === "Starfall Burst").range.value, 120);

const frostwaveDualSummon = repairHybridSpecFromRequest({
  kind: "legendaryEquipmentSuite",
  name: "Frostwave Sovereign",
  baseItem: "trident",
  weaponType: "martialM",
  saveActivities: [{
    activityId: "TidalBurstSave01",
    activityName: "Triggered Power",
    save: { ability: "str", dc: 0 },
    damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["cold"] }]
  }],
  utilityActivities: []
}, `Create a legendary +2 magical trident called Frostwave Sovereign.

2 charges: Tidal Burst. Each creature in a 15-foot cone must make a DC 15 Strength saving throw, taking 4d6 cold damage on a failed save or half as much on a success.

4 charges: Summon Reef Shark, a friendly aquatic ally for 1 minute in water.
4 charges: Summon Wolf, a friendly terrestrial ally for 1 minute on land.`);

assert.equal(frostwaveDualSummon.applied, true);
assert.equal(frostwaveDualSummon.spec.saveActivities[0].activityName, "Tidal Burst");
assert.equal(frostwaveDualSummon.spec.utilityActivities.filter(activity => activity.activityName === "Summon Reef Shark").length, 1);
assert.equal(frostwaveDualSummon.spec.utilityActivities.filter(activity => activity.activityName === "Summon Wolf").length, 1);
assert.deepEqual(frostwaveDualSummon.spec.utilityActivities.find(activity => activity.activityName === "Summon Wolf").summonProfiles[0].actor, {
  name: "Friendly Wolf",
  srdActorName: "Wolf",
  requireSrdActor: true
});

const fallbackDefaults = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Fallback Shield",
  armorValue: 2,
  magicalBonus: "0",
  equipmentType: "shield",
  saveActivities: [{
    activityId: "FallbackSave0001",
    activityName: "Triggered Power",
    save: { ability: "dex", dc: 0 },
    damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }]
  }]
}, "Create a magical shield that exhales a 15-foot cone of fire.");

assert.equal(fallbackDefaults.applied, true);
assert.equal(fallbackDefaults.spec.magicalBonus, "1");
assert.equal(fallbackDefaults.spec.saveActivities[0].save.dc, 13);

const ashenPilgrimRider = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Ashen Pilgrim Staff",
  weaponType: "simpleM",
  baseItem: "quarterstaff",
  damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] } },
  magicalBonus: "1",
  saveActivities: [{
    activityId: "BurningHands0001",
    activityName: "Burning Hands",
    save: { ability: "dex", dc: 15 },
    damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]
  }]
}, "Create a rare quarterstaff. It grants +1 to attack and damage rolls and deals an extra 1d6 fire damage on each hit. It can cast Burning Hands.");

assert.equal(ashenPilgrimRider.applied, true);
assert.deepEqual(ashenPilgrimRider.spec.extraDamageParts, [
  { number: 1, denomination: 6, bonus: "", types: ["fire"] }
]);

const staffCastCostsAndTemplates = repairHybridSpecFromRequest({
  kind: "multiActivityStaff",
  name: "Staff of Tides and Thunder",
  baseItem: "staff",
  uses: { max: 8, recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
  saveActivities: [
    {
      activityId: "CastShatter00001",
      activityName: "Cast Shatter",
      activationType: "action",
      chargeCost: 0,
      range: { units: "self" },
      target: {
        affects: { count: "", type: "creature" },
        template: { type: "sphere", size: "10", count: "1", units: "ft" },
        prompt: false
      },
      save: { ability: "con", dc: 15 },
      damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
    },
    {
      activityId: "CastTidalWave01",
      activityName: "Cast Tidal Wave",
      activationType: "action",
      chargeCost: 0,
      range: { units: "self" },
      target: {
        affects: { count: "", type: "creature" },
        template: { type: "cube", size: "30", count: "1", units: "ft" },
        prompt: false
      },
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 4, denomination: 8, bonus: "", types: ["bludgeoning"] }]
    }
  ]
}, "Create a rare staff called Staff of Tides and Thunder. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 2 charges to cast Shatter with a DC 15 save, or spend 3 charges to cast Tidal Wave with a DC 15 save. It requires attunement.");

assert.equal(staffCastCostsAndTemplates.applied, true);
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[0].chargeCost, 2);
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[0].target.prompt, true);
assert.deepEqual(staffCastCostsAndTemplates.spec.saveActivities[0].range, { value: 60, units: "ft" });
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[0].target.template.type, "sphere");
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[0].target.template.size, 10);
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[0].damageOnSave, "half");
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[1].chargeCost, 3);
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[1].target.prompt, true);
assert.deepEqual(staffCastCostsAndTemplates.spec.saveActivities[1].range, { value: 120, units: "ft" });
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[1].target.template.type, "line");
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[1].target.template.size, 30);
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[1].target.template.width, 10);
assert.equal(staffCastCostsAndTemplates.spec.saveActivities[1].damageOnSave, "half");

const solarJudgmentPassives = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Solar Judgment",
  baseItem: "longsword",
  passiveEffects: [{
    effectId: "SolarFireResist1",
    name: "Fire Resistance",
    changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "fire" }]
  }]
}, "Create an artifact greatsword requiring attunement. It grants the wielder +1 AC and resistance to fire damage while attuned. As a bonus action, it can ignite as a bonus action to shed bright light for 20 feet and dim light for 20 more feet.");

assert.equal(solarJudgmentPassives.applied, true);
assert.equal(solarJudgmentPassives.spec.passiveEffects.length, 2);
assert.deepEqual(solarJudgmentPassives.spec.passiveEffects[1].changes, [
  { key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }
]);
assert.equal(solarJudgmentPassives.spec.toggleLight.activationType, "bonus");
assert.equal(solarJudgmentPassives.spec.toggleLight.bright, 20);
assert.equal(solarJudgmentPassives.spec.toggleLight.dim, 40);

const solarGenericResistance = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Solar Judgment",
  effects: [{
    effectId: "SolarFireResist1",
    name: "Fire Resistance",
    changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "fire" }]
  }]
}, "Create an artifact greatsword requiring attunement. It grants resistance to fire damage while attuned.");

assert.equal(solarGenericResistance.applied, true);
assert.equal(solarGenericResistance.spec.effects, undefined);
assert.deepEqual(solarGenericResistance.spec.passiveEffects, [{
  effectId: "SolarFireResist1",
  name: "Fire Resistance",
  changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "fire" }]
}]);

const nightfallDarkvision = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Nightfall Longbow",
  baseItem: "longbow"
}, "Create an artifact longbow requiring attunement. The wielder gains darkvision out to 60 feet while attuned.");

assert.equal(nightfallDarkvision.applied, true);
assert.deepEqual(nightfallDarkvision.spec.passiveEffects, [{
  effectId: nightfallDarkvision.spec.passiveEffects[0].effectId,
  name: "Nightfall Longbow Darkvision",
  changes: [{ key: "system.attributes.senses.ranges.darkvision", mode: "ADD", value: "60" }]
}]);

const coilstingRider = repairHybridSpecFromRequest({
  kind: "artifactWeaponHybrid",
  name: "Coilsting Glaive",
  extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["lightning"] }],
  saveActivities: [{
    activityId: "CoilstingSurge01",
    activityName: "Triggered Power",
    save: { ability: "con", dc: 14 },
    damageParts: [
      { number: 1, denomination: 6, bonus: "", types: ["lightning"] },
      { number: 3, denomination: 6, bonus: "", types: ["thunder"] }
    ]
  }]
}, "Create a glaive that deals an extra 1d6 lightning damage on every hit. Spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Constitution saving throw, taking 3d6 thunder damage on a failed save.");

assert.equal(coilstingRider.applied, true);
assert.deepEqual(coilstingRider.spec.saveActivities[0].damageParts, [
  { number: 3, denomination: 6, bonus: "", types: ["thunder"] }
]);

const namedCoilstingRider = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Coilsting Glaive",
  extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["lightning"] }],
  saveActivities: [{
    activityId: "CoilstingPulse01",
    activityName: "Coilsting Pulse",
    chargeCost: 1,
    save: { ability: "con", dc: 14 },
    damageParts: [
      { number: 1, denomination: 6, bonus: "", types: ["lightning"] },
      { number: 3, denomination: 6, bonus: "", types: ["thunder"] }
    ]
  }]
}, "Create a rare glaive that deals an extra 1d6 lightning damage on every hit. Spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Constitution saving throw, taking 3d6 thunder damage on a failed save or half as much on a success.");

assert.equal(namedCoilstingRider.applied, true);
assert.deepEqual(namedCoilstingRider.spec.saveActivities[0].damageParts, [
  { number: 3, denomination: 6, bonus: "", types: ["thunder"] }
]);

const mooncallSummon = repairHybridSpecFromRequest({
  kind: "nativeEnchant",
  name: "Mooncall Unguent",
  uses: { max: "1", spent: 0, recovery: [] }
}, "Create a consumable oil. When the oil is used, it also summons a friendly wolf for 10 minutes. The oil has 1 use and is consumed after use.");

assert.equal(mooncallSummon.applied, true);
assert.equal(mooncallSummon.spec.summonActivity.activityName, "Summon Wolf");
assert.equal(mooncallSummon.spec.summonActivity.duration.units, "minute");

const dragonomiconSummon = repairHybridSpecFromRequest({
  kind: "legendaryEquipmentSuite",
  name: "the Dragonomicon",
  uses: { max: "1", spent: 0, recovery: [{ period: "lr", type: "recoverAll" }] },
  unresolvedMechanics: [{
    category: "unmappedSpell",
    label: "draconic spell usage",
    requestedText: "Spell usage: uses charges",
    reason: "No specific spell, activity, or resolved spell effect was provided beyond a charge-based resource model."
  }]
}, "Create a Book named the Dragonomicon that can be used to summon a Pseudodragon as a companion. The book has 1 charge that recharges after a long rest.");

assert.equal(dragonomiconSummon.applied, true);
assert.equal(dragonomiconSummon.spec.summonActivity.activityName, "Summon Pseudodragon");
assert.equal(dragonomiconSummon.spec.summonActivity.chargeCost, 1);
assert.equal(dragonomiconSummon.spec.summonProfiles[0].actor.srdActorName, "Pseudodragon");
assert.equal(dragonomiconSummon.spec.summonProfiles[0].actor.requireSrdActor, true);
assert.equal(dragonomiconSummon.spec.unresolvedMechanics, undefined);

const owlbearSummon = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Bestiary Beacon",
  uses: { max: "1", spent: 0, recovery: [{ period: "lr", type: "recoverAll" }] }
}, "Create a beacon that can summon an Owlbear in an unoccupied space within 30 feet for 1 hour.");

assert.equal(owlbearSummon.applied, true);
assert.equal(owlbearSummon.spec.summonActivity.activityName, "Summon Owlbear");
assert.equal(owlbearSummon.spec.summonProfiles[0].actor.srdActorName, "Owlbear");
assert.equal(owlbearSummon.spec.summonProfiles[0].actor.requireSrdActor, true);

const callInLionSummon = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Gatecrash Harness",
  uses: { max: "12", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
  saveActivities: [
    { activityId: "HoldMonster00001", activityName: "Hold Monster", chargeCost: 4, save: { ability: "wis", dc: 17 } },
    { activityId: "Fly000000000001", activityName: "Fly", chargeCost: 3 }
  ],
  unresolvedMechanics: [{
    category: "summon",
    label: "Call Lion",
    requestedText: "Call in a friendly Lion for 1 hour",
    reason: "No summon actor was provided."
  }]
}, "Burn 4 charges to cast Hold Monster at DC 17, 3 charges to cast Fly, or 5 charges to call in a friendly Lion for 1 hour.");

assert.equal(callInLionSummon.applied, true);
assert.equal(callInLionSummon.spec.summonActivity.activityName, "Summon Lion");
assert.equal(callInLionSummon.spec.summonActivity.chargeCost, 5);
assert.equal(callInLionSummon.spec.summonProfiles[0].actor.srdActorName, "Lion");
assert.equal(callInLionSummon.spec.unresolvedMechanics, undefined);

const utilityPlaceholderCallInLion = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Gatecrash Harness",
  uses: { max: "12", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
  utilityActivities: [{
    activityId: "CallFriendlyLion1",
    activityName: "Call Friendly Lion",
    chargeCost: 5,
    duration: { value: 1, units: "hour" },
    target: { type: "self", value: 1, units: "ft" }
  }],
  unresolvedMechanics: [{
    category: "tableAdjudication",
    label: "Friendly Lion summon",
    requestedText: "Burn 5 charges to call in a friendly Lion for 1 hour.",
    reason: "No summon actor or summon profile statistics were provided."
  }]
}, "Burn 4 charges to cast Hold Monster at DC 17, 3 charges to cast Fly, or 5 charges to call in a friendly Lion for 1 hour.");

assert.equal(utilityPlaceholderCallInLion.applied, true);
assert.equal(utilityPlaceholderCallInLion.spec.utilityActivities.length, 0);
assert.equal(utilityPlaceholderCallInLion.spec.summonActivity.chargeCost, 5);
assert.equal(utilityPlaceholderCallInLion.spec.summonActivity.duration.value, 1);
assert.equal(utilityPlaceholderCallInLion.spec.summonProfiles[0].profileName, "Lion");
assert.equal(utilityPlaceholderCallInLion.spec.summonProfiles[0].actor.srdActorName, "Lion");
assert.equal(utilityPlaceholderCallInLion.spec.unresolvedMechanics, undefined);

const embeddedCallInLionSummon = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Gatecrash Harness",
  uses: { max: "12", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
  utilityActivities: [{
    activityId: "CallLion00000001",
    activityName: "Call Lion",
    chargeCost: 4,
    save: { ability: "dex", dc: 17 },
    damageParts: [],
    summonProfiles: [{
      profileId: "Companion0000001",
      profileName: "Companion",
      actor: { name: "Friendly Companion", type: "beast" }
    }]
  }],
  unresolvedMechanics: [{
    category: "summon",
    label: "Friendly Lion",
    requestedText: "Call in a friendly Lion for 1 hour",
    reason: "The exact actor stats are deferred."
  }]
}, "Burn 4 charges to cast Hold Monster at DC 17, 3 charges to cast Fly, or 5 charges to call in a friendly Lion for 1 hour.");

assert.equal(embeddedCallInLionSummon.applied, true);
assert.equal(embeddedCallInLionSummon.spec.utilityActivities[0].chargeCost, 5);
assert.equal(embeddedCallInLionSummon.spec.utilityActivities[0].duration.value, 1);
assert.equal(embeddedCallInLionSummon.spec.utilityActivities[0].duration.units, "hour");
assert.equal(embeddedCallInLionSummon.spec.utilityActivities[0].save, undefined);
assert.equal(embeddedCallInLionSummon.spec.utilityActivities[0].summonProfiles[0].profileName, "Lion");
assert.equal(embeddedCallInLionSummon.spec.utilityActivities[0].summonProfiles[0].actor.srdActorName, "Lion");
assert.equal(embeddedCallInLionSummon.spec.unresolvedMechanics, undefined);

const singlePlaceholderScorpion = repairHybridSpecFromRequest({
  kind: "nativeSummon",
  name: "Scorpioncall Seal",
  description: "As an action, summon one friendly Giant Scorpion for 1 hour using the exact D&D5e SRD actor profile.",
  summonProfiles: [{
    profileName: "Profile Separate",
    actor: { name: "Friendly Profile Separate", srdActorName: "Profile Separate", requireSrdActor: true }
  }],
  summonActivity: { activityName: "Summon Profile Separate", chargeCost: 2 }
}, "As an action, summon one friendly Giant Scorpion for 1 hour using the exact D&D5e SRD actor profile.");

assert.equal(singlePlaceholderScorpion.spec.summonProfiles[0].actor.srdActorName, "Giant Scorpion");
assert.equal(singlePlaceholderScorpion.spec.summonProfiles[0].actor.name, "Friendly Giant Scorpion");

const resolvedForceResistance = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Gatecrash Harness",
  effects: [{
    effectId: "ForceResist00001",
    name: "Force Resistance",
    changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "force" }]
  }],
  unresolvedMechanics: [{
    category: "tableAdjudication",
    label: "Force damage shrug off",
    requestedText: "The wearer can shrug off force damage.",
    reason: "This resistance clause was left for passive defensive review."
  }]
}, "The wearer can shrug off force damage.");

assert.equal(resolvedForceResistance.applied, true);
assert.equal(resolvedForceResistance.spec.unresolvedMechanics, undefined);

const whisperglassAttack = repairHybridSpecFromRequest({
  kind: "casterUtilityEquipment",
  name: "Whisperglass Circlet",
  utilityActivities: [{ activityId: "DetectThoughts0001", activityName: "Detect Thoughts" }],
  saveActivities: [{
    activityId: "PsychicDamage0001",
    activityName: "Detect Thoughts",
    save: { ability: "wis", dc: 15 },
    damageParts: [{ number: 4, denomination: 8, bonus: "", types: ["psychic"] }]
  }]
}, "Create a circlet. It can cast Detect Thoughts once per long rest. As an action, the wearer can spend 1 charge to make a ranged spell attack against one creature within 90 feet, dealing 4d8 psychic damage on a hit.");

assert.equal(whisperglassAttack.applied, true);
assert.equal(whisperglassAttack.spec.utilityActivities[0].duration.concentration, true);
assert.equal(whisperglassAttack.spec.attackActivities[0].activityName, "Psychic Bolt");
assert.equal(whisperglassAttack.spec.attackActivities[0].range.value, 90);
assert.equal(whisperglassAttack.spec.saveActivities.some(activity => activity.activityName === "Detect Thoughts"), false);

const defaultSaveDc = repairHybridSpecFromRequest({
  kind: "equipmentPowerSuite",
  name: "Default Save",
  saveActivities: [{ activityId: "DefaultSave00001", activityName: "Triggered Power", save: { ability: "dex" } }]
}, "Create an item with a Dexterity saving throw.");

assert.equal(defaultSaveDc.spec.saveActivities[0].save.dc, 13);

const owlglassLanguageRepair = repairHybridSpecFromRequest({
  kind: "passiveEffectEquipment",
  name: "Owlglass Lenses",
  attunement: "required",
  effects: [{
    effectId: "OwlglassEffect01",
    name: "Owlglass Sight",
    changes: [{
      key: "system.skills.prc.bonuses.check",
      mode: "CUSTOM",
      value: "advantage on Wisdom (Perception) checks"
    }]
  }]
}, "Create uncommon goggles called Owlglass Lenses. They grant advantage on Wisdom (Perception) checks. They do not require attunement.");
assert.equal(owlglassLanguageRepair.spec.attunement, "");
assert.equal(owlglassLanguageRepair.spec.effects[0].changes.some(change => change.key === "system.skills.prc.bonuses.check"), false);
assert.deepEqual(
  owlglassLanguageRepair.spec.effects[0].changes.find(change => change.key === "system.skills.prc.roll.mode"),
  { key: "system.skills.prc.roll.mode", mode: "ADD", value: "1" }
);

const spellcastingBonusRepair = repairHybridSpecFromRequest({
  kind: "casterUtilityEquipment",
  name: "Surveyor's Third Eye",
  effects: [{
    effectId: "SpellBonusRepair",
    name: "Spellcasting Bonus",
    changes: [
      { key: "system.bonuses.msak.attack", mode: "ADD", value: "1" },
      { key: "system.bonuses.spelldc", mode: "ADD", value: "1" }
    ]
  }]
}, "While worn, it grants +1 to spell attacks and spell save DC.");
assert.deepEqual(
  spellcastingBonusRepair.spec.effects[0].changes,
  [
    { key: "system.bonuses.msak.attack", mode: "ADD", value: "1" },
    { key: "system.bonuses.rsak.attack", mode: "ADD", value: "1" },
    { key: "system.bonuses.spell.dc", mode: "ADD", value: "1" }
  ]
);

const explicitArmorSuiteRepair = repairHybridSpecFromRequest({
  kind: "nativeSummon",
  name: "Bastion of the Quiet World",
  itemType: "equipment",
  armorType: "heavy",
  magicalBonus: 2,
  uses: { max: "18", recovery: [{ period: "dawn", type: "formula", formula: "1d10 + 8" }] },
  saveActivities: [{ activityId: "AntimagicField01", activityName: "Antimagic Field", chargeCost: 8 }],
  summonActor: { name: "Friendly Elephant", requireSrdActor: true, srdActorName: "Elephant" }
}, "Create legendary +2 plate armor. It has 18 charges, casts Antimagic Field and Power Word Stun, and can summon a friendly Elephant.");
assert.equal(explicitArmorSuiteRepair.spec.kind, "legendaryEquipmentSuite");
assert.ok(explicitArmorSuiteRepair.spec.summonProfiles?.some(profile => profile.profileName === "Elephant"));

const stormglassEnchantRepair = repairHybridSpecFromRequest({
  kind: "nativeEnchant",
  name: "Stormglass Oil",
  enchantChanges: [{ key: "system.properties", mode: "ADD", value: "mgc" }],
  unresolvedMechanics: [{
    category: "enchantment",
    label: "Weapon damage rider implementation",
    reason: "The weapon damage rider was not preserved."
  }]
}, "Apply this oil to a weapon. It becomes magical and deals an extra 1d4 lightning damage for 1 hour.");
assert.deepEqual(
  stormglassEnchantRepair.spec.enchantChanges.find(change => change.key === "system.damage.parts")?.value,
  { number: 1, denomination: 4, bonus: "", types: ["lightning"] }
);

const stormglassMalformedDamageRepair = repairHybridSpecFromRequest({
  kind: "nativeEnchant",
  name: "Stormglass Oil",
  enchantChanges: [
    { key: "system.properties", mode: "ADD", value: "mgc" },
    { key: "system.damage.parts", mode: "ADD", value: { damage: {} } }
  ],
  unresolvedMechanics: [{
    category: "tableAdjudication",
    label: "weapon enchantment timing",
    reason: "The underlying application workflow is table-facing."
  }]
}, "Apply this oil to a weapon. It becomes magical and deals an extra 1d4 lightning damage for 1 hour.");
assert.deepEqual(
  stormglassMalformedDamageRepair.spec.enchantChanges.filter(change => change.key === "system.damage.parts"),
  [{ key: "system.damage.parts", mode: "ADD", value: { number: 1, denomination: 4, bonus: "", types: ["lightning"] } }]
);
assert.deepEqual(stormglassMalformedDamageRepair.spec.unresolvedMechanics, []);
assert.equal(stormglassEnchantRepair.spec.unresolvedMechanics.length, 0);

const enchantSummonRepair = repairHybridSpecFromRequest({
  kind: "nativeEnchant",
  name: "Webspark Unguent",
  summonProfiles: [{
    profileId: "WebsparkSpider01",
    profileName: "Giant Spider",
    actor: { name: "Friendly Giant Spider", srdActorName: "Giant Spider", type: "beast" }
  }],
  summonActivity: { activityId: "WebsparkSummon01", activityName: "Summon Giant Spider" },
  unresolvedMechanics: [{
    category: "nativeSummon",
    label: "Giant Spider Summon",
    requestedText: "Using the oil also calls in a friendly Giant Spider for 1 hour."
  }]
}, "Create a one-use oil that enchants a weapon for 1 hour and calls in a friendly Giant Spider for 1 hour.");
assert.deepEqual(enchantSummonRepair.spec.unresolvedMechanics, undefined);

const defaultWeaponWorkflowRepair = repairHybridSpecFromRequest({
  kind: "weaponConditionOnHit",
  name: "Embercoil Sickle",
  conditionOnHit: {
    condition: "burned",
    save: { ability: "dex", dc: 13 },
    durationSeconds: 60
  },
  unresolvedMechanics: [{
    category: "tableAdjudication",
    label: "single-target attack behavior",
    requestedText: "The basic sickle strike must be a single-target attack against the focused target with no extra target-selection dialog; verify the attack, save, and effect behavior."
  }]
}, "Create an Embercoil Sickle with a DC 13 Dexterity save on hit.");
assert.equal(defaultWeaponWorkflowRepair.spec.unresolvedMechanics, undefined);

export const testedHybridRepairCases = 33;
