import assert from "node:assert/strict";
import { TEMPLATE_LAYERS, buildLayeredItemBlueprint } from "../scripts/item-blueprint.js";

assert.deepEqual(TEMPLATE_LAYERS, [
  "baseChassis",
  "classification",
  "passiveMechanics",
  "resourcePool",
  "namedActivities",
  "effects",
  "advancedMechanics"
]);

const ashenOath = buildLayeredItemBlueprint({
  kind: "weaponExtraDamage",
  name: "Ashen Oath",
  baseItem: "longsword",
  saveActivities: [
    { activityId: "TriggeredPower001", activityName: "Triggered Power", chargeCost: 1 },
    { activityId: "BurningHands0001", activityName: "Cast Burning Hands", chargeCost: 1 }
  ],
  unresolvedMechanics: [{
    id: "StaleWarning00001",
    category: "spell",
    label: "Burning Hands activation",
    requestedText: "Cast Burning Hands.",
    reason: "Activated spell casting is not supported by the weaponExtraDamage family.",
    handling: "Create a separate activated spell activity or use a different item family if the spell must be represented mechanically.",
    resolved: false
  }]
}, "Create a +1 longsword. Once per long rest, cast Burning Hands.");

assert.equal(ashenOath.spec.kind, "artifactWeaponHybrid");
assert.deepEqual(ashenOath.spec.saveActivities.map(activity => activity.activityName), ["Cast Burning Hands"]);
assert.deepEqual(ashenOath.spec.uses, {
  spent: 0,
  max: "1",
  recovery: [{ period: "lr", type: "recoverAll", formula: "" }],
  autoDestroy: false
});
assert.equal(ashenOath.spec.unresolvedMechanics, undefined);
assert.equal(ashenOath.layers.resourcePool.complete, true);

const chargedStaff = buildLayeredItemBlueprint({
  kind: "artifactWeaponHybrid",
  name: "Staff of Frostlight",
  baseItem: "quarterstaff",
  uses: { max: "6", recovery: [{ period: "dawn", type: "formula", formula: "1d6" }] },
  saveActivities: [{ activityId: "IceKnife0000001", activityName: "Cast Ice Knife", chargeCost: 1 }]
}, "It has 6 charges and regains 1d6 charges at dawn.");

assert.equal(chargedStaff.spec.uses.max, "6");
assert.equal(chargedStaff.spec.uses.recovery[0].period, "dawn");

const noActivePower = buildLayeredItemBlueprint({
  kind: "weaponExtraDamage",
  name: "Quiet Edge",
  baseItem: "dagger",
  extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["cold"] }]
}, "Create a dagger that deals extra cold damage.");

assert.equal(noActivePower.spec.kind, "weaponExtraDamage");
assert.equal(noActivePower.layers.resourcePool.complete, false);

const genericActivityPayload = buildLayeredItemBlueprint({
  kind: "weaponExtraDamage",
  name: "Storm Mark",
  baseItem: "longsword",
  activities: [{
    activityId: "ThunderwaveAct001",
    activityName: "Cast Thunderwave",
    type: "save",
    save: { ability: "con", dc: 15 },
    damageOnSave: "half",
    damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["thunder"] }]
  }]
}, "Once per long rest, cast Thunderwave.");

assert.equal(genericActivityPayload.spec.activities, undefined);
assert.equal(genericActivityPayload.spec.kind, "artifactWeaponHybrid");
assert.equal(genericActivityPayload.spec.saveActivities.length, 1);
assert.equal(genericActivityPayload.spec.saveActivities[0].chargeCost, 1);
assert.equal(genericActivityPayload.spec.uses.max, "1");

const resolvedWeaponSpellWarnings = buildLayeredItemBlueprint({
  kind: "artifactWeaponHybrid",
  name: "Emberspark Dagger",
  baseItem: "dagger",
  uses: { max: "1", recovery: [{ period: "lr", type: "recoverAll", formula: "" }] },
  saveActivities: [{
    activityId: "EmberBurning001",
    activityName: "Burning Hands",
    save: { ability: "dex", dc: 15 },
    damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]
  }],
  unresolvedMechanics: [
    {
      id: "DailySpellUsage01",
      category: "tableAdjudication",
      label: "Daily spell usage integration",
      requestedText: "Spell usage: once per day",
      reason: "This item family does not natively express a once-per-day spell cast tied to a weapon attack and a separate save activity in a single supported schema without table-specific adjudication.",
      handling: "Track the daily casting limit at the table or add a dedicated charge-to-activity linkage if your Forge configuration supports it.",
      resolved: false
    },
    {
      id: "SpellSaveDc01",
      category: "unmappedSpell",
      label: "Burning Hands",
      requestedText: "Spell: Burning Hands",
      reason: "weaponExtraDamage does not support spell activities or save-based spell casting.",
      handling: "Move to a casterUtilityEquipment, equipmentPowerSuite, or multiActivityStaff spec if spell activity is required.",
      resolved: false
    }
  ]
}, "Create a dagger that can cast Burning Hands once per day.");

assert.equal(resolvedWeaponSpellWarnings.spec.unresolvedMechanics, undefined);

const resolvedStormforgedWarnings = buildLayeredItemBlueprint({
  kind: "artifactWeaponHybrid",
  name: "Stormforged Longsword",
  baseItem: "longsword",
  saveActivities: [{
    activityId: "Stormwave001",
    activityName: "Cast Thunderwave",
    save: { ability: "con", dc: 15 },
    damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["thunder"] }]
  }],
  unresolvedMechanics: [
    {
      category: "tableAdjudication",
      label: "Once per long rest spell usage",
      reason: "This chassis does not support a spell-activation resource model."
    },
    {
      category: "tableAdjudication",
      label: "Spell save DC 15",
      reason: "This chassis does not support a separate spell save DC for an activated spell activity."
    }
  ]
}, "Create a longsword that can cast Thunderwave once per long rest with DC 15.");

assert.equal(resolvedStormforgedWarnings.spec.unresolvedMechanics, undefined);

const resolvedHealingReview = buildLayeredItemBlueprint({
  kind: "equipmentPowerSuite",
  name: "Heartglass Torque",
  baseItem: "amulet",
  uses: { max: "3", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] },
  activities: [{
    activityId: "HealingTouch00001",
    activityName: "Healing Touch",
    type: "heal",
    chargeCost: 1,
    damageParts: [{ number: 2, denomination: 8, bonus: "+2", types: ["healing"] }]
  }],
  unresolvedMechanics: [{
    category: "tableAdjudication",
    label: "Touch healing action",
    requestedText: "As an action, spend 1 charge to restore 2d8 + 2 hit points to a creature you touch.",
    reason: "This item family cannot express a charge-spending healing activity without moving to a different supported family.",
    handling: "Convert to a charged healing item if the healing activation should be formalized."
  }]
}, "Create a charged amulet that heals a touched creature.");

assert.equal(resolvedHealingReview.spec.unresolvedMechanics, undefined);
assert.ok(resolvedHealingReview.assumptions.some(note => /stale review notes/i.test(note)));

const resolvedLightReview = buildLayeredItemBlueprint({
  kind: "artifactWeaponHybrid",
  name: "Sunforged Oathblade",
  baseItem: "greatsword",
  toggleLight: { bright: 20, dim: 20 },
  utilityActivities: [{
    activityId: "IgniteFlame00001",
    activityName: "Ignite the Flame",
    type: "utility"
  }],
  unresolvedMechanics: [{
    category: "tableAdjudication",
    label: "light-activation-mode",
    requestedText: "Ignite as a bonus action to shed bright and dim light.",
    reason: "The supported artifact shape only declaratively supports toggleLight without a separate activation workflow.",
    handling: "The table may decide whether this is always-on while lit or requires a bonus action to activate."
  }]
}, "Create an artifact greatsword with a bonus-action light toggle.");

assert.equal(resolvedLightReview.spec.unresolvedMechanics, undefined);

const resolvedLightSchemaReview = buildLayeredItemBlueprint({
  kind: "artifactWeaponHybrid",
  name: "Sunforged Oathblade",
  toggleLight: { bright: 20, dim: 20 },
  utilityActivities: [{
    activityId: "IgniteFlame00001",
    activityName: "Ignite the Flame",
    type: "utility"
  }],
  unresolvedMechanics: [{
    category: "lightToggle",
    label: "Requested light effect",
    requestedText: "Ignite as a bonus action to shed bright and dim light.",
    reason: "The generated item does not contain light-toggle data.",
    handling: "Review the light activity manually."
  }]
}, "Create an artifact weapon with an Ignite the Flame light toggle.");

assert.equal(resolvedLightSchemaReview.spec.unresolvedMechanics, undefined);

const dedupedLightActivities = buildLayeredItemBlueprint({
  kind: "artifactWeaponHybrid",
  name: "Sunforged Oathblade",
  toggleLight: { activityId: "IgniteFlame00001", activityName: "Ignite the Flame", bright: 20, dim: 20 },
  utilityActivities: [
    { activityId: "IgniteFlame00001", activityName: "Ignite the Flame", type: "utility" },
    { activityId: "OtherUtility0001", activityName: "Other Utility", type: "utility" }
  ]
}, "Create an artifact weapon with an Ignite the Flame light toggle.");
assert.deepEqual(dedupedLightActivities.spec.utilityActivities.map(activity => activity.activityName), ["Other Utility"]);

const explicitSummonCost = buildLayeredItemBlueprint({
  kind: "equipmentPowerSuite",
  name: "Staff of the Bonebound Pact",
  baseItem: "quarterstaff",
  utilityActivities: [{
    activityId: "SummonChosen0001",
    activityName: "Summon Chosen Ally",
    type: "summon",
    chargeCost: 3
  }],
  summonProfiles: [{ profileName: "Skeleton", actor: { name: "Skeleton" } }]
}, "As an action, spend 4 charges to summon one friendly Skeleton or Zombie for 1 hour.");

assert.equal(explicitSummonCost.spec.utilityActivities[0].chargeCost, 4);
assert.equal(explicitSummonCost.spec.summonActivity.chargeCost, 4);
assert.ok(explicitSummonCost.assumptions.some(note => /explicit summon charge cost/i.test(note)));

console.log("item-blueprint tests passed");
