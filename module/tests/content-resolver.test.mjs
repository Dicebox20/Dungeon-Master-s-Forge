import assert from "node:assert/strict";
import {
  isSystemOwnedDnd5ePack,
  normalizeLookupName,
  resolveEquipmentByName,
  resolveSpellByName,
  resolveSystemContentByName,
  runSystemContentDiagnostics
} from "../scripts/content-resolver.js";

function fakePack({
  collection,
  label,
  packageType = "system",
  packageName = "dnd5e",
  system = "dnd5e",
  systemVersion = "5.3.3",
  documentName = "Item",
  index = []
}) {
  return {
    collection,
    documentName,
    metadata: { label, packageType, packageName, system, systemVersion },
    async getIndex() {
      return index;
    }
  };
}

const packs = [
  fakePack({
    collection: "dnd5e.legacy-spells",
    label: "Legacy Spells",
    index: [{ _id: "legacy-command", name: "Command", type: "spell" }]
  }),
  fakePack({
    collection: "dnd5e.spells",
    label: "Spells",
    index: [
      { _id: "command", name: "Command", type: "spell" },
      { _id: "flame-strike", name: "Flame Strike", type: "spell" }
    ]
  }),
  fakePack({
    collection: "dnd5e.equipment",
    label: "Equipment",
    index: [
      { _id: "longsword", name: "Longsword", type: "weapon" },
      { _id: "plate", name: "Plate Armor", type: "equipment" }
    ]
  }),
  fakePack({
    collection: "world.custom-items",
    label: "Custom Items",
    packageType: "world",
    packageName: "custom-world",
    system: "dnd5e",
    index: [{ _id: "world-command", name: "Command", type: "spell" }]
  })
];

assert.equal(normalizeLookupName("  Flame   Strike "), "flame strike");
assert.equal(isSystemOwnedDnd5ePack(packs[1]), true);
assert.equal(isSystemOwnedDnd5ePack(packs[3]), false);

const command = await resolveSpellByName("Command", { packs });
assert.equal(command.status, "compatible");
assert.equal(command.match.pack.collection, "dnd5e.spells");
assert.equal(command.match.uuid, "Compendium.dnd5e.spells.command");

const longsword = await resolveEquipmentByName("Longsword", { packs });
assert.equal(longsword.status, "compatible");
assert.equal(longsword.match.pack.collection, "dnd5e.equipment");

const missing = await resolveSystemContentByName("Meteor Hammer", "equipment", { packs });
assert.equal(missing.status, "not-found");

const diagnostics = await runSystemContentDiagnostics({ packs });
assert.equal(diagnostics.healthy, true);
assert.equal(diagnostics.total, 4);

export const testedContentResolverCases = 8;
