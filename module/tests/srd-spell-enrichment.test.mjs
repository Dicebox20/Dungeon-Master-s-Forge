import assert from "node:assert/strict";
import { autoSelectSrdChoiceSpells, requestedSpellChoiceCount } from "../scripts/srd-spell-enrichment.js";

assert.equal(requestedSpellChoiceCount("It has 10 charges with 3 spells of your choice."), 3);

const compatibleSpell = name => ({
  status: "compatible",
  match: {
    uuid: `Compendium.dnd5e.spells.${name.toLowerCase().replace(/\s+/g, "-")}`,
    pack: { label: "Spells" },
    documentType: "Item"
  }
});

const result = await autoSelectSrdChoiceSpells({
  kind: "weaponExtraDamage",
  name: "Flame-Thunder Greatsword",
  description: "A very rare greatsword with 10 charges and 3 spells of your choice.",
  extraDamageParts: [
    { number: 1, denomination: 6, bonus: "", types: ["fire"] },
    { number: 1, denomination: 6, bonus: "", types: ["thunder"] }
  ]
}, "Greatsword that is very rare quality. It has +2. It deals additional fire damage and thunder damage. It has 10 charges with 3 spells of your choice.", {
  resolveSpell: async name => compatibleSpell(name)
});

assert.equal(result.applied, true);
assert.deepEqual(result.chosenSpells, ["Thunderwave", "Shatter", "Fireball"]);
assert.equal(result.spec.saveActivities.length, 3);
assert.equal(result.spec.saveActivities[0].chargeCost, 1);
assert.equal(result.spec.saveActivities[1].chargeCost, 2);
assert.equal(result.spec.saveActivities[2].chargeCost, 3);
assert.equal(result.spec.systemReferences.length, 3);
assert.equal(result.spec.uses.max, "10");

const unresolvedResult = await autoSelectSrdChoiceSpells({
  kind: "weaponExtraDamage",
  name: "Already Explicit Blade",
  saveActivities: [{ activityName: "Cast Fireball" }]
}, "It has 3 spells of your choice.", {
  resolveSpell: async name => compatibleSpell(name)
});

assert.equal(unresolvedResult.applied, false);

export const testedSrdSpellEnrichmentCases = 8;
