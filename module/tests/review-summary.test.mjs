import assert from "node:assert/strict";
import { compileItemRequest } from "../scripts/request-compiler.js";
import { buildReviewSummaries } from "../scripts/review-summary.js";

function review(request) {
  const compilation = compileItemRequest(request);
  return buildReviewSummaries(compilation.specs, compilation)[0];
}

const weapon = review("Emberglass Dagger\nUncommon magic dagger. Its attacks deal an extra 1d4 fire damage.");
assert.equal(weapon.kindLabel, "Extra-damage weapon");
assert.equal(weapon.rarity, "Uncommon");
assert.ok(weapon.mechanics.some(value => value.includes("Attack: 1d4 + modifier piercing damage")));
assert.ok(weapon.mechanics.some(value => value.includes("Extra damage: 1d4 fire damage")));

const ring = review("Ring of Steadfast Warding\nRare ring requiring attunement. It grants +1 to AC and saving throws.");
assert.equal(ring.attunement, "Attunement required");
assert.ok(ring.mechanics.some(value => value.includes("+1 AC")));
assert.ok(ring.mechanics.some(value => value.includes("+1 saving throws")));

const staff = review("Staff of Winter's Judgment\nRare staff requiring attunement. It has 10 charges and DC 15. Cast Ice Storm for 4 charges and Cone of Cold for 5 charges. Regains 1d6 + 4 charges at dawn.");
assert.equal(staff.kindLabel, "Multi-spell item");
assert.ok(staff.mechanics.some(value => value.includes("10 uses; regains 1d6 + 4 at dawn")));
assert.ok(staff.mechanics.some(value => value.includes("Cast Ice Storm: 4 charges; DC 15 Dexterity save")));
assert.ok(staff.mechanics.some(value => value.includes("Cast Cone of Cold: 5 charges; DC 15 Constitution save")));

const summon = review("Infernal Calling Stone\nVery rare item requiring attunement. Once per long rest summon a friendly fiend, choosing Demon, Devil, or Yugoloth.");
assert.equal(summon.kindLabel, "Selectable summon");
assert.ok(summon.mechanics.includes("Summon choice: Demon, Devil, Yugoloth"));

const oil = review("Oil of Ember Edge\nUncommon consumable oil. As an action, apply it to one nonmagical weapon. For 1 hour it becomes magical and deals an extra 1d4 fire damage. One use, consumed.");
assert.ok(oil.mechanics.some(value => value.includes("Enchant Weapon for 1 hour")));
assert.ok(oil.mechanics.some(value => value.includes("Adds 1d4 fire damage")));

const unresolved = review("Crown of Shared Aura\nLegendary crown requiring attunement. It emits a 30-foot aura granting allies +1 AC. It restores 1 sorcery point. It casts Fly once per dawn.");
assert.equal(unresolved.unresolvedCount, 3);
assert.deepEqual(unresolved.notes.filter(note => note.state === "unresolved").map(note => note.label), [
  "Ally-affecting aura",
  "Class-specific resource",
  "Unmapped spell casting"
]);
assert.ok(unresolved.notes.every(note => note.message.length > 0));

const referenced = buildReviewSummaries([{
  kind: "weaponExtraDamage",
  name: "Resolver Test Blade",
  img: "icons/weapons/swords/sword-guard.webp",
  rarity: "rare",
  attunement: "",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  extraDamageParts: [],
  systemReferences: [{
    label: "System equipment",
    message: "Longsword from Equipment",
    uuid: "Compendium.dnd5e.equipment24.phbwepLongsword0"
  }]
}], null)[0];
assert.deepEqual(referenced.notes.filter(note => note.state === "reference").map(note => note.label), ["System equipment"]);
assert.equal(referenced.notes.find(note => note.state === "reference")?.handling, "Compendium.dnd5e.equipment24.phbwepLongsword0");

export const testedReviewSummaryCount = 20;
