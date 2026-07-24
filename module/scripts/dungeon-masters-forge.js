import { runDungeonMastersForge } from "./forge-engine.js";
import { compileItemRequest } from "./request-compiler.js";
import {
  DEFAULT_PROVIDER_ID,
  HOSTED_PROVIDER_ID,
  compileWithProvider,
  getProvider,
  listProviders,
  mechanicsRequestForCompilation,
  networkProviderConfiguration,
  partitionProviderConfiguration,
  providerReadiness,
  SUPPORTED_SPEC_KINDS
} from "./providers.js";
import {
  REMOTE_PROVIDER_SCHEMA_VERSION,
  buildRemoteProviderRequest,
  capabilitiesEndpointFor,
  healthEndpointFor,
  normalizeRemoteEndpoint,
  normalizeRemoteCapabilities,
  normalizeRemoteHealth,
  normalizeRemoteProviderResponse,
  redactProviderConfiguration,
  requestRemoteHealth,
  requestRemoteCapabilities,
  requestRemoteServiceStatus,
  requestRemoteCompilation,
  requestRemoteErrorReport
} from "./provider-contract.js";
import { DIAGNOSTIC_CASES, runLocalDiagnostics } from "./diagnostics.js";
import {
  findSystemNonMagicalEquipmentForText,
  findSystemNonMagicalWeaponForText,
  resolveEquipmentByName,
  resolveSpellByName,
  resolveSystemDocument,
  resolveSystemContentByName,
  runSystemContentDiagnostics
} from "./content-resolver.js";
import { BUILD_VERSION, PRODUCT_TITLE, isManagedSourceLabel, sourceLabelForVersion } from "./versioning.js";
import {
  PROVIDER_PROFILE_SCHEMA_VERSION,
  createProviderProfile,
  parseProviderProfile,
  serializeProviderProfile
} from "./provider-profile.js";
import { buildReviewSummaries } from "./review-summary.js";
import { normalizeWeight, safeItemIcon } from "./equipment-normalization.js";
import { applyFeaturePlanToSpec, planItemFeatures } from "./feature-planner.js";
import { fingerprintForgeSpecs, sanitizeForgeSpec } from "./forge-spec-integrity.js";
import { repairHybridSpecFromRequest } from "./hybrid-activity-repair.js";
import { buildLayeredItemBlueprint } from "./item-blueprint.js";
import { applyDefaultLeveledSpellCharges, applyForgeSpecDefaults, autoSelectSrdChoiceSpells, dedupeRecognizedSpellActivities, reconcilePlannedSrdSpellActivities, repairNamedSrdSpellActivities } from "./srd-spell-enrichment.js";
import { applyBaseChassisFallbackArt, applyCategoryItemFallbackArt, applyConsumableProjectileFallbackArt, applyFallbackActivityArt, applySpellActivityArt, applySystemEquipmentArt, needsFallbackItemArt } from "./system-art-enrichment.js";
import { openSceneRegionForge } from "./scene-region-forge.js";
import { buildAutomationCapabilitySnapshot, resolveAutomationRoute } from "./automation-capabilities.js";
import { normalizeAutomationMetadata } from "./automation-contract.js";
import { buildAutomationExecutionPlan } from "./automation-execution.js";
import {
  PREVIOUS_PACKAGE_ID,
  MODULE_ID,
  migrateLegacySettings
} from "./package-identity.js";

const MODULE_TITLE = PRODUCT_TITLE;
const MIN_DND5E_VERSION = "5.3.3";
const SETTINGS_TEMPLATE_PATH = `modules/${MODULE_ID}/templates/forge-settings.hbs`;
const DEFAULT_VERIFICATION_WORLD_ID = "dmf-test-world";
let verificationHarnessModulePromise;

function verificationHarnessIncluded() {
  return game.modules.get(MODULE_ID)?.flags?.[MODULE_ID]?.verificationHarness === true;
}

function verificationHarnessStatusSnapshot({ enabled, expectedWorldId } = {}) {
  const worldId = game?.world?.id ?? "";
  const expected = expectedWorldId || DEFAULT_VERIFICATION_WORLD_ID;
  return {
    enabled: enabled === true && verificationHarnessIncluded(),
    currentWorldId: worldId,
    expectedWorldId: expected,
    isolated: verificationHarnessIncluded() && worldId === expected,
    ready: verificationHarnessIncluded() && enabled === true && game?.user?.isGM === true && worldId === expected
  };
}

async function loadVerificationHarness() {
  if (!verificationHarnessIncluded()) {
    throw new Error("The isolated verification harness is available only in the Dungeon Master's Forge tester build.");
  }
  verificationHarnessModulePromise ??= import("./verification-harness.js");
  return verificationHarnessModulePromise;
}

function normalizeVerificationRunTag(runTag) {
  const normalized = String(runTag ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(normalized)) {
    throw new Error("Verification run tags must be 3-81 characters using letters, numbers, dots, underscores, or hyphens.");
  }
  return normalized;
}

const EXAMPLE_SPECS = [
  {
    kind: "weaponExtraDamage",
    name: "Emberglass Dagger",
    img: "icons/weapons/daggers/dagger-curved-red.webp",
    description: "A translucent red-black dagger that looks like cooled volcanic glass. Its edge glows faintly when it strikes.",
    rarity: "uncommon",
    attunement: "",
    weaponType: "simpleM",
    baseItem: "dagger",
    properties: ["mgc", "fin", "lgt", "thr"],
    damage: {
      base: { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] },
      versatile: { number: null, denomination: null, bonus: "", types: [] }
    },
    magicalBonus: "",
    range: { value: 20, long: 60, reach: 5, units: "ft" },
    mastery: "nick",
    weight: 1,
    extraDamageParts: [
      { number: 1, denomination: 4, bonus: "", types: ["fire"] }
    ],
    attackName: "Strike with Emberglass Dagger"
  }
];

let forgeDialog = null;
let forgeSettingsApp = null;
const providerSessionConfiguration = new Map();

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerSetting(key, data) {
  game.settings.register(MODULE_ID, key, { ...data });
  const { name: _name, hint: _hint, ...legacyData } = data;
  game.settings.register(PREVIOUS_PACKAGE_ID, key, {
    ...legacyData,
    config: false
  });
}

function registerSettings() {
  game.settings.registerMenu(MODULE_ID, "forgeSettings", {
    name: "Forge settings",
    label: "Open Forge Settings",
    hint: "Manage generation provider settings, examples, and diagnostics.",
    icon: "fa-solid fa-gear",
    type: ForgeSettingsApplication,
    restricted: true
  });

  registerSetting("itemFolderName", {
    name: "Item folder",
    hint: "World folder used for generated items.",
    scope: "world",
    config: true,
    type: String,
    default: "Dungeon Master's Forge"
  });

  registerSetting("actorFolderName", {
    name: "Summon actor folder",
    hint: "World folder used for generated summon actors.",
    scope: "world",
    config: true,
    type: String,
    default: "Dungeon Master's Forge Summons"
  });

  registerSetting("sourceLabel", {
    name: "Source label",
    hint: "Source text written to generated items.",
    scope: "world",
    config: true,
    type: String,
    default: sourceLabelForVersion(BUILD_VERSION)
  });

  registerSetting("replaceExisting", {
    name: "Replace matching world documents",
    hint: "Delete world items and summon actors with the same name before creating replacements.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  registerSetting("enableMidiQolAutomation", {
    name: "Apply basic conditions and effects automatically",
    hint: "Use the best verified automation layer for each mechanic. Midi-QOL, DAE, and Item Macro add timing, targeting, condition, concentration, and workflow behavior when available; portable DND5e data and a review note remain the fallback.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  registerSetting("enableSceneRegionForge", {
    name: "Enable experimental Scene Region Forge",
    hint: "Allows a GM to add reviewed native Foundry and DND5e behaviors to one selected Scene Region. Existing non-Forge behaviors are preserved.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  registerSetting("enableVerificationHarness", {
    name: "Enable isolated Beta verification harness",
    hint: "Allows a GM to create tagged disposable test copies and explicitly run a named test macro only in the configured test world. It never auto-selects targets, places tokens, or runs anything without a GM request.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  registerSetting("verificationWorldId", {
    name: "Verification test world ID",
    hint: "The harness refuses to run unless the active world ID exactly matches this value.",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_VERIFICATION_WORLD_ID
  });

  registerSetting("lastSpecs", {
    scope: "client",
    config: false,
    type: String,
    default: JSON.stringify(EXAMPLE_SPECS, null, 2)
  });

  registerSetting("lastRequest", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  registerSetting("providerId", {
    scope: "client",
    config: false,
    type: String,
    default: DEFAULT_PROVIDER_ID
  });

  registerSetting("hostedDefaultApplied", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  registerSetting("unresolvedPolicy", {
    scope: "client",
    config: false,
    type: String,
    default: "review"
  });

  registerSetting("providerEndpoint", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  registerSetting("providerModel", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  registerSetting("rememberProviderApiToken", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  registerSetting("providerApiToken", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  registerSetting("providerMembershipToken", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  registerSetting("anonymousErrorReports", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

}

function currentProviderId() {
  const storedProviderId = game.settings.get(MODULE_ID, "providerId") || DEFAULT_PROVIDER_ID;
  return getProvider(storedProviderId)?.available ? storedProviderId : DEFAULT_PROVIDER_ID;
}

function currentUnresolvedPolicy() {
  const storedUnresolvedPolicy = game.settings.get(MODULE_ID, "unresolvedPolicy") || "review";
  return ["review", "block"].includes(storedUnresolvedPolicy) ? storedUnresolvedPolicy : "review";
}

function currentProviderToken({ rememberProviderToken } = {}) {
  const rememberToken = rememberProviderToken ?? (game.settings.get(MODULE_ID, "rememberProviderApiToken") === true);
  const rememberedProviderToken = rememberToken ? game.settings.get(MODULE_ID, "providerApiToken") || "" : "";
  return providerSessionConfiguration.get("bring-your-own")?.apiToken || rememberedProviderToken;
}

function currentProviderMembershipToken() {
  return providerSessionConfiguration.get(HOSTED_PROVIDER_ID)?.membershipToken
    || game.settings.get(MODULE_ID, "providerMembershipToken")
    || "";
}

function currentAnonymousErrorReportsEnabled() {
  return game.settings.get(MODULE_ID, "anonymousErrorReports") === true;
}

function configuredProviderState(overrides = {}) {
  const providerId = overrides.providerId ?? currentProviderId();
  const rememberApiToken = overrides.rememberApiToken ?? (game.settings.get(MODULE_ID, "rememberProviderApiToken") === true);
  const configuration = {
    endpoint: (overrides.endpoint ?? game.settings.get(MODULE_ID, "providerEndpoint")) || "",
    model: (overrides.model ?? game.settings.get(MODULE_ID, "providerModel")) || "",
    apiToken: overrides.apiToken ?? currentProviderToken({ rememberProviderToken: rememberApiToken }),
    membershipToken: overrides.membershipToken ?? currentProviderMembershipToken(),
    unresolvedPolicy: overrides.unresolvedPolicy ?? currentUnresolvedPolicy()
  };
  return {
    id: providerId,
    rememberApiToken,
    configuration
  };
}

function assertEnvironment({ requireGM = false } = {}) {
  if (game.system.id !== "dnd5e") {
    throw new Error(`${MODULE_TITLE} requires the DND5e system.`);
  }

  if (foundry.utils.isNewerVersion(MIN_DND5E_VERSION, game.system.version)) {
    throw new Error(`${MODULE_TITLE} requires DND5e ${MIN_DND5E_VERSION} or newer. Current version: ${game.system.version}.`);
  }

  if (requireGM && !game.user.isGM) {
    throw new Error(`Only a GM can create world items with ${MODULE_TITLE}.`);
  }
}

function normalizeSpecs(input) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  const specs = Array.isArray(parsed) ? parsed : parsed?.items;

  if (!Array.isArray(specs) || !specs.length) {
    throw new Error('Specs must be a non-empty JSON array or an object with an "items" array.');
  }

  return specs;
}

function requestedAttunementState(requestText = "") {
  const text = String(requestText ?? "").trim();
  if (!text) return null;
  if (/\b(?:does(?:\s+not|n't)\s+(?:need|require)\s+attunement|no\s+attunement(?:\s+needed)?|attunement\s*:\s*(?:not required|no|none))\b/i.test(text)) return "";
  if (/\b(?:(?:needs?|requires?|requiring)\s+attunement|required\s+by|when attuned|while attuned|attunement\s*:\s*required)\b/i.test(text)) return "required";
  return null;
}

function alignSpecAttunementToRequest(spec, requestText = "", { preserveExistingWhenUnspecified = false } = {}) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { applied: false, spec };
  const requested = requestedAttunementState(requestText);
  if (requested == null) {
    // Review-time validation must not discard a GM's explicit JSON edit just because
    // the original request did not state an attunement preference.
    if (preserveExistingWhenUnspecified) return { applied: false, spec };
    if (!String(spec.attunement ?? "").trim()) return { applied: false, spec };
    return {
      applied: true,
      spec: {
        ...spec,
        attunement: ""
      },
      assumption: "No attunement requirement was supplied; cleared model-added attunement."
    };
  }
  if (String(spec.attunement ?? "").trim() === requested) return { applied: false, spec };
  return {
    applied: true,
    spec: {
      ...spec,
      attunement: requested
    },
    assumption: requested
      ? "Aligned attunement with the request."
      : "Removed attunement because the request explicitly said it was not required."
  };
}

function repairSpecsForValidation(specs, requestText = "") {
  return specs.map(spec => {
    const repairContext = [requestText, spec.description].filter(Boolean).join("\n");
    const repaired = repairHybridSpecFromRequest(spec, repairContext);
    const defaulted = applyForgeSpecDefaults(repaired.spec);
    const deduped = dedupeRecognizedSpellActivities(defaulted.spec, repairContext);
    const blueprinted = buildLayeredItemBlueprint(deduped.spec, repairContext);
    const attunementAligned = alignSpecAttunementToRequest(blueprinted.spec, requestText, {
      preserveExistingWhenUnspecified: true
    });
    return attunementAligned.spec;
  });
}

async function prepareSpecsForForge(input, requestText = "") {
  const repairedSpecs = repairSpecsForValidation(normalizeSpecs(input), requestText);
  const enrichedSpecs = await enrichSpecsWithSystemReferences(repairedSpecs, requestText);
  return enrichedSpecs.map(normalizeAutomationMetadata);
}

function currentConfig(overrides = {}) {
  const config = {
    itemFolderName: overrides.itemFolderName ?? game.settings.get(MODULE_ID, "itemFolderName"),
    actorFolderName: overrides.actorFolderName ?? game.settings.get(MODULE_ID, "actorFolderName"),
    sourceLabel: overrides.sourceLabel ?? game.settings.get(MODULE_ID, "sourceLabel"),
    engineVersion: BUILD_VERSION,
    midiQolAutomation: overrides.midiQolAutomation
      ?? (game.settings.get(MODULE_ID, "enableMidiQolAutomation") === true && moduleIsActive("midi-qol")),
    itemMacroAutomation: overrides.itemMacroAutomation ?? moduleIsActive("itemacro"),
    daeAutomation: overrides.daeAutomation ?? moduleIsActive("dae"),
    authorizeGeneratedAutomation: overrides.authorizeGeneratedAutomation === true,
    replaceExistingWorldDocuments: overrides.replaceExistingWorldDocuments
      ?? game.settings.get(MODULE_ID, "replaceExisting")
  };
  return {
    ...config,
    automationCapabilities: buildAutomationCapabilitySnapshot({
      game,
      moduleId: MODULE_ID,
      moduleVersion: BUILD_VERSION,
      config
    })
  };
}

function currentVerificationHarnessOptions(overrides = {}) {
  return {
    enabled: overrides.enabled ?? (game.settings.get(MODULE_ID, "enableVerificationHarness") === true),
    expectedWorldId: overrides.expectedWorldId
      ?? game.settings.get(MODULE_ID, "verificationWorldId")
      ?? DEFAULT_VERIFICATION_WORLD_ID
  };
}

function verificationHarnessEnvironment(overrides = {}) {
  return {
    game,
    Actor,
    Folder,
    ...currentVerificationHarnessOptions(overrides)
  };
}

async function setupIsolatedVerificationHarness(overrides = {}) {
  assertEnvironment({ requireGM: true });
  const harness = await loadVerificationHarness();
  return harness.setupVerificationHarness(verificationHarnessEnvironment(overrides));
}

async function setupIsolatedVerificationActors(runTag, overrides = {}) {
  assertEnvironment({ requireGM: true });
  const harness = await loadVerificationHarness();
  return harness.createVerificationFixtureActors({
    ...verificationHarnessEnvironment(overrides),
    runTag
  });
}

async function runIsolatedVerificationHarness(specs, { runTag, ...overrides } = {}) {
  assertEnvironment({ requireGM: true });
  const harness = await loadVerificationHarness();
  // Hosted verification inputs may be structurally valid before the normal
  // request-context hybrid repair has promoted passive/armor hybrids into a
  // suite. Apply that deterministic repair here so the harness exercises the
  // same supported chassis as the approved Forge path.
  const preparedSpecs = specs.map(spec => {
    const requestText = [
      spec.description,
      ...(spec.unresolvedMechanics ?? []).map(mechanic => mechanic?.requestedText)
    ].filter(Boolean).join("\n");
    return repairSpecsForValidation([spec], requestText)[0];
  });
  const sanitizedSpecs = preparedSpecs.map(spec => sanitizeForgeSpec(spec).spec);
  return harness.runVerificationHarness({
    ...verificationHarnessEnvironment(overrides),
    runTag,
    specs: sanitizedSpecs,
    capabilitySnapshot: currentConfig().automationCapabilities,
    createItems: (verificationSpecs, config = {}) => createPreparedSpecs(verificationSpecs, {
      ...config,
      // The isolated harness only creates tagged documents and never executes activities.
      authorizeGeneratedAutomation: true
    })
  });
}

async function executeIsolatedVerificationMacro({ macroId, macroName, args = {}, ...overrides } = {}) {
  assertEnvironment({ requireGM: true });
  const harness = await loadVerificationHarness();
  return harness.executeVerificationMacro({
    ...verificationHarnessEnvironment(overrides),
    macroId,
    macroName,
    args
  });
}

async function cleanupIsolatedVerificationHarness(runTag) {
  assertEnvironment({ requireGM: true });
  const harness = await loadVerificationHarness();
  const options = currentVerificationHarnessOptions();
  if (verificationHarnessStatusSnapshot(options).isolated !== true) {
    throw new Error("Verification cleanup is restricted to the configured test world.");
  }
  return harness.cleanupVerificationRun({ game, runTag });
}

function moduleIsActive(id) {
  return Boolean(game.modules.get(id)?.active);
}

function midiQolAutomationEnabled() {
  return game.settings.get(MODULE_ID, "enableMidiQolAutomation") === true && moduleIsActive("midi-qol");
}

function dependencyWarnings(specs) {
  const warnings = [];
  const usesConditionMacro = specs.some(spec => spec.kind === "weaponConditionOnHit");
  const usesUtilityMacro = specs.some(spec => spec.utilityActivities?.some(activity => activity.macroCommand));
  const capabilities = currentConfig().automationCapabilities;
  const routes = [];
  if (usesConditionMacro) routes.push(resolveAutomationRoute("conditionOnHit", capabilities));
  if (specs.some(spec => spec.toggleLight)) routes.push(resolveAutomationRoute("selfTargetLight", capabilities));
  if (usesUtilityMacro) routes.push({
    recipe: "utilityMacro",
    selectedLayer: "Midi-QOL + Item Macro",
    dependencyLabels: ["Midi-QOL", "Item Macro"],
    available: midiQolAutomationEnabled() && moduleIsActive("itemacro"),
    reason: "The utility activity uses the trusted Item Macro hook exposed through Midi-QOL.",
    fallback: "DND5e core utility activity with manual review"
  });
  for (const spec of specs) {
    const automationRoutes = [
      ...(spec.automation ? [spec.automation] : []),
      ...(Array.isArray(spec.automationRoutes) ? spec.automationRoutes : [])
    ];
    for (const automation of automationRoutes) {
      const route = resolveAutomationRoute(automation, capabilities);
      if (route) routes.push(route);
    }
    const executionPlan = buildAutomationExecutionPlan(spec, {
      midiQolAutomation: midiQolAutomationEnabled(),
      itemMacroAutomation: moduleIsActive("itemacro")
    });
    for (const fallback of executionPlan.fallbacks ?? []) {
      if (!fallback.missingFields?.length) continue;
      warnings.push(`${spec.name} requested ${fallback.recipe} automation, but the declarative ${fallback.missingFields.join(", ")} payload was not supplied. No executable code was generated; review the specification before creation.`);
    }
  }
  const seen = new Set();
  for (const route of routes.filter(Boolean)) {
    const key = `${route.recipe}|${route.selectedLayer}|${route.reason}`;
    if (seen.has(key) || route.available) continue;
    seen.add(key);
    const required = route.dependencyLabels?.length ? route.dependencyLabels.join(", ") : "none";
    warnings.push(`${route.recipe} is using the ${route.selectedLayer} fallback. Required modules: ${required}. ${route.reason} ${route.fallback}.`);
  }

  return warnings;
}

async function validateSpecs(input, requestText = "") {
  assertEnvironment();
  const specs = await prepareSpecsForForge(input, requestText);
  const validation = await runDungeonMastersForge(currentConfig(), specs, { validateOnly: true });
  return {
    ...validation,
    warnings: dependencyWarnings(specs),
    specs
  };
}

async function createFromSpecs(input, configOverrides = {}, requestText = "") {
  assertEnvironment({ requireGM: true });
  const specs = await prepareSpecsForForge(input, requestText);
  return createPreparedSpecs(specs, configOverrides);
}

async function createPreparedSpecs(specs, configOverrides = {}) {
  assertEnvironment({ requireGM: true });
  // The engine validates immediately before creation, so an approved UI draft does
  // not need a second template/reference preparation pass.
  return runDungeonMastersForge(currentConfig(configOverrides), specs, {
    authorizeGeneratedAutomation: configOverrides.authorizeGeneratedAutomation === true
  });
}

function statusPill(label, active, title) {
  const state = active ? "ready" : "inactive";
  const icon = active ? "fa-solid fa-check" : "fa-solid fa-minus";
  return `<span class="dm_forge-pill" data-state="${state}" title="${escapeHTML(title)}"><i class="${icon}"></i>${escapeHTML(label)}</span>`;
}

function moduleStatusHTML() {
  return [
    statusPill(`DND5e ${game.system.version}`, game.system.id === "dnd5e", "Required system"),
    statusPill("Midi-QOL", midiQolAutomationEnabled(), "Enabled for Forge activity and condition automation"),
    statusPill("DAE", moduleIsActive("dae"), "Used by advanced effects"),
    statusPill("Item Macro", moduleIsActive("itemacro"), "Used by scripted item powers")
  ].join("");
}

function providerOptionsHTML(selectedProviderId) {
  return listProviders().map(provider => {
    const selected = provider.id === selectedProviderId ? " selected" : "";
    const disabled = provider.available ? "" : " disabled";
    const suffix = provider.available ? "" : " - unavailable";
    return `<option value="${escapeHTML(provider.id)}"${selected}${disabled}>${escapeHTML(provider.label + suffix)}</option>`;
  }).join("");
}

function unresolvedPolicyOptionsHTML(selectedPolicy) {
  const field = getProvider(DEFAULT_PROVIDER_ID)?.configuration.find(entry => entry.id === "unresolvedPolicy");
  return (field?.options ?? []).map(option => {
    const selected = option.value === selectedPolicy ? " selected" : "";
    return `<option value="${escapeHTML(option.value)}"${selected}>${escapeHTML(option.label)}</option>`;
  }).join("");
}

function providerStatusSnapshot(providerId, configuration, connection = null) {
  const provider = getProvider(providerId);
  const readiness = providerReadiness(providerId, configuration);
  const activeConnection = connection?.providerId === providerId ? connection : null;
  const summary = providerConnectionSummary(provider, readiness, activeConnection);
  const missingLabels = readiness.missing.map(id => provider?.configuration.find(field => field.id === id)?.label ?? id);
  const message = summary?.message ?? (!readiness.available
    ? "Disabled"
    : readiness.ready
      ? provider?.mode === "network" ? "Network / Ready" : "Offline / Ready"
      : `${missingLabels.join(", ")} required`);

  return {
    provider,
    readiness,
    connection: activeConnection,
    icon: summary?.icon ?? (provider?.mode === "network" ? "fa-cloud" : "fa-laptop"),
    state: summary?.state ?? (readiness.ready ? "ready" : "warning"),
    message
  };
}

function forgeFooterProviderStatusHTML(snapshot) {
  return `
    <output class="dm_forge-footer-provider-status" data-forge-footer-provider-status data-state="${escapeHTML(snapshot.state)}" aria-live="polite">
      <i class="fa-solid ${escapeHTML(snapshot.icon)}"></i>
      <span>${escapeHTML(snapshot.message)}</span>
    </output>
  `;
}

function forgeCapacitySnapshot(usage = {}) {
  const limit = Number(usage?.capacity?.limit ?? usage?.capacityLimit ?? 0);
  const remaining = Number(usage?.capacity?.remaining ?? usage?.capacityRemaining ?? 0);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) return null;
  const percent = Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
  const message = percent === 0
    ? "Forge Capacity: 0% remaining - The Blacksmith is sorry, he had to go to bed."
    : percent < 10
      ? `Forge Capacity: ${percent}% remaining - The Blacksmith is exhausted.`
      : percent <= 25
        ? `Forge Capacity: ${percent}% remaining - The Blacksmith is getting tired.`
        : `Forge Capacity: ${percent}% remaining`;
  return {
    percent,
    tier: String(usage?.tier ?? "free") === "paid-capacity" ? "paid-capacity" : "free",
    state: percent <= 25 ? "warning" : "ready",
    message
  };
}

function renderForgeCapacity(dialog, usage = {}) {
  const output = dialog?.element?.querySelector?.("[data-forge-capacity]");
  if (!(output instanceof HTMLElement)) return;
  const snapshot = forgeCapacitySnapshot(usage);
  output.hidden = !snapshot;
  if (!snapshot) return;
  output.dataset.state = snapshot.state;
  output.dataset.tier = snapshot.tier;
  output.textContent = snapshot.message;
  output.title = snapshot.tier === "paid-capacity"
    ? "Member Forge Capacity is based on the current paid allowance. Complexity, batches, and repairs use different amounts."
    : "Free Forge Capacity is based on the current tester allowance. Complexity, batches, and repairs use different amounts.";
}

function forgeContent() {
  const specs = game.settings.get(MODULE_ID, "lastSpecs") || JSON.stringify(EXAMPLE_SPECS, null, 2);
  const request = game.settings.get(MODULE_ID, "lastRequest") || "";
  const unresolvedPolicy = currentUnresolvedPolicy();

  return `
    <section class="dungeon-masters-forge-shell">
      <div class="dm_forge-statusbar" aria-label="System status">
        ${moduleStatusHTML()}
      </div>

      <div class="dm_forge-workflow">
        <section class="dm_forge-panel dm_forge-request-panel" data-forge-panel="request" tabindex="-1">
          <header class="dm_forge-pane-header">
            <h2><span class="dm_forge-step" aria-hidden="true">1</span><i class="fa-solid fa-feather-pointed"></i><span>Description</span></h2>
          </header>
          <div class="dm_forge-provider-controls dm_forge-request-controls">
            <label>
              <span>Unresolved mechanics</span>
              <select name="unresolvedPolicy" aria-label="Unresolved mechanics policy">
                ${unresolvedPolicyOptionsHTML(unresolvedPolicy)}
              </select>
            </label>
            <label class="dm_forge-request-hint">
              <span>Connection</span>
              <small>Provider selection, API details, examples, and diagnostics now live in Forge Settings.</small>
            </label>
          </div>
          <label class="dm_forge-request">
            <span>Item request</span>
            <textarea name="request" aria-label="Natural-language item request" placeholder="Describe one item, or separate multiple items with a line containing ---.\n\nCreate a rare +1 dagger that deals an extra 1d4 fire damage.">${escapeHTML(request)}</textarea>
          </label>
        </section>

        <section class="dm_forge-panel dm_forge-review-panel" data-forge-panel="review" tabindex="-1">
          <header class="dm_forge-pane-header">
            <h2><span class="dm_forge-step" aria-hidden="true">2</span><i class="fa-solid fa-scroll"></i><span>Result</span></h2>
          </header>
          <nav class="dm_forge-review-tabs" data-forge-review-tabs hidden aria-label="Review view">
            <button type="button" class="dm_forge-review-tab is-active" data-forge-review-tab="visual" aria-selected="true">Visual preview</button>
            <button type="button" class="dm_forge-review-tab" data-forge-review-tab="automation" aria-selected="false" hidden>Automation code</button>
            <button type="button" class="dm_forge-review-tab" data-forge-review-tab="specs" aria-selected="false"><i class="fa-solid fa-code"></i> Advanced Specification Editor</button>
          </nav>
          <div class="dm_forge-review-summary" data-forge-preview hidden></div>

          <div class="dm_forge-automation-review" data-forge-automation-review hidden></div>

          <section class="dm_forge-advanced" data-forge-advanced-review hidden aria-label="Advanced Specification Editor">
            <label class="dm_forge-specs">
              <span>Generated specifications</span>
              <textarea name="specs" spellcheck="false" aria-label="Item specs JSON">${escapeHTML(specs)}</textarea>
            </label>
          </section>
        </section>
      </div>

      <section class="dm_forge-bottom-tray">
        <div class="dm_forge-compile-report" data-forge-compile-report hidden></div>
        <label class="dm_forge-approval dm_forge-approval-compact" title="Required before creating items: review the generated specifications, then approve creation.">
          <input type="checkbox" name="reviewApproval" aria-label="Approve creation after reviewing the specifications.">
          <span class="dm_forge-approval-box" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
          <span class="dm_forge-approval-label">Approve</span>
        </label>
        <label class="dm_forge-approval dm_forge-approval-compact dm_forge-code-approval" data-forge-code-approval-wrap hidden title="Required when the item contains generated automation code: read the code preview and authorize it before creation.">
          <input type="checkbox" name="automationCodeApproval" aria-label="I have read and authorize the generated automation code.">
          <span class="dm_forge-approval-box" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
          <span class="dm_forge-approval-label"><span>Approve</span><small>Automation</small></span>
        </label>
        <output class="dm_forge-capacity" data-forge-capacity hidden aria-live="polite"></output>
        <output class="dm_forge-message" data-forge-status data-state="idle" aria-live="polite">Ready.</output>
      </section>
    </section>
  `;
}

function formControl(form, name) {
  const control = form?.elements?.namedItem(name);
  if (!control) throw new Error(`Forge form control not found: ${name}`);
  return control;
}

function readDialogForm(form) {
  const rawSpecs = formControl(form, "specs").value.trim();
  const provider = activeProviderState({
    unresolvedPolicy: formControl(form, "unresolvedPolicy").value
  });
  return {
    request: formControl(form, "request").value.trim(),
    rawSpecs,
    specs: normalizeSpecs(rawSpecs),
    approved: formControl(form, "reviewApproval").checked,
    automationApproved: formControl(form, "automationCodeApproval").checked,
    provider,
    config: currentConfig()
  };
}

async function persistProviderState(provider) {
  const partitioned = partitionProviderConfiguration(provider.id, provider.configuration);
  if (provider.id === "bring-your-own") {
    const rememberApiToken = provider.rememberApiToken === true;
    const storedApiToken = rememberApiToken
      ? String(game.settings.get(MODULE_ID, "providerApiToken") || "")
      : "";
    const apiToken = rememberApiToken
      ? partitioned.session.apiToken || storedApiToken
      : partitioned.session.apiToken;
    if (apiToken) providerSessionConfiguration.set(provider.id, { ...partitioned.session, apiToken });
    else providerSessionConfiguration.delete(provider.id);

    partitioned.session.apiToken = apiToken;
  } else if (provider.id === HOSTED_PROVIDER_ID) {
    const membershipToken = String(partitioned.session.membershipToken ?? "").trim();
    if (membershipToken) providerSessionConfiguration.set(provider.id, { membershipToken });
    else providerSessionConfiguration.delete(provider.id);
    partitioned.session.membershipToken = membershipToken;
  }

  const writes = [
    game.settings.set(MODULE_ID, "providerId", provider.id),
    game.settings.set(MODULE_ID, "unresolvedPolicy", provider.configuration.unresolvedPolicy)
  ];
  if (provider.id === "bring-your-own") {
    const rememberApiToken = provider.rememberApiToken === true;
    writes.push(
      game.settings.set(MODULE_ID, "providerEndpoint", partitioned.persisted.endpoint),
      game.settings.set(MODULE_ID, "providerModel", partitioned.persisted.model),
      game.settings.set(MODULE_ID, "rememberProviderApiToken", rememberApiToken),
      game.settings.set(MODULE_ID, "providerApiToken", rememberApiToken ? partitioned.session.apiToken : "")
    );
  } else if (provider.id === HOSTED_PROVIDER_ID) {
    // Membership tokens are intentionally session-only; never write them to a world setting.
    writes.push(game.settings.set(MODULE_ID, "providerMembershipToken", ""));
  }
  await Promise.all(writes);
}

function clearProviderConnection(dialog) {
  dialog._dm_forgeProviderConnection = null;
}

function providerConnectionSummary(provider, readiness, connection) {
  if (!provider?.available) {
    return { icon: "fa-cloud-slash", state: "warning", message: "Disabled" };
  }
  if (!readiness.ready) return null;
  if (!connection || connection.providerId !== provider.id) {
    return provider.mode === "network"
      ? { icon: "fa-cloud", state: "ready", message: "Network / Ready" }
      : { icon: "fa-laptop", state: "ready", message: "Offline / Ready" };
  }

  const healthStatus = String(connection.health?.status ?? "").trim().toLowerCase();
  const mode = String(connection.health?.mode ?? "").trim().toLowerCase();
  const modeLabel = mode === "openai"
    ? "OpenAI"
    : mode === "mock"
      ? "Mock"
      : healthStatus === "legacy-bridge"
        ? "Connected"
        : "Connected";
  const compatibility = connection.capabilities?.status;
  const compatibleKinds = Number(connection.capabilities?.compatibleKinds?.length ?? 0);
  const compatibilityText = compatibility === "compatible"
    ? `${compatibleKinds} kind${compatibleKinds === 1 ? "" : "s"}`
    : healthStatus === "legacy-bridge"
      ? "Legacy bridge"
    : compatibility === "not-supported"
      ? "No capabilities route"
    : compatibility === "not-advertised"
        ? "Health only"
        : "Connected";

  return {
    icon: provider.mode === "network" ? "fa-cloud" : "fa-laptop",
    state: mode === "mock" ? "warning" : "ready",
    message: `${modeLabel} / ${compatibilityText}`
  };
}

function providerConnectionDetailText(connection) {
  if (!connection) return "";

  const serviceName = String(connection.health?.service?.name ?? "Remote provider").trim();
  const serviceVersion = String(connection.health?.service?.version ?? "").trim();
  const serviceLabel = `${serviceName}${serviceVersion ? ` ${serviceVersion}` : ""}`;
  const healthStatus = String(connection.health?.status ?? "").trim().toLowerCase();
  const mode = String(connection.health?.mode ?? "").trim().toLowerCase();
  const compatibleKinds = Number(connection.capabilities?.compatibleKinds?.length ?? 0);
  const rateLimit = Number(connection.health?.requestLimits?.perMinute ?? 0);
  const monthlyLimit = Number(connection.health?.requestLimits?.perClientMonth ?? 0);
  const dailyLimit = Number(connection.health?.requestLimits?.perClientDay ?? 0);
  const compatibility = connection.capabilities?.status;
  const quotaParts = [];
  if (rateLimit > 0) quotaParts.push(`${rateLimit}/minute`);
  if (dailyLimit > 0) quotaParts.push(`${dailyLimit}/day`);
  if (monthlyLimit > 0) quotaParts.push(`${monthlyLimit}/month`);
  const rateText = quotaParts.length ? ` Limits: ${quotaParts.join(", ")}.` : "";

  if (mode === "mock") {
    return `${serviceLabel} is connected in mock mode. ${compatibleKinds} Forge item famil${compatibleKinds === 1 ? "y is" : "ies are"} compatible.${rateText} Switch the service to openai mode for live AI generation.`;
  }
  if (mode === "openai") {
    return `${serviceLabel} is connected in openai mode. ${compatibleKinds} Forge item famil${compatibleKinds === 1 ? "y is" : "ies are"} compatible.${rateText}`;
  }
  if (healthStatus === "legacy-bridge") {
    return `${serviceLabel} responded through its legacy bridge route. Compile requests can still proceed.${rateText}`;
  }
  if (compatibility === "not-supported") {
    return `${serviceLabel} responded. Capabilities discovery is unavailable, but compile requests can still proceed.${rateText}`;
  }
  if (compatibility === "not-advertised") {
    return `${serviceLabel} responded. Health is available, but the provider did not advertise capabilities.${rateText}`;
  }
  return `${serviceLabel} responded.${rateText}`;
}

async function checkProviderConnection(providerState) {
  const provider = getProvider(providerState?.id ?? DEFAULT_PROVIDER_ID);
  if (provider?.mode !== "network") {
    return {
      providerId: providerState?.id ?? DEFAULT_PROVIDER_ID,
      checkedAt: new Date().toISOString(),
      health: null,
      capabilities: null
    };
  }

  const connection = networkProviderConfiguration(providerState.id, providerState.configuration);
  const status = await requestRemoteServiceStatus({
    endpoint: connection.endpoint,
    token: connection.apiToken,
    membershipToken: connection.membershipToken,
    supportedKinds: SUPPORTED_SPEC_KINDS
  });
  return {
    providerId: providerState.id,
    ...status
  };
}

function refreshForgeProviderSummary(dialog, form) {
  if (!(form instanceof HTMLFormElement)) return;

  const provider = activeProviderState({
    unresolvedPolicy: formControl(form, "unresolvedPolicy").value
  });
  const snapshot = providerStatusSnapshot(provider.id, provider.configuration, dialog._dm_forgeProviderConnection);
  const summary = dialog.element?.querySelector(".dm_forge-provider-summary");
  const label = summary?.querySelector("strong");
  const text = summary?.querySelector("[data-forge-provider-summary-text]");
  const icon = summary?.querySelector(".dm_forge-provider-summary-meta i");
  const compileButton = dialog.element?.querySelector('button[data-action="compile"]');

  if (summary) summary.dataset.state = snapshot.state;
  if (label) label.textContent = snapshot.provider?.label ?? "Provider";
  if (text) text.textContent = snapshot.message;
  if (icon) icon.className = `fa-solid ${snapshot.icon}`;
  const footerStatus = dialog.element?.querySelector("[data-forge-footer-provider-status]");
  const footerIcon = footerStatus?.querySelector("i");
  const footerText = footerStatus?.querySelector("span");
  if (footerStatus) footerStatus.dataset.state = snapshot.state;
  if (footerIcon) footerIcon.className = `fa-solid ${snapshot.icon}`;
  if (footerText) footerText.textContent = snapshot.message;
  if (compileButton instanceof HTMLButtonElement) compileButton.disabled = !snapshot.readiness.ready;
}

function showDialogView(form, view) {
  const panel = form?.querySelector?.(`[data-forge-panel="${view}"]`);
  if (!(panel instanceof HTMLElement)) return;

  panel.focus({ preventScroll: true });
  panel.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function syncCreateAction(dialog) {
  const form = dialog.element?.querySelector("form");
  const approval = form?.elements?.namedItem("reviewApproval");
  const automationApproval = form?.elements?.namedItem("automationCodeApproval");
  const createButton = dialog.element?.querySelector('button[data-action="create"]');
  if (!(approval instanceof HTMLInputElement) || !(createButton instanceof HTMLButtonElement)) return;

  const codeApproved = dialog._dm_forgeAutomationCodeRequired !== true
    || (automationApproval instanceof HTMLInputElement && automationApproval.checked);
  createButton.disabled = !dialog._dm_forgeReviewValidated || !codeApproved;
  createButton.setAttribute("aria-disabled", String(createButton.disabled));
}

function retryActionAvailability(dialog) {
  const form = dialog?.element?.querySelector?.("form");
  const request = form instanceof HTMLFormElement ? formControl(form, "request").value.trim() : "";
  const previewRequest = String(dialog?._dm_forgePreviewRequest ?? "").trim();
  if (!request || !previewRequest || request !== previewRequest) {
    return { enabled: false, message: "Convert the description into editable Forge specs." };
  }
  const availability = repairRerunAvailability(dialog);
  return availability.enabled
    ? { enabled: true, message: "Open the SEND IT AGAIN!? confirmation for one new repair request." }
    : { enabled: false, message: "Convert the description into editable Forge specs." };
}

function syncCompileAction(dialog) {
  const button = dialog?.element?.querySelector?.('button[data-action="compile"]');
  if (!(button instanceof HTMLButtonElement)) return;

  const retry = retryActionAvailability(dialog).enabled;
  const label = retry ? "Retry" : "Preview";
  const icon = retry ? "fa-rotate" : "fa-wand-magic-sparkles";
  button.replaceChildren(
    Object.assign(document.createElement("i"), { className: `fa-solid ${icon}` }),
    Object.assign(document.createElement("span"), { textContent: label })
  );
  button.title = retry
    ? "Open SEND IT AGAIN!? to send one new, user-confirmed repair request."
    : "Convert the description into editable Forge specs";
  button.setAttribute("aria-label", label);
  button.dataset.forgeCompileMode = retry ? "retry" : "preview";
}

function relocateBottomActions(dialog) {
  const form = dialog.element?.querySelector("form");
  const footer = form?.querySelector(".form-footer");
  const approval = form?.elements?.namedItem("reviewApproval");
  const approvalLabel = approval instanceof HTMLInputElement ? approval.closest(".dm_forge-approval") : null;
  const automationApproval = form?.elements?.namedItem("automationCodeApproval");
  const automationApprovalLabel = automationApproval instanceof HTMLInputElement
    ? automationApproval.closest(".dm_forge-approval")
    : null;
  const compileButton = footer?.querySelector('[data-action="compile"]');
  if (!(footer instanceof HTMLElement) || !(approvalLabel instanceof HTMLElement)) return;

  if (compileButton instanceof HTMLButtonElement) compileButton.after(approvalLabel);
  if (automationApprovalLabel instanceof HTMLElement && approvalLabel instanceof HTMLElement) approvalLabel.after(automationApprovalLabel);
  if (!footer.querySelector("[data-forge-footer-provider-status]")) {
    const provider = activeProviderState({
      unresolvedPolicy: formControl(form, "unresolvedPolicy").value
    });
    const snapshot = providerStatusSnapshot(provider.id, provider.configuration, dialog._dm_forgeProviderConnection);
    approvalLabel.insertAdjacentHTML("afterend", forgeFooterProviderStatusHTML(snapshot));
  }
  footer.classList.add("dm_forge-actions-footer");
}

function repairRerunAvailability(dialog) {
  const context = dialog?._dm_forgeRepairContext;
  if (!context || context.attempted === true) {
    return { visible: false, enabled: false, message: "Repair is available after a reviewed network preview and can be used only once." };
  }
  const provider = reportContextProvider(dialog);
  const providerRecord = getProvider(provider.id);
  if (!providerRecord || providerRecord.mode !== "network") {
    return { visible: false, enabled: false, message: "Repair reruns require a network Forge service." };
  }
  const capabilities = dialog?._dm_forgeProviderConnection?.capabilities;
  if (capabilities?.features?.repairRerun !== true) {
    return { visible: true, enabled: false, message: "The connected Forge service does not advertise user-confirmed repair reruns yet." };
  }
  try {
    const connection = networkProviderConfiguration(provider.id, provider.configuration);
    if (!String(connection.endpoint ?? "").trim()) {
      return { visible: true, enabled: false, message: "Configure the connected Forge service before sending a repair rerun." };
    }
  } catch {
    return { visible: true, enabled: false, message: "Finish configuring the connected Forge service before sending a repair rerun." };
  }
  return { visible: true, enabled: true, message: "Send one new repair request, then review and approve the returned preview again." };
}

function setRepairPromptLock(dialog, locked) {
  const form = dialog?.element?.querySelector?.("form");
  const request = form instanceof HTMLFormElement ? formControl(form, "request") : null;
  if (!(request instanceof HTMLTextAreaElement)) return;
  request.readOnly = locked === true;
  request.dataset.forgeRepairLocked = String(locked === true);
  request.setAttribute("aria-readonly", String(locked === true));
}

function setReviewValidated(dialog, validated) {
  const form = dialog.element?.querySelector("form");
  const approval = form?.elements?.namedItem("reviewApproval");
  const automationApproval = form?.elements?.namedItem("automationCodeApproval");
  dialog._dm_forgeReviewValidated = validated;
  if (approval instanceof HTMLInputElement) {
    approval.disabled = !validated;
    if (!validated) approval.checked = false;
  }
  if (automationApproval instanceof HTMLInputElement && !validated) automationApproval.checked = false;
  syncCreateAction(dialog);
  syncCompileAction(dialog);
}

function clearForgeResultState(dialog) {
  dialog._dm_forgeCompilation = null;
  dialog._dm_forgeRepairContext = null;
  dialog._dm_forgePreviewRequest = null;
  dialog._dm_forgeAutomationCodeRequired = false;
  setReviewValidated(dialog, false);
  for (const selector of ["[data-forge-compile-report]", "[data-forge-preview]", "[data-forge-automation-review]", "[data-forge-diagnostics]"]) {
    const output = dialog.element?.querySelector(selector);
    if (!output) continue;
    output.hidden = true;
    if ("innerHTML" in output) output.innerHTML = "";
  }
  // Keep the editor control mounted so the next preview can write the normalized specs.
  const advancedReview = dialog.element?.querySelector("[data-forge-advanced-review]");
  if (advancedReview instanceof HTMLElement) advancedReview.hidden = true;
  const codeApprovalWrap = dialog.element?.querySelector("[data-forge-code-approval-wrap]");
  const reviewTabs = dialog.element?.querySelector("[data-forge-review-tabs]");
  const codeApproval = dialog.element?.querySelector('input[name="automationCodeApproval"]');
  if (codeApprovalWrap instanceof HTMLElement) codeApprovalWrap.hidden = true;
  if (reviewTabs instanceof HTMLElement) reviewTabs.hidden = true;
  if (codeApproval instanceof HTMLInputElement) {
    codeApproval.checked = false;
    codeApproval.disabled = true;
  }
  const capacity = dialog.element?.querySelector("[data-forge-capacity]");
  if (capacity instanceof HTMLElement) capacity.hidden = true;
  syncCompileAction(dialog);
}

function bindForgeUsability(dialog, element) {
  const form = element?.querySelector?.("form") ?? dialog.element?.querySelector("form");
  if (!(form instanceof HTMLFormElement) || form.dataset.forgeUsabilityBound !== undefined) return;
  form.dataset.forgeUsabilityBound = "";
  relocateBottomActions(dialog);

  const approval = formControl(form, "reviewApproval");
  const automationApproval = formControl(form, "automationCodeApproval");
  const request = formControl(form, "request");
  const specs = formControl(form, "specs");
  const unresolvedPolicy = formControl(form, "unresolvedPolicy");
  for (const tab of form.querySelectorAll("[data-forge-review-tab]")) {
    tab.addEventListener("click", () => setReviewTab(dialog, tab.dataset.forgeReviewTab));
  }
  approval.addEventListener("change", () => {
    approval.closest(".dm_forge-approval")?.classList.remove("dm_forge-approval-needs-attention");
    syncCreateAction(dialog);
  });
  automationApproval.addEventListener("change", () => {
    automationApproval.closest(".dm_forge-approval")?.classList.remove("dm_forge-approval-needs-attention");
    syncCreateAction(dialog);
  });
  unresolvedPolicy.addEventListener("change", () => {
    refreshForgeProviderSummary(dialog, form);
  });
  request.addEventListener("input", () => {
    clearForgeResultState(dialog);
    setStatus(dialog, "warning", "Request changed. Preview again to refresh the item review.");
  });
  specs.addEventListener("input", () => {
    clearForgeResultState(dialog);
    setStatus(dialog, "warning", "Specifications changed. Validate to refresh the item review.");
  });
  setReviewValidated(dialog, false);
  refreshForgeProviderSummary(dialog, form);
  syncCompileAction(dialog);
}

function setStatus(dialog, state, message) {
  const root = dialog.element?.querySelector ? dialog.element : dialog.element?.[0] ?? dialog.element;
  const output = root?.querySelector?.("[data-forge-status]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
}

const REVIEW_NOTE_ICONS = Object.freeze({
    assumption: "fa-lightbulb",
    deferred: "fa-hand",
    "free-forge": "fa-cloud",
    notice: "fa-circle-info",
    note: "fa-circle-info",
    reference: "fa-book-open",
    resolved: "fa-check",
    review: "fa-clipboard-check",
    unresolved: "fa-clipboard-check",
    warning: "fa-triangle-exclamation"
});

function reviewNoteIcon(state) {
  return REVIEW_NOTE_ICONS[state] ?? "fa-circle-info";
}

function reviewNoteDisplayLabel(note) {
  const state = note?.state;
  if (state === "warning") return "Warning";
  if (["review", "unresolved", "deferred"].includes(state)) return "Review";
  if (state === "notice") return "Notice";
  if (state === "free-forge") return "Free Forge";
  if (["assumption", "reference", "note", "resolved"].includes(state)) return "Resolved";
  return note?.label ?? "Review note";
}

function reviewNoteHTML(note) {
  return `
    <div class="dm_forge-review-note" data-state="${escapeHTML(note.state)}">
      <i class="fa-solid ${reviewNoteIcon(note.state)}"></i>
      <div>
        <strong>${escapeHTML(reviewNoteDisplayLabel(note))}</strong>
        <span>${escapeHTML(note.message)}</span>
        ${note.handling ? `<small>${escapeHTML(note.handling)}</small>` : ""}
      </div>
    </div>
  `;
}

function summarizeFooterNotes(notes) {
  const groups = [
    { state: "warning", label: "Warnings", states: ["warning"] },
    { state: "review", label: "Review", states: ["review", "unresolved", "deferred"] },
    { state: "notice", label: "Notices", states: ["notice"] },
    { state: "free-forge", label: "Free Forge", states: ["free-forge"] },
    { state: "resolved", label: "Resolved", states: ["assumption", "reference", "note"] }
  ];
  return groups
    .map(group => ({
      ...group,
      notes: notes.filter(note => group.states.includes(note.state))
    }))
    .filter(group => group.notes.length);
}

function itemNoteBadgesHTML(notes) {
  const groups = summarizeFooterNotes(notes ?? []);
  if (!groups.length) return "";
  return `
    <section class="dm_forge-item-sheet-card dm_forge-item-sheet-notes">
      <div class="dm_forge-item-sheet-card-head">
        <strong>Review notes</strong>
        <span>${notes.length} note${notes.length === 1 ? "" : "s"}</span>
      </div>
      <div class="dm_forge-review-note-groups">
        ${groups.map(group => `
          <details class="dm_forge-review-note-group" data-state="${escapeHTML(group.state)}">
            <summary>
              <span class="dm_forge-review-note-group-title"><i class="fa-solid ${reviewNoteIcon(group.state)}"></i>${escapeHTML(group.label)}</span>
              <span>${group.notes.length}</span>
            </summary>
            <div class="dm_forge-review-note-group-body">${group.notes.map(reviewNoteHTML).join("")}</div>
          </details>
        `).join("")}
      </div>
    </section>
  `;
}

function reviewOverview(summaries = []) {
  const itemCount = summaries.length;
  const unresolvedItems = summaries.filter(summary => (summary.unresolvedCount ?? 0) > 0).length;
  const unresolvedMechanics = summaries.reduce((total, summary) => total + (summary.unresolvedCount ?? 0), 0);
  return {
    itemCount,
    readyItems: itemCount - unresolvedItems,
    unresolvedItems,
    unresolvedMechanics
  };
}

function reviewOverviewHTML(summaries = []) {
  const overview = reviewOverview(summaries);
  const pills = [
    {
      state: "ready",
      icon: "fa-check",
      label: `${overview.readyItems} forge-ready`
    }
  ];
  if (overview.unresolvedItems) {
    pills.push({
      state: "unresolved",
      icon: "fa-triangle-exclamation",
      label: `${overview.unresolvedItems} item${overview.unresolvedItems === 1 ? "" : "s"} need manual review`
    });
  }
  if (overview.unresolvedMechanics) {
    pills.push({
      state: "warning",
      icon: "fa-list-check",
      label: `${overview.unresolvedMechanics} unresolved mechanic${overview.unresolvedMechanics === 1 ? "" : "s"} preserved`
    });
  }
  return `
    <div class="dm_forge-review-overview">
      ${pills.map(pill => `
        <span class="dm_forge-review-pill" data-state="${pill.state}">
          <i class="fa-solid ${pill.icon}"></i>
          <span>${escapeHTML(pill.label)}</span>
        </span>
      `).join("")}
    </div>
  `;
}

function reviewItemHTML(summary) {
  const itemIcon = safeItemIcon(summary.img);
  const automationRoute = summary.automationRoute;
  return `
    <article class="dm_forge-item-summary dm_forge-item-sheet" data-state="${summary.unresolvedCount ? "unresolved" : "ready"}">
      <header class="dm_forge-item-sheet-header">
        <img src="${escapeHTML(itemIcon)}" alt="">
        <div class="dm_forge-item-sheet-titlewrap">
          <div class="dm_forge-item-sheet-titlebar">
            <h3>${escapeHTML(summary.name)}</h3>
          </div>
          <div class="dm_forge-item-sheet-ribbon">
            <span>${escapeHTML(summary.kindLabel)}</span>
            <span>${escapeHTML(summary.rarity)}</span>
            <span>${escapeHTML(summary.attunement)}</span>
          </div>
          <div class="dm_forge-item-sheet-status">
            <span class="dm_forge-review-pill" data-state="${summary.unresolvedCount ? "unresolved" : "ready"}">
              <i class="fa-solid ${summary.unresolvedCount ? "fa-triangle-exclamation" : "fa-check"}"></i>
              <span>${escapeHTML(summary.reviewStateLabel ?? (summary.unresolvedCount ? "Manual review needed" : "Forge-ready"))}</span>
            </span>
          </div>
          ${automationRoute ? `
            <div class="dm_forge-automation-route" data-state="${automationRoute.available ? "available" : "fallback"}">
              <strong><i class="fa-solid fa-route"></i> ${escapeHTML(automationRoute.available ? "Automation layer" : "Automation fallback")}</strong>
              <span>${escapeHTML(automationRoute.selectedLayer)}</span>
              <small>Required modules: ${escapeHTML(automationRoute.dependencyLabels?.join(", ") || "none")}</small>
            </div>
          ` : ""}
        </div>
      </header>
      <div class="dm_forge-item-sheet-tabs" aria-hidden="true">
        <span class="dm_forge-item-sheet-tab is-active">Description</span>
        <span class="dm_forge-item-sheet-tab">Details</span>
        <span class="dm_forge-item-sheet-tab">Activities${summary.activityCount ? ` <em>${summary.activityCount}</em>` : ""}</span>
        <span class="dm_forge-item-sheet-tab">Effects${summary.effectCount ? ` <em>${summary.effectCount}</em>` : ""}</span>
      </div>
      <div class="dm_forge-item-sheet-body">
        <p class="dm_forge-item-sheet-subtitle">${escapeHTML(summary.subtitle)}</p>
        ${summary.description ? `<div class="dm_forge-item-sheet-description">${escapeHTML(summary.description)}</div>` : ""}
        ${summary.unresolvedCount
          ? `
            <section class="dm_forge-item-sheet-card dm_forge-item-sheet-alert" data-state="unresolved">
              <div class="dm_forge-item-sheet-card-head">
                <strong>Manual review preserved</strong>
                <span>${summary.unresolvedCount} mechanic${summary.unresolvedCount === 1 ? "" : "s"}</span>
              </div>
              <div class="dm_forge-item-sheet-alert-copy">
                <p>Forge created every compatible mechanic it could model safely and preserved the remaining mechanic${summary.unresolvedCount === 1 ? "" : "s"} for review instead of inventing behavior.</p>
                ${summary.unresolvedLabels?.length
                  ? `<div class="dm_forge-item-sheet-alert-tags">${summary.unresolvedLabels.map(label => `<span>${escapeHTML(label)}</span>`).join("")}</div>`
                  : ""}
              </div>
            </section>
          `
          : ""
        }
        <section class="dm_forge-item-sheet-card">
          <div class="dm_forge-item-sheet-card-head">
            <strong>Mechanical preview</strong>
            <span>${summary.mechanics.length} detail${summary.mechanics.length === 1 ? "" : "s"}</span>
          </div>
          ${summary.mechanics.length
            ? `
              <ul class="dm_forge-mechanics dm_forge-item-sheet-stats">
                ${summary.mechanics.map(mechanic => `<li><i class="fa-solid fa-bolt"></i><span>${escapeHTML(mechanic)}</span></li>`).join("")}
              </ul>
            `
            : `
              <div class="dm_forge-empty-state">
                <i class="fa-solid fa-scroll"></i>
                <div>
                  <strong>No confirmed mechanics yet</strong>
                  <span>This request currently resolves mostly as description and review notes. Adjust the wording or edit the generated specification if you want a stronger automated result.</span>
                </div>
              </div>
            `
          }
        </section>
        ${itemNoteBadgesHTML(summary.notes)}
      </div>
    </article>
  `;
}

function collectFooterNotes(summaries, validation) {
  const notes = [];
  const seen = new Set();
  for (const summary of summaries ?? []) {
    for (const note of summary.notes ?? []) {
      const key = `${note.state}|${note.label}|${note.message}|${note.handling ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notes.push(note);
    }
  }
  for (const warning of validation?.warnings ?? []) {
    const note = { state: "review", label: "Validation review", message: warning, handling: "" };
    const key = `${note.state}|${note.label}|${note.message}|`;
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
  }
  const order = { warning: 0, review: 1, unresolved: 1, deferred: 1, notice: 2, "free-forge": 3, resolved: 4, assumption: 4, reference: 4, note: 4 };
  return notes.sort((left, right) => (order[left.state] ?? 99) - (order[right.state] ?? 99));
}

function titleCaseWords(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

function uniqueReferences(entries = []) {
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.kind}:${entry.name}`;
    if (!entry.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSpellChoiceCompilationNote(text) {
  return /\bspell/i.test(String(text ?? "")) && /\b(choice|charges?)\b/i.test(String(text ?? ""));
}

function specReferenceLookups(spec) {
  const references = [];
  const add = (kind, name, label) => {
    const normalized = String(name ?? "").trim();
    if (!normalized) return;
    references.push({ kind, name: normalized, label });
  };
  const summonActorReferenceName = actor => {
    const explicit = actor?.srdActorName ?? actor?.systemReferenceName ?? actor?.referenceName ?? actor?.sourceName;
    if (String(explicit ?? "").trim()) return explicit;
    const actorName = String(actor?.name ?? "").trim();
    if (actorName && !/^Forge Summon\s*-/i.test(actorName)) return actorName;
    return "";
  };

  if (["weaponExtraDamage", "weaponConditionOnHit", "shieldArmorBonus"].includes(spec.kind)) {
    add("equipment", titleCaseWords(spec.baseItem || (spec.kind === "shieldArmorBonus" ? "shield" : "")), "System equipment");
  }

  if (spec.kind === "passiveEffectEquipment" && spec.equipmentType === "heavy" && /\bplate\b/i.test(spec.description ?? "")) {
    add("equipment", "Plate Armor", "System equipment");
  }

  if (spec.baseItem && ["multiActivityStaff", "artifactWeaponHybrid", "equipmentPowerSuite", "legendaryEquipmentSuite", "casterUtilityEquipment", "passiveEffectEquipment"].includes(spec.kind)) {
    add("equipment", titleCaseWords(spec.baseItem), "System equipment");
  }

  if (spec.summonActor) {
    add("actor", summonActorReferenceName(spec.summonActor), "System actor");
  }

  for (const profile of spec.summonProfiles ?? []) {
    add("actor", summonActorReferenceName(profile.actor), "System actor");
  }

  for (const activity of [
    ...(spec.activities ?? []),
    ...(spec.utilityActivities ?? []),
    ...(spec.saveActivities ?? [])
  ]) {
    const match = String(activity.activityName ?? "").match(/^Cast\s+(.+)$/i);
    if (match) add("spell", match[1], "System spell");
    else if (/^[A-Z][A-Za-z' -]+$/.test(String(activity.activityName ?? "")) && (activity.save || activity.damageParts?.length)) {
      add("spell", activity.activityName, "System spell");
    }
  }

  return uniqueReferences(references);
}

function supportsWeaponBase(spec) {
  return [
    "weaponExtraDamage",
    "weaponConditionOnHit",
    "artifactWeaponHybrid",
    "equipmentPowerSuite",
    "legendaryEquipmentSuite",
    "casterUtilityEquipment",
    "multiActivityStaff"
  ].includes(spec?.kind);
}

function applySystemWeaponBase(spec, profile) {
  if (!profile || !supportsWeaponBase(spec)) return spec;
  const properties = new Set([...(profile.properties ?? []), ...(spec.properties ?? [])]);
  if (String(spec.magicalBonus ?? "").trim() && String(spec.magicalBonus) !== "0") properties.add("mgc");
  return {
    ...spec,
    weaponType: profile.weaponType,
    baseItem: profile.baseItem,
    damage: profile.damage,
    properties: [...properties],
    range: profile.range,
    mastery: spec.mastery || profile.mastery,
    weight: normalizeWeight(spec.weight, profile.weight ?? 0),
    img: profile.img || spec.img
  };
}

function supportsEquipmentBase(spec) {
  return [
    "shieldArmorBonus",
    "passiveEffectEquipment",
    "chargedSaveDamage",
    "chargedHealing",
    "nativeEnchant",
    "nativeSummon",
    "nativeMultiProfileSummon",
    "wondrousPassive",
    "casterUtilityEquipment",
    "equipmentPowerSuite",
    "legendaryEquipmentSuite"
  ].includes(spec?.kind);
}

function applySystemEquipmentBase(spec, profile) {
  if (!profile || !supportsEquipmentBase(spec)) return spec;
  return {
    ...spec,
    itemType: spec.itemType || profile.itemType || "equipment",
    equipmentType: spec.equipmentType || profile.equipmentType,
    baseItem: spec.baseItem || profile.baseItem,
    armorValue: Number(spec.armorValue ?? profile.armorValue ?? 0) || 0,
    armorDex: spec.armorDex ?? profile.armorDex ?? null,
    strength: spec.strength ?? profile.strength ?? null,
    weight: normalizeWeight(spec.weight, profile.weight ?? 0),
    img: profile.img || spec.img
  };
}

async function enrichSpecsWithSystemReferences(specs, requestText = "") {
  const items = Array.isArray(specs) ? specs : [];
  const cache = new Map();
  const resolveReference = async reference => {
    const key = `${reference.kind}:${reference.name}`;
    if (!cache.has(key)) {
      cache.set(key, resolveSystemContentByName(reference.name, reference.kind).catch(error => ({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      })));
    }
    return cache.get(key);
  };

  return Promise.all(items.map(async spec => {
    let nextSpec = spec;
    const systemReferences = Array.isArray(spec.systemReferences) ? [...spec.systemReferences] : [];
    const profileText = [spec.name, spec.baseItem, spec.equipmentType, requestText].filter(Boolean).join(" ");
    const weaponProfile = supportsWeaponBase(spec)
      ? await findSystemNonMagicalWeaponForText(profileText).catch(() => null)
      : null;
    if (weaponProfile) {
      nextSpec = applySystemWeaponBase(nextSpec, weaponProfile);
      systemReferences.push({
        kind: "equipment",
        name: weaponProfile.name,
        label: "System nonmagical weapon base",
        uuid: weaponProfile.sourceUuid,
        packLabel: weaponProfile.pack.label,
        documentType: "Item",
        message: `${weaponProfile.name} from ${weaponProfile.pack.label}`
      });
    }
    const equipmentProfile = !weaponProfile && supportsEquipmentBase(spec)
      ? await findSystemNonMagicalEquipmentForText(profileText).catch(() => null)
      : null;
    if (equipmentProfile) {
      nextSpec = applySystemEquipmentBase(nextSpec, equipmentProfile);
      systemReferences.push({
        kind: "equipment",
        name: equipmentProfile.name,
        label: "System nonmagical equipment base",
        uuid: equipmentProfile.sourceUuid,
        packLabel: equipmentProfile.pack.label,
        documentType: "Item",
        message: `${equipmentProfile.name} from ${equipmentProfile.pack.label}`
      });
    }
    for (const reference of specReferenceLookups(spec)) {
      const resolution = await resolveReference(reference);
      if (resolution?.status !== "compatible") continue;
      systemReferences.push({
        kind: reference.kind,
        name: reference.name,
        label: reference.label,
        uuid: resolution.match.uuid,
        packLabel: resolution.match.pack.label,
        documentType: resolution.match.documentType,
        message: `${reference.name} from ${resolution.match.pack.label}`
      });
      if (reference.kind === "equipment") {
        nextSpec = applySystemEquipmentArt(nextSpec, resolution.match.img);
      } else if (reference.kind === "spell") {
        nextSpec = applySpellActivityArt(nextSpec, reference.name, resolution.match.img);
      }
    }
    const baseChassisArt = applyBaseChassisFallbackArt(nextSpec, requestText);
    nextSpec = baseChassisArt.spec;
    if (baseChassisArt.applied) {
      systemReferences.push({
        kind: "art",
        name: `${nextSpec.name} Foundry core art`,
        label: "Foundry core image",
        message: "Used bundled Foundry base-item art because no compatible system item image was available."
      });
    }
    nextSpec = applyFallbackActivityArt(nextSpec);
    const projectileArt = applyConsumableProjectileFallbackArt(nextSpec, requestText);
    nextSpec = projectileArt.spec;
    if (projectileArt.applied) {
      systemReferences.push({
        kind: "art",
        name: `${nextSpec.name} Foundry core art`,
        label: "Foundry core image",
        message: "Used bundled Foundry consumable-projectile art because no exact system item image was available."
      });
    } else {
      const categoryArt = applyCategoryItemFallbackArt(nextSpec, requestText);
      nextSpec = categoryArt.spec;
      if (categoryArt.applied) {
        systemReferences.push({
          kind: "art",
          name: `${nextSpec.name} Foundry core art`,
          label: "Foundry core image",
          message: "Used a bundled Foundry image based on the item category because no exact system item image was available."
        });
      } else if (needsFallbackItemArt(nextSpec.img)) {
        systemReferences.push({
          kind: "art",
          name: `${nextSpec.name} missing art`,
          label: "Item image",
          message: "No matching system or bundled Foundry image was found; the generic item image is being used."
        });
      }
    }
    return systemReferences.length ? { ...nextSpec, systemReferences: uniqueReferences(systemReferences) } : nextSpec;
  }));
}

async function enrichCompilationWithSrdSpellChoices(compilation, requestText = "") {
  const items = Array.isArray(compilation?.specs) ? compilation.specs : [];
  if (!items.length) return compilation;
  const providerSpecFingerprint = fingerprintForgeSpecs(items);
  const mechanicsRequest = mechanicsRequestForCompilation(compilation, requestText);

  const featurePlan = await planItemFeatures(mechanicsRequest, {
    resolveSpell: resolveSpellByName
  });
  let applied = false;
  const assumptions = [...(compilation.assumptions ?? [])];
  const warnings = [...(compilation.warnings ?? [])];
  const deferred = [...(compilation.deferred ?? [])];
  const specs = [];

  for (const spec of items) {
    const planned = applyFeaturePlanToSpec(spec, featurePlan);
    const repairedHybrid = repairHybridSpecFromRequest(planned.spec, mechanicsRequest);
    const result = await autoSelectSrdChoiceSpells(repairedHybrid.spec, mechanicsRequest, {
      resolveSpell: resolveSpellByName,
      resolveSpellDocument: resolution => resolveSystemDocument(resolution)
    });
    const repaired = await repairNamedSrdSpellActivities(result.spec, mechanicsRequest, {
      resolveSpell: resolveSpellByName,
      resolveSpellDocument: resolution => resolveSystemDocument(resolution)
    });
    const reconciled = await reconcilePlannedSrdSpellActivities(repaired.spec, featurePlan, mechanicsRequest, {
      resolveSpell: resolveSpellByName,
      resolveSpellDocument: resolution => resolveSystemDocument(resolution)
    });
    const deduped = dedupeRecognizedSpellActivities(reconciled.spec, mechanicsRequest);
    const defaulted = applyForgeSpecDefaults(deduped.spec);
    const charged = await applyDefaultLeveledSpellCharges(defaulted.spec, mechanicsRequest, {
      resolveSpell: resolveSpellByName,
      resolveSpellDocument: resolution => resolveSystemDocument(resolution)
    });
    const blueprinted = buildLayeredItemBlueprint(charged.spec, mechanicsRequest);
    const attunementAligned = alignSpecAttunementToRequest(blueprinted.spec, mechanicsRequest);
    const sanitized = sanitizeForgeSpec(attunementAligned.spec);
    specs.push(sanitized.spec);
    if (planned.applied) applied = true;
    if (repairedHybrid.applied) {
      applied = true;
      for (const assumption of repairedHybrid.assumptions ?? []) {
        if (assumption && !assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (result.applied) {
      applied = true;
      if (result.assumption && !assumptions.includes(result.assumption)) assumptions.push(result.assumption);
    } else if (result.warning && !warnings.includes(result.warning)) {
      warnings.push(result.warning);
    }
    if (repaired.applied) {
      applied = true;
      for (const assumption of repaired.assumptions ?? []) {
        if (!assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (reconciled.applied) {
      applied = true;
      for (const assumption of reconciled.assumptions ?? []) {
        if (!assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (deduped.applied) {
      applied = true;
      for (const assumption of deduped.assumptions ?? []) {
        if (!assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (defaulted.applied) {
      applied = true;
      for (const assumption of defaulted.assumptions ?? []) {
        if (!assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (charged.applied) {
      applied = true;
      for (const assumption of charged.assumptions ?? []) {
        if (!assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (blueprinted.applied) {
      applied = true;
      for (const assumption of blueprinted.assumptions ?? []) {
        if (!assumptions.includes(assumption)) assumptions.push(assumption);
      }
    }
    if (attunementAligned.applied) {
      applied = true;
      if (attunementAligned.assumption && !assumptions.includes(attunementAligned.assumption)) {
        assumptions.push(attunementAligned.assumption);
      }
    }
    if (sanitized.applied) {
      applied = true;
      const summary = `Repaired malformed model fields: ${sanitized.repairs.join(", ")}.`;
      if (!assumptions.includes(summary)) assumptions.push(summary);
    }
  }

  if (!applied) {
    return {
      ...compilation,
      forgeProvenance: {
        servicePreparedSpecFingerprint: String(compilation.preparedSpecFingerprint ?? ""),
        providerSpecFingerprint,
        finalSpecFingerprint: providerSpecFingerprint,
        changedAfterProvider: false
      }
    };
  }

  const filteredWarnings = warnings.filter(note => !isSpellChoiceCompilationNote(note) || /Selected compatible SRD spells automatically/i.test(note));
  const filteredDeferred = deferred.filter(note => !isSpellChoiceCompilationNote(note));
  const unresolvedMechanics = specs.flatMap(spec => (spec.unresolvedMechanics ?? []).map(mechanic => ({
    itemName: spec.name,
    ...mechanic
  })));
  const decisions = (compilation.decisions ?? []).map((decision, index) => ({
    ...decision,
    unresolvedCount: specs[index]?.unresolvedMechanics?.length ?? 0
  }));

  return {
    ...compilation,
    specs,
    decisions,
    assumptions,
    warnings: filteredWarnings,
    deferred: filteredDeferred,
    unresolvedMechanics,
    featurePlan,
    forgeProvenance: {
      servicePreparedSpecFingerprint: String(compilation.preparedSpecFingerprint ?? ""),
      providerSpecFingerprint,
      finalSpecFingerprint: fingerprintForgeSpecs(specs),
      changedAfterProvider: providerSpecFingerprint !== fingerprintForgeSpecs(specs)
    }
  };
}

function compilationWithPreparedSpecs(compilation, specs) {
  if (!compilation) return null;
  const preparedSpecs = Array.isArray(specs) ? specs : [];
  const providerSpecFingerprint = String(
    compilation.forgeProvenance?.providerSpecFingerprint
      ?? fingerprintForgeSpecs(compilation.specs)
  );
  const finalSpecFingerprint = fingerprintForgeSpecs(preparedSpecs);
  return {
    ...compilation,
    specs: preparedSpecs,
    decisions: (compilation.decisions ?? []).map((decision, index) => ({
      ...decision,
      unresolvedCount: preparedSpecs[index]?.unresolvedMechanics?.length ?? 0
    })),
    unresolvedMechanics: preparedSpecs.flatMap(spec => (spec.unresolvedMechanics ?? []).map(mechanic => ({
      itemName: spec.name,
      ...mechanic
    }))),
    forgeProvenance: {
      servicePreparedSpecFingerprint: String(
        compilation.forgeProvenance?.servicePreparedSpecFingerprint
          ?? compilation.preparedSpecFingerprint
          ?? ""
      ),
      providerSpecFingerprint,
      finalSpecFingerprint,
      changedAfterProvider: providerSpecFingerprint !== finalSpecFingerprint
    }
  };
}

function syncPreparedSpecs(dialog, form, specs) {
  const rawSpecs = JSON.stringify(specs, null, 2);
  formControl(form, "specs").value = rawSpecs;
  if (dialog?._dm_forgeCompilation) {
    dialog._dm_forgeCompilation = compilationWithPreparedSpecs(dialog._dm_forgeCompilation, specs);
  }
  return rawSpecs;
}

async function renderPreview(dialog, validation, compilation = dialog._dm_forgeCompilation) {
  const preview = dialog.element?.querySelector("[data-forge-preview]");
  if (!preview) return;

  const summaries = buildReviewSummaries(validation.specs, compilation, null, currentConfig().automationCapabilities);
  setReviewValidated(dialog, true);
  preview.hidden = false;
  preview.innerHTML = `
    <div class="dm_forge-review-head">
      <strong>${validation.itemCount} item${validation.itemCount === 1 ? "" : "s"} ready for review</strong>
      <span><i class="fa-solid fa-check"></i> Validated</span>
    </div>
    ${reviewOverviewHTML(summaries)}
    <div class="dm_forge-review-items">${summaries.map(reviewItemHTML).join("")}</div>
  `;
  const compiledKinds = dialog.element?.querySelector("[data-forge-compiled-kinds]");
  if (compiledKinds) {
    compiledKinds.textContent = validation.specs.map(spec => String(spec?.kind ?? "").trim()).filter(Boolean).join(", ");
  }
  renderAutomationCodeReview(dialog, validation.automationCodePreview ?? []);
  const reviewNotes = collectFooterNotes(summaries, validation);
  renderForgeCapacity(dialog, compilation?.usage);
  updateRepairContext(dialog, {
    request: dialogRequestFor(dialog),
    validation,
    reviewNotes,
    compilation
  });
  return reviewNotes;
}

function setReviewTab(dialog, tab = "visual") {
  const normalizedTab = ["visual", "automation", "specs"].includes(tab) ? tab : "visual";
  const preview = dialog.element?.querySelector("[data-forge-preview]");
  const automation = dialog.element?.querySelector("[data-forge-automation-review]");
  const specs = dialog.element?.querySelector("[data-forge-advanced-review]");
  const tabs = dialog.element?.querySelectorAll("[data-forge-review-tab]") ?? [];
  if (preview instanceof HTMLElement) preview.hidden = normalizedTab !== "visual";
  if (automation instanceof HTMLElement && dialog._dm_forgeAutomationCodeRequired === true) {
    automation.hidden = normalizedTab !== "automation";
  }
  if (specs instanceof HTMLElement) specs.hidden = normalizedTab !== "specs";
  for (const button of tabs) {
    const active = button.dataset.forgeReviewTab === normalizedTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
}

function renderAutomationCodeReview(dialog, entries = []) {
  const output = dialog.element?.querySelector("[data-forge-automation-review]");
  const wrapper = dialog.element?.querySelector("[data-forge-code-approval-wrap]");
  const tabs = dialog.element?.querySelector("[data-forge-review-tabs]");
  const approval = dialog.element?.querySelector('input[name="automationCodeApproval"]');
  if (!(output instanceof HTMLElement)) return;

  const codeEntries = Array.isArray(entries) ? entries.filter(entry => entry?.command) : [];
  dialog._dm_forgeAutomationCodeRequired = codeEntries.length > 0;
  output.hidden = codeEntries.length === 0;
  if (wrapper instanceof HTMLElement) wrapper.hidden = codeEntries.length === 0;
  const automationTab = dialog.element?.querySelector('[data-forge-review-tab="automation"]');
  if (automationTab instanceof HTMLButtonElement) automationTab.hidden = codeEntries.length === 0;
  if (tabs instanceof HTMLElement) tabs.hidden = false;
  if (approval instanceof HTMLInputElement) {
    approval.disabled = codeEntries.length === 0;
    approval.checked = false;
  }
  output.innerHTML = codeEntries.length
    ? `
      <details class="dm_forge-generated-code-disclosure" open>
        <summary><i class="fa-solid fa-code"></i><strong>Generated automation code (${codeEntries.length})</strong></summary>
        <p class="notes">This item contains executable Item Macro code generated by the trusted Forge engine. Read the exact code below before creation. It runs only when the corresponding item activity is used.</p>
        <div class="dm_forge-generated-code-list">
          ${codeEntries.map(entry => `
            <article class="dm_forge-generated-code-entry">
              <header><strong>${escapeHTML(entry.itemName)}</strong><span>${escapeHTML(entry.activityName)} - ${escapeHTML(entry.source)}</span></header>
              <pre><code>${escapeHTML(entry.command)}</code></pre>
            </article>
          `).join("")}
        </div>
      </details>
    `
    : "";
  setReviewTab(dialog, "visual");
  syncCreateAction(dialog);
}

function renderCompilationReport(dialog, compilation, reviewNotes = null) {
  const report = dialog.element?.querySelector("[data-forge-compile-report]");
  if (!report) return;
  dialog._dm_forgeCompilation = compilation;
  const connectionDetail = compilation.providerMode === "network"
    ? providerConnectionDetailText(dialog._dm_forgeProviderConnection)
    : "";
  const unresolvedCount = compilation.unresolvedMechanics?.length ?? 0;
  const reviewGroups = reviewNotes ? summarizeFooterNotes(reviewNotes) : [];
  const reviewGroup = state => reviewGroups.find(group => group.state === state);
  const warningCount = reviewGroup("warning")?.notes.length ?? 0;
  const reviewCount = reviewGroup("review")?.notes.length ?? 0;
  const noticeCount = reviewGroup("notice")?.notes.length ?? 0;
  const freeForgeCount = reviewGroup("free-forge")?.notes.length ?? 0;
  const resolvedCount = reviewGroup("resolved")?.notes.length ?? 0;
  const normalizationNote = compilation.normalization?.changed
    ? "Request normalized into a layered Forge brief before compilation."
    : "";
  report.hidden = false;
  report.innerHTML = `
    <div class="dm_forge-compile-head">
      <strong>${escapeHTML(compilation.providerLabel ?? "Local Rules")}</strong>
      <span data-forge-compiled-kinds>${compilation.decisions.map(decision => escapeHTML(decision.pattern)).join(", ")}</span>
    </div>
    <div class="dm_forge-compile-pills">
      <span class="dm_forge-review-pill" data-state="ready">
        <i class="fa-solid fa-check"></i>
        <span>${compilation.specs.length} validated spec${compilation.specs.length === 1 ? "" : "s"}</span>
      </span>
      ${unresolvedCount
        ? `
          <span class="dm_forge-review-pill" data-state="unresolved">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${unresolvedCount} manual review mechanic${unresolvedCount === 1 ? "" : "s"}</span>
          </span>
        `
        : ""
      }
      ${warningCount
        ? `
          <span class="dm_forge-review-pill" data-state="warning">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>${warningCount} warning${warningCount === 1 ? "" : "s"}</span>
          </span>
        `
        : ""
      }
      ${reviewCount
        ? `
          <span class="dm_forge-review-pill" data-state="review">
            <i class="fa-solid fa-clipboard-check"></i>
            <span>${reviewCount} review item${reviewCount === 1 ? "" : "s"}</span>
          </span>
        `
        : ""
      }
      ${noticeCount
        ? `
          <span class="dm_forge-review-pill" data-state="notice">
            <i class="fa-solid fa-circle-info"></i>
            <span>${noticeCount} notice${noticeCount === 1 ? "" : "s"}</span>
          </span>
        `
        : ""
      }
      ${freeForgeCount
        ? `
          <span class="dm_forge-review-pill" data-state="free-forge">
            <i class="fa-solid fa-cloud"></i>
            <span>Free Forge ${freeForgeCount}</span>
          </span>
        `
        : ""
      }
      ${resolvedCount
        ? `
          <span class="dm_forge-review-pill" data-state="resolved">
            <i class="fa-solid fa-check"></i>
            <span>Resolutions ${resolvedCount}</span>
          </span>
        `
        : ""
      }
    </div>
    ${connectionDetail ? `<small>${escapeHTML(connectionDetail)}</small>` : ""}
    ${normalizationNote ? `<small>${escapeHTML(normalizationNote)}</small>` : ""}
  `;
}

function diagnosticsHTML(report) {
  return `
    <div class="dm_forge-diagnostics-head">
      <strong>Diagnostics</strong>
      <span>${report.passed}/${report.total} passed</span>
    </div>
    <ol>
      ${report.results.map(result => `
        <li data-state="${result.passed ? "passed" : "failed"}">
          <i class="fa-solid ${result.passed ? "fa-check" : "fa-xmark"}"></i>
          <span>${escapeHTML(result.name)}</span>
          <code>${escapeHTML(result.kind || "failed")}</code>
          <small>${escapeHTML(result.message)}</small>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderDiagnostics(dialog, report) {
  const output = dialog.element?.querySelector("[data-forge-diagnostics]");
  if (!output) return;
  output.hidden = false;
  output.innerHTML = diagnosticsHTML(report);
}

async function runFoundryDiagnostics() {
  const compilerReport = runLocalDiagnostics();
  const compilerResults = new Map(compilerReport.results.map(result => [result.name, result]));
  const results = [];

  for (const testCase of DIAGNOSTIC_CASES) {
    const compilerResult = compilerResults.get(testCase.name);
    if (!compilerResult?.passed) {
      results.push(compilerResult ?? {
        name: testCase.name,
        passed: false,
        kind: "",
        message: "Compiler diagnostic did not return a result."
      });
      continue;
    }

    try {
      const compilation = compileItemRequest(testCase.request);
      await validateSpecs(compilation.specs);
      results.push({ ...compilerResult, message: "Compiler and Foundry validation passed" });
    } catch (error) {
      results.push({
        name: testCase.name,
        passed: false,
        kind: compilerResult.kind,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const systemContentReport = await runSystemContentDiagnostics();
  results.push(...systemContentReport.results);

  const passed = results.filter(result => result.passed).length;
  return {
    passed,
    failed: results.length - passed,
    total: results.length,
    healthy: passed === results.length,
    results
  };
}

function reportContextProvider(dialog) {
  try {
    if (dialog instanceof ForgeSettingsApplication) {
      const form = settingsFormElement();
      return form ? settingsFormProviderState(form) : configuredProviderState();
    }
    const form = dialog?.element?.querySelector?.("form");
    return form instanceof HTMLFormElement
      ? activeProviderState({ unresolvedPolicy: formControl(form, "unresolvedPolicy").value })
      : configuredProviderState();
  } catch {
    return configuredProviderState();
  }
}

function errorCodeFromMessage(message) {
  return String(message ?? "").match(/\[([a-z0-9_]+),\s*request\s+[^\]]+\]/i)?.[1] ?? "";
}

function requestIdFromMessage(message) {
  return String(message ?? "").match(/\brequest\s+([a-f0-9-]{8,})\b/i)?.[1] ?? "";
}

function sanitizedStack(error) {
  const stack = String(error?.stack ?? "").split(/\r?\n/).slice(1, 7);
  return stack.map(line => line
    .replace(/[A-Z]:\\[^)\s]+/gi, path => path.split(/\\+/).slice(-2).join("\\"))
    .replace(/https?:\/\/[^\s)]+/gi, url => {
      try {
        const parsed = new URL(url);
        return `${parsed.hostname}${parsed.pathname}`;
      } catch {
        return url;
      }
    })
    .trim()).filter(Boolean);
}

function summaryItemNotes(summary) {
  return {
    name: summary.name,
    kind: summary.kind,
    reviewState: summary.reviewState,
    automationRoute: summary.automationRoute ? {
      selectedLayer: summary.automationRoute.selectedLayer,
      dependencies: summary.automationRoute.dependencyLabels,
      available: summary.automationRoute.available,
      fallback: summary.automationRoute.fallback
    } : null,
    notes: (summary.notes ?? []).map(note => ({
      state: note.state,
      label: note.label,
      message: note.message
    }))
  };
}

function reviewSummariesForDialog(dialog) {
  const compilation = dialog?._dm_forgeCompilation ?? null;
  let specs = [];
  try {
    const form = dialog?.element?.querySelector?.("form");
    if (form instanceof HTMLFormElement) {
      const rawSpecs = formControl(form, "specs").value.trim();
      specs = normalizeSpecs(rawSpecs);
    }
  } catch {
    specs = [];
  }
  return buildReviewSummaries(specs, compilation, null, currentConfig().automationCapabilities).map(summaryItemNotes);
}

function dialogRequestFor(dialog) {
  try {
    const form = dialog?.element?.querySelector?.("form");
    return form instanceof HTMLFormElement ? formControl(form, "request").value.trim() : "";
  } catch {
    return "";
  }
}

const REPAIR_TEXT_LIMIT = 12000;
const REPAIR_NOTES_LIMIT = 4000;
const REPAIR_JSON_LIMIT = 60000;

function repairSafeValue(value) {
  if (Array.isArray(value)) return value.map(repairSafeValue);
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:flags|macroCommand|scripts?|command|rawConsole|apiToken|authorization|password|secret)$/i.test(key)) continue;
    next[key] = repairSafeValue(child);
  }
  return next;
}

function boundedRepairText(value, limit) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limit);
}

function repairParentRequestId() {
  try {
    const id = String(foundry.utils.randomID(24));
    if (/^[A-Za-z0-9_-]{8,100}$/.test(id)) return id;
  } catch {
    // Fall through to the browser UUID generator.
  }
  return `dmf-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function updateRepairContext(dialog, { request, validation, reviewNotes, compilation } = {}) {
  if (!dialog || !validation?.specs?.length) return;
  const provider = reportContextProvider(dialog);
  const existing = dialog._dm_forgeRepairContext ?? {};
  const originalPrompt = existing.originalPrompt || boundedRepairText(request, REPAIR_TEXT_LIMIT);
  const originalRequest = boundedRepairText(
    request || existing.originalRequest || compilation?.originalRequest || compilation?.normalizedRequest,
    REPAIR_TEXT_LIMIT
  );
  const currentReviewedSpecs = repairSafeValue(validation.specs);
  const currentNotes = (reviewNotes ?? []).slice(0, 40).map(note => ({
    state: boundedRepairText(note?.state, 40),
    label: boundedRepairText(note?.label, 160),
    message: boundedRepairText(note?.message, 600),
    handling: boundedRepairText(note?.handling, 600)
  })).filter(note => note.message);
  const deterministicFindings = [
    ...(validation.warnings ?? []),
    ...validation.specs.flatMap(spec => (spec.unresolvedMechanics ?? []).map(mechanic =>
      `${spec.name}: ${mechanic.requestedText || mechanic.reason || mechanic.label || "Manual review required."}`
    ))
  ].map(value => boundedRepairText(value, 600)).filter(Boolean).slice(0, 40);
  const providerRecord = getProvider(provider.id);
  const requestFingerprint = fingerprintForgeSpecs([{ request: originalPrompt }]);
  const specFingerprint = fingerprintForgeSpecs(currentReviewedSpecs);
  dialog._dm_forgeRepairContext = {
    ...existing,
    parentRequestId: existing.parentRequestId || repairParentRequestId(),
    originalPrompt,
    originalRequest,
    provider: {
      id: provider.id,
      label: providerRecord?.label ?? provider.id,
      mode: providerRecord?.mode ?? ""
    },
    currentReviewedSpecs,
    currentReviewedSpecsJson: JSON.stringify(currentReviewedSpecs, null, 2).slice(0, REPAIR_JSON_LIMIT),
    reviewNotes: currentNotes,
    deterministicFindings,
    originalStatus: existing.originalStatus || "reviewed",
    requestFingerprint,
    specFingerprint,
    attempted: existing.attempted === true,
    repairNotes: existing.repairNotes || ""
  };
}

function repairSnapshotForDialog(dialog) {
  const context = dialog?._dm_forgeRepairContext;
  if (!context) return null;
  return {
    mode: "repair-attempt",
    parentRequestId: boundedRepairText(context.parentRequestId, 100),
    attempted: context.attempted === true,
    requestFingerprint: boundedRepairText(context.requestFingerprint, 120),
    originalSpecFingerprint: boundedRepairText(context.specFingerprint, 120),
    repairNotes: boundedRepairText(context.repairNotes, REPAIR_NOTES_LIMIT),
    providerLane: boundedRepairText(context.provider?.id, 100)
  };
}

function buildRepairAttemptPayload(dialog, repairNotes) {
  const context = dialog?._dm_forgeRepairContext;
  if (!context || context.attempted === true) {
    throw new Error("This Forge result does not have another repair attempt available.");
  }
  const notes = boundedRepairText(repairNotes, REPAIR_NOTES_LIMIT);
  if (!notes) throw new Error("Add a short repair note before sending the repair request.");
  return {
    parentRequestId: context.parentRequestId,
    attempt: 1,
    originalRequest: context.originalRequest,
    repairNotes: notes,
    currentReviewedSpecs: repairSafeValue(context.currentReviewedSpecs),
    reviewNotes: repairSafeValue(context.reviewNotes),
    deterministicFindings: repairSafeValue(context.deterministicFindings),
    provenance: {
      requestFingerprint: context.requestFingerprint,
      specFingerprint: context.specFingerprint,
      providerLane: context.provider?.id ?? ""
    }
  };
}

function buildReportPayloadBase(dialog, error, context = {}) {
  const provider = reportContextProvider(dialog);
  let endpoint = "";
  try {
    endpoint = String(networkProviderConfiguration(provider.id, provider.configuration)?.endpoint ?? "").trim();
  } catch {
    endpoint = "";
  }
  const endpointUrl = endpoint ? new URL(endpoint) : null;
  return {
    schemaVersion: "1.0",
    source: String(context.source ?? "dungeon-masters-forge-module"),
    occurredAt: new Date().toISOString(),
    module: {
      id: MODULE_ID,
      version: BUILD_VERSION
    },
    environment: {
      foundryVersion: String(game.version ?? ""),
      systemId: String(game.system?.id ?? ""),
      systemVersion: String(game.system?.version ?? ""),
      browserOrigin: String(globalThis.location?.origin ?? "")
    },
    provider: {
      id: provider.id,
      endpointHost: endpointUrl?.host ?? "",
      endpointPath: endpointUrl?.pathname ?? "",
      unresolvedPolicy: provider.configuration?.unresolvedPolicy ?? "review"
    },
    error: {
      stage: String(context.stage ?? "forge"),
      name: String(error?.name ?? "Error"),
      message: error instanceof Error ? error.message : String(error),
      code: errorCodeFromMessage(error?.message),
      requestId: requestIdFromMessage(error?.message),
      stack: sanitizedStack(error)
    },
    items: reviewSummariesForDialog(dialog)
  };
}

function buildAnonymousErrorReportPayload(dialog, error, context = {}) {
  return buildReportPayloadBase(dialog, error, {
    ...context,
    source: "dungeon-masters-forge-module"
  });
}

async function maybeSubmitAnonymousErrorReport(dialog, error, context = {}) {
  if (!currentAnonymousErrorReportsEnabled()) return;
  const provider = reportContextProvider(dialog);
  const providerRecord = getProvider(provider.id);
  if (!providerRecord || providerRecord.mode !== "network") return;

  let connection;
  try {
    connection = networkProviderConfiguration(provider.id, provider.configuration);
  } catch {
    return;
  }
  if (!String(connection.endpoint ?? "").trim()) return;

  const payload = buildAnonymousErrorReportPayload(dialog, error, context);
  try {
    await requestRemoteErrorReport({
      endpoint: connection.endpoint,
      token: connection.apiToken,
      payload
    });
  } catch (reportingError) {
    console.info(`${MODULE_TITLE}: anonymous error report upload skipped: ${reportingError instanceof Error ? reportingError.message : reportingError}`);
  }
}

function reportError(dialog, error, context = {}) {
  console.error(`${MODULE_TITLE}:`, error);
  void maybeSubmitAnonymousErrorReport(dialog, error, {
    stage: context.stage ?? (dialog instanceof ForgeSettingsApplication ? "settings" : "forge")
  });
  const message = error instanceof Error ? error.message : String(error);
  setStatus(dialog, "error", message);
  setSettingsStatus(dialog, "error", message);
  ui.notifications.error(`${MODULE_TITLE}: ${message}`);
}

function repairRerunDialogContent(context) {
  // Keep the confirmation window focused; the main Forge window owns the detailed evidence.
  return `
    <section class="dm_forge-repair-dialog">
      <header class="dm_forge-repair-warning">
        <strong>SEND IT AGAIN!?</strong>
        <span>This is a new provider request, not an approval and not a hidden retry.</span>
      </header>
      <p>Describe the intended result in plain language. The original prompt and review details remain visible in the main Forge window. The repaired result will return to preview and require fresh review and approval. It will not create or execute anything automatically.</p>
      <label class="dm_forge-repair-dialog-field">
        <span>What should it have done?</span>
        <textarea name="repairNotes" aria-label="What should it have done?" placeholder="Example: Keep the weapon and all existing effects, but preserve the requested light toggle."></textarea>
      </label>
      <label class="dm_forge-repair-consent" title="I understand this sends the displayed prompt, reviewed JSON, review findings, and my repair note as one new provider request. It will require fresh review before creation.">
        <input type="checkbox" name="repairConsent" aria-label="I understand this sends one new repair request.">
        <span>I understand</span>
      </label>
      <output class="dm_forge-repair-dialog-status" data-forge-repair-status data-state="idle" aria-live="polite">Nothing has been sent.</output>
    </section>
  `;
}

function setRepairRerunStatus(dialog, state, message) {
  const output = dialog?.element?.querySelector?.("[data-forge-repair-status]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
}

function bindRepairConsentFooter(application, element) {
  const root = element?.querySelector ? element : application?.element;
  const form = root?.querySelector?.("form") ?? application?.element?.querySelector?.("form");
  const footer = form?.querySelector?.(".form-footer");
  const input = form?.elements?.namedItem("repairConsent");
  const consent = input instanceof HTMLInputElement
    ? input.closest(".dm_forge-repair-consent")
    : null;
  if (!(footer instanceof HTMLElement) || !(consent instanceof HTMLElement)) return;
  consent.classList.add("dm_forge-repair-consent-footer");
  footer.prepend(consent);
}

async function runRepairRerun(parentDialog, repairNotes) {
  const context = parentDialog?._dm_forgeRepairContext;
  const payload = buildRepairAttemptPayload(parentDialog, repairNotes);
  const provider = reportContextProvider(parentDialog);
  const providerRecord = getProvider(provider.id);
  if (!providerRecord || providerRecord.mode !== "network") throw new Error("Repair reruns require a network Forge service.");
  const connection = networkProviderConfiguration(provider.id, provider.configuration);
  if (!String(connection.endpoint ?? "").trim()) throw new Error("Configure a Forge-compatible compile endpoint before sending a repair rerun.");

  context.attempted = true;
  context.repairNotes = payload.repairNotes;
  setStatus(parentDialog, "working", "Sending one confirmed repair request...");

  const form = parentDialog.element?.querySelector("form");
  const remoteCompilation = await compileWithProvider(context.originalRequest, {
    providerId: provider.id,
    configuration: provider.configuration,
    requestMode: "repair-attempt",
    repair: payload,
     refreshCompletedCache: parentDialog?._dm_forgeProviderConnection?.capabilities?.request?.cacheControlRefresh === true,
    context: {
      foundryVersion: game.version,
      systemId: game.system.id,
      systemVersion: game.system.version,
      moduleVersion: BUILD_VERSION,
      supportedKinds: SUPPORTED_SPEC_KINDS,
      automationCapabilities: currentConfig().automationCapabilities.providerContext
    }
  });
  const compilation = await enrichCompilationWithSrdSpellChoices(remoteCompilation, context.originalRequest);
  const mechanicsRequest = mechanicsRequestForCompilation(compilation, context.originalRequest);
  const validation = await validateSpecs(compilation.specs, mechanicsRequest);
  const preparedCompilation = compilationWithPreparedSpecs(compilation, validation.specs);
  const rawSpecs = JSON.stringify(validation.specs, null, 2);
  if (!(form instanceof HTMLFormElement)) throw new Error("Forge form is unavailable after the repair request.");
  formControl(form, "specs").value = rawSpecs;
  formControl(form, "reviewApproval").checked = false;
  const automationApproval = formControl(form, "automationCodeApproval");
  automationApproval.checked = false;
  await Promise.all([
    game.settings.set(MODULE_ID, "lastRequest", context.originalPrompt),
    game.settings.set(MODULE_ID, "lastSpecs", rawSpecs)
  ]);
  const reviewNotesResult = await renderPreview(parentDialog, validation, preparedCompilation);
  renderCompilationReport(parentDialog, preparedCompilation, reviewNotesResult);
  showDialogView(form, "review");
  const noteCount = reviewNotesResult.length;
  setStatus(parentDialog, "success", `Repair preview ready with ${noteCount} review note${noteCount === 1 ? "" : "s"}. Review and approve again before creation.`);
  ui.notifications.info(`${MODULE_TITLE}: Repair preview ready. No document was created.`);
}

async function openRepairRerunDialog(parentDialog) {
  const availability = repairRerunAvailability(parentDialog);
  if (!availability.enabled) {
    ui.notifications.warn(`${MODULE_TITLE}: ${availability.message}`);
    return null;
  }
  const context = parentDialog._dm_forgeRepairContext;
  setRepairPromptLock(parentDialog, true);
  const repairDialog = new foundry.applications.api.DialogV2({
    classes: ["dungeon-masters-forge", "dungeon-masters-forge-repair-window"],
    window: {
      title: "SEND IT AGAIN!?",
      icon: "fa-solid fa-triangle-exclamation",
      minimizable: false,
      resizable: true
    },
    position: { width: 720, height: 680 },
    form: { closeOnSubmit: false },
    content: repairRerunDialogContent(context),
    buttons: [
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-xmark",
        type: "button",
        callback: (_event, _button, dialog) => dialog.close()
      },
      {
        action: "send-repair",
        label: "Send repair request",
        icon: "fa-solid fa-rotate",
        class: "dm_forge-send-repair",
        default: true,
        type: "button",
        callback: async (_event, button, dialog) => {
          const form = dialog.element?.querySelector("form");
          const sendButton = dialog.element?.querySelector(".dm_forge-send-repair");
          try {
            if (!(form instanceof HTMLFormElement)) throw new Error("The repair form is unavailable. Close this window and reopen SEND IT AGAIN!? from the reviewed result.");
            const repairNotes = formControl(form, "repairNotes").value.trim();
            const consent = formControl(form, "repairConsent").checked;
            if (!consent) {
              setRepairRerunStatus(dialog, "warning", "Confirm that you understand this sends one new repair request.");
              return;
            }
            if (!repairNotes) {
              setRepairRerunStatus(dialog, "warning", "Describe what it should have done before sending the request.");
              return;
            }
            if (sendButton instanceof HTMLButtonElement) sendButton.disabled = true;
            setRepairRerunStatus(dialog, "working", "Sending the one confirmed repair request...");
            await runRepairRerun(parentDialog, repairNotes);
            setRepairRerunStatus(dialog, "success", "Repair preview ready. This window will close; review the returned result before approving it.");
            dialog.close();
          } catch (error) {
            if (sendButton instanceof HTMLButtonElement) sendButton.disabled = false;
            setRepairRerunStatus(dialog, "error", error instanceof Error ? error.message : String(error));
            reportError(parentDialog, error, { stage: "repair-attempt" });
          }
        }
      }
    ]
  });
  repairDialog.addEventListener("close", () => setRepairPromptLock(parentDialog, false), { once: true });
  repairDialog.render({ force: true });
  return repairDialog;
}

async function saveDialogState(rawSpecs, config, provider) {
  await Promise.all([
    game.settings.set(MODULE_ID, "lastSpecs", rawSpecs),
    game.settings.set(MODULE_ID, "itemFolderName", config.itemFolderName),
    game.settings.set(MODULE_ID, "actorFolderName", config.actorFolderName),
    game.settings.set(MODULE_ID, "replaceExisting", config.replaceExistingWorldDocuments),
    persistProviderState(provider)
  ]);
}

function settingsFormElement() {
  const root = forgeSettingsApp?.element?.[0] ?? forgeSettingsApp?.element;
  const form = root instanceof HTMLFormElement ? root : root?.querySelector?.("form");
  return form instanceof HTMLFormElement ? form : null;
}

function settingsFormProviderState(form, overrides = {}) {
  const providerId = formControl(form, "providerId").value;
  const rememberApiToken = formControl(form, "rememberProviderApiToken").checked;
  const enteredApiToken = formControl(form, "providerApiToken").value;
  const apiToken = enteredApiToken || (providerId === "bring-your-own" && rememberApiToken
    ? currentProviderToken({ rememberProviderToken: true })
    : "");
  const membershipToken = formControl(form, "providerMembershipToken").value.trim() || currentProviderMembershipToken();
  return configuredProviderState({
    providerId,
    endpoint: formControl(form, "providerEndpoint").value.trim(),
    model: formControl(form, "providerModel").value.trim(),
    apiToken,
    membershipToken,
    rememberApiToken,
    unresolvedPolicy: overrides.unresolvedPolicy ?? currentUnresolvedPolicy()
  });
}

function activeProviderState(overrides = {}) {
  const settingsForm = settingsFormElement();
  return settingsForm
    ? settingsFormProviderState(settingsForm, overrides)
    : configuredProviderState(overrides);
}

function syncSettingsProviderPanel(app) {
  const root = app.element?.[0] ?? app.element;
  const form = root?.querySelector?.("form");
  if (!(form instanceof HTMLFormElement)) return;

  const provider = settingsFormProviderState(form);
  const snapshot = providerStatusSnapshot(provider.id, provider.configuration, app._dm_forgeProviderConnection);
  const configurationPanel = root.querySelector('[data-provider-configuration="bring-your-own"]');
  const hostedConfigurationPanel = root.querySelector('[data-provider-configuration="hosted-forge"]');
  const status = root.querySelector("[data-forge-settings-provider-status]");
  const icon = status?.querySelector("i");
  const label = status?.querySelector("span");
  const checkButton = root.querySelector('[data-action="check-provider"]');

  if (configurationPanel) configurationPanel.hidden = provider.id !== "bring-your-own";
  if (hostedConfigurationPanel) hostedConfigurationPanel.hidden = provider.id !== HOSTED_PROVIDER_ID;
  if (status) status.dataset.state = snapshot.state;
  if (icon) icon.className = `fa-solid ${snapshot.icon}`;
  if (label) label.textContent = snapshot.message;
  if (checkButton instanceof HTMLButtonElement) {
    checkButton.disabled = provider.mode === "network" ? !snapshot.readiness.ready : false;
  }
}

function setSettingsStatus(app, state, message) {
  const root = app.element?.[0] ?? app.element;
  const output = root?.querySelector?.("[data-forge-settings-status]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
}

function renderSettingsDiagnostics(app, report) {
  const root = app.element?.[0] ?? app.element;
  const output = root?.querySelector?.("[data-forge-settings-diagnostics]");
  if (!output) return;
  output.hidden = false;
  output.innerHTML = diagnosticsHTML(report);
}

function parseVerificationHarnessSpecs(raw, runTag) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw ?? "").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`Verification specs must be valid JSON: ${error.message}`);
  }
  const specs = Array.isArray(parsed) ? parsed : parsed?.specs;
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error("Verification specs must be a non-empty JSON array or an object with a specs array.");
  }
  const normalizedRunTag = normalizeVerificationRunTag(runTag);
  const untagged = specs
    .map((spec, index) => ({ spec, index }))
    .filter(({ spec }) => !String(spec?.name ?? "").includes(`[${normalizedRunTag}]`));
  if (untagged.length > 0) {
    throw new Error(`Every verification item name must include [${normalizedRunTag}]. Untagged entries: ${untagged.map(({ index }) => index + 1).join(", ")}.`);
  }
  return specs;
}

function renderVerificationHarnessReport(app, report) {
  const root = app.element?.[0] ?? app.element;
  const output = root?.querySelector?.("[data-verification-harness-report]");
  if (!output) return;
  output.hidden = false;
  output.textContent = JSON.stringify({
    runTag: report.runTag,
    worldId: report.worldId,
    total: report.total,
    passed: report.passed,
    warnings: report.warnings,
    checks: report.checks,
    summonActors: (report.summonActors ?? []).map(actor => ({ name: actor.name, uuid: actor.uuid }))
  }, null, 2);
}

async function loadExampleIntoForge() {
  const dialog = await openForge();
  const form = dialog?.element?.querySelector?.("form");
  const rawSpecs = JSON.stringify(EXAMPLE_SPECS, null, 2);

  await game.settings.set(MODULE_ID, "lastSpecs", rawSpecs);
  if (!(form instanceof HTMLFormElement)) return;

  setReviewValidated(dialog, false);
  formControl(form, "specs").value = rawSpecs;
  formControl(form, "reviewApproval").checked = false;
  dialog._dm_forgeCompilation = null;
  const report = dialog.element?.querySelector("[data-forge-compile-report]");
  const preview = dialog.element?.querySelector("[data-forge-preview]");
  if (report) report.hidden = true;
  if (preview) preview.hidden = true;
  showDialogView(form, "review");

  const validation = await validateSpecs(rawSpecs);
  await renderPreview(dialog, validation);
  setStatus(dialog, "success", "Example loaded and validated.");
}

class ForgeSettingsApplication extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-settings`,
      classes: ["dungeon-masters-forge-settings"],
      template: SETTINGS_TEMPLATE_PATH,
      title: `${MODULE_TITLE} Settings`,
      width: 760,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false,
      submitOnClose: false,
      resizable: true
    });
  }

  getData() {
    const provider = activeProviderState();
    const snapshot = providerStatusSnapshot(provider.id, provider.configuration, this._dm_forgeProviderConnection);
    const rememberProviderToken = provider.rememberApiToken === true;

    return {
      isBringYourOwn: provider.id === "bring-your-own",
      providerOptions: providerOptionsHTML(provider.id),
      providerEndpoint: provider.configuration.endpoint,
      providerModel: provider.configuration.model,
      providerToken: provider.configuration.apiToken,
      providerMembershipToken: provider.configuration.membershipToken,
      isHostedForge: provider.id === HOSTED_PROVIDER_ID,
      rememberProviderToken,
      anonymousErrorReports: currentAnonymousErrorReportsEnabled(),
      itemFolderName: game.settings.get(MODULE_ID, "itemFolderName"),
      actorFolderName: game.settings.get(MODULE_ID, "actorFolderName"),
      replaceExisting: game.settings.get(MODULE_ID, "replaceExisting"),
      enableSceneRegionForge: game.settings.get(MODULE_ID, "enableSceneRegionForge") === true,
      verificationHarnessAvailable: verificationHarnessIncluded(),
      enableVerificationHarness: verificationHarnessIncluded() && game.settings.get(MODULE_ID, "enableVerificationHarness") === true,
      verificationWorldId: game.settings.get(MODULE_ID, "verificationWorldId") || DEFAULT_VERIFICATION_WORLD_ID,
      verificationHarness: verificationHarnessStatusSnapshot(currentVerificationHarnessOptions()),
      // Keep harness control on the API/console path without advertising utility buttons in the UI.
      hideVerificationHarnessUtilities: true,
      providerStatusIcon: snapshot.icon,
      providerStatusState: snapshot.state,
      providerStatusMessage: snapshot.message
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    const form = root instanceof HTMLFormElement ? root : root?.querySelector?.("form");
    if (!(form instanceof HTMLFormElement)) return;

    const providerSelect = formControl(form, "providerId");
    const providerInputs = [
      providerSelect,
      formControl(form, "providerEndpoint"),
      formControl(form, "providerModel"),
      formControl(form, "providerApiToken"),
      formControl(form, "providerMembershipToken"),
      formControl(form, "rememberProviderApiToken")
    ];

    providerSelect.addEventListener("change", () => {
      clearProviderConnection(this);
      syncSettingsProviderPanel(this);
    });

    for (const control of providerInputs.slice(1)) {
      control.addEventListener(control instanceof HTMLInputElement && control.type === "checkbox" ? "change" : "input", () => {
        clearProviderConnection(this);
        syncSettingsProviderPanel(this);
      });
    }

    root.querySelector('[data-action="save-provider"]')?.addEventListener("click", async () => {
      try {
        const providerState = settingsFormProviderState(form);
        await persistProviderState(providerState);
        if (forgeDialog?.rendered) {
          refreshForgeProviderSummary(forgeDialog, forgeDialog.element?.querySelector("form"));
        }
        const tokenText = providerState.id === "bring-your-own" && providerState.rememberApiToken
          ? " The API token is remembered on this device."
          : "";
        setSettingsStatus(this, "success", `Connection settings saved.${tokenText}`);
        syncSettingsProviderPanel(this);
      } catch (error) {
        reportError(this, error);
      }
    });

    root.querySelector('[data-action="check-provider"]')?.addEventListener("click", async () => {
      try {
        const providerState = settingsFormProviderState(form);
        if (getProvider(providerState.id)?.mode !== "network") {
          clearProviderConnection(this);
          if (forgeDialog?.rendered) {
            clearProviderConnection(forgeDialog);
            refreshForgeProviderSummary(forgeDialog, forgeDialog.element?.querySelector("form"));
          }
          syncSettingsProviderPanel(this);
          setSettingsStatus(this, "success", "Local Rules runs entirely in Foundry and does not need a remote service.");
          return;
        }

        setSettingsStatus(this, "working", "Checking the remote provider...");
        this._dm_forgeProviderConnection = await checkProviderConnection(providerState);
        await persistProviderState(providerState);
        if (forgeDialog?.rendered) {
          forgeDialog._dm_forgeProviderConnection = this._dm_forgeProviderConnection;
          refreshForgeProviderSummary(forgeDialog, forgeDialog.element?.querySelector("form"));
        }
        syncSettingsProviderPanel(this);
        const detail = providerConnectionDetailText(this._dm_forgeProviderConnection);
        setSettingsStatus(this, this._dm_forgeProviderConnection.health?.mode === "mock" ? "warning" : "success", detail);
      } catch (error) {
        clearProviderConnection(this);
        if (forgeDialog?.rendered) {
          clearProviderConnection(forgeDialog);
          refreshForgeProviderSummary(forgeDialog, forgeDialog.element?.querySelector("form"));
        }
        syncSettingsProviderPanel(this);
        reportError(this, error);
      }
    });

    root.querySelector('[data-action="example"]')?.addEventListener("click", async () => {
      try {
        setSettingsStatus(this, "working", "Loading the example item into the Forge...");
        await loadExampleIntoForge();
        setSettingsStatus(this, "success", "Example loaded into the Forge and validated.");
      } catch (error) {
        reportError(this, error);
      }
    });

    root.querySelector('[data-action="diagnostics"]')?.addEventListener("click", async () => {
      try {
        setSettingsStatus(this, "working", "Running non-destructive diagnostics...");
        const report = await runFoundryDiagnostics();
        renderSettingsDiagnostics(this, report);
        setSettingsStatus(this, report.healthy ? "success" : "error", report.healthy
          ? `${report.passed}/${report.total} diagnostics passed. No world documents were created.`
          : `${report.failed}/${report.total} diagnostics failed. No world documents were created.`);
      } catch (error) {
        reportError(this, error);
      }
    });

    root.querySelector('[data-action="setup-verification-harness"]')?.addEventListener("click", async () => {
      try {
        const enabled = formControl(form, "enableVerificationHarness").checked;
        const expectedWorldId = formControl(form, "verificationWorldId").value.trim() || DEFAULT_VERIFICATION_WORLD_ID;
        setSettingsStatus(this, "working", "Preparing the isolated verification boundary...");
        const result = await setupIsolatedVerificationHarness({ enabled, expectedWorldId });
        setSettingsStatus(this, "success", result.actorCreated
          ? `Verification harness is ready in ${result.worldId}. Created ${result.actor.name}.`
          : `Verification harness is ready in ${result.worldId}. Reusing ${result.actor.name}.`);
      } catch (error) {
        reportError(this, error);
      }
    });

    root.querySelector('[data-action="run-verification-harness"]')?.addEventListener("click", async () => {
      try {
        const enabled = formControl(form, "enableVerificationHarness").checked;
        const expectedWorldId = formControl(form, "verificationWorldId").value.trim() || DEFAULT_VERIFICATION_WORLD_ID;
        const runTag = formControl(form, "verificationRunTag").value.trim();
        const specs = parseVerificationHarnessSpecs(formControl(form, "verificationSpecs").value, runTag);
        setSettingsStatus(this, "working", `Running isolated verification for ${specs.length} prepared item(s)...`);
        const report = await runIsolatedVerificationHarness(specs, { runTag, enabled, expectedWorldId });
        renderVerificationHarnessReport(this, report);
        setSettingsStatus(this, report.warnings === 0 ? "success" : "warning",
          `Verification completed in ${report.worldId}: ${report.passed}/${report.total} expectation cards passed; ${report.warnings} warning(s).`);
      } catch (error) {
        reportError(this, error);
      }
    });

    root.querySelector('[data-action="open-forge"]')?.addEventListener("click", async () => {
      await openForge();
    });

    root.querySelector('[data-action="open-region-forge"]')?.addEventListener("click", async () => {
      await openSceneRegionForge();
    });

    syncSettingsProviderPanel(this);
  }

  async _updateObject(_event, _formData) {
    const root = this.element?.[0] ?? this.element;
    const form = root instanceof HTMLFormElement ? root : root?.querySelector?.("form");
    if (!(form instanceof HTMLFormElement)) return;
    const providerState = settingsFormProviderState(form);
    await Promise.all([
      persistProviderState(providerState),
      game.settings.set(MODULE_ID, "anonymousErrorReports", formControl(form, "anonymousErrorReports").checked),
      game.settings.set(MODULE_ID, "itemFolderName", formControl(form, "itemFolderName").value.trim() || "Dungeon Master's Forge"),
      game.settings.set(MODULE_ID, "actorFolderName", formControl(form, "actorFolderName").value.trim() || "Dungeon Master's Forge Summons"),
      game.settings.set(MODULE_ID, "replaceExisting", formControl(form, "replaceExisting").checked),
      game.settings.set(MODULE_ID, "enableSceneRegionForge", formControl(form, "enableSceneRegionForge").checked),
      game.settings.set(MODULE_ID, "enableVerificationHarness", formControl(form, "enableVerificationHarness").checked),
      game.settings.set(MODULE_ID, "verificationWorldId", formControl(form, "verificationWorldId").value.trim() || DEFAULT_VERIFICATION_WORLD_ID)
    ]);
    if (forgeDialog?.rendered) {
      refreshForgeProviderSummary(forgeDialog, forgeDialog.element?.querySelector("form"));
    }
    setSettingsStatus(this, "success", "Forge settings saved.");
    syncSettingsProviderPanel(this);
  }

  async close(options) {
    forgeSettingsApp = null;
    return super.close(options);
  }
}

function openForgeSettings() {
  if (forgeSettingsApp?.rendered) {
    forgeSettingsApp.bringToTop?.();
    forgeSettingsApp.bringToFront?.();
    return forgeSettingsApp;
  }

  forgeSettingsApp = new ForgeSettingsApplication();
  forgeSettingsApp.render(true);
  return forgeSettingsApp;
}

function resolveElementRoot(element) {
  if (!element) return null;
  if (element instanceof HTMLElement) return element;
  if (Array.isArray(element)) return resolveElementRoot(element[0]);
  return element[0] instanceof HTMLElement ? element[0] : null;
}

function injectItemsSidebarLauncher(root = document) {
  const base = root instanceof Document ? root : resolveElementRoot(root);
  if (!(base instanceof Document || base instanceof HTMLElement)) return;

  const sidebars = base instanceof Document
    ? Array.from(base.querySelectorAll(".items-sidebar"))
    : [
      ...(base.matches?.(".items-sidebar") ? [base] : []),
      ...base.querySelectorAll?.(".items-sidebar") ?? []
    ];

  for (const sidebar of sidebars) {
    const searchControls = sidebar.querySelector(".directory-header search");
    if (!(searchControls instanceof HTMLElement)) continue;
    if (searchControls.querySelector('[data-dm_forge-launcher="open"]')) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-control dm_forge-sidebar-launch icon fa-solid fa-hammer";
    button.dataset.action = "openForge";
    button.setAttribute("data-dm_forge-launcher", "open");
    button.dataset.tooltip = `Open ${MODULE_TITLE}`;
    button.setAttribute("aria-label", `Open ${MODULE_TITLE}`);
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      await openForge();
    });

    searchControls.append(button);
  }
}

function scheduleItemsSidebarLauncherRefresh(root = document) {
  window.requestAnimationFrame(() => injectItemsSidebarLauncher(root));
}

async function openForge() {
  try {
    assertEnvironment({ requireGM: true });
  } catch (error) {
    ui.notifications.error(error.message);
    return null;
  }

  if (forgeDialog?.rendered) {
    if (forgeDialog.minimized) await forgeDialog.maximize();
    forgeDialog.bringToFront();
    return forgeDialog;
  }

  forgeDialog = new foundry.applications.api.DialogV2({
    classes: ["dungeon-masters-forge"],
    window: {
      title: MODULE_TITLE,
      icon: "fa-solid fa-hammer",
      resizable: true,
      minimizable: true
    },
    position: { width: 1180, height: 760 },
    form: { closeOnSubmit: false },
    content: forgeContent(),
    buttons: [
      {
        action: "compile",
        label: "Preview",
        icon: "fa-solid fa-wand-magic-sparkles",
        tooltip: "Convert the description into editable Forge specs",
        class: "dm_forge-compile",
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            const request = formControl(button.form, "request").value.trim();
            if (retryActionAvailability(dialog).enabled) {
              await openRepairRerunDialog(dialog);
              return;
            }
            setStatus(dialog, "working", "Preparing preview...");
            clearForgeResultState(dialog);
            const provider = activeProviderState({
              unresolvedPolicy: formControl(button.form, "unresolvedPolicy").value
            });
            if (getProvider(provider.id)?.mode === "network") {
              setStatus(dialog, "working", "Checking remote service status...");
              dialog._dm_forgeProviderConnection = await checkProviderConnection(provider);
              refreshForgeProviderSummary(dialog, button.form);
              const detail = providerConnectionDetailText(dialog._dm_forgeProviderConnection);
              setStatus(
                dialog,
                dialog._dm_forgeProviderConnection.health?.mode === "mock" ? "warning" : "working",
                `${detail} Preparing preview...`
              );
            } else {
              clearProviderConnection(dialog);
              refreshForgeProviderSummary(dialog, button.form);
            }
            const remoteCompilation = await compileWithProvider(request, {
              providerId: provider.id,
              configuration: provider.configuration,
              context: {
                foundryVersion: game.version,
                systemId: game.system.id,
                systemVersion: game.system.version,
                moduleVersion: BUILD_VERSION,
                supportedKinds: SUPPORTED_SPEC_KINDS,
                automationCapabilities: currentConfig().automationCapabilities.providerContext
              }
            });
            const compilation = await enrichCompilationWithSrdSpellChoices(remoteCompilation, request);
            const mechanicsRequest = mechanicsRequestForCompilation(compilation, request);
            const validation = await validateSpecs(compilation.specs, mechanicsRequest);
            const preparedCompilation = compilationWithPreparedSpecs(compilation, validation.specs);
            const rawSpecs = JSON.stringify(validation.specs, null, 2);
            formControl(button.form, "specs").value = rawSpecs;
            formControl(button.form, "reviewApproval").checked = false;
            await Promise.all([
              game.settings.set(MODULE_ID, "lastRequest", request),
              game.settings.set(MODULE_ID, "lastSpecs", rawSpecs),
              persistProviderState(provider)
            ]);
            const diagnostics = dialog.element?.querySelector("[data-forge-diagnostics]");
            if (diagnostics) diagnostics.hidden = true;
            const reviewNotes = await renderPreview(dialog, validation, preparedCompilation);
            renderCompilationReport(dialog, preparedCompilation, reviewNotes);
            dialog._dm_forgePreviewRequest = request;
            syncCompileAction(dialog);
            showDialogView(button.form, "review");
            const reviewGroups = summarizeFooterNotes(reviewNotes);
            const noteCount = reviewNotes.length;
            const attentionCount = reviewGroups.find(group => group.state === "warning")?.notes.length ?? 0;
            const itemCount = validation.specs.length;
            const draftLabel = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
            setStatus(dialog, attentionCount ? "warning" : "success", noteCount
              ? `${draftLabel} validated with ${noteCount} review note${noteCount === 1 ? "" : "s"}${attentionCount ? `; ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention` : ""}. Review the item summary before approval.`
              : `${draftLabel} compiled and validated. Review the item summary before approval.`);
          } catch (error) {
            reportError(dialog, error, { stage: "compile" });
          }
        }
      },
      {
        action: "validate",
        label: "Validate",
        icon: "fa-solid fa-check",
        tooltip: "Validate without creating documents",
        class: "dm_forge-validate",
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            setStatus(dialog, "working", "Validating...");
            setReviewValidated(dialog, false);
            const priorPreview = dialog.element?.querySelector("[data-forge-preview]");
            if (priorPreview) priorPreview.hidden = true;
            const { request, rawSpecs } = readDialogForm(button.form);
            const validation = await validateSpecs(rawSpecs, request);
            const preparedRawSpecs = syncPreparedSpecs(dialog, button.form, validation.specs);
            formControl(button.form, "reviewApproval").checked = false;
            const diagnostics = dialog.element?.querySelector("[data-forge-diagnostics]");
            if (diagnostics) diagnostics.hidden = true;
            if (!dialog._dm_forgeCompilation) {
              const report = dialog.element?.querySelector("[data-forge-compile-report]");
              if (report) report.hidden = true;
            }
            await game.settings.set(MODULE_ID, "lastSpecs", preparedRawSpecs);
            const reviewNotes = await renderPreview(dialog, validation);
            if (dialog._dm_forgeCompilation) renderCompilationReport(dialog, dialog._dm_forgeCompilation, reviewNotes);
            const warning = validation.warnings.length ? ` ${validation.warnings.join(" ")}` : "";
            const unresolved = validation.unresolvedMechanicCount
              ? ` ${validation.unresolvedMechanicCount} unresolved mechanic${validation.unresolvedMechanicCount === 1 ? "" : "s"} require review.`
              : "";
            setStatus(
              dialog,
              validation.warnings.length || validation.unresolvedMechanicCount ? "warning" : "success",
              `Specs are valid.${warning}${unresolved}`
            );
          } catch (error) {
            reportError(dialog, error, { stage: "validate" });
          }
        }
      },
      {
        action: "create",
        label: "Create Items",
        icon: "fa-solid fa-hammer",
        tooltip: "Create the validated world documents",
        class: "dm_forge-create",
        default: true,
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            const { request, rawSpecs, specs, approved, automationApproved, provider, config } = readDialogForm(button.form);
            const mechanicsRequest = mechanicsRequestForCompilation(dialog._dm_forgeCompilation, request);
            if (!approved) {
              formControl(button.form, "reviewApproval").closest(".dm_forge-approval")?.classList.add("dm_forge-approval-needs-attention");
              showDialogView(button.form, "review");
              setStatus(dialog, "warning", "Review the generated specs and check the approval box before creation.");
              ui.notifications.warn(`${MODULE_TITLE}: Review approval is required before creation.`);
              return;
            }
            if (dialog._dm_forgeAutomationCodeRequired === true && !automationApproved) {
              formControl(button.form, "automationCodeApproval").closest(".dm_forge-approval")?.classList.add("dm_forge-approval-needs-attention");
              showDialogView(button.form, "review");
              setStatus(dialog, "warning", "Read the generated automation code and approve it before creation.");
              ui.notifications.warn(`${MODULE_TITLE}: Generated automation code approval is required before creation.`);
              return;
            }
            setStatus(dialog, "working", "Creating approved world documents...");
            const validation = await validateSpecs(specs, mechanicsRequest);
            if (provider.configuration.unresolvedPolicy === "block" && validation.unresolvedMechanicCount) {
              setStatus(dialog, "warning", `${validation.unresolvedMechanicCount} unresolved mechanic${validation.unresolvedMechanicCount === 1 ? " blocks" : "s block"} item creation under the selected policy.`);
              return;
            }
            const preparedRawSpecs = syncPreparedSpecs(dialog, button.form, validation.specs);
            const reviewNotes = await renderPreview(dialog, validation);
            if (dialog._dm_forgeCompilation) renderCompilationReport(dialog, dialog._dm_forgeCompilation, reviewNotes);
            await Promise.all([
              saveDialogState(preparedRawSpecs, config, provider),
              game.settings.set(MODULE_ID, "lastRequest", request)
            ]);
            const result = await createPreparedSpecs(validation.specs, {
              ...config,
              authorizeGeneratedAutomation: automationApproved
            });
            const actorText = result.actors.length ? ` and ${result.actors.length} summon actor${result.actors.length === 1 ? "" : "s"}` : "";
            const unresolvedCount = validation.specs.reduce((total, spec) => total + (spec.unresolvedMechanics?.length ?? 0), 0);
            const unresolvedText = unresolvedCount
              ? ` ${unresolvedCount} unresolved mechanic${unresolvedCount === 1 ? " was" : "s were"} preserved on the created item${result.items.length === 1 ? "" : "s"}.`
              : "";
            setStatus(dialog, "success", `Created ${result.items.length} item${result.items.length === 1 ? "" : "s"}${actorText}.${unresolvedText}`);
          } catch (error) {
            reportError(dialog, error, { stage: "create" });
          }
        }
      },
      {
        action: "settings",
        label: "",
        icon: "fa-solid fa-gear",
        tooltip: "Open provider settings, example tools, and diagnostics",
        class: "dm_forge-settings-launch",
        type: "button",
        callback: async () => openForgeSettings()
      }
    ]
  });

  forgeDialog.addEventListener("close", () => {
    forgeDialog = null;
  }, { once: true });

  forgeDialog.render({ force: true });
  return forgeDialog;
}

Hooks.once("init", () => {
  registerSettings();
});

async function migrateV2Settings() {
  if (!game.user?.isGM) return;

  const previousProductName = ["Co", "dex Item Forge"].join("");
  const previousItemFolders = [previousProductName, `${previousProductName} Beta`, "Dungeon Master's Forge"];
  const previousActorFolders = [
    `${previousProductName} Summons`,
    `${previousProductName} Beta Summons`,
    "Dungeon Master's Forge Summons"
  ];

  const migrations = [
    {
      key: "itemFolderName",
      oldValues: previousItemFolders,
      value: "Dungeon Master's Forge"
    },
    {
      key: "actorFolderName",
      oldValues: previousActorFolders,
      value: "Dungeon Master's Forge Summons"
    },
  ];

  for (const migration of migrations) {
    const current = game.settings.get(MODULE_ID, migration.key);
    if (migration.oldValues.includes(current)) {
      await game.settings.set(MODULE_ID, migration.key, migration.value);
    }
  }

  const currentSourceLabel = game.settings.get(MODULE_ID, "sourceLabel");
  const versionedSourceLabel = sourceLabelForVersion(BUILD_VERSION);
  if (isManagedSourceLabel(currentSourceLabel) && currentSourceLabel !== versionedSourceLabel) {
    await game.settings.set(MODULE_ID, "sourceLabel", versionedSourceLabel);
  }

  const folderMigrations = [
    {
      type: "Item",
      oldNames: previousItemFolders,
      name: "Dungeon Master's Forge"
    },
    {
      type: "Actor",
      oldNames: previousActorFolders,
      name: "Dungeon Master's Forge Summons"
    }
  ];

  for (const migration of folderMigrations) {
    const alreadyExists = Array.from(game.folders ?? []).some(folder =>
      folder.type === migration.type && folder.name === migration.name
    );
    if (alreadyExists) continue;

    const legacyFolder = Array.from(game.folders ?? []).find(folder =>
      folder.type === migration.type && migration.oldNames.includes(folder.name)
    );
    if (legacyFolder) await legacyFolder.update({ name: migration.name });
  }
}

async function applyHostedDefaultProvider() {
  const hostedProvider = getProvider(HOSTED_PROVIDER_ID);
  if (!hostedProvider?.available) return;
  if (game.settings.get(MODULE_ID, "hostedDefaultApplied") === true) return;
  await game.settings.set(MODULE_ID, "providerId", HOSTED_PROVIDER_ID);
  await game.settings.set(MODULE_ID, "hostedDefaultApplied", true);
}

Hooks.once("ready", async () => {
  const module = game.modules.get(MODULE_ID);
  await migrateLegacySettings();
  await migrateV2Settings();
  await applyHostedDefaultProvider();
  module.api = {
    open: openForge,
    openSettings: openForgeSettings,
    openSceneRegion: openSceneRegionForge,
    compile: compileItemRequest,
    compileWithProvider,
    providers: listProviders,
    providerConfiguration: Object.freeze({
      partition: partitionProviderConfiguration,
      readiness: providerReadiness,
      profileSchemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
      createProfile: createProviderProfile,
      parseProfile: parseProviderProfile,
      serializeProfile: serializeProviderProfile
    }),
    providerContract: Object.freeze({
      schemaVersion: REMOTE_PROVIDER_SCHEMA_VERSION,
      buildRequest: buildRemoteProviderRequest,
      capabilitiesEndpointFor,
      healthEndpointFor,
      normalizeEndpoint: normalizeRemoteEndpoint,
      normalizeCapabilities: normalizeRemoteCapabilities,
      normalizeHealth: normalizeRemoteHealth,
      normalizeResponse: normalizeRemoteProviderResponse,
      redactConfiguration: redactProviderConfiguration,
      requestServiceStatus: requestRemoteServiceStatus,
      requestHealth: requestRemoteHealth,
      requestCapabilities: requestRemoteCapabilities,
      request: requestRemoteCompilation
    }),
    diagnostics: runLocalDiagnostics,
    diagnosticsWithValidation: runFoundryDiagnostics,
    contentResolver: Object.freeze({
      resolveExact: resolveSystemContentByName,
      resolveSpellByName,
      resolveEquipmentByName,
      diagnostics: runSystemContentDiagnostics
    }),
    verification: Object.freeze({
      status: () => verificationHarnessStatusSnapshot(currentVerificationHarnessOptions()),
      setup: setupIsolatedVerificationHarness,
      setupActors: setupIsolatedVerificationActors,
      run: runIsolatedVerificationHarness,
      executeMacro: executeIsolatedVerificationMacro,
      cleanup: cleanupIsolatedVerificationHarness
    }),
    version: BUILD_VERSION,
    automationCapabilities: () => currentConfig().automationCapabilities,
    validate: validateSpecs,
    create: createFromSpecs,
    example: () => foundry.utils.deepClone(EXAMPLE_SPECS)
  };

  scheduleItemsSidebarLauncherRefresh();
  console.log(`${MODULE_TITLE} build ${BUILD_VERSION} ready (manifest ${module.version}).`);
});

Hooks.on("renderApplicationV2", (application, element) => {
  if (application === forgeDialog) bindForgeUsability(application, element);
  if (application?.element?.classList?.contains("dungeon-masters-forge-repair-window")) {
    bindRepairConsentFooter(application, element);
  }
  scheduleItemsSidebarLauncherRefresh(element);
});

Hooks.on("renderSidebarTab", (_application, html) => {
  scheduleItemsSidebarLauncherRefresh(html);
});

Hooks.on("changeSidebarTab", tabName => {
  if (tabName === "items") scheduleItemsSidebarLauncherRefresh();
});

export { cleanupIsolatedVerificationHarness, compileItemRequest, createFromSpecs, executeIsolatedVerificationMacro, openForge, openSceneRegionForge, runIsolatedVerificationHarness, setupIsolatedVerificationHarness, validateSpecs };
