import assert from "node:assert/strict";
import { armorBonusValue, inferArmorProfile, normalizeItemDocumentType, normalizeMagicalBonus, normalizeWeight, safeItemIcon } from "../scripts/equipment-normalization.js";
import { buildReviewSummaries } from "../scripts/review-summary.js";

assert.equal(safeItemIcon(undefined), "icons/svg/item-bag.svg");
assert.equal(safeItemIcon("undefined"), "icons/svg/item-bag.svg");
assert.equal(safeItemIcon("icons/test.webp"), "icons/test.webp");

assert.equal(normalizeItemDocumentType("rod", "consumable"), "equipment");
assert.equal(normalizeItemDocumentType("wand", "consumable"), "equipment");
assert.equal(normalizeItemDocumentType("staff", "consumable"), "equipment");
assert.equal(normalizeItemDocumentType("equipment", "consumable"), "equipment");

const plate = inferArmorProfile({
  name: "Frostguard Plate",
  description: "A +2 suit of plate armor."
});
assert.equal(plate.isShield, false);
assert.equal(plate.equipmentType, "heavy");
assert.equal(plate.baseItem, "plate");
assert.equal(plate.armorValue, 18);
assert.equal(armorBonusValue({ armorValue: 2 }, plate), "1");

const shield = inferArmorProfile({
  name: "Sentinel Shield of the Deep",
  description: "A +2 shield."
});
assert.equal(shield.isShield, true);
assert.equal(shield.equipmentType, "shield");
assert.equal(shield.baseItem, "shield");
assert.equal(armorBonusValue({ armorValue: 2, magicalBonus: true }, shield), "1");
assert.equal(normalizeMagicalBonus(true), "");
assert.equal(normalizeMagicalBonus("+2"), "2");
assert.equal(normalizeWeight(4), 4);
assert.equal(normalizeWeight({ value: "4" }), 4);
assert.equal(normalizeWeight({ value: "not a number" }), 0);

const armorSummary = buildReviewSummaries([{
  kind: "shieldArmorBonus",
  name: "Stonehide Breastplate",
  description: "This is breastplate armor, not a shield. It is +1 breastplate armor.",
  rarity: "rare",
  armorValue: 1,
  magicalBonus: "1"
}], null)[0];
assert.equal(armorSummary.kindLabel, "Magic armor");
assert.ok(armorSummary.mechanics.some(value => value.includes("Armor bonus +1 AC")));
assert.equal(armorSummary.img, "icons/svg/item-bag.svg");

const malformedShieldSummary = buildReviewSummaries([{
  kind: "shieldArmorBonus",
  name: "Cinderwake Aegis",
  description: "A shield with malformed magical bonus output.",
  rarity: "rare",
  armorValue: 2,
  magicalBonus: true
}], null)[0];
assert.ok(malformedShieldSummary.mechanics.some(value => value.includes("Shield bonus +1 AC")));
assert.ok(!malformedShieldSummary.mechanics.some(value => value.includes("true")));

export const testedEquipmentNormalizationCount = 21;
