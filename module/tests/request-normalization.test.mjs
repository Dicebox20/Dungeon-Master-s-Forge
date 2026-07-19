import assert from "node:assert/strict";
import { normalizeItemRequest } from "../scripts/request-normalization.js";

const flameforce = normalizeItemRequest("Create a dagger that deals an additional 1d6 fire damage, 1d6 force damage, gives +1 to attack rolls, and can cast Burning Hands once per day.");
assert.equal(flameforce.changed, true);
assert.match(flameforce.normalizedRequest, /Complexity layer 1 - Base chassis/);
assert.match(flameforce.normalizedRequest, /Base item: Dagger/);
assert.match(flameforce.normalizedRequest, /Magical bonus: \+1/);
assert.match(flameforce.normalizedRequest, /Complexity layer 4 - Named activities/);
assert.match(flameforce.normalizedRequest, /Spell: Burning Hands/);
assert.match(flameforce.normalizedRequest, /Spell usage: once per day/);
assert.match(flameforce.normalizedRequest, /Original request: Create a dagger that deals an additional 1d6 fire damage/);

const shortbow = normalizeItemRequest("Create a shortbow that gives +1 to attack rolls, deals an additional 1d6 poison damage and 1d6 necrotic damage on hit, and can cast Ray of Sickness once per day.");
assert.match(shortbow.normalizedRequest, /Base item: Shortbow/);
assert.match(shortbow.normalizedRequest, /Spell: Ray of Sickness/);

const grenade = normalizeItemRequest("Create a rare grenade that is consumed after one use. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere makes a DC 15 Dexterity save, taking 4d6 fire damage on a failed save.");
assert.match(grenade.normalizedRequest, /Base item: Grenade/);
assert.match(grenade.normalizedRequest, /Item type: Consumable projectile/);
assert.match(grenade.normalizedRequest, /Use model: Consumed after one use/);
assert.match(grenade.normalizedRequest, /Activation: Throw as an action/);
assert.match(grenade.normalizedRequest, /Range: 60 feet/);
assert.match(grenade.normalizedRequest, /Area: 10-foot-radius sphere/);

const alchemistFire = normalizeItemRequest("Create an uncommon flask of Alchemist Fire. As an action, throw it at a creature within 20 feet. On a hit, the target takes 1d4 fire damage at the start of each of its turns until a creature uses an action to extinguish the flames. The flask is consumed after one use.");
assert.match(alchemistFire.normalizedRequest, /Item name: Alchemist Fire/);
assert.doesNotMatch(alchemistFire.normalizedRequest, /Magical bonus:/);

const unspecifiedDefaults = normalizeItemRequest("Create a rare longsword that can cast Thunderwave once per day.");
assert.doesNotMatch(unspecifiedDefaults.normalizedRequest, /Magical bonus:/);
assert.doesNotMatch(unspecifiedDefaults.normalizedRequest, /Spell save DC:/);

const acidFlask = normalizeItemRequest("Create an uncommon acid flask. As an action, throw it at one creature within 20 feet. On a hit, the target takes 2d6 acid damage. The flask is consumed after one use.");
assert.doesNotMatch(acidFlask.normalizedRequest, /Magical bonus:/);

const armorAndResistance = normalizeItemRequest("Create a rare suit of half plate called Ashen Bulwark. It is +1 half plate armor, not a shield, and grants resistance to fire damage while equipped. It requires attunement.");
assert.match(armorAndResistance.normalizedRequest, /Base item: Half Plate/);
assert.match(armorAndResistance.normalizedRequest, /Resistance to: fire damage/);

const pluralNoAttunement = normalizeItemRequest("Create uncommon goggles called Owlglass Lenses. They do not require attunement.");
assert.equal(pluralNoAttunement.items[0].extracted.attunement, "none");

const bloomdraught = normalizeItemRequest("Create an uncommon potion called Bloomdraught. As an action, a creature can drink it to regain 3d4 + 3 hit points. It has 1 use and is consumed after drinking.");
assert.match(bloomdraught.normalizedRequest, /Healing: 3d4 \+ 3 hit points/);

const searingHail = normalizeItemRequest("Create a rare wand called Wand of Searing Hail. It has 6 charges and regains 1d6 charges daily at dawn. As an action, the wielder can spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Dexterity saving throw, taking 4d6 fire damage on a failed save or half as much on a success.");
assert.match(searingHail.normalizedRequest, /Saving throw: Dexterity DC 14/);
assert.match(searingHail.normalizedRequest, /Damage on failed save: 4d6 fire; half damage on success/);
assert.match(searingHail.normalizedRequest, /Charge cost: 1/);
assert.match(searingHail.normalizedRequest, /Area: 15-foot cone/);
assert.match(searingHail.normalizedRequest, /Charges: 6 charges; regains 1d6 daily at dawn/);
assert.doesNotMatch(searingHail.normalizedRequest, /Extra hit damage:/);

const tidesAndThunder = normalizeItemRequest("Create a rare staff called Staff of Tides and Thunder. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 2 charges to cast Shatter with a DC 15 save, or spend 3 charges to cast Tidal Wave with a DC 15 save. It requires attunement.");
assert.match(tidesAndThunder.normalizedRequest, /Spell: Shatter; Tidal Wave/);
assert.match(tidesAndThunder.normalizedRequest, /Charges: 8 charges; regains 1d6 \+ 2 daily at dawn/);

const alreadyStructured = normalizeItemRequest(`
Item name: Emberglass Dagger
Base item: Dagger
Rarity: Rare
Magical bonus: +1
Spell: Burning Hands
Spell usage: once per day
`);
assert.match(alreadyStructured.normalizedRequest, /Item name: Emberglass Dagger/);
assert.match(alreadyStructured.normalizedRequest, /Spell: Burning Hands/);

const inlineNameField = normalizeItemRequest("Name: Ashen Signet. Create a rare magical signet ring that grants resistance to fire damage while worn.");
assert.match(inlineNameField.normalizedRequest, /Item name: Ashen Signet/);
assert.doesNotMatch(inlineNameField.normalizedRequest, /Item name: Ashen Signet\. Create/);

const leadingTitle = normalizeItemRequest("Wand of Searing Hail. Create a rare wand with 7 charges that regains 1d6 + 1 charges at dawn. It casts Ice Storm for 4 charges.");
assert.match(leadingTitle.normalizedRequest, /Item name: Wand of Searing Hail/);

const quotedNamedItem = normalizeItemRequest('Create a legendary trident named "Frostwave Trident" with 12 charges that regains 1d8 + 4 charges daily at dawn.');
assert.match(quotedNamedItem.normalizedRequest, /Item name: Frostwave Trident/);

const slang = normalizeItemRequest("Make an uncommon ring called Skipstone. The wearer can bamf with Misty Step once a day. It has 4 charges and at dawn, roll 1d4 and put that many charges back. While worn, it lets the user shrug off fire damage.");
assert.match(slang.normalizedRequest, /Spell: Misty Step/);
assert.match(slang.normalizedRequest, /Spell usage: once per day/);
assert.match(slang.normalizedRequest, /Charges: 4 charges; regains 1d4 daily at dawn/);
assert.match(slang.normalizedRequest, /Resistance to: fire damage/);
assert.match(slang.normalizedRequest, /Original request: Make an uncommon ring called Skipstone\. The wearer can bamf/);
for (const alias of ["once a day", "cast named spell", "dawn charge recovery", "damage resistance"]) {
  assert.match(slang.notes.join(" "), new RegExp(alias, "i"));
}

const slangHealing = normalizeItemRequest("Make a one-and-done healing potion called Redcap's Pick-Me-Up. Chugging it takes an action and gets you back 2d4 + 2 HP.");
assert.match(slangHealing.normalizedRequest, /Healing: 2d4 \+ 2 hit points/);
assert.match(slangHealing.normalizedRequest, /Use model: Consumed after one use/);
assert.match(slangHealing.notes.join(" "), /drink as an action/);

export const testedNormalizationCases = 15;
