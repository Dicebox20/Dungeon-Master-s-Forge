import assert from "node:assert/strict";
import {
  applyBaseChassisFallbackArt,
  applyCategoryItemFallbackArt,
  applyConsumableProjectileFallbackArt,
  applyFallbackActivityArt,
  applySpellActivityArt,
  applySystemEquipmentArt,
  consumableProjectileFallbackImage,
  spellActivityMatches,
  supportsSystemEquipmentArt
} from "../scripts/system-art-enrichment.js";

assert.equal(supportsSystemEquipmentArt({ kind: "weaponExtraDamage" }), true);
assert.equal(supportsSystemEquipmentArt({ kind: "artifactWeaponHybrid" }), true);

const blade = applySystemEquipmentArt({
  kind: "weaponExtraDamage",
  name: "Flame-Thunder Greatsword",
  img: "icons/svg/item-bag.svg"
}, "systems/dnd5e/icons/svg/items/greatsword.webp");
assert.equal(blade.img, "systems/dnd5e/icons/svg/items/greatsword.webp");

const artifact = applySystemEquipmentArt({
  kind: "artifactWeaponHybrid",
  name: "Worldrender"
}, "systems/dnd5e/icons/svg/items/greataxe.webp");
assert.equal(artifact.img, "systems/dnd5e/icons/svg/items/greataxe.webp");

assert.equal(spellActivityMatches("Cast Fireball", "Fireball"), true);
assert.equal(spellActivityMatches("Fireball", "Fireball"), true);
assert.equal(spellActivityMatches("Flame Strike", "Fireball"), false);

const suite = applySpellActivityArt({
  kind: "equipmentPowerSuite",
  utilityActivities: [
    { activityName: "Cast Fireball" },
    { activityName: "Cast Lightning Bolt" }
  ]
}, "Fireball", "systems/dnd5e/icons/svg/spells/fireball.webp");

assert.equal(suite.utilityActivities[0].activityImg, "systems/dnd5e/icons/svg/spells/fireball.webp");
assert.equal(suite.utilityActivities[1].activityImg, undefined);

const activityFallback = applyFallbackActivityArt({
  kind: "multiActivityStaff",
  img: "icons/svg/item-bag.svg",
  activities: [
    { activityName: "Cast Fireball", activityImg: "systems/dnd5e/icons/svg/spells/fireball.webp" }
  ]
});

assert.equal(activityFallback.img, "systems/dnd5e/icons/svg/spells/fireball.webp");

assert.equal(
  consumableProjectileFallbackImage({ itemType: "consumable", name: "Arc Grenade" }),
  "icons/weapons/thrown/grenade-energy.webp"
);
assert.equal(
  consumableProjectileFallbackImage({ itemType: "consumable", name: "Frostburst Grenade" }),
  "icons/weapons/thrown/bomb-fuse-blue.webp"
);
assert.equal(
  consumableProjectileFallbackImage({ itemType: "consumable", name: "Thunderclap Grenade" }),
  "icons/weapons/thrown/bomb-pressure-black.webp"
);

const grenadeFallback = applyConsumableProjectileFallbackArt({
  kind: "chargedSaveDamage",
  itemType: "consumable",
  name: "Arc Grenade",
  img: "icons/svg/item-bag.svg"
});
assert.equal(grenadeFallback.applied, true);
assert.equal(grenadeFallback.spec.img, "icons/weapons/thrown/grenade-energy.webp");

const missingFallback = applyConsumableProjectileFallbackArt({
  kind: "passiveEffectEquipment",
  name: "Unpictured Relic",
  img: "icons/svg/item-bag.svg"
});
assert.equal(missingFallback.status, "missing");
assert.equal(missingFallback.spec.img, "icons/svg/item-bag.svg");

const cloakFallback = applyCategoryItemFallbackArt({
  kind: "passiveEffectEquipment",
  name: "Cloak of the Stormwatch",
  img: "icons/svg/item-bag.svg"
});
assert.equal(cloakFallback.applied, true);
assert.equal(cloakFallback.spec.img, "icons/equipment/back/cloak-hooded-blue.webp");

const potionFallback = applyCategoryItemFallbackArt({
  kind: "chargedHealing",
  itemType: "consumable",
  name: "Bloomdraught",
  description: "An uncommon healing potion.",
  img: "icons/svg/item-bag.svg"
});
assert.equal(potionFallback.applied, true);
assert.equal(potionFallback.spec.img, "icons/consumables/potions/potion-bottle-corked-blue.webp");

const wandFallback = applyBaseChassisFallbackArt({
  kind: "chargedSaveDamage",
  name: "Wand of Searing Hail",
  baseItem: "wand",
  img: "icons/weapons/staves/staff-orante-gold.webp"
});
assert.equal(wandFallback.applied, true);
assert.equal(wandFallback.spec.img, "icons/weapons/wands/wand-gem-red.webp");

export const testedSystemArtCases = 21;
