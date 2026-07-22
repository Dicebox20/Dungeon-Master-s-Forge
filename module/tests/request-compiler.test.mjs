import assert from "node:assert/strict";
import { compileItemRequest } from "../scripts/request-compiler.js";

const rifle = compileItemRequest("Make a rifle that does fire damage");
assert.equal(rifle.specs[0].kind, "weaponExtraDamage");
assert.equal(rifle.specs[0].extraDamageParts[0].denomination, 4);
assert.deepEqual(rifle.specs[0].extraDamageParts[0].types, ["fire"]);
assert.equal(rifle.specs[0].magicalBonus, "1");

const ring = compileItemRequest(`
Ring of Steadfast Warding
Rarity: Rare
Attunement: Required
Apply +1 bonus to AC and saving throws.
`);
assert.deepEqual(
  ring.specs[0].effects[0].changes.map(change => change.key),
  ["system.attributes.ac.bonus", "system.bonuses.abilities.save"]
);

const command = compileItemRequest(`
Crown of the Ashen King
Legendary crown, requires attunement. It casts Command once per dawn; the target makes a DC 18 Wisdom save.
`);
assert.equal(command.specs[0].kind, "legendaryEquipmentSuite");
assert.deepEqual(command.specs[0].saveActivities[0].save, { ability: "wis", dc: 18 });
assert.equal(command.specs[0].saveActivities[0].damageParts.length, 0);

const wand = compileItemRequest(`
Wand of Thunderous Force
Uncommon wand requiring attunement by a spellcaster. Action. 15-foot cube originating from the wielder.
Constitution save, DC 13. 2d8 thunder damage, half on success. 7 charges; spend 1 charge.
Regains 1d6 + 1 charges daily at dawn.
`);
assert.equal(wand.specs[0].kind, "chargedSaveDamage");
assert.equal(wand.specs[0].target.template.type, "cube");
assert.equal(wand.specs[0].target.template.size, 15);
assert.equal(wand.specs[0].uses.recovery[0].formula, "1d6 + 1");

const defaultChargeRecovery = compileItemRequest("Create a rare circlet called Poison Crown. It has 12 charges. As an action, spend 1 charge to make a ranged poison spell attack against one creature within 60 feet, dealing 1d6 poison damage.");
assert.deepEqual(defaultChargeRecovery.specs[0].uses.recovery, [{ period: "lr", type: "recoverAll", formula: "" }]);

const unspecifiedDcWand = compileItemRequest(`
Stormglass Wand
Rare wand requiring attunement. As an action, unleash a 15-foot cone that forces a Constitution save or takes 4d8 thunder damage.
`);
assert.equal(unspecifiedDcWand.specs[0].save?.dc, 13);

const deafeningMace = compileItemRequest("Create a rare magical mace that grants +1 to attack and damage rolls. On a hit, the target must succeed on a DC 13 Constitution saving throw or be deafened until the start of your next turn.");
assert.equal(deafeningMace.specs[0].kind, "weaponConditionOnHit");
assert.equal(deafeningMace.specs[0].conditionOnHit.condition, "deafened");
assert.deepEqual(deafeningMace.specs[0].conditionOnHit.save, { ability: "con", dc: 13 });

const summon = compileItemRequest("Create a rare item that summons a friendly wolf once per long rest.");
assert.equal(summon.specs[0].kind, "nativeSummon");
assert.match(summon.specs[0].activityId, /^[A-Za-z0-9]{16}$/);
assert.match(summon.specs[0].profileId, /^[A-Za-z0-9]{16}$/);

const dragonomicon = compileItemRequest("Create a Book named the Dragonomicon that can be used to summon a Pseudodragon as a companion. The book has 1 charge that recharges after a long rest.");
assert.equal(dragonomicon.specs[0].kind, "nativeSummon");
assert.equal(dragonomicon.specs[0].profileName, "Pseudodragon");
assert.equal(dragonomicon.specs[0].summonActor.srdActorName, "Pseudodragon");
assert.equal(dragonomicon.specs[0].summonActor.requireSrdActor, true);
assert.equal("ac" in dragonomicon.specs[0].summonActor, false);
assert.equal("items" in dragonomicon.specs[0].summonActor, false);

const owlbearTalisman = compileItemRequest("Create a talisman that can summon an Owlbear in an unoccupied space within 30 feet for 1 hour.");
assert.equal(owlbearTalisman.specs[0].kind, "nativeSummon");
assert.equal(owlbearTalisman.specs[0].profileName, "Owlbear");
assert.equal(owlbearTalisman.specs[0].summonActor.srdActorName, "Owlbear");
assert.equal(owlbearTalisman.specs[0].summonActor.requireSrdActor, true);

const deferred = compileItemRequest("Create a helm that restores 1 Ki point.");
assert.ok(deferred.warnings.some(message => message.includes("Class-specific")));
assert.equal(deferred.specs[0].unresolvedMechanics[0].category, "classResource");
assert.equal(deferred.specs[0].unresolvedMechanics[0].resolved, false);
assert.match(deferred.specs[0].unresolvedMechanics[0].id, /^[A-Za-z0-9]{16}$/);
assert.equal(deferred.unresolvedMechanics[0].itemName, deferred.specs[0].name);

const unresolvedSuite = compileItemRequest(`
Crown of Shared Aura
Legendary crown requiring attunement. It emits a 30-foot aura that grants allies +1 AC.
It restores 1 sorcery point once per long rest. It casts Fly once per dawn.
`);
assert.deepEqual(
  unresolvedSuite.specs[0].unresolvedMechanics.map(mechanic => mechanic.category),
  ["allyAura", "classResource", "unmappedSpell"]
);
assert.ok(unresolvedSuite.specs[0].unresolvedMechanics.every(mechanic => mechanic.requestedText.length > 0));
assert.ok(unresolvedSuite.specs[0].unresolvedMechanics.every(mechanic => mechanic.handling.length > 0));
assert.match(unresolvedSuite.specs[0].unresolvedMechanics[0].requestedText, /grants allies \+1 AC/i);
assert.equal(unresolvedSuite.specs[0].effects.length, 0, "An ally aura must not become a personal AC effect.");
assert.equal(unresolvedSuite.decisions[0].unresolvedCount, 3);
assert.equal(unresolvedSuite.unresolvedMechanics.length, 3);

const separatedBatch = compileItemRequest(`
Make a rifle that does fire damage
---
Ring of Steadfast Warding
Rarity: Rare
Attunement: Required
Apply +1 bonus to AC and saving throws.
`);
assert.equal(separatedBatch.requestCount, 2);
assert.deepEqual(separatedBatch.specs.map(spec => spec.kind), ["weaponExtraDamage", "passiveEffectEquipment"]);
assert.deepEqual(separatedBatch.decisions.map(decision => decision.name), ["Fire Rifle", "Ring of Steadfast Warding"]);
assert.ok(separatedBatch.assumptions.every(message => /^\[[^\]]+\]/.test(message)));

const fieldBatch = compileItemRequest(`
Item name: Emberglass Dagger
Item type: Weapon, dagger
Rarity: Uncommon
Damage: Normal dagger damage plus 1d4 fire damage

Item name: Moonhowl Whistle
Item type: Wondrous item
Rarity: Rare
It summons a friendly wolf once per long rest.
`);
assert.equal(fieldBatch.requestCount, 2);
assert.deepEqual(fieldBatch.specs.map(spec => spec.name), ["Emberglass Dagger", "Moonhowl Whistle"]);
assert.deepEqual(fieldBatch.specs.map(spec => spec.kind), ["weaponExtraDamage", "nativeSummon"]);

const winterStaff = compileItemRequest(`
Staff of Winter's Judgment
Rare staff requiring attunement by a wizard. It has 10 charges and a spell save DC of 15.
It casts Ice Storm for 4 charges and Cone of Cold for 5 charges.
Ice Storm deals 2d8 bludgeoning plus 4d6 cold damage. Cone of Cold deals 8d8 cold damage. Half damage on a successful save.
The staff regains 1d6 + 4 charges daily at dawn.
`);
assert.equal(winterStaff.specs[0].kind, "multiActivityStaff");
assert.deepEqual(winterStaff.specs[0].activities.map(activity => activity.chargeCost), [4, 5]);
assert.deepEqual(winterStaff.specs[0].activities.map(activity => activity.save), [
  { ability: "dex", dc: 15 },
  { ability: "con", dc: 15 }
]);
assert.equal(winterStaff.specs[0].uses.max, "10");
assert.equal(winterStaff.specs[0].uses.recovery[0].formula, "1d6 + 4");

const fiendStone = compileItemRequest(`
Infernal Calling Stone
Very rare wondrous item requiring attunement. Once per long rest, as an action, summon a friendly fiend spirit within 90 feet.
Choose Demon, Devil, or Yugoloth. The summon lasts 1 hour and uses concentration.
`);
assert.equal(fiendStone.specs[0].kind, "nativeMultiProfileSummon");
assert.deepEqual(fiendStone.specs[0].summonProfiles.map(profile => profile.profileName), ["Demon", "Devil", "Yugoloth"]);
assert.ok(fiendStone.specs[0].summonProfiles.every(profile => /^[A-Za-z0-9]{16}$/.test(profile.profileId)));
assert.deepEqual(fiendStone.specs[0].summonProfiles.map(profile => profile.actor.srdActorName), ["Quasit", "Imp", "Mezzoloth"]);
assert.ok(fiendStone.specs[0].summonProfiles.every(profile => profile.actor.requireSrdActor));
assert.equal(fiendStone.specs[0].uses.recovery[0].period, "lr");

const emberOil = compileItemRequest(`
Oil of Ember Edge
Uncommon consumable oil that does not require attunement. As an action, apply it to one nonmagical weapon.
For 1 hour, the weapon becomes magical and deals an extra 1d4 fire damage. The oil has one use and is consumed.
`);
assert.equal(emberOil.specs[0].kind, "nativeEnchant");
assert.equal(emberOil.specs[0].duration.seconds, 3600);
assert.equal(emberOil.specs[0].restrictions.type, "weapon");
assert.equal(emberOil.specs[0].uses.autoDestroy, true);
assert.deepEqual(emberOil.specs[0].enchantChanges.map(change => change.key), ["system.properties", "system.damage.parts"]);
assert.deepEqual(emberOil.specs[0].enchantChanges[1].value.damage, {
  number: 1,
  denomination: 4,
  bonus: "",
  types: ["fire"]
});
assert.match(emberOil.specs[0].activityId, /^[A-Za-z0-9]{16}$/);
assert.match(emberOil.specs[0].effectId, /^[A-Za-z0-9]{16}$/);

const alchemistFire = compileItemRequest(`
Create an uncommon flask of Alchemist Fire. As an action, throw it at a creature within 20 feet.
On a hit, the target takes 1d4 fire damage at the start of each of its turns until a creature uses an action to extinguish the flames.
The flask is consumed after one use.
`);
assert.equal(alchemistFire.specs[0].kind, "equipmentPowerSuite");
assert.equal(alchemistFire.specs[0].itemType, "consumable");
assert.equal(alchemistFire.specs[0].consumableType, "trinket");
assert.equal(alchemistFire.specs[0].name, "Alchemist Fire");
assert.equal(alchemistFire.specs[0].uses.autoDestroy, true);
assert.equal(alchemistFire.specs[0].attackActivities.length, 1);
assert.equal(alchemistFire.specs[0].attackActivities[0].attackType, "ranged");
assert.equal(alchemistFire.specs[0].unresolvedMechanics[0].category, "tableAdjudication");

const fireGrenade = compileItemRequest(`
Create a rare grenade. As an action, throw it to a point within 60 feet.
Each creature in a 10-foot-radius sphere must make a DC 15 Dexterity saving throw, taking 4d6 fire damage on a failed save, or half as much on a success.
The grenade is consumed after one use.
`);
assert.equal(fireGrenade.specs[0].kind, "chargedSaveDamage");
assert.equal(fireGrenade.specs[0].itemType, "consumable");
assert.equal(fireGrenade.specs[0].consumableType, "trinket");
assert.equal(fireGrenade.specs[0].uses.autoDestroy, true);
assert.equal(fireGrenade.specs[0].target.template.type, "sphere");
assert.equal(fireGrenade.specs[0].target.template.size, 10);
assert.equal(fireGrenade.specs[0].img, "icons/weapons/thrown/grenade-incendiary.webp");

const mindCirclet = compileItemRequest(`
Mindshard Circlet
Very rare circlet requiring attunement. It has 5 charges and regains all charges on a long rest.
As an action, spend 1 charge to make a ranged psychic attack using Intelligence against one enemy within 90 feet. On a hit it deals 4d8 psychic damage.
`);
assert.equal(mindCirclet.specs[0].kind, "equipmentPowerSuite");
assert.equal(mindCirclet.specs[0].attackActivities.length, 1);
assert.equal(mindCirclet.specs[0].attackActivities[0].ability, "int");
assert.equal(mindCirclet.specs[0].attackActivities[0].attackType, "ranged");
assert.equal(mindCirclet.specs[0].attackActivities[0].chargeCost, 1);
assert.deepEqual(mindCirclet.specs[0].attackActivities[0].range, { value: 90, units: "ft" });
assert.deepEqual(mindCirclet.specs[0].attackActivities[0].damageParts[0], {
  number: 4, denomination: 8, bonus: "", types: ["psychic"]
});

const stormfire = compileItemRequest(`
Stormfire Reaver
Create a +3 artifact greataxe requiring attunement. Its attacks deal an extra 1d6 fire and 1d6 lightning damage.
While equipped and attuned, it grants +1 to AC. As a bonus action, ignite or extinguish its light: 20 feet of bright light and an additional 20 feet of dim light.
Once per dawn, cast Flame Strike at DC 18 Dexterity. It deals 4d6 fire and 4d6 radiant damage, half on a successful save.
`);
const stormfireSpec = stormfire.specs[0];
assert.equal(stormfireSpec.kind, "artifactWeaponHybrid");
assert.equal(stormfireSpec.magicalBonus, "3");
assert.deepEqual(stormfireSpec.extraDamageParts.map(part => part.types[0]), ["fire", "lightning"]);
assert.deepEqual(stormfireSpec.passiveEffects[0].changes, [
  { key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }
]);
assert.equal(stormfireSpec.toggleLight.bright, 20);
assert.equal(stormfireSpec.toggleLight.dim, 40);
assert.match(stormfireSpec.toggleLight.activityId, /^[A-Za-z0-9]{16}$/);
assert.match(stormfireSpec.toggleLight.effectId, /^[A-Za-z0-9]{16}$/);
assert.deepEqual(stormfireSpec.saveActivities[0].save, { ability: "dex", dc: 18 });
assert.deepEqual(stormfireSpec.saveActivities[0].damageParts.map(part => part.types[0]), ["fire", "radiant"]);
assert.equal(stormfireSpec.uses.recovery[0].period, "dawn");

export const testedRequestCount = 15;
