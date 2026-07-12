import assert from "node:assert/strict";
import { repairHybridSpecFromRequest } from "../scripts/hybrid-activity-repair.js";

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
assert.equal(eclipseSovereign.spec.summonProfiles[0].actor.items[0].name, "Eclipse Bite");
assert.equal(eclipseSovereign.spec.summonActivity.activityName, "Summon Eclipse Hound");
assert.equal(eclipseSovereign.spec.summonProfiles[0].profileName, "Eclipse Hound");
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
assert.equal(frostwaveDualSummon.spec.utilityActivities.find(activity => activity.activityName === "Summon Wolf").summonProfiles[0].actor.items[0].name, "Bite");

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
assert.equal(fallbackDefaults.spec.saveActivities[0].save.dc, 15);

export const testedHybridRepairCases = 16;
