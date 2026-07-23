import { MODULE_ID, readForgeFlags } from "./package-identity.js";
import { normalizeAutomationContract } from "./automation-contract.js";

const DEFAULT_VERIFICATION_WORLD_ID = "dmf-test-world";
const VERIFICATION_ACTOR_NAME = "DMF Verification Actor";
const VERIFICATION_ITEM_FOLDER = "DMF Verification Items";
const VERIFICATION_SUMMON_FOLDER = "DMF Verification Summons";
const VERIFICATION_ACTOR_FOLDER = "DMF Verification Actors";
const VERIFICATION_ACTOR_FIXTURE_SPECS = Object.freeze([
  Object.freeze({
    role: "subject",
    label: "DMF Test Subject",
    sourceNames: Object.freeze(["Priest", "Acolyte", "Veteran"]),
    purpose: "Primary wielder and caster; use for concentration, self-target, resource, and activity tests."
  }),
  Object.freeze({
    role: "ally",
    label: "DMF Test Ally",
    sourceNames: Object.freeze(["Guard", "Commoner"]),
    purpose: "Friendly target for reactions, damage reduction, healing, and ally filtering."
  }),
  Object.freeze({
    role: "hostile-save",
    label: "DMF Test Hostile Save",
    sourceNames: Object.freeze(["Goblin", "Kobold"]),
    purpose: "Primary hostile target for saves, conditions, hit filtering, and damage."
  }),
  Object.freeze({
    role: "hostile-second",
    label: "DMF Test Hostile Second",
    sourceNames: Object.freeze(["Wolf", "Goblin", "Kobold"]),
    purpose: "Second hostile target for multi-target and once-per-turn filtering."
  }),
  Object.freeze({
    role: "hostile-durable",
    label: "DMF Test Hostile Durable",
    sourceNames: Object.freeze(["Ogre", "Bugbear", "Veteran"]),
    purpose: "Durable target for repeated damage, aura ticks, concentration, and repair reruns."
  })
]);

function clone(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeRunTag(runTag) {
  const normalized = String(runTag ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(normalized)) {
    throw new Error("Verification run tags must be 3-81 characters using letters, numbers, dots, underscores, or hyphens.");
  }
  return normalized;
}

function assertVerificationBoundary({
  enabled = false,
  isGM = false,
  worldId = "",
  expectedWorldId = DEFAULT_VERIFICATION_WORLD_ID
} = {}) {
  if (enabled !== true) throw new Error("Enable the isolated verification harness before setup or a test run.");
  if (isGM !== true) throw new Error("Only a GM can run the isolated verification harness.");
  if (!expectedWorldId || worldId !== expectedWorldId) {
    throw new Error(`Verification is restricted to the configured test world "${expectedWorldId || DEFAULT_VERIFICATION_WORLD_ID}".`);
  }
  return true;
}

function expectedDocumentType(spec = {}) {
  if (spec.documentType) return spec.documentType;
  if (["weaponExtraDamage", "weaponConditionOnHit", "artifactWeaponHybrid"].includes(spec.kind)) return "weapon";
  if (["shieldArmorBonus", "passiveEffectEquipment"].includes(spec.kind) && (spec.armorType || spec.baseItem || spec.shield)) return "equipment";
  if (spec.consumable === true || spec.consumedOnUse === true) return "consumable";
  return "";
}

function expectedActivityCount(spec = {}) {
  return ["attackActivities", "saveActivities", "utilityActivities", "activities"]
    .reduce((total, key) => total + (Array.isArray(spec[key]) ? spec[key].length : 0), 0)
    + (spec.summonActivity ? 1 : 0);
}

function expectedEffectCount(spec = {}) {
  return (Array.isArray(spec.effects) ? spec.effects.length : 0)
    + (Array.isArray(spec.activeEffects) ? spec.activeEffects.length : 0);
}

function expectedUses(spec = {}) {
  const max = spec.uses?.max ?? spec.uses?.value ?? spec.charges?.max ?? spec.charges ?? null;
  if (max == null || String(max).trim() === "") return null;
  return Number.isFinite(Number(max)) ? Number(max) : null;
}

function expectedStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(entry => String(entry ?? "").trim()).filter(Boolean))];
}

function buildVerificationExpectation(spec = {}) {
  const automation = normalizeAutomationContract(spec.automation);
  const automationRoutes = [
    ...(spec.automation ? [spec.automation] : []),
    ...(Array.isArray(spec.automationRoutes) ? spec.automationRoutes : [])
  ].map(normalizeAutomationContract).filter((route, index, all) => all.findIndex(candidate => candidate.recipe === route.recipe) === index);
  const expectedActivityTypes = expectedStringList(spec.expectedActivityTypes);
  const expectedEffectKeys = expectedStringList(spec.expectedEffectKeys);
  const expectation = {
    kind: spec.kind ?? "",
    name: spec.name ?? "",
    documentType: expectedDocumentType(spec),
    minimumActivities: expectedActivityCount(spec),
    minimumEffects: expectedEffectCount(spec),
    expectedUses: expectedUses(spec),
    minimumSummonProfiles: Array.isArray(spec.summonProfiles) ? spec.summonProfiles.length : 0,
    automationRecipe: automation?.recipe ?? "",
    automationWorkflowPass: automation?.workflowPass ?? "",
    automationTargetSource: automation?.targetSource ?? ""
  };
  if (expectedActivityTypes.length) expectation.expectedActivityTypes = expectedActivityTypes;
  if (expectedEffectKeys.length) expectation.expectedEffectKeys = expectedEffectKeys;
  if (spec.expectedMacroActivities != null) expectation.minimumMacroActivities = Number(spec.expectedMacroActivities) || 0;
  if (spec.expectedMidiHook) expectation.expectedMidiHook = String(spec.expectedMidiHook);
  if (automationRoutes.length > 1) expectation.expectedAutomationRecipes = automationRoutes.map(route => route.recipe);
  return expectation;
}

function collectionValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.values === "function") return Array.from(value.values());
  return Object.values(value);
}

function activityProfiles(activity = {}) {
  return collectionValues(activity.profiles ?? activity.system?.profiles);
}

function documentSnapshot(document) {
  const source = clone(document?.toObject?.() ?? document ?? {});
  const activities = collectionValues(source?.system?.activities);
  const activityTypes = [...new Set(activities.map(activity => String(activity?.type ?? "").trim()).filter(Boolean))];
  const effectKeys = [...new Set(collectionValues(source?.effects)
    .flatMap(effect => collectionValues(effect?.changes).map(change => String(change?.key ?? "").trim()))
    .filter(Boolean))];
  const macroActivities = activities
    .filter(activity => activity?.macroData?.command)
    .map(activity => ({ id: activity._id ?? activity.id ?? "", name: activity.name ?? "" }));
  const midiHook = source?.flags?.["midi-qol"]?.onUseMacroName ?? "";
  return {
    uuid: String(document?.uuid ?? source?.uuid ?? ""),
    name: String(document?.name ?? source?.name ?? ""),
    type: String(document?.type ?? source?.type ?? ""),
    source,
    activityTypes,
    effectKeys,
    automation: {
      macroActivityCount: macroActivities.length,
      macroActivities,
      midiHook: String(midiHook)
    }
  };
}

function compareDocumentToExpectation(document, expectation = {}) {
  const activities = collectionValues(document?.system?.activities);
  const effects = collectionValues(document?.effects);
  const profiles = activities.flatMap(activity => activityProfiles(activity));
  const forgeFlags = readForgeFlags(document?.flags ?? {});
  const automation = forgeFlags.automation ? normalizeAutomationContract(forgeFlags.automation) : null;
  const automationRoutes = [
    ...(forgeFlags.automation ? [forgeFlags.automation] : []),
    ...(Array.isArray(forgeFlags.automationRoutes) ? forgeFlags.automationRoutes : [])
  ].map(normalizeAutomationContract).filter((route, index, all) => all.findIndex(candidate => candidate.recipe === route.recipe) === index);
  const source = clone(document?.toObject?.() ?? document ?? {});
  const sourceActivities = collectionValues(source?.system?.activities);
  const activityTypes = [...new Set(activities.map(activity => String(activity?.type ?? "").trim()).filter(Boolean))];
  const effectKeys = [...new Set(effects
    .flatMap(effect => collectionValues(effect?.changes).map(change => String(change?.key ?? "").trim()))
    .filter(Boolean))];
  const macroActivities = sourceActivities.filter(activity => activity?.macroData?.command);
  const midiHook = String(source?.flags?.["midi-qol"]?.onUseMacroName ?? "");
  const actualUses = document?.system?.uses?.max;
  const failures = [];

  if (expectation.name && document?.name !== expectation.name) {
    failures.push(`Expected name "${expectation.name}" but found "${document?.name ?? ""}".`);
  }
  if (expectation.kind && forgeFlags.kind && forgeFlags.kind !== expectation.kind) {
    failures.push(`Expected Forge family "${expectation.kind}" but found "${forgeFlags.kind}".`);
  }
  if (expectation.documentType && document?.type !== expectation.documentType) {
    failures.push(`Expected document type "${expectation.documentType}" but found "${document?.type ?? ""}".`);
  }
  if (activities.length < (expectation.minimumActivities ?? 0)) {
    failures.push(`Expected at least ${expectation.minimumActivities} activities but found ${activities.length}.`);
  }
  if (effects.length < (expectation.minimumEffects ?? 0)) {
    failures.push(`Expected at least ${expectation.minimumEffects} effects but found ${effects.length}.`);
  }
  if (expectation.expectedUses != null && Number(actualUses) !== expectation.expectedUses) {
    failures.push(`Expected ${expectation.expectedUses} uses but found ${actualUses ?? "none"}.`);
  }
  if (profiles.length < (expectation.minimumSummonProfiles ?? 0)) {
    failures.push(`Expected at least ${expectation.minimumSummonProfiles} summon profiles but found ${profiles.length}.`);
  }
  for (const type of expectation.expectedActivityTypes ?? []) {
    if (!activityTypes.includes(type)) failures.push(`Expected an activity of type "${type}" but found ${activityTypes.join(", ") || "none"}.`);
  }
  for (const key of expectation.expectedEffectKeys ?? []) {
    if (!effectKeys.includes(key)) failures.push(`Expected an Active Effect change at "${key}" but the document did not contain it.`);
  }
  if (expectation.automationRecipe && automation?.recipe !== expectation.automationRecipe) {
    failures.push(`Expected automation recipe "${expectation.automationRecipe}" but found "${automation?.recipe ?? "none"}".`);
  }
  if (expectation.automationWorkflowPass && automation?.workflowPass !== expectation.automationWorkflowPass) {
    failures.push(`Expected automation workflow pass "${expectation.automationWorkflowPass}" but found "${automation?.workflowPass ?? "none"}".`);
  }
  if (expectation.automationTargetSource && automation?.targetSource !== expectation.automationTargetSource) {
    failures.push(`Expected automation target source "${expectation.automationTargetSource}" but found "${automation?.targetSource ?? "none"}".`);
  }
  if (expectation.expectedAutomationRecipes) {
    const actualRecipes = automationRoutes.map(route => route.recipe);
    for (const recipe of expectation.expectedAutomationRecipes) {
      if (!actualRecipes.includes(recipe)) failures.push(`Expected automation recipe "${recipe}" but found "${actualRecipes.join(", ") || "none"}".`);
    }
  }
  if (macroActivities.length < (expectation.minimumMacroActivities ?? 0)) {
    failures.push(`Expected at least ${expectation.minimumMacroActivities} attached macro activities but found ${macroActivities.length}.`);
  }
  if (expectation.expectedMidiHook && !midiHook.includes(expectation.expectedMidiHook)) {
    failures.push(`Expected Midi-QOL hook "${expectation.expectedMidiHook}" but found "${midiHook}".`);
  }

  return {
    passed: failures.length === 0,
    failures,
    actual: {
      uuid: String(document?.uuid ?? ""),
      type: document?.type ?? "",
      activityCount: activities.length,
      activityTypes,
      effectCount: effects.length,
      effectKeys,
      usesMax: actualUses ?? "",
      summonProfileCount: profiles.length,
      automationRecipe: automation?.recipe ?? "",
      automationRecipes: automationRoutes.map(route => route.recipe),
      macroActivityCount: macroActivities.length,
      midiHook
    }
  };
}

async function ensureFolder({ game, Folder, name, type, color }) {
  const existing = Array.from(game.folders ?? []).find(folder => folder.type === type && folder.name === name);
  if (existing) return existing;
  return Folder.create({ name, type, sorting: "a", color });
}

function verificationFlag(runTag, extra = {}) {
  return {
    harness: true,
    runTag,
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function taggedDocumentName(name, runTag) {
  const base = String(name ?? "").trim();
  if (!base || base.includes(`[${runTag}]`)) return base;
  return `${base} [${runTag}]`;
}

async function tagVerificationActor(actor, runTag) {
  const name = taggedDocumentName(actor?.name, runTag);
  if (name && name !== actor?.name && typeof actor?.update === "function") {
    await actor.update({ name });
  }
  return setVerificationFlag(actor, runTag, { role: "summon-actor" });
}

async function setVerificationFlag(document, runTag, extra = {}) {
  if (!document?.setFlag) return document;
  await document.setFlag(MODULE_ID, "verification", verificationFlag(runTag, extra));
  return document;
}

async function ensureVerificationActor({ game, Actor, Folder, boundary }) {
  const actorFolder = await ensureFolder({
    game,
    Folder,
    name: VERIFICATION_ACTOR_FOLDER,
    type: "Actor",
    color: "#55b7c7"
  });
  const existing = Array.from(game.actors ?? []).find(actor => actor.name === VERIFICATION_ACTOR_NAME);
  if (existing) {
    const verification = readForgeFlags(existing.flags).verification;
    if (verification?.harness !== true) {
      throw new Error(`An Actor named "${VERIFICATION_ACTOR_NAME}" already exists but is not harness-owned.`);
    }
    return { actor: existing, actorFolder, created: false };
  }

  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const actor = await Actor.create({
    name: VERIFICATION_ACTOR_NAME,
    type: "character",
    folder: actorFolder.id,
    ownership: { default: owner },
    flags: {
      [MODULE_ID]: {
        verification: verificationFlag("setup", {
          worldId: boundary.worldId,
          purpose: "isolated-beta-verification"
        })
      }
    }
  });
  return { actor, actorFolder, created: true };
}

async function setupVerificationHarness({ game, Actor, Folder, enabled, expectedWorldId }) {
  const boundary = {
    enabled,
    isGM: game.user?.isGM === true,
    worldId: game.world?.id ?? "",
    expectedWorldId: expectedWorldId || DEFAULT_VERIFICATION_WORLD_ID
  };
  assertVerificationBoundary(boundary);
  const itemFolder = await ensureFolder({ game, Folder, name: VERIFICATION_ITEM_FOLDER, type: "Item", color: "#55b7c7" });
  const summonFolder = await ensureFolder({ game, Folder, name: VERIFICATION_SUMMON_FOLDER, type: "Actor", color: "#8caeff" });
  const actorState = await ensureVerificationActor({ game, Actor, Folder, boundary });
  return {
    worldId: boundary.worldId,
    itemFolder,
    summonFolder,
    actorFolder: actorState.actorFolder,
    actor: actorState.actor,
    actorCreated: actorState.created
  };
}

function isDnd5eActorPack(pack) {
  const metadata = pack?.metadata ?? {};
  return (pack?.documentName === "Actor" || metadata.documentName === "Actor" || metadata.type === "Actor")
    && /^dnd5e\./i.test(String(metadata.id ?? pack?.collection ?? ""));
}

async function findDnd5eActor(game, sourceNames) {
  for (const pack of Array.from(game?.packs ?? []).filter(isDnd5eActorPack)) {
    let index = [];
    try {
      index = await pack.getIndex({ fields: ["name", "type"] });
    } catch {
      try {
        index = await pack.getIndex();
      } catch {
        index = [];
      }
    }
    for (const sourceName of sourceNames) {
      const entry = index.find(candidate => String(candidate?.name ?? "").trim().toLowerCase() === sourceName.toLowerCase());
      if (!entry) continue;
      const sourceId = entry._id ?? entry.id;
      if (!sourceId || typeof pack.getDocument !== "function") continue;
      const source = await pack.getDocument(sourceId);
      if (source) return { source, pack };
    }
  }
  return null;
}

function verificationActorData(source, folder, fixture, runTag) {
  const data = clone(source.toObject?.() ?? source);
  delete data._id;
  delete data.id;
  delete data.folder;
  delete data.sort;
  delete data._stats;
  const name = taggedDocumentName(fixture.label, runTag);
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  data.name = name;
  data.folder = folder.id;
  data.ownership = { ...(data.ownership ?? {}), default: owner };
  data.flags = {
    ...(data.flags ?? {}),
    [MODULE_ID]: {
      ...(data.flags?.[MODULE_ID] ?? {}),
      verification: verificationFlag(runTag, {
        role: fixture.role,
        purpose: fixture.purpose,
        sourceActorUuid: source.uuid ?? "",
        fixture: true
      })
    }
  };
  return data;
}

async function createVerificationFixtureActors({
  game,
  Actor,
  Folder,
  enabled,
  expectedWorldId,
  runTag
} = {}) {
  const normalizedRunTag = normalizeRunTag(runTag);
  const setup = await setupVerificationHarness({ game, Actor, Folder, enabled, expectedWorldId });
  const actorPacksAvailable = Array.from(game?.packs ?? []).some(isDnd5eActorPack);
  const results = [];
  const actors = [];

  for (const fixture of VERIFICATION_ACTOR_FIXTURE_SPECS) {
    const name = taggedDocumentName(fixture.label, normalizedRunTag);
    const existing = Array.from(game.actors ?? []).find(actor => actor.name === name);
    if (existing) {
      const verification = readForgeFlags(existing.flags).verification;
      if (verification?.harness === true && verification?.fixture === true) {
        actors.push(existing);
        results.push({ role: fixture.role, status: "reused", name, uuid: existing.uuid });
      } else {
        results.push({ role: fixture.role, status: "blocked", name, reason: "A non-harness Actor already uses this fixture name." });
      }
      continue;
    }

    if (!actorPacksAvailable) {
      results.push({ role: fixture.role, status: "unavailable", name, reason: "No DND5e Actor compendium was found." });
      continue;
    }

    const found = await findDnd5eActor(game, fixture.sourceNames);
    if (!found) {
      results.push({ role: fixture.role, status: "unavailable", name, reason: fixture.sourceNames.join(" / ") });
      continue;
    }

    const actor = await Actor.create(verificationActorData(found.source, setup.actorFolder, fixture, normalizedRunTag));
    actors.push(actor);
    results.push({ role: fixture.role, status: "created", name: actor.name, uuid: actor.uuid, source: found.source.name });
  }

  return {
    runTag: normalizedRunTag,
    worldId: game?.world?.id ?? "",
    actorFolder: setup.actorFolder,
    actors,
    results
  };
}

function disposableItemData(item, runTag) {
  const data = clone(item.toObject?.() ?? item);
  delete data._id;
  delete data.id;
  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...readForgeFlags(data.flags),
    verification: verificationFlag(runTag, { sourceItemUuid: item.uuid ?? "" })
  };
  return data;
}

async function runVerificationHarness({
  game,
  Actor,
  Folder,
  enabled,
  expectedWorldId,
  runTag,
  specs,
  createItems,
  capabilitySnapshot = null
} = {}) {
  const normalizedRunTag = normalizeRunTag(runTag);
  if (!Array.isArray(specs) || specs.length === 0) throw new Error("Verification requires at least one prepared item specification.");
  if (typeof createItems !== "function") throw new Error("Verification requires a controlled item-creation function.");

  const setup = await setupVerificationHarness({ game, Actor, Folder, enabled, expectedWorldId });
  const result = await createItems(specs, {
    itemFolderName: VERIFICATION_ITEM_FOLDER,
    actorFolderName: VERIFICATION_SUMMON_FOLDER,
    replaceExistingWorldDocuments: false
  });
  const worldItems = result.items ?? [];
  const summonActors = result.actors ?? [];
  await Promise.all([
    ...worldItems.map(item => setVerificationFlag(item, normalizedRunTag, { role: "world-item" })),
    ...summonActors.map(actor => tagVerificationActor(actor, normalizedRunTag))
  ]);

  const copies = await setup.actor.createEmbeddedDocuments("Item", worldItems.map(item => disposableItemData(item, normalizedRunTag)));
  const copiesByName = new Map(copies.map(copy => [copy.name, copy]));
  const orderedCopies = worldItems.map((item, index) => copiesByName.get(item.name) ?? copies[index]).filter(Boolean);
  const checks = specs.map((spec, index) => {
    const item = worldItems[index];
    const copy = copiesByName.get(item?.name) ?? copies[index];
    const expectation = buildVerificationExpectation(specs[index] ?? {});
    return {
      name: copy?.name ?? item?.name ?? "",
      expectation,
      documentSnapshot: documentSnapshot(copy ?? item),
      ...compareDocumentToExpectation(copy, expectation)
    };
  });
  const report = {
    runTag: normalizedRunTag,
    worldId: game.world?.id ?? "",
    actorUuid: setup.actor.uuid ?? "",
    createdAt: new Date().toISOString(),
    total: checks.length,
    passed: checks.filter(check => check.passed).length,
    warnings: checks.filter(check => !check.passed).length,
    capabilitySnapshot: capabilitySnapshot ? clone(capabilitySnapshot) : null,
    documentSnapshots: checks.map(check => check.documentSnapshot),
    checks,
    manualChecks: [
      "Review target selection, token placement, and optional module behavior before counting a full-function success.",
      "The harness runs a macro only after an explicit GM request by exact ID or name; it never auto-selects targets, places tokens, or runs item activities, Scenes, or Regions."
    ]
  };
  await setup.actor.setFlag(MODULE_ID, "verificationLastRun", report);
  return { ...report, items: worldItems, copies: orderedCopies, summonActors };
}

function findVerificationMacro({ game, macroId, macroName } = {}) {
  const id = String(macroId ?? "").trim();
  const name = String(macroName ?? "").trim();
  if (!id && !name) throw new Error("Macro execution requires an exact macroId or macroName.");

  const macros = collectionValues(game?.macros);
  const matches = macros.filter(macro =>
    (id && (String(macro?.id ?? "") === id || String(macro?.uuid ?? "") === id))
    || (name && String(macro?.name ?? "") === name)
  );
  if (matches.length !== 1) {
    if (!matches.length) throw new Error(`No macro matched the requested ${id ? "ID" : "name"}.`);
    throw new Error("Macro execution requires one uniquely matched macro.");
  }
  return matches[0];
}

async function executeVerificationMacro({
  game,
  enabled,
  expectedWorldId,
  macroId,
  macroName,
  args = {}
} = {}) {
  const boundary = {
    enabled,
    isGM: game?.user?.isGM === true,
    worldId: game?.world?.id ?? "",
    expectedWorldId: expectedWorldId || DEFAULT_VERIFICATION_WORLD_ID
  };
  assertVerificationBoundary(boundary);

  const macro = findVerificationMacro({ game, macroId, macroName });
  if (typeof macro.execute !== "function") {
    throw new Error(`Macro "${macro.name ?? macro.id ?? ""}" cannot be executed by Foundry.`);
  }

  const result = await macro.execute(args);
  return {
    executed: true,
    worldId: boundary.worldId,
    macro: {
      id: String(macro.id ?? ""),
      uuid: String(macro.uuid ?? ""),
      name: String(macro.name ?? ""),
      folder: String(macro.folder?.name ?? "")
    },
    result: result == null ? null : String(result)
  };
}

async function cleanupVerificationRun({ game, runTag } = {}) {
  const normalizedRunTag = normalizeRunTag(runTag);
  const hasTag = document => readForgeFlags(document.flags).verification?.runTag === normalizedRunTag;
  const worldItems = Array.from(game.items ?? []).filter(hasTag);
  const actors = Array.from(game.actors ?? []).filter(actor => hasTag(actor));
  const verificationActor = Array.from(game.actors ?? []).find(actor =>
    actor.name === VERIFICATION_ACTOR_NAME && readForgeFlags(actor.flags).verification?.harness === true
  );
  const embeddedItems = verificationActor ? collectionValues(verificationActor.items).filter(hasTag) : [];

  for (const item of embeddedItems) await item.delete();
  for (const item of worldItems) await item.delete();
  for (const actor of actors) await actor.delete();
  return {
    runTag: normalizedRunTag,
    deletedEmbeddedItems: embeddedItems.length,
    deletedWorldItems: worldItems.length,
    deletedActors: actors.length
  };
}

function verificationHarnessStatus({ game, enabled, expectedWorldId } = {}) {
  const worldId = game?.world?.id ?? "";
  const expected = expectedWorldId || DEFAULT_VERIFICATION_WORLD_ID;
  return {
    enabled: enabled === true,
    currentWorldId: worldId,
    expectedWorldId: expected,
    isolated: worldId === expected,
    ready: enabled === true && game?.user?.isGM === true && worldId === expected
  };
}

export {
  DEFAULT_VERIFICATION_WORLD_ID,
  VERIFICATION_ACTOR_NAME,
  VERIFICATION_ACTOR_FIXTURE_SPECS,
  VERIFICATION_ACTOR_FOLDER,
  VERIFICATION_ITEM_FOLDER,
  VERIFICATION_SUMMON_FOLDER,
  assertVerificationBoundary,
  buildVerificationExpectation,
  cleanupVerificationRun,
  compareDocumentToExpectation,
  createVerificationFixtureActors,
  documentSnapshot,
  normalizeRunTag,
    runVerificationHarness,
    executeVerificationMacro,
    setupVerificationHarness,
  verificationHarnessStatus
};
