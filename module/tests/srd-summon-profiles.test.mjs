import assert from "node:assert/strict";
import { extractNamedSrdSummon, genericSrdSummonActor, namedSrdSummonActor } from "../scripts/srd-summon-profiles.js";

assert.equal(
  extractNamedSrdSummon("Create a book that can summon a Friendly Pseudodragon that serves the user."),
  "Pseudodragon"
);
assert.equal(
  extractNamedSrdSummon("As an action, summon an Owlbear in an unoccupied space within 30 feet."),
  "Owlbear"
);
assert.equal(
  extractNamedSrdSummon("3 charges: Summon Eclipse Hound. As an action, summon a Shadow Mastiff for 1 minute."),
  "Shadow Mastiff"
);
assert.equal(
  extractNamedSrdSummon("Burn 5 charges to call in a friendly Lion for 1 hour."),
  "Lion"
);
assert.equal(
  extractNamedSrdSummon("As an action, summon one friendly Giant Scorpion for 1 hour."),
  "Giant Scorpion"
);
assert.equal(extractNamedSrdSummon("Summon a friendly companion."), "");

assert.deepEqual(genericSrdSummonActor("Owlbear"), {
  name: "Friendly Owlbear",
  srdActorName: "Owlbear",
  requireSrdActor: true
});

assert.deepEqual(namedSrdSummonActor("Fiend (Demon)", "Quasit"), {
  name: "Friendly Fiend (Demon)",
  srdActorName: "Quasit",
  requireSrdActor: true
});

console.log("srd summon profile tests passed");
