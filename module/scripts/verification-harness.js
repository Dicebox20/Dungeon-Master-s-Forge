import { MODULE_ID, readForgeFlags } from "./package-identity.js";

const DEFAULT_VERIFICATION_WORLD_ID = "dmf-test-world";
const VERIFICATION_ACTOR_NAME = "DMF Verification Actor";
const VERIFICATION_ITEM_FOLDER = "DMF Verification Items";
const VERIFICATION_SUMMON_FOLDER = "DMF Verification Summons";
const VERIFICATION_ACTOR_FOLDER = "DMF Verification Actors";

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

function buildVerificationExpectation(spec = {}) {
  return {
    kind: spec.kind ?? "",
    name: spec.name ?? "",
    documentType: expectedDocumentType(spec),
    minimumActivities: expectedActivityCount(spec),
    minimumEffects: expectedEffectCount(spec),
    expectedUses: expectedUses(spec),
    minimumSummonProfiles: Array.isArray(spec.summonProfiles) ? spec.summonProfiles.length : 0
  };
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

function compareDocumentToExpectation(document, expectation = {}) {
  const activities = collectionValues(document?.system?.activities);
  const effects = collectionValues(document?.effects);
  const profiles = activities.flatMap(activity => activityProfiles(activity));
  const forgeFlags = readForgeFlags(document?.flags ?? {});
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

  return {
    passed: failures.length === 0,
    failures,
    actual: {
      type: document?.type ?? "",
      activityCount: activities.length,
      effectCount: effects.length,
      usesMax: actualUses ?? "",
      summonProfileCount: profiles.length
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
  createItems
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
    checks,
    manualChecks: [
      "Review target selection, token placement, and optional module behavior before counting a full-function success.",
      "This harness does not execute item activities, macros, Scenes, or Regions."
    ]
  };
  await setup.actor.setFlag(MODULE_ID, "verificationLastRun", report);
  return { ...report, items: worldItems, copies: orderedCopies, summonActors };
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
  VERIFICATION_ACTOR_FOLDER,
  VERIFICATION_ITEM_FOLDER,
  VERIFICATION_SUMMON_FOLDER,
  assertVerificationBoundary,
  buildVerificationExpectation,
  cleanupVerificationRun,
  compareDocumentToExpectation,
  normalizeRunTag,
  runVerificationHarness,
  setupVerificationHarness,
  verificationHarnessStatus
};
