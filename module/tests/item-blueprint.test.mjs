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

console.log("item-blueprint tests passed");
