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
    hint: "When Midi-QOL and Item Macro are active, apply supported condition riders after failed saves and remove them automatically by combat duration. Generated attacks and charged powers also confirm targets and resource use. Core DND5e item data is always preserved.",
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
    hint: "Allows a GM to create tagged disposable test copies only in the configured test world. It never runs item activities, macros, Scenes, or Regions automatically.",
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
  return enrichSpecsWithSystemReferences(repairedSpecs, requestText);
}

function currentConfig(overrides = {}) {
  return {
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
    createItems: (verificationSpecs, config = {}) => createPreparedSpecs(verificationSpecs, {
      ...config,
      // The isolated harness only creates tagged documents and never executes activities.
      authorizeGeneratedAutomation: true
    })
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
  const usesItemMacro = usesConditionMacro || usesUtilityMacro || specs.some(spec => spec.toggleLight);
  const midiEnabled = midiQolAutomationEnabled();

  if ((usesConditionMacro || usesUtilityMacro) && !midiEnabled) {
    warnings.push("Enable the Forge Midi-QOL automation setting to automate condition riders and supported utility powers.");
  }
  if (usesItemMacro && !moduleIsActive("itemacro")) {
    warnings.push("This spec expects Item Macro.");
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
            <button type="button" class="dm_forge-review-tab" data-forge-review-tab="automation" aria-selected="false">Automation code</button>
          </nav>
          <div class="dm_forge-review-summary" data-forge-preview hidden></div>

          <div class="dm_forge-automation-review" data-forge-automation-review hidden></div>

          <details class="dm_forge-advanced">
            <summary><i class="fa-solid fa-code"></i><span>Advanced specification editor</span></summary>
            <label class="dm_forge-specs">
              <span>Generated specifications</span>
              <textarea name="specs" spellcheck="false" aria-label="Item specs JSON">${escapeHTML(specs)}</textarea>
            </label>
          </details>
        </section>
      </div>

      <section class="dm_forge-bottom-tray">
        <div class="dm_forge-compile-report" data-forge-compile-report hidden></div>
        <div class="dm_forge-notice-stack" data-forge-notices hidden></div>
        <label class="dm_forge-approval dm_forge-approval-compact" title="Required before creating items: review the generated specifications, then approve creation.">
          <input type="checkbox" name="reviewApproval" aria-label="Approve creation after reviewing the specifications.">
          <span class="dm_forge-approval-box" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
          <span class="dm_forge-approval-label">Approve</span>
        </label>
        <label class="dm_forge-approval dm_forge-approval-compact dm_forge-code-approval" data-forge-code-approval-wrap hidden title="Required when the item contains generated automation code: read the code preview and authorize it before creation.">
          <input type="checkbox" name="automationCodeApproval" aria-label="I have read and authorize the generated automation code.">
          <span class="dm_forge-approval-box" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
          <span class="dm_forge-approval-label">Approve automation</span>
        </label>
        <button type="button" class="dm_forge-report-button" data-action="report-failed-item" disabled hidden>
          <i class="fa-solid fa-bug"></i>
          <span>Report Failed Item</span>
        </button>
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

function relocateBottomActions(dialog) {
  const form = dialog.element?.querySelector("form");
  const footer = form?.querySelector(".form-footer");
  const approval = form?.elements?.namedItem("reviewApproval");
  const approvalLabel = approval instanceof HTMLInputElement ? approval.closest(".dm_forge-approval") : null;
  const reportButton = form?.querySelector('[data-action="report-failed-item"]');
  const compileButton = footer?.querySelector('[data-action="compile"]');
  const validateButton = footer?.querySelector('[data-action="validate"]');
  if (!(footer instanceof HTMLElement) || !(approvalLabel instanceof HTMLElement) || !(reportButton instanceof HTMLButtonElement)) return;

  if (compileButton instanceof HTMLButtonElement) compileButton.after(approvalLabel);
  if (!footer.querySelector("[data-forge-footer-provider-status]")) {
    const provider = activeProviderState({
      unresolvedPolicy: formControl(form, "unresolvedPolicy").value
    });
    const snapshot = providerStatusSnapshot(provider.id, provider.configuration, dialog._dm_forgeProviderConnection);
    approvalLabel.insertAdjacentHTML("afterend", forgeFooterProviderStatusHTML(snapshot));
  }
  if (validateButton instanceof HTMLButtonElement) validateButton.before(reportButton);
  reportButton.hidden = false;
  footer.classList.add("dm_forge-actions-footer");
}

function failedItemReportAvailability(dialog) {
  const rawSpecs = reportRawSpecsForDialog(dialog);
  const preview = dialog?.element?.querySelector?.("[data-forge-preview]");
  const hasPreview = preview instanceof HTMLElement && preview.hidden === false;
  const items = hasPreview ? reportSummariesForDialog(dialog) : [];
  if (!rawSpecs || !hasPreview || !items.length) {
    return {
      enabled: false,
      message: "Available after you preview or validate an item. The report window will include the current request, generated JSON, preview notes, and your note."
    };
  }

  const provider = reportContextProvider(dialog);
  const providerRecord = getProvider(provider.id);
  if (!providerRecord || providerRecord.mode !== "network") {
    return {
      enabled: false,
      message: "Failed-item reports are available when you are connected to a network Forge service."
    };
  }

  try {
    const connection = networkProviderConfiguration(provider.id, provider.configuration);
    if (!String(connection.endpoint ?? "").trim()) {
      return {
        enabled: false,
        message: "Add a Forge-compatible compile endpoint in Forge Settings before sending failed-item reports."
      };
    }
  } catch {
    return {
      enabled: false,
      message: "Finish configuring the connected Forge service before sending failed-item reports."
    };
  }

  return {
    enabled: true,
      message: "Opens a separate report window. We will attach the current request, generated JSON, preview notes, provider details, and your note. The configured service controls how long it keeps the report."
  };
}

function syncFailedItemReportAction(dialog) {
  const button = dialog?.element?.querySelector?.('[data-action="report-failed-item"]');
  const text = dialog?.element?.querySelector?.("[data-forge-report-action-text]");
  if (!(button instanceof HTMLButtonElement)) return;

  const availability = failedItemReportAvailability(dialog);
  button.disabled = !availability.enabled;
  button.setAttribute("aria-disabled", String(button.disabled));
  if (text) text.textContent = availability.message;
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
  syncFailedItemReportAction(dialog);
}

function clearForgeResultState(dialog) {
  dialog._dm_forgeCompilation = null;
  dialog._dm_forgeAutomationCodeRequired = false;
  setReviewValidated(dialog, false);
  for (const selector of ["[data-forge-compile-report]", "[data-forge-preview]", "[data-forge-automation-review]", "[data-forge-notices]", "[data-forge-diagnostics]"]) {
    const output = dialog.element?.querySelector(selector);
    if (!output) continue;
    output.hidden = true;
    if ("innerHTML" in output) output.innerHTML = "";
  }
  const codeApprovalWrap = dialog.element?.querySelector("[data-forge-code-approval-wrap]");
  const reviewTabs = dialog.element?.querySelector("[data-forge-review-tabs]");
  const codeApproval = dialog.element?.querySelector('input[name="automationCodeApproval"]');
  if (codeApprovalWrap instanceof HTMLElement) codeApprovalWrap.hidden = true;
  if (reviewTabs instanceof HTMLElement) reviewTabs.hidden = true;
  if (codeApproval instanceof HTMLInputElement) {
    codeApproval.checked = false;
    codeApproval.disabled = true;
  }
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
  const reportButton = form.querySelector('[data-action="report-failed-item"]');
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
    syncFailedItemReportAction(dialog);
  });
  reportButton?.addEventListener("click", event => {
    event.preventDefault();
    void openFailedItemReportDialog(dialog);
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
  syncFailedItemReportAction(dialog);
}

function setStatus(dialog, state, message) {
  const root = dialog.element?.querySelector ? dialog.element : dialog.element?.[0] ?? dialog.element;
  const output = root?.querySelector?.("[data-forge-status]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
}

function reviewNoteHTML(note) {
  const icons = {
    assumption: "fa-lightbulb",
    deferred: "fa-hand",
    "free-forge": "fa-cloud",
    notice: "fa-circle-info",
    note: "fa-circle-info",
    reference: "fa-book-open",
    unresolved: "fa-triangle-exclamation",
    warning: "fa-triangle-exclamation"
  };
  return `
    <div class="dm_forge-review-note" data-state="${escapeHTML(note.state)}">
      <i class="fa-solid ${icons[note.state] ?? "fa-circle-info"}"></i>
      <div>
        <strong>${escapeHTML(note.label)}</strong>
        <span>${escapeHTML(note.message)}</span>
        ${note.handling ? `<small>${escapeHTML(note.handling)}</small>` : ""}
      </div>
    </div>
  `;
}

function footerReviewNoteHTML(note) {
  return `
    <div class="dm_forge-footer-note" data-state="${escapeHTML(note.state)}">
      ${reviewNoteHTML(note)}
    </div>
  `;
}

function footerReviewBadgeHTML(note) {
  const icons = {
    assumption: "fa-lightbulb",
    deferred: "fa-hand",
    "free-forge": "fa-cloud",
    notice: "fa-circle-info",
    note: "fa-circle-info",
    reference: "fa-book-open",
    unresolved: "fa-triangle-exclamation",
    warning: "fa-triangle-exclamation"
  };
  const tooltip = [note.label, note.message, note.handling].filter(Boolean).join(" - ");
  return `
    <span class="dm_forge-footer-badge" data-state="${escapeHTML(note.state)}" title="${escapeHTML(tooltip)}">
      <i class="fa-solid ${icons[note.state] ?? "fa-circle-info"}"></i>
      <span>${escapeHTML(note.label)}</span>
    </span>
  `;
}

function summarizeFooterNotes(notes) {
  const groups = [
    { state: "warning", label: "Warnings", states: ["warning", "unresolved", "deferred"] },
    { state: "notice", label: "Notices", states: ["notice"] },
    { state: "free-forge", label: "Free Forge", states: ["free-forge"] },
    { state: "note", label: "Notes", states: ["assumption", "reference", "note"] }
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
      <div class="dm_forge-item-note-badges">
        ${groups.map(group => footerReviewBadgeHTML({
          state: group.state,
          label: `${group.label} ${group.notes.length}`,
          message: group.notes.slice(0, 2).map(note => note.message).join(" | "),
          handling: group.notes.length > 2 ? `${group.notes.length - 2} more note${group.notes.length - 2 === 1 ? "" : "s"} in the footer details.` : "Open the footer notes for full details."
        })).join("")}
        <span class="dm_forge-item-note-hint">Full details stay in the footer notes.</span>
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
                <p>Forge kept the dominant supported item pattern and preserved the leftover mechanic${summary.unresolvedCount === 1 ? "" : "s"} for review instead of failing the request.</p>
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
    const note = { state: "warning", label: "Validation warning", message: warning, handling: "" };
    const key = `${note.state}|${note.label}|${note.message}|`;
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
  }
  const order = { warning: 0, unresolved: 1, deferred: 2, notice: 3, "free-forge": 4, assumption: 5, reference: 6, note: 7 };
  return notes.sort((left, right) => (order[left.state] ?? 99) - (order[right.state] ?? 99));
}

function renderFooterNotices(dialog, summaries, validation) {
  const output = dialog.element?.querySelector("[data-forge-notices]");
  if (!output) return;
  const notes = collectFooterNotes(summaries, validation);
  output.hidden = notes.length === 0;
  const groups = summarizeFooterNotes(notes);
  output.innerHTML = notes.length
    ? `
      <details class="dm_forge-footer-disclosure">
        <summary class="dm_forge-footer-head">
          <div class="dm_forge-footer-summary">
            <strong>Review notes</strong>
            <span>${notes.length} note${notes.length === 1 ? "" : "s"}</span>
          </div>
          <div class="dm_forge-footer-badges">
            ${groups.map(group => footerReviewBadgeHTML({
              state: group.state,
              label: `${group.label} ${group.notes.length}`,
              message: `${group.notes.length} ${group.label.toLowerCase()} note${group.notes.length === 1 ? "" : "s"}`,
              handling: group.notes.slice(0, 3).map(note => note.message).join(" | ")
            })).join("")}
            <span class="dm_forge-footer-more">Expand for details</span>
          </div>
        </summary>
        <div class="dm_forge-footer-notes">${notes.map(footerReviewNoteHTML).join("")}</div>
      </details>
    `
    : "";
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

  const summaries = buildReviewSummaries(validation.specs, compilation);
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
  renderFooterNotices(dialog, summaries, validation);
  renderAutomationCodeReview(dialog, validation.automationCodePreview ?? []);
  return collectFooterNotes(summaries, validation);
}

function setReviewTab(dialog, tab = "visual") {
  const normalizedTab = tab === "automation" ? "automation" : "visual";
  const preview = dialog.element?.querySelector("[data-forge-preview]");
  const automation = dialog.element?.querySelector("[data-forge-automation-review]");
  const tabs = dialog.element?.querySelectorAll("[data-forge-review-tab]") ?? [];
  if (preview instanceof HTMLElement) preview.hidden = normalizedTab !== "visual";
  if (automation instanceof HTMLElement && dialog._dm_forgeAutomationCodeRequired === true) {
    automation.hidden = normalizedTab !== "automation";
  }
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
  if (tabs instanceof HTMLElement) tabs.hidden = codeEntries.length === 0;
  if (approval instanceof HTMLInputElement) {
    approval.disabled = codeEntries.length === 0;
    if (codeEntries.length === 0) approval.checked = false;
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
  if (codeEntries.length) setReviewTab(dialog, "visual");
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
  const warningCount = reviewGroup("warning")?.notes.length ?? (compilation.warnings?.length ?? 0);
  const noticeCount = reviewGroup("notice")?.notes.length ?? 0;
  const freeForgeCount = reviewGroup("free-forge")?.notes.length ?? 0;
  const noteCount = reviewGroup("note")?.notes.length ?? 0;
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
      ${noteCount
        ? `
          <span class="dm_forge-review-pill" data-state="note">
            <i class="fa-solid fa-circle-info"></i>
            <span>Notes ${noteCount}</span>
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
    notes: (summary.notes ?? []).map(note => ({
      state: note.state,
      label: note.label,
      message: note.message
    }))
  };
}

function reportSummariesForDialog(dialog) {
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
  return buildReviewSummaries(specs, compilation).map(summaryItemNotes);
}

function reportRawSpecsForDialog(dialog) {
  try {
    const form = dialog?.element?.querySelector?.("form");
    return form instanceof HTMLFormElement ? formControl(form, "specs").value.trim() : "";
  } catch {
    return "";
  }
}

function reportRequestForDialog(dialog) {
  try {
    const form = dialog?.element?.querySelector?.("form");
    return form instanceof HTMLFormElement ? formControl(form, "request").value.trim() : "";
  } catch {
    return "";
  }
}

function reportStatusForDialog(dialog) {
  const status = dialog?.element?.querySelector?.("[data-forge-status]");
  return String(status?.textContent ?? "").trim();
}

function compilationSnapshotForDialog(dialog) {
  const compilation = dialog?._dm_forgeCompilation;
  if (!compilation || typeof compilation !== "object") return null;
  return {
    providerLabel: String(compilation.providerLabel ?? ""),
    providerMode: String(compilation.providerMode ?? ""),
    normalizedRequest: String(compilation.request ?? ""),
    decisions: Array.isArray(compilation.decisions)
      ? compilation.decisions.map(decision => ({
          name: String(decision?.name ?? ""),
          pattern: String(decision?.pattern ?? ""),
          unresolvedCount: Number.isFinite(Number(decision?.unresolvedCount)) ? Number(decision.unresolvedCount) : 0
        }))
      : [],
    assumptions: Array.isArray(compilation.assumptions) ? compilation.assumptions.map(String) : [],
    warnings: Array.isArray(compilation.warnings) ? compilation.warnings.map(String) : [],
    deferred: Array.isArray(compilation.deferred) ? compilation.deferred.map(String) : [],
    unresolvedCount: Array.isArray(compilation.unresolvedMechanics) ? compilation.unresolvedMechanics.length : 0,
    forgeProvenance: compilation.forgeProvenance && typeof compilation.forgeProvenance === "object"
      ? {
          servicePreparedSpecFingerprint: String(compilation.forgeProvenance.servicePreparedSpecFingerprint ?? "").slice(0, 100),
          providerSpecFingerprint: String(compilation.forgeProvenance.providerSpecFingerprint ?? "").slice(0, 100),
          finalSpecFingerprint: String(compilation.forgeProvenance.finalSpecFingerprint ?? "").slice(0, 100),
          changedAfterProvider: compilation.forgeProvenance.changedAfterProvider === true
        }
      : null
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
    items: reportSummariesForDialog(dialog)
  };
}

function buildAnonymousErrorReportPayload(dialog, error, context = {}) {
  return buildReportPayloadBase(dialog, error, {
    ...context,
    source: "dungeon-masters-forge-module"
  });
}

function buildFailedItemReportPayload(dialog, userNote, desiredOutcome = "") {
  return {
    ...buildReportPayloadBase(dialog, new Error("User reported a failed item from the Forge preview window."), {
      stage: "user-feedback",
      source: "dungeon-masters-forge-failed-item"
    }),
    feedback: {
      kind: "failed-item",
      userNote: String(userNote ?? "").trim(),
      desiredOutcome: String(desiredOutcome ?? "").trim(),
      requestText: reportRequestForDialog(dialog),
      generatedSpecsJson: reportRawSpecsForDialog(dialog),
      statusMessage: reportStatusForDialog(dialog),
      includedPreviewNotes: true
    },
    compilation: compilationSnapshotForDialog(dialog)
  };
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

function failedItemReportDialogContent() {
  return `
    <section class="dm_forge-report-dialog">
      <p>Tell us what failed when you previewed, created, or used this item.</p>
      <ul>
        <li>Describe the mismatch between the prompt and the result.</li>
        <li>Mention whether the failure happened in preview, on item creation, or during use in chat.</li>
        <li>Avoid including secrets such as API keys or access tokens.</li>
      </ul>
      <p><strong>Included automatically:</strong> the current request, generated specifications JSON, preview notes, provider details, and Foundry/system version data.</p>
      <label class="dm_forge-report-consent">
        <input type="checkbox" name="reportConsent" aria-label="I understand what this report sends.">
        <span>I understand that this report sends the prompt, generated specifications, preview notes, provider host/path, and my notes to the configured Forge service. It does not send the API token, world documents, actors, Scenes, or Regions. The configured service controls retention; the current hosted tester service prunes expired reports when a new report is received. I will remove secrets or private campaign details from my notes.</span>
      </label>
      <label class="dm_forge-report-dialog-field">
        <span>What went wrong?</span>
        <textarea name="reportNote" aria-label="Failed item report note" placeholder="Example: Burning Hands showed up in preview, but the created item defaulted to the melee attack and never offered the spell activity."></textarea>
      </label>
      <label class="dm_forge-report-dialog-field">
        <span>Desired outcome in plain language <em>(optional)</em></span>
        <textarea name="desiredOutcome" aria-label="Desired outcome in plain language" placeholder="Example: I wanted an action that casts Burning Hands from the item, using its charges and spell save DC."></textarea>
      </label>
      <p class="notes">This optional outcome helps us refine how Free Forge interprets natural D&D wording. It is stored with this report for review; it does not change an existing item automatically.</p>
      <output class="dm_forge-report-dialog-status" data-forge-report-status data-state="idle" aria-live="polite">Your note will be sent with the current preview context.</output>
    </section>
  `;
}

function setFailedItemReportStatus(dialog, state, message) {
  const output = dialog?.element?.querySelector?.("[data-forge-report-status]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
}

async function submitFailedItemReport(parentDialog, userNote, desiredOutcome = "") {
  const provider = reportContextProvider(parentDialog);
  const providerRecord = getProvider(provider.id);
  if (!providerRecord || providerRecord.mode !== "network") {
    throw new Error("Failed-item reports are only available when a network Forge service is active.");
  }
  const connection = networkProviderConfiguration(provider.id, provider.configuration);
  if (!String(connection.endpoint ?? "").trim()) {
    throw new Error("Configure a Forge-compatible compile endpoint before sending failed-item reports.");
  }
  const payload = buildFailedItemReportPayload(parentDialog, userNote, desiredOutcome);
  return requestRemoteErrorReport({
    endpoint: connection.endpoint,
    token: connection.apiToken,
    payload
  });
}

async function openFailedItemReportDialog(parentDialog) {
  const availability = failedItemReportAvailability(parentDialog);
  if (!availability.enabled) {
    ui.notifications.warn(`${MODULE_TITLE}: ${availability.message}`);
    return null;
  }

  const reportDialog = new foundry.applications.api.DialogV2({
    classes: ["dungeon-masters-forge", "dungeon-masters-forge-report-window"],
    window: {
      title: "Report Failed Item",
      icon: "fa-solid fa-bug",
      minimizable: false,
      resizable: true
    },
    position: { width: 640, height: 520 },
    form: { closeOnSubmit: false },
    content: failedItemReportDialogContent(),
    buttons: [
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-xmark",
        type: "button",
        callback: (_event, _button, dialog) => {
          dialog.close();
        }
      },
      {
        action: "send-report",
        label: "Send Report",
        icon: "fa-solid fa-paper-plane",
        class: "dm_forge-send-report",
        default: true,
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            const note = formControl(button.form, "reportNote").value.trim();
            const desiredOutcome = formControl(button.form, "desiredOutcome").value.trim();
            const reportConsent = formControl(button.form, "reportConsent").checked;
            if (!reportConsent) {
              setFailedItemReportStatus(dialog, "warning", "Confirm that you understand what this report sends before continuing.");
              return;
            }
            if (!note) {
              setFailedItemReportStatus(dialog, "warning", "Add a short note describing what failed before sending the report.");
              return;
            }
            setFailedItemReportStatus(dialog, "working", "Sending failed-item report...");
            setStatus(parentDialog, "working", "Sending failed-item report...");
            await submitFailedItemReport(parentDialog, note, desiredOutcome);
            setFailedItemReportStatus(dialog, "success", "Report sent. Thank you - the current preview notes and generated JSON were included.");
            setStatus(parentDialog, "success", "Failed-item report sent with the current preview notes and generated JSON.");
            ui.notifications.info(`${MODULE_TITLE}: Failed-item report sent.`);
            dialog.close();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setFailedItemReportStatus(dialog, "error", message);
            setStatus(parentDialog, "warning", message);
          }
        }
      }
    ]
  });

  reportDialog.render({ force: true });
  return reportDialog;
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
  return configuredProviderState({
    providerId,
    endpoint: formControl(form, "providerEndpoint").value.trim(),
    model: formControl(form, "providerModel").value.trim(),
    apiToken,
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
  const status = root.querySelector("[data-forge-settings-provider-status]");
  const icon = status?.querySelector("i");
  const label = status?.querySelector("span");
  const checkButton = root.querySelector('[data-action="check-provider"]');

  if (configurationPanel) configurationPanel.hidden = provider.id !== "bring-your-own";
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
            setStatus(dialog, "working", "Preparing preview...");
            clearForgeResultState(dialog);
            const request = formControl(button.form, "request").value.trim();
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
                supportedKinds: SUPPORTED_SPEC_KINDS
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
      run: runIsolatedVerificationHarness,
      cleanup: cleanupIsolatedVerificationHarness
    }),
    version: BUILD_VERSION,
    validate: validateSpecs,
    create: createFromSpecs,
    example: () => foundry.utils.deepClone(EXAMPLE_SPECS)
  };

  scheduleItemsSidebarLauncherRefresh();
  console.log(`${MODULE_TITLE} build ${BUILD_VERSION} ready (manifest ${module.version}).`);
});

Hooks.on("renderApplicationV2", (application, element) => {
  if (application === forgeDialog) bindForgeUsability(application, element);
  scheduleItemsSidebarLauncherRefresh(element);
});

Hooks.on("renderSidebarTab", (_application, html) => {
  scheduleItemsSidebarLauncherRefresh(html);
});

Hooks.on("changeSidebarTab", tabName => {
  if (tabName === "items") scheduleItemsSidebarLauncherRefresh();
});

export { cleanupIsolatedVerificationHarness, compileItemRequest, createFromSpecs, openForge, openSceneRegionForge, runIsolatedVerificationHarness, setupIsolatedVerificationHarness, validateSpecs };
