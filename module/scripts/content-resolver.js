import { normalizeWeight } from "./equipment-normalization.js";

const SYSTEM_CONTENT_FIELDS = Object.freeze([
  "name",
  "type",
  "system.type.value",
  "system.type.baseItem",
  "system.level",
  "system.rarity",
  "system.properties",
  "system.damage.base",
  "system.damage.versatile",
  "system.range",
  "system.mastery",
  "system.weight",
  "img"
]);

const CONTENT_KIND_CONFIG = Object.freeze({
  spell: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.spells24", "dnd5e.spells"]),
    preferredLabels: Object.freeze(["Spells"]),
    documentNames: Object.freeze(["Item"]),
    matchesEntry: entry => Object.freeze(["spell"]).includes(itemTypeForEntry(entry))
  }),
  equipment: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.equipment24", "dnd5e.equipment"]),
    preferredLabels: Object.freeze(["Equipment"]),
    documentNames: Object.freeze(["Item"]),
    matchesEntry: entry => Object.freeze(["weapon", "equipment", "consumable", "tool", "loot", "backpack", "container"]).includes(itemTypeForEntry(entry))
  }),
  actor: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.actors24", "dnd5e.actors", "dnd5e.monsters"]),
    preferredLabels: Object.freeze(["Actors"]),
    documentNames: Object.freeze(["Actor"]),
    matchesEntry: entry => Boolean(String(entry?.name ?? "").trim())
  }),
  monsterFeature: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.monsterfeatures24", "dnd5e.monsterfeatures"]),
    preferredLabels: Object.freeze(["Monster Features"]),
    documentNames: Object.freeze(["Item"]),
    matchesEntry: entry => Boolean(String(entry?.name ?? "").trim())
  }),
  rollTable: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.tables24", "dnd5e.tables"]),
    preferredLabels: Object.freeze(["Roll Tables"]),
    documentNames: Object.freeze(["RollTable"]),
    matchesEntry: entry => Boolean(String(entry?.name ?? "").trim())
  })
});

const SYSTEM_CONTENT_DIAGNOSTIC_CASES = Object.freeze([
  Object.freeze({ name: "Command", kind: "spell" }),
  Object.freeze({ name: "Flame Strike", kind: "spell" }),
  Object.freeze({ name: "Longsword", kind: "equipment" }),
  Object.freeze({ name: "Plate Armor", kind: "equipment" }),
  Object.freeze({ name: "Dire Wolf", kind: "actor" }),
  Object.freeze({ name: "Magic Resistance", kind: "monsterFeature" }),
  Object.freeze({ name: "Wand of Wonder Effects", kind: "rollTable" })
]);

let liveNonMagicalWeaponCatalogue = null;
let liveNonMagicalEquipmentCatalogue = null;

function normalizeLookupName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function packMetadata(pack) {
  return pack?.metadata && typeof pack.metadata === "object" ? pack.metadata : {};
}

function packCollection(pack) {
  return String(pack?.collection ?? packMetadata(pack).id ?? "").trim();
}

function packLabel(pack) {
  return String(pack?.title ?? pack?.label ?? packMetadata(pack).label ?? packCollection(pack)).trim();
}

function packDocumentName(pack) {
  return String(pack?.documentName ?? packMetadata(pack).type ?? "").trim();
}

function packPackageType(pack) {
  return String(packMetadata(pack).packageType ?? "").trim().toLowerCase();
}

function packPackageName(pack) {
  return String(packMetadata(pack).packageName ?? packMetadata(pack).package ?? "").trim();
}

function packSystemId(pack) {
  return String(packMetadata(pack).system ?? packPackageName(pack)).trim();
}

function packSystemVersion(pack) {
  return String(packMetadata(pack).systemVersion ?? packMetadata(pack).packageVersion ?? "").trim();
}

function itemTypeForEntry(entry = {}) {
  return String(entry.type ?? entry.system?.type?.value ?? "").trim().toLowerCase();
}

function documentSource(document = {}) {
  return typeof document?.toObject === "function" ? document.toObject() : document;
}

function entryIdentifier(entry = {}) {
  return String(entry?._id ?? entry?.id ?? "").trim();
}

function collectionValues(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.contents)) return value.contents;
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value?.[Symbol.iterator] === "function") return [...value];
  return [];
}

function packValues(options = {}) {
  return collectionValues(options.packs ?? globalThis.game?.packs);
}

function indexValues(value) {
  const entries = collectionValues(value);
  if (entries.length) return entries;
  if (value && typeof value === "object") {
    return Object.values(value).filter(entry => entry && typeof entry === "object");
  }
  return [];
}

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function documentPropertySet(document) {
  const source = documentSource(document);
  return new Set(collectionValues(source?.system?.properties).map(value => String(value).trim().toLowerCase()).filter(Boolean));
}

function documentRarity(document) {
  return String(documentSource(document)?.system?.rarity ?? "").trim().toLowerCase();
}

function isMundaneSystemDocument(document) {
  const properties = documentPropertySet(document);
  if (properties.has("mgc")) return false;
  const rarity = documentRarity(document);
  return !rarity || rarity === "common";
}

function isNonMagicalWeaponDocument(document) {
  const source = documentSource(document);
  if (String(source?.type ?? "").trim().toLowerCase() !== "weapon") return false;
  if (!String(source?.system?.type?.baseItem ?? "").trim()) return false;
  return isMundaneSystemDocument(document);
}

function nonMagicalWeaponProfileFromDocument(document) {
  if (!isNonMagicalWeaponDocument(document)) return null;
  const source = documentSource(document);
  const system = source.system ?? {};
  return {
    name: String(source.name ?? "").trim(),
    baseItem: String(system.type?.baseItem ?? "").trim(),
    weaponType: String(system.type?.value ?? "").trim(),
    damage: {
      base: cloneData(system.damage?.base ?? {}),
      versatile: cloneData(system.damage?.versatile ?? {})
    },
    properties: collectionValues(system.properties).map(value => String(value).trim()).filter(Boolean),
    range: cloneData(system.range ?? {}),
    mastery: String(system.mastery ?? "").trim(),
    weight: normalizeWeight(system.weight, null),
    img: String(source.img ?? "").trim(),
    sourceUuid: String(document?.uuid ?? source.uuid ?? "").trim()
  };
}

function isNonMagicalEquipmentDocument(document) {
  const source = documentSource(document);
  if (String(source?.type ?? "").trim().toLowerCase() !== "equipment") return false;
  if (!String(source?.system?.type?.baseItem ?? "").trim()) return false;
  return isMundaneSystemDocument(document);
}

function nonMagicalEquipmentProfileFromDocument(document) {
  if (!isNonMagicalEquipmentDocument(document)) return null;
  const source = documentSource(document);
  const system = source.system ?? {};
  return {
    name: String(source.name ?? "").trim(),
    itemType: "equipment",
    equipmentType: String(system.type?.value ?? "").trim(),
    baseItem: String(system.type?.baseItem ?? "").trim(),
    armorValue: Number(system.armor?.value ?? 0) || 0,
    armorDex: system.armor?.dex ?? null,
    strength: system.strength ?? null,
    weight: normalizeWeight(system.weight, null),
    img: String(source.img ?? "").trim(),
    sourceUuid: String(document?.uuid ?? source.uuid ?? "").trim()
  };
}

function isExactNameMatch(candidateName, requestedName) {
  return normalizeLookupName(candidateName) !== ""
    && normalizeLookupName(candidateName) === normalizeLookupName(requestedName);
}

function isSystemOwnedDnd5ePack(pack) {
  const collection = packCollection(pack).toLowerCase();
  const packageType = packPackageType(pack);
  const packageName = packPackageName(pack).toLowerCase();
  const systemId = packSystemId(pack).toLowerCase();
  return collection.startsWith("dnd5e.")
    || (packageType === "system" && (packageName === "dnd5e" || systemId === "dnd5e"));
}

function kindConfig(kind) {
  const config = CONTENT_KIND_CONFIG[kind];
  if (!config) throw new Error(`Unsupported system content kind "${kind}".`);
  return config;
}

function entryMatchesKind(entry, kind) {
  const config = kindConfig(kind);
  return config.matchesEntry(entry);
}

function packLikelySupportsKind(pack, kind) {
  const config = kindConfig(kind);
  if (!config.documentNames.includes(packDocumentName(pack))) return false;
  const collection = packCollection(pack).toLowerCase();
  const label = packLabel(pack).toLowerCase();
  return config.preferredCollections.includes(collection)
    || config.preferredLabels.some(preferred => label === preferred.toLowerCase());
}

function modernityScore(pack, kind) {
  const config = kindConfig(kind);
  const collection = packCollection(pack).toLowerCase();
  const label = packLabel(pack).toLowerCase();
  let score = 0;
  if (isSystemOwnedDnd5ePack(pack)) score += 100;
  if (config.preferredCollections.includes(collection)) score += 50;
  if (config.preferredLabels.some(preferred => label === preferred.toLowerCase())) score += 30;
  if (/legacy|old|deprecated/i.test(label)) score -= 25;
  return score;
}

async function readPackIndex(pack) {
  const directIndex = indexValues(pack?.index);
  if (directIndex.length) return directIndex;
  if (typeof pack?.getIndex === "function") {
    const index = await pack.getIndex({ fields: [...SYSTEM_CONTENT_FIELDS] });
    const entries = indexValues(index);
    if (entries.length) return entries;
    if (typeof index?.toObject === "function") {
      const object = index.toObject();
      if (Array.isArray(object)) return object;
      if (object && typeof object === "object") return Object.values(object);
    }
  }
  if (typeof pack?.getDocuments === "function") {
    const documents = await pack.getDocuments();
    const entries = documents.map(document => documentSource(document));
    if (entries.length) return entries;
  }
  return [];
}

function candidateSummary(pack, entry, kind) {
  return {
    entryId: entryIdentifier(entry),
    uuid: `Compendium.${packCollection(pack)}.${entryIdentifier(entry)}`,
    name: String(entry.name ?? "").trim(),
    img: String(entry.img ?? "").trim(),
    kind,
    spellLevel: kind === "spell" ? Number(entry.system?.level ?? 0) : null,
    documentType: packDocumentName(pack) || "Item",
    itemType: itemTypeForEntry(entry),
    pack: {
      collection: packCollection(pack),
      label: packLabel(pack),
      packageType: packPackageType(pack),
      packageName: packPackageName(pack),
      systemId: packSystemId(pack),
      systemVersion: packSystemVersion(pack)
    },
    compatibility: {
      exactName: true,
      systemOwned: isSystemOwnedDnd5ePack(pack),
      likelyModern: modernityScore(pack, kind) >= 130,
      preferredPack: packLikelySupportsKind(pack, kind)
    },
    rank: modernityScore(pack, kind)
  };
}

function findPackByCollection(collection, options = {}) {
  const target = String(collection ?? "").trim().toLowerCase();
  if (!target) return null;
  const packs = packValues(options);
  return packs.find(pack => packCollection(pack).toLowerCase() === target) ?? null;
}

async function resolveDocumentFromMatch(match, options = {}) {
  const collection = String(match?.pack?.collection ?? "").trim();
  const entryId = String(match?.entryId ?? "").trim();
  if (!collection || !entryId) return null;
  const pack = findPackByCollection(collection, options);
  if (!pack || typeof pack.getDocument !== "function") return null;
  const direct = await pack.getDocument(entryId);
  if (direct) return direct;
  if (typeof pack.getDocuments !== "function") return null;
  const documents = await pack.getDocuments();
  return documents.find(document => {
    const source = documentSource(document);
    return String(document?.id ?? source?._id ?? source?.id ?? "").trim() === entryId
      || isExactNameMatch(source?.name, match?.name);
  }) ?? null;
}

async function resolveSystemDocument(resolution, options = {}) {
  if (resolution?.status !== "compatible") return null;
  return resolveDocumentFromMatch(resolution.match, options);
}

function finalizeResolution(name, kind, candidates) {
  if (!candidates.length) {
    return {
      status: "not-found",
      requestedName: name,
      kind,
      message: `No system-owned DND5e ${kind} named "${name}" was found.`,
      candidates: []
    };
  }

  const matchingKind = candidates.filter(candidate => candidate.kind === kind);
  if (!matchingKind.length) {
    return {
      status: "incompatible",
      requestedName: name,
      kind,
      message: `Exact-name matches were found for "${name}", but none were compatible ${kind} entries.`,
      candidates
    };
  }

  const highestRank = Math.max(...matchingKind.map(candidate => candidate.rank));
  const bestCandidates = matchingKind.filter(candidate => candidate.rank === highestRank);
  if (bestCandidates.length > 1) {
    return {
      status: "ambiguous",
      requestedName: name,
      kind,
      message: `Multiple equally suitable system-owned DND5e ${kind} entries named "${name}" were found.`,
      candidates: bestCandidates,
      alternatives: matchingKind.filter(candidate => candidate.rank < highestRank)
    };
  }

  return {
    status: "compatible",
    requestedName: name,
    kind,
    match: bestCandidates[0],
    alternatives: matchingKind.filter(candidate => candidate.uuid !== bestCandidates[0].uuid),
    message: `Resolved "${name}" to ${bestCandidates[0].pack.label}.`
  };
}

async function resolveSystemContentByName(name, kind, options = {}) {
  const requestedName = String(name ?? "").trim();
  if (!requestedName) throw new Error("System content lookup requires a name.");

  const packs = packValues(options);
  const candidates = [];
  for (const pack of packs) {
    if (!isSystemOwnedDnd5ePack(pack)) continue;
    const config = kindConfig(kind);
    if (!config.documentNames.includes(packDocumentName(pack))) continue;
    if (!packLikelySupportsKind(pack, kind) && !packCollection(pack).toLowerCase().startsWith("dnd5e.")) continue;

    const entries = await readPackIndex(pack);
    for (const entry of entries) {
      if (!isExactNameMatch(entry?.name, requestedName)) continue;
      if (!entryMatchesKind(entry, kind)) continue;
      candidates.push(candidateSummary(pack, entry, kind));
    }
  }

  return finalizeResolution(requestedName, kind, candidates);
}

async function resolveSpellByName(name, options = {}) {
  return resolveSystemContentByName(name, "spell", options);
}

async function resolveEquipmentByName(name, options = {}) {
  return resolveSystemContentByName(name, "equipment", options);
}

async function buildSystemNonMagicalWeaponCatalogue(packs) {
  return buildBestRankedSystemCatalogue(packs, {
    kind: "equipment",
    profileFromDocument: nonMagicalWeaponProfileFromDocument
  });
}

async function buildSystemNonMagicalEquipmentCatalogue(packs) {
  return buildBestRankedSystemCatalogue(packs, {
    kind: "equipment",
    profileFromDocument: nonMagicalEquipmentProfileFromDocument
  });
}

async function buildBestRankedSystemCatalogue(packs, { kind, profileFromDocument }) {
  const profiles = [];
  for (const pack of packs) {
    if (!isSystemOwnedDnd5ePack(pack) || !packLikelySupportsKind(pack, kind)) continue;
    if (typeof pack.getDocuments !== "function") continue;
    const documents = await pack.getDocuments();
    for (const document of documents) {
      const profile = profileFromDocument(document);
      if (!profile) continue;
      profiles.push({
        ...profile,
        pack: {
          collection: packCollection(pack),
          label: packLabel(pack)
        },
        rank: modernityScore(pack, kind)
      });
    }
  }

  const byBaseItem = new Map();
  for (const profile of profiles) {
    const key = normalizeLookupName(profile.baseItem || profile.name);
    const existing = byBaseItem.get(key);
    if (!existing || profile.rank > existing.rank) byBaseItem.set(key, profile);
  }
  return Object.freeze([...byBaseItem.values()].sort((left, right) => left.name.localeCompare(right.name)));
}

async function listSystemNonMagicalWeapons(options = {}) {
  if (options.packs) return buildSystemNonMagicalWeaponCatalogue(packValues(options));
  if (!liveNonMagicalWeaponCatalogue) {
    liveNonMagicalWeaponCatalogue = buildSystemNonMagicalWeaponCatalogue(packValues())
      .catch(error => {
        liveNonMagicalWeaponCatalogue = null;
        throw error;
      });
  }
  return liveNonMagicalWeaponCatalogue;
}

async function listSystemNonMagicalEquipment(options = {}) {
  if (options.packs) return buildSystemNonMagicalEquipmentCatalogue(packValues(options));
  if (!liveNonMagicalEquipmentCatalogue) {
    liveNonMagicalEquipmentCatalogue = buildSystemNonMagicalEquipmentCatalogue(packValues())
      .catch(error => {
        liveNonMagicalEquipmentCatalogue = null;
        throw error;
      });
  }
  return liveNonMagicalEquipmentCatalogue;
}

function textIncludesBaseProfile(text, profile) {
  const normalized = normalizeLookupName(text);
  const candidates = [profile.name, profile.baseItem]
    .map(normalizeLookupName)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  return candidates.some(candidate => new RegExp(`(^|[^a-z0-9])${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(normalized));
}

async function findSystemNonMagicalWeaponForText(text, options = {}) {
  const profiles = await listSystemNonMagicalWeapons(options);
  return profiles
    .filter(profile => textIncludesBaseProfile(text, profile))
    .sort((left, right) => right.name.length - left.name.length)[0] ?? null;
}

async function findSystemNonMagicalEquipmentForText(text, options = {}) {
  const profiles = await listSystemNonMagicalEquipment(options);
  return profiles
    .filter(profile => textIncludesBaseProfile(text, profile))
    .sort((left, right) => right.name.length - left.name.length)[0] ?? null;
}

async function resolveActorByName(name, options = {}) {
  return resolveSystemContentByName(name, "actor", options);
}

async function resolveMonsterFeatureByName(name, options = {}) {
  return resolveSystemContentByName(name, "monsterFeature", options);
}

async function resolveRollTableByName(name, options = {}) {
  return resolveSystemContentByName(name, "rollTable", options);
}

async function runSystemContentDiagnostics(options = {}) {
  const results = [];
  for (const testCase of SYSTEM_CONTENT_DIAGNOSTIC_CASES) {
    try {
      const resolution = await resolveSystemContentByName(testCase.name, testCase.kind, options);
      if (resolution.status !== "compatible") {
        throw new Error(resolution.message);
      }
      results.push({
        name: `${testCase.kind}: ${testCase.name}`,
        passed: true,
        kind: `system-${testCase.kind}`,
        message: `${resolution.match.pack.label} (${resolution.match.uuid})`
      });
    } catch (error) {
      results.push({
        name: `${testCase.kind}: ${testCase.name}`,
        passed: false,
        kind: `system-${testCase.kind}`,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const passed = results.filter(result => result.passed).length;
  return {
    passed,
    failed: results.length - passed,
    total: results.length,
    healthy: passed === results.length,
    results
  };
}

export {
  CONTENT_KIND_CONFIG,
  SYSTEM_CONTENT_DIAGNOSTIC_CASES,
  SYSTEM_CONTENT_FIELDS,
  candidateSummary,
  entryIdentifier,
  entryMatchesKind,
  finalizeResolution,
  findSystemNonMagicalEquipmentForText,
  findSystemNonMagicalWeaponForText,
  findPackByCollection,
  isExactNameMatch,
  isNonMagicalEquipmentDocument,
  isNonMagicalWeaponDocument,
  isSystemOwnedDnd5ePack,
  listSystemNonMagicalEquipment,
  listSystemNonMagicalWeapons,
  modernityScore,
  nonMagicalEquipmentProfileFromDocument,
  nonMagicalWeaponProfileFromDocument,
  normalizeLookupName,
  packCollection,
  packDocumentName,
  packValues,
  packLabel,
  packLikelySupportsKind,
  readPackIndex,
  resolveActorByName,
  resolveDocumentFromMatch,
  resolveEquipmentByName,
  resolveMonsterFeatureByName,
  resolveRollTableByName,
  resolveSpellByName,
  resolveSystemDocument,
  resolveSystemContentByName,
  runSystemContentDiagnostics
};
