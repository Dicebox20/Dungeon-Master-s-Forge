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
assert.doesNotMatch(flameforce.normalizedRequest, /On a hit, it deals an extra 1d6 fire damage and 1d6 force damage\./);

const shortbow = normalizeItemRequest("Create a shortbow that gives +1 to attack rolls, deals an additional 1d6 poison damage and 1d6 necrotic damage on hit, and can cast Ray of Sickness once per day.");
assert.match(shortbow.normalizedRequest, /Base item: Shortbow/);
assert.match(shortbow.normalizedRequest, /Spell: Ray of Sickness/);

const grenade = normalizeItemRequest("Create a rare grenade that is consumed after one use. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere makes a DC 15 Dexterity save, taking 4d6 fire damage on a failed save.");
assert.match(grenade.normalizedRequest, /Base item: Grenade/);
assert.match(grenade.normalizedRequest, /Item type: Consumable projectile/);
assert.match(grenade.normalizedRequest, /Use model: Consumed after one use/);
assert.match(grenade.normalizedRequest, /Activation: Throw as an action/);

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

export const testedNormalizationCases = 4;
