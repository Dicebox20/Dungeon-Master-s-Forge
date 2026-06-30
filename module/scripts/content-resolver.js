const SYSTEM_CONTENT_FIELDS = Object.freeze(["name", "type", "system.type.value"]);

const CONTENT_KIND_CONFIG = Object.freeze({
  spell: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.spells"]),
    preferredLabels: Object.freeze(["Spells"]),
    documentNames: Object.freeze(["Item"]),
    matchesEntry: entry => Object.freeze(["spell"]).includes(itemTypeForEntry(entry))
  }),
  equipment: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.equipment"]),
    preferredLabels: Object.freeze(["Equipment"]),
    documentNames: Object.freeze(["Item"]),
    matchesEntry: entry => Object.freeze(["weapon", "equipment", "consumable", "tool", "loot", "backpack", "container"]).includes(itemTypeForEntry(entry))
  }),
  actor: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.actors"]),
    preferredLabels: Object.freeze(["Actors"]),
    documentNames: Object.freeze(["Actor"]),
    matchesEntry: entry => Boolean(String(entry?.name ?? "").trim())
  }),
  monsterFeature: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.monsterfeatures"]),
    preferredLabels: Object.freeze(["Monster Features"]),
    documentNames: Object.freeze(["Item"]),
    matchesEntry: entry => Boolean(String(entry?.name ?? "").trim())
  }),
  rollTable: Object.freeze({
    preferredCollections: Object.freeze(["dnd5e.tables"]),
    preferredLabels: Object.freeze(["Roll Tables"]),
    documentNames: Object.freeze(["RollTable"]),
    matchesEntry: entry => Boolean(String(entry?.name ?? "").trim())
  })
});

const SYSTEM_CONTENT_DIAGNOSTIC_CASES = Object.freeze([
  Object.freeze({ name: "Command", kind: "spell" }),
  Object.freeze({ name: "Flame Strike", kind: "spell" }),
  Object.freeze({ name: "Longsword", kind: "equipment" }),
  Object.freeze({ name: "Plate Armor", kind: "equipment" })
]);

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
  if (Array.isArray(pack?.index)) return pack.index;
  if (typeof pack?.getIndex === "function") {
    const index = await pack.getIndex({ fields: [...SYSTEM_CONTENT_FIELDS] });
    if (Array.isArray(index)) return index;
    if (Array.isArray(index?.contents)) return index.contents;
    if (typeof index?.toObject === "function") return index.toObject();
    if (typeof index?.[Symbol.iterator] === "function") return [...index];
  }
  return [];
}

function candidateSummary(pack, entry, kind) {
  return {
    uuid: `Compendium.${packCollection(pack)}.${entry._id}`,
    name: String(entry.name ?? "").trim(),
    kind,
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

  const packs = Array.from(options.packs ?? globalThis.game?.packs ?? []);
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
  entryMatchesKind,
  finalizeResolution,
  isExactNameMatch,
  isSystemOwnedDnd5ePack,
  modernityScore,
  normalizeLookupName,
  packCollection,
  packDocumentName,
  packLabel,
  packLikelySupportsKind,
  readPackIndex,
  resolveActorByName,
  resolveEquipmentByName,
  resolveMonsterFeatureByName,
  resolveRollTableByName,
  resolveSpellByName,
  resolveSystemContentByName,
  runSystemContentDiagnostics
};
