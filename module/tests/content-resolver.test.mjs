import assert from "node:assert/strict";
import {
  findSystemNonMagicalEquipmentForText,
  entryIdentifier,
  packValues,
  isSystemOwnedDnd5ePack,
  isNonMagicalEquipmentDocument,
  normalizeLookupName,
  resolveDocumentFromMatch,
  resolveActorByName,
  listSystemNonMagicalEquipment,
  nonMagicalEquipmentProfileFromDocument,
  resolveEquipmentByName,
  findSystemNonMagicalWeaponForText,
  isNonMagicalWeaponDocument,
  listSystemNonMagicalWeapons,
  nonMagicalWeaponProfileFromDocument,
  resolveMonsterFeatureByName,
  resolveRollTableByName,
  resolveSpellByName,
  resolveSystemDocument,
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
  const documents = new Map(index.map(entry => [entry._id, { ...entry, uuid: `Compendium.${collection}.${entry._id}` }]));
  return {
    collection,
    documentName,
    metadata: { label, packageType, packageName, system, systemVersion },
    async getIndex() {
      return index;
    },
    async getDocument(id) {
      return documents.get(id) ?? null;
    },
    async getDocuments() {
      return [...documents.values()];
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
      { _id: "command", name: "Command", type: "spell", system: { level: 1 }, img: "systems/dnd5e/icons/svg/spells/command.webp" },
      { _id: "flame-strike", name: "Flame Strike", type: "spell", system: { level: 5 }, img: "systems/dnd5e/icons/svg/spells/flame-strike.webp" }
    ]
  }),
  fakePack({
    collection: "dnd5e.equipment24",
    label: "Equipment",
    index: [
      {
        _id: "trident",
        name: "Trident",
        type: "weapon",
        img: "systems/dnd5e/icons/weapons/trident.webp",
        system: {
          type: { value: "martialM", baseItem: "trident" },
          properties: ["thr", "ver"],
          damage: {
            base: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] },
            versatile: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] }
          },
          range: { value: 20, long: 60, reach: 5, units: "ft" },
          weight: { value: 4, units: "lb" },
          rarity: "common"
        }
      },
      {
        _id: "trident-plus-one",
        name: "Trident +1",
        type: "weapon",
        system: {
          type: { value: "martialM", baseItem: "trident" },
          properties: ["mgc", "thr", "ver"],
          rarity: "uncommon"
        }
      },
      {
        _id: "shield",
        name: "Shield",
        type: "equipment",
        img: "systems/dnd5e/icons/equipment/shield.webp",
        system: {
          type: { value: "shield", baseItem: "shield" },
          armor: { value: 2, dex: null },
          weight: { value: 6, units: "lb" },
          rarity: "common"
        }
      },
      {
        _id: "breastplate",
        name: "Breastplate",
        type: "equipment",
        img: "systems/dnd5e/icons/equipment/breastplate.webp",
        system: {
          type: { value: "medium", baseItem: "breastplate" },
          armor: { value: 14, dex: 2 },
          weight: { value: 20, units: "lb" },
          rarity: "common"
        }
      }
    ]
  }),
  fakePack({
    collection: "dnd5e.equipment",
    label: "Equipment",
    index: [
      { _id: "longsword", name: "Longsword", type: "weapon", img: "systems/dnd5e/icons/svg/items/longsword.webp" },
      { _id: "plate", name: "Plate Armor", type: "equipment", img: "systems/dnd5e/icons/svg/items/plate.webp" }
    ]
  }),
  fakePack({
    collection: "dnd5e.actors24",
    label: "Actors",
    documentName: "Actor",
    index: [
      { _id: "dire-wolf", name: "Dire Wolf", type: "npc" }
    ]
  }),
  fakePack({
    collection: "dnd5e.monsters",
    label: "Monsters",
    documentName: "Actor",
    index: [
      { _id: "giant-spider", name: "Giant Spider", type: "npc" }
    ]
  }),
  fakePack({
    collection: "dnd5e.monsterfeatures",
    label: "Monster Features",
    index: [
      { _id: "magic-resistance", name: "Magic Resistance", type: "feat" }
    ]
  }),
  fakePack({
    collection: "dnd5e.tables24",
    label: "Roll Tables",
    documentName: "RollTable",
    index: [
      { _id: "wand-of-wonder-effects", name: "Wand of Wonder Effects" }
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
assert.equal(entryIdentifier({ id: "document-id" }), "document-id");
assert.equal(packValues({ packs: { contents: packs } }).length, packs.length);
assert.equal(isSystemOwnedDnd5ePack(packs[1]), true);
assert.equal(isSystemOwnedDnd5ePack(packs[8]), false);

const command = await resolveSpellByName("Command", { packs });
assert.equal(command.status, "compatible");
assert.equal(command.match.pack.collection, "dnd5e.spells");
assert.equal(command.match.uuid, "Compendium.dnd5e.spells.command");
assert.equal(command.match.img, "systems/dnd5e/icons/svg/spells/command.webp");
assert.equal(command.match.spellLevel, 1);

const commandDoc = await resolveSystemDocument(command, { packs });
assert.equal(commandDoc?.name, "Command");
assert.equal(commandDoc?.uuid, "Compendium.dnd5e.spells.command");

const directDoc = await resolveDocumentFromMatch(command.match, { packs });
assert.equal(directDoc?.name, "Command");

const longsword = await resolveEquipmentByName("Longsword", { packs });
assert.equal(longsword.status, "compatible");
assert.equal(longsword.match.pack.collection, "dnd5e.equipment");
assert.equal(longsword.match.img, "systems/dnd5e/icons/svg/items/longsword.webp");

const weapons = await listSystemNonMagicalWeapons({ packs });
assert.equal(weapons.length, 1);
assert.equal(weapons[0].name, "Trident");
assert.equal(weapons[0].weaponType, "martialM");
assert.equal(weapons[0].damage.versatile.denomination, 8);
assert.equal(weapons[0].range.long, 60);
assert.equal(weapons[0].weight, 4);
assert.equal((await findSystemNonMagicalWeaponForText("Create a frost trident with a guardian summon.", { packs }))?.baseItem, "trident");
assert.equal(isNonMagicalWeaponDocument({ type: "weapon", system: { type: { baseItem: "trident" }, properties: ["mgc"] } }), false);
assert.equal(nonMagicalWeaponProfileFromDocument({ type: "weapon", system: { type: { baseItem: "trident" }, properties: ["mgc"] } }), null);

const equipmentProfiles = await listSystemNonMagicalEquipment({ packs });
assert.equal(equipmentProfiles.length, 2);
assert.equal(equipmentProfiles[0].baseItem, "breastplate");
assert.equal(equipmentProfiles[1].baseItem, "shield");
assert.equal((await findSystemNonMagicalEquipmentForText("Create a fire ward shield that protects the bearer.", { packs }))?.baseItem, "shield");
assert.equal((await findSystemNonMagicalEquipmentForText("Create a breastplate that stores radiant energy.", { packs }))?.equipmentType, "medium");
assert.equal(isNonMagicalEquipmentDocument({ type: "equipment", system: { type: { baseItem: "shield" }, rarity: "common" } }), true);
assert.equal(isNonMagicalEquipmentDocument({ type: "equipment", system: { type: { baseItem: "shield" }, properties: ["mgc"] } }), false);
assert.equal(nonMagicalEquipmentProfileFromDocument({ type: "equipment", img: "icons/shield.webp", system: { type: { value: "shield", baseItem: "shield" }, armor: { value: 2, dex: null }, weight: { value: 6 } } })?.equipmentType, "shield");

const direWolf = await resolveActorByName("Dire Wolf", { packs });
assert.equal(direWolf.status, "compatible");
assert.equal(direWolf.match.pack.collection, "dnd5e.actors24");
assert.equal(direWolf.match.documentType, "Actor");

const giantSpider = await resolveActorByName("Giant Spider", { packs });
assert.equal(giantSpider.status, "compatible");
assert.equal(giantSpider.match.pack.collection, "dnd5e.monsters");
assert.equal(giantSpider.match.documentType, "Actor");

const collectionIndexPack = {
  ...fakePack({
    collection: "dnd5e.legacy-monsters",
    label: "Legacy Monsters",
    documentName: "Actor",
    index: []
  }),
  index: {
    contents: [{ _id: "owl", name: "Owl", type: "npc" }]
  }
};
const owl = await resolveActorByName("Owl", { packs: [collectionIndexPack] });
assert.equal(owl.status, "compatible");
assert.equal(owl.match.pack.collection, "dnd5e.legacy-monsters");

const objectIndexPack = {
  ...fakePack({
    collection: "dnd5e.object-monsters",
    label: "Object Monsters",
    documentName: "Actor",
    index: []
  }),
  index: {
    owl: { _id: "owl", name: "Object Owl", type: "npc" }
  }
};
const objectOwl = await resolveActorByName("Object Owl", { packs: [objectIndexPack] });
assert.equal(objectOwl.status, "compatible");
assert.equal(objectOwl.match.pack.collection, "dnd5e.object-monsters");

const documentFallbackPack = {
  ...fakePack({
    collection: "dnd5e.document-monsters",
    label: "Document Monsters",
    documentName: "Actor",
    index: []
  }),
  async getDocuments() {
    return [{ _id: "document-spider", name: "Document Spider", type: "npc" }];
  }
};
const documentSpider = await resolveActorByName("Document Spider", { packs: [documentFallbackPack] });
assert.equal(documentSpider.status, "compatible");
assert.equal(documentSpider.match.pack.collection, "dnd5e.document-monsters");

const documentLookupFallbackPack = {
  ...fakePack({
    collection: "dnd5e.lookup-fallback-monsters",
    label: "Lookup Fallback Monsters",
    documentName: "Actor",
    index: [{ _id: "lookup-spider", name: "Lookup Spider", type: "npc" }]
  }),
  async getDocument() {
    return null;
  }
};
const lookupSpiderResolution = await resolveActorByName("Lookup Spider", { packs: [documentLookupFallbackPack] });
assert.equal(lookupSpiderResolution.status, "compatible");
const lookupSpiderDocument = await resolveDocumentFromMatch(lookupSpiderResolution.match, { packs: [documentLookupFallbackPack] });
assert.equal(lookupSpiderDocument?.name, "Lookup Spider");

const worldActorPack = fakePack({
  collection: "world.custom-actors",
  label: "Custom Actors",
  packageType: "world",
  packageName: "custom-world",
  system: "dnd5e",
  documentName: "Actor",
  index: [{ _id: "world-dire-wolf", name: "Dire Wolf", type: "npc" }]
});
const systemOwnedDireWolf = await resolveActorByName("Dire Wolf", { packs: [...packs, worldActorPack] });
assert.equal(systemOwnedDireWolf.status, "compatible");
assert.equal(systemOwnedDireWolf.match.pack.collection, "dnd5e.actors24");
const worldOnlyDireWolf = await resolveActorByName("Dire Wolf", { packs: [worldActorPack] });
assert.equal(worldOnlyDireWolf.status, "not-found");

const magicResistance = await resolveMonsterFeatureByName("Magic Resistance", { packs });
assert.equal(magicResistance.status, "compatible");
assert.equal(magicResistance.match.pack.collection, "dnd5e.monsterfeatures");

const wandOfWonderEffects = await resolveRollTableByName("Wand of Wonder Effects", { packs });
assert.equal(wandOfWonderEffects.status, "compatible");
assert.equal(wandOfWonderEffects.match.pack.collection, "dnd5e.tables24");
assert.equal(wandOfWonderEffects.match.documentType, "RollTable");

const missing = await resolveSystemContentByName("Meteor Hammer", "equipment", { packs });
assert.equal(missing.status, "not-found");

const diagnostics = await runSystemContentDiagnostics({ packs });
assert.equal(diagnostics.healthy, true);
assert.equal(diagnostics.total, 7);

export const testedContentResolverCases = 32;
