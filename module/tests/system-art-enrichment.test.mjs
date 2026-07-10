import assert from "node:assert/strict";
import {
  applyFallbackActivityArt,
  applySpellActivityArt,
  applySystemEquipmentArt,
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

export const testedSystemArtCases = 8;
