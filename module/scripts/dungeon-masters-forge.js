import { runCodexItemForge } from "./forge-engine.js";
import { compileItemRequest } from "./request-compiler.js";
import {
  DEFAULT_PROVIDER_ID,
  compileWithProvider,
  getProvider,
  listProviders,
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
  requestRemoteCompilation
} from "./provider-contract.js";
import { DIAGNOSTIC_CASES, runLocalDiagnostics } from "./diagnostics.js";
import {
  resolveEquipmentByName,
  resolveSpellByName,
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

const MODULE_ID = "codex-item-forge";
const MODULE_TITLE = PRODUCT_TITLE;
const MIN_DND5E_VERSION = "5.3.3";
const SETTINGS_TEMPLATE_PATH = `modules/${MODULE_ID}/templates/forge-settings.hbs`;

const EXAMPLE_SPECS = [
  {
    kind: "weaponExtraDamage",
    name: "Forge V2 - Emberglass Dagger",
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

function registerSettings() {
  game.settings.registerMenu(MODULE_ID, "forgeSettings", {
    name: "Forge settings",
    label: "Open Forge Settings",
    hint: "Manage generation provider settings, examples, and diagnostics.",
    icon: "fa-solid fa-gear",
    type: ForgeSettingsApplication,
    restricted: true
  });

  game.settings.register(MODULE_ID, "itemFolderName", {
    name: "Item folder",
    hint: "World folder used for generated items.",
    scope: "world",
    config: true,
    type: String,
    default: "Dungeon Master's Forge V2"
  });

  game.settings.register(MODULE_ID, "actorFolderName", {
    name: "Summon actor folder",
    hint: "World folder used for generated summon actors.",
    scope: "world",
    config: true,
    type: String,
    default: "Dungeon Master's Forge V2 Summons"
  });

  game.settings.register(MODULE_ID, "sourceLabel", {
    name: "Source label",
    hint: "Source text written to generated items.",
    scope: "world",
    config: true,
    type: String,
    default: sourceLabelForVersion(BUILD_VERSION)
  });

  game.settings.register(MODULE_ID, "replaceExisting", {
    name: "Replace matching world documents",
    hint: "Delete world items and summon actors with the same name before creating replacements.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "lastSpecs", {
    scope: "client",
    config: false,
    type: String,
    default: JSON.stringify(EXAMPLE_SPECS, null, 2)
  });

  game.settings.register(MODULE_ID, "lastRequest", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "providerId", {
    scope: "client",
    config: false,
    type: String,
    default: DEFAULT_PROVIDER_ID
  });

  game.settings.register(MODULE_ID, "unresolvedPolicy", {
    scope: "client",
    config: false,
    type: String,
    default: "review"
  });

  game.settings.register(MODULE_ID, "providerEndpoint", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "providerModel", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "rememberProviderApiToken", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "providerApiToken", {
    scope: "client",
    config: false,
    type: String,
    default: ""
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

function currentConfig(overrides = {}) {
  return {
    itemFolderName: overrides.itemFolderName ?? game.settings.get(MODULE_ID, "itemFolderName"),
    actorFolderName: overrides.actorFolderName ?? game.settings.get(MODULE_ID, "actorFolderName"),
    sourceLabel: overrides.sourceLabel ?? game.settings.get(MODULE_ID, "sourceLabel"),
    engineVersion: BUILD_VERSION,
    replaceExistingWorldDocuments: overrides.replaceExistingWorldDocuments
      ?? game.settings.get(MODULE_ID, "replaceExisting")
  };
}

function moduleIsActive(id) {
  return Boolean(game.modules.get(id)?.active);
}

function dependencyWarnings(specs) {
  const warnings = [];
  const usesConditionMacro = specs.some(spec => spec.kind === "weaponConditionOnHit");
  const usesUtilityMacro = specs.some(spec => spec.utilityActivities?.some(activity => activity.macroCommand));
  const usesItemMacro = usesConditionMacro || usesUtilityMacro || specs.some(spec => spec.toggleLight);

  if ((usesConditionMacro || usesUtilityMacro) && !moduleIsActive("midi-qol")) {
    warnings.push("This automation expects Midi-QOL.");
  }
  if (usesItemMacro && !moduleIsActive("itemacro")) {
    warnings.push("This spec expects Item Macro.");
  }

  return warnings;
}

async function validateSpecs(input) {
  assertEnvironment();
  const specs = normalizeSpecs(input);
  const validation = await runCodexItemForge(currentConfig(), specs, { validateOnly: true });
  return { ...validation, warnings: dependencyWarnings(specs), specs };
}

async function createFromSpecs(input, configOverrides = {}) {
  assertEnvironment({ requireGM: true });
  const specs = normalizeSpecs(input);
  await runCodexItemForge(currentConfig(configOverrides), specs, { validateOnly: true });
  return runCodexItemForge(currentConfig(configOverrides), specs);
}

function statusPill(label, active, title) {
  const state = active ? "ready" : "inactive";
  const icon = active ? "fa-solid fa-check" : "fa-solid fa-minus";
  return `<span class="codex-forge-pill" data-state="${state}" title="${escapeHTML(title)}"><i class="${icon}"></i>${escapeHTML(label)}</span>`;
}

function moduleStatusHTML() {
  return [
    statusPill(`DND5e ${game.system.version}`, game.system.id === "dnd5e", "Required system"),
    statusPill("Midi-QOL", moduleIsActive("midi-qol"), "Used by condition automation"),
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

function forgeProviderSummaryHTML(unresolvedPolicy) {
  const configuredProvider = configuredProviderState({ unresolvedPolicy });
  const snapshot = providerStatusSnapshot(configuredProvider.id, configuredProvider.configuration);
  return `
    <section class="codex-forge-provider-summary">
      <div class="codex-forge-provider-summary-copy">
        <strong>${escapeHTML(snapshot.provider?.label ?? "Provider")}</strong>
        <span class="codex-forge-provider-summary-meta">
          <i class="fa-solid ${escapeHTML(snapshot.icon)}"></i>
          <span data-forge-provider-summary-text>${escapeHTML(snapshot.message)}</span>
        </span>
      </div>
      <button type="button" class="codex-forge-ghost-button" data-action="open-settings">
        <i class="fa-solid fa-gear"></i>
        <span>Forge Settings</span>
      </button>
    </section>
  `;
}

function forgeContent() {
  const specs = game.settings.get(MODULE_ID, "lastSpecs") || JSON.stringify(EXAMPLE_SPECS, null, 2);
  const request = game.settings.get(MODULE_ID, "lastRequest") || "";
  const itemFolder = game.settings.get(MODULE_ID, "itemFolderName");
  const actorFolder = game.settings.get(MODULE_ID, "actorFolderName");
  const replaceExisting = game.settings.get(MODULE_ID, "replaceExisting");
  const unresolvedPolicy = currentUnresolvedPolicy();

  return `
    <section class="codex-item-forge-shell">
      <div class="codex-forge-statusbar" aria-label="System status">
        ${moduleStatusHTML()}
      </div>

      <div class="codex-forge-workflow">
        <section class="codex-forge-panel codex-forge-request-panel" data-forge-panel="request" tabindex="-1">
          <header class="codex-forge-pane-header">
            <h2><span class="codex-forge-step" aria-hidden="true">1</span><i class="fa-solid fa-feather-pointed"></i><span>Description</span></h2>
          </header>
          ${forgeProviderSummaryHTML(unresolvedPolicy)}
          <div class="codex-forge-provider-controls codex-forge-request-controls">
            <label>
              <span>Unresolved mechanics</span>
              <select name="unresolvedPolicy" aria-label="Unresolved mechanics policy">
                ${unresolvedPolicyOptionsHTML(unresolvedPolicy)}
              </select>
            </label>
            <label class="codex-forge-request-hint">
              <span>Connection</span>
              <small>Provider selection, API details, examples, and diagnostics now live in Forge Settings.</small>
            </label>
          </div>
          <label class="codex-forge-request">
            <span>Item request</span>
            <textarea name="request" aria-label="Natural-language item request" placeholder="Describe one item, or separate multiple items with a line containing ---.\n\nCreate a rare +1 dagger that deals an extra 1d4 fire damage.">${escapeHTML(request)}</textarea>
          </label>
        </section>

        <section class="codex-forge-panel codex-forge-review-panel" data-forge-panel="review" tabindex="-1">
          <header class="codex-forge-pane-header">
            <h2><span class="codex-forge-step" aria-hidden="true">2</span><i class="fa-solid fa-scroll"></i><span>Result</span></h2>
          </header>
          <div class="codex-forge-compile-report" data-forge-compile-report hidden></div>
          <div class="codex-forge-review-summary" data-forge-preview hidden></div>
          <div class="codex-forge-options">
            <label>
              <span>Item folder</span>
              <input type="text" name="itemFolderName" value="${escapeHTML(itemFolder)}">
            </label>
            <label>
              <span>Summon actor folder</span>
              <input type="text" name="actorFolderName" value="${escapeHTML(actorFolder)}">
            </label>
            <label class="codex-forge-toggle">
              <input type="checkbox" name="replaceExisting" ${replaceExisting ? "checked" : ""}>
              <span>Replace matching items and summon actors</span>
            </label>
          </div>

          <details class="codex-forge-advanced">
            <summary><i class="fa-solid fa-code"></i><span>Advanced specification editor</span></summary>
            <label class="codex-forge-specs">
              <span>Generated specifications</span>
              <textarea name="specs" spellcheck="false" aria-label="Item specs JSON">${escapeHTML(specs)}</textarea>
            </label>
          </details>
          <label class="codex-forge-approval">
            <input type="checkbox" name="reviewApproval">
            <span>I reviewed these specifications and approve creation.</span>
          </label>
        </section>
      </div>

      <output class="codex-forge-message" data-forge-status data-state="idle" aria-live="polite">Ready.</output>
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
  const provider = configuredProviderState({
    unresolvedPolicy: formControl(form, "unresolvedPolicy").value
  });
  return {
    request: formControl(form, "request").value.trim(),
    rawSpecs,
    specs: normalizeSpecs(rawSpecs),
    approved: formControl(form, "reviewApproval").checked,
    provider,
    config: {
      itemFolderName: formControl(form, "itemFolderName").value.trim() || "Dungeon Master's Forge V2",
      actorFolderName: formControl(form, "actorFolderName").value.trim() || "Dungeon Master's Forge V2 Summons",
      replaceExistingWorldDocuments: formControl(form, "replaceExisting").checked
    }
  };
}

async function persistProviderState(provider) {
  const partitioned = partitionProviderConfiguration(provider.id, provider.configuration);
  if (provider.id === "bring-your-own") {
    if (partitioned.session.apiToken) providerSessionConfiguration.set(provider.id, partitioned.session);
    else providerSessionConfiguration.delete(provider.id);
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
  dialog._codexProviderConnection = null;
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

function refreshForgeProviderSummary(dialog, form) {
  if (!(form instanceof HTMLFormElement)) return;

  const provider = configuredProviderState({
    unresolvedPolicy: formControl(form, "unresolvedPolicy").value
  });
  const snapshot = providerStatusSnapshot(provider.id, provider.configuration);
  const summary = dialog.element?.querySelector(".codex-forge-provider-summary");
  const label = summary?.querySelector("strong");
  const text = summary?.querySelector("[data-forge-provider-summary-text]");
  const icon = summary?.querySelector(".codex-forge-provider-summary-meta i");
  const compileButton = dialog.element?.querySelector('button[data-action="compile"]');

  if (summary) summary.dataset.state = snapshot.state;
  if (label) label.textContent = snapshot.provider?.label ?? "Provider";
  if (text) text.textContent = snapshot.message;
  if (icon) icon.className = `fa-solid ${snapshot.icon}`;
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
  const createButton = dialog.element?.querySelector('button[data-action="create"]');
  if (!(approval instanceof HTMLInputElement) || !(createButton instanceof HTMLButtonElement)) return;

  createButton.disabled = !dialog._codexReviewValidated || !approval.checked;
  createButton.setAttribute("aria-disabled", String(createButton.disabled));
}

function setReviewValidated(dialog, validated) {
  const form = dialog.element?.querySelector("form");
  const approval = form?.elements?.namedItem("reviewApproval");
  dialog._codexReviewValidated = validated;
  if (approval instanceof HTMLInputElement) {
    approval.disabled = !validated;
    if (!validated) approval.checked = false;
  }
  syncCreateAction(dialog);
}

function bindForgeUsability(dialog, element) {
  const form = element?.querySelector?.("form") ?? dialog.element?.querySelector("form");
  if (!(form instanceof HTMLFormElement) || form.dataset.forgeUsabilityBound !== undefined) return;
  form.dataset.forgeUsabilityBound = "";

  const approval = formControl(form, "reviewApproval");
  const specs = formControl(form, "specs");
  const unresolvedPolicy = formControl(form, "unresolvedPolicy");
  const openSettingsButton = form.querySelector('[data-action="open-settings"]');
  approval.addEventListener("change", () => syncCreateAction(dialog));
  unresolvedPolicy.addEventListener("change", () => refreshForgeProviderSummary(dialog, form));
  openSettingsButton?.addEventListener("click", () => openForgeSettings());
  specs.addEventListener("input", () => {
    dialog._codexCompilation = null;
    setReviewValidated(dialog, false);
    const report = dialog.element?.querySelector("[data-forge-compile-report]");
    const preview = dialog.element?.querySelector("[data-forge-preview]");
    if (report) report.hidden = true;
    if (preview) preview.hidden = true;
    setStatus(dialog, "warning", "Specifications changed. Validate to refresh the item review.");
  });
  setReviewValidated(dialog, false);
  refreshForgeProviderSummary(dialog, form);
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
    reference: "fa-book-open",
    unresolved: "fa-triangle-exclamation",
    warning: "fa-triangle-exclamation"
  };
  return `
    <div class="codex-forge-review-note" data-state="${escapeHTML(note.state)}">
      <i class="fa-solid ${icons[note.state] ?? "fa-circle-info"}"></i>
      <div>
        <strong>${escapeHTML(note.label)}</strong>
        <span>${escapeHTML(note.message)}</span>
        ${note.handling ? `<small>${escapeHTML(note.handling)}</small>` : ""}
      </div>
    </div>
  `;
}

function reviewItemHTML(summary) {
  return `
    <article class="codex-forge-item-summary" data-state="${summary.unresolvedCount ? "unresolved" : "ready"}">
      <header>
        <img src="${escapeHTML(summary.img)}" alt="">
        <div>
          <h3>${escapeHTML(summary.name)}</h3>
          <div class="codex-forge-item-meta">
            <span>${escapeHTML(summary.kindLabel)}</span>
            <span>${escapeHTML(summary.rarity)}</span>
            <span>${escapeHTML(summary.attunement)}</span>
          </div>
        </div>
      </header>
      ${summary.description ? `<p class="codex-forge-item-description">${escapeHTML(summary.description)}</p>` : ""}
      <ul class="codex-forge-mechanics">
        ${summary.mechanics.map(mechanic => `<li><i class="fa-solid fa-bolt"></i><span>${escapeHTML(mechanic)}</span></li>`).join("")}
      </ul>
      ${summary.notes.length ? `<div class="codex-forge-review-notes">${summary.notes.map(reviewNoteHTML).join("")}</div>` : ""}
    </article>
  `;
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

function specReferenceLookups(spec) {
  const references = [];
  const add = (kind, name, label) => {
    const normalized = String(name ?? "").trim();
    if (!normalized) return;
    references.push({ kind, name: normalized, label });
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

async function enrichSpecsWithSystemReferences(specs) {
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
    const systemReferences = [];
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
    }
    return systemReferences.length ? { ...spec, systemReferences } : spec;
  }));
}

async function renderPreview(dialog, validation) {
  const preview = dialog.element?.querySelector("[data-forge-preview]");
  if (!preview) return;

  const enrichedSpecs = await enrichSpecsWithSystemReferences(validation.specs);
  const summaries = buildReviewSummaries(enrichedSpecs, dialog._codexCompilation);
  setReviewValidated(dialog, true);
  preview.hidden = false;
  preview.innerHTML = `
    <div class="codex-forge-review-head">
      <strong>${validation.itemCount} item${validation.itemCount === 1 ? "" : "s"} ready for review</strong>
      <span><i class="fa-solid fa-check"></i> Validated</span>
    </div>
    <div class="codex-forge-review-items">${summaries.map(reviewItemHTML).join("")}</div>
  `;
}

function renderCompilationReport(dialog, compilation) {
  const report = dialog.element?.querySelector("[data-forge-compile-report]");
  if (!report) return;
  dialog._codexCompilation = compilation;
  report.hidden = false;
  report.innerHTML = `
    <div class="codex-forge-compile-head">
      <strong>${escapeHTML(compilation.providerLabel ?? "Local Rules")}</strong>
      <span>${compilation.decisions.map(decision => escapeHTML(decision.pattern)).join(", ")}</span>
    </div>
  `;
}

function diagnosticsHTML(report) {
  return `
    <div class="codex-forge-diagnostics-head">
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

function reportError(dialog, error) {
  console.error(`${MODULE_TITLE}:`, error);
  const message = error instanceof Error ? error.message : String(error);
  setStatus(dialog, "error", message);
  setSettingsStatus(dialog, "error", message);
  ui.notifications.error(`${MODULE_TITLE}: ${message}`);
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

function settingsFormProviderState(form) {
  return configuredProviderState({
    providerId: formControl(form, "providerId").value,
    endpoint: formControl(form, "providerEndpoint").value.trim(),
    model: formControl(form, "providerModel").value.trim(),
    apiToken: formControl(form, "providerApiToken").value,
    rememberApiToken: formControl(form, "rememberProviderApiToken").checked,
    unresolvedPolicy: currentUnresolvedPolicy()
  });
}

function syncSettingsProviderPanel(app) {
  const root = app.element?.[0] ?? app.element;
  const form = root?.querySelector?.("form");
  if (!(form instanceof HTMLFormElement)) return;

  const provider = settingsFormProviderState(form);
  const snapshot = providerStatusSnapshot(provider.id, provider.configuration, app._codexProviderConnection);
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
    checkButton.disabled = provider.id === "bring-your-own" ? !snapshot.readiness.ready : false;
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

async function loadExampleIntoForge() {
  const dialog = await openForge();
  const form = dialog?.element?.querySelector?.("form");
  const rawSpecs = JSON.stringify(EXAMPLE_SPECS, null, 2);

  await game.settings.set(MODULE_ID, "lastSpecs", rawSpecs);
  if (!(form instanceof HTMLFormElement)) return;

  setReviewValidated(dialog, false);
  formControl(form, "specs").value = rawSpecs;
  formControl(form, "reviewApproval").checked = false;
  dialog._codexCompilation = null;
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
      classes: ["codex-item-forge-settings"],
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
    const provider = configuredProviderState();
    const snapshot = providerStatusSnapshot(provider.id, provider.configuration, this._codexProviderConnection);
    const rememberProviderToken = provider.rememberApiToken === true;

    return {
      isBringYourOwn: provider.id === "bring-your-own",
      providerOptions: providerOptionsHTML(provider.id),
      providerEndpoint: provider.configuration.endpoint,
      providerModel: provider.configuration.model,
      providerToken: provider.configuration.apiToken,
      rememberProviderToken,
      providerStatusIcon: snapshot.icon,
      providerStatusState: snapshot.state,
      providerStatusMessage: snapshot.message
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    const form = root?.querySelector?.("form");
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
        if (providerState.id !== "bring-your-own") {
          clearProviderConnection(this);
          syncSettingsProviderPanel(this);
          setSettingsStatus(this, "success", "Local Rules runs entirely in Foundry and does not need a remote service.");
          return;
        }

        setSettingsStatus(this, "working", "Checking the remote provider...");
        const health = await requestRemoteHealth({
          endpoint: providerState.configuration.endpoint,
          token: providerState.configuration.apiToken
        });
        const capabilities = await requestRemoteCapabilities({
          endpoint: providerState.configuration.endpoint,
          token: providerState.configuration.apiToken,
          supportedKinds: SUPPORTED_SPEC_KINDS
        });
        this._codexProviderConnection = {
          providerId: providerState.id,
          checkedAt: new Date().toISOString(),
          health,
          capabilities
        };
        syncSettingsProviderPanel(this);

        const serviceName = health.service?.name || "Remote provider";
        const serviceVersion = health.service?.version ? ` ${health.service.version}` : "";
        const rateLimit = Number(health.requestLimits?.perMinute ?? 0);
        const rateText = rateLimit ? ` Rate limit: ${rateLimit}/minute.` : "";
        const compatibleKinds = Number(capabilities.compatibleKinds?.length ?? 0);
        const capabilityText = capabilities.status === "compatible"
          ? ` ${compatibleKinds} Forge item famil${compatibleKinds === 1 ? "y is" : "ies are"} compatible.`
          : health.status === "legacy-bridge"
            ? " This bridge does not expose the standard Forge capabilities route, but compile requests can still proceed."
          : capabilities.status === "not-supported"
            ? " Capabilities discovery is unavailable, but compile requests can still proceed."
            : capabilities.status === "not-advertised"
              ? " Health responded, but the provider did not advertise capabilities."
              : "";

        if (health.mode === "mock") {
          setSettingsStatus(this, "warning", `${serviceName}${serviceVersion} is connected in mock mode.${capabilityText}${rateText} Switch the service to openai mode for live AI generation.`);
        } else if (health.mode === "openai") {
          setSettingsStatus(this, "success", `${serviceName}${serviceVersion} is connected in openai mode.${capabilityText}${rateText}`);
        } else if (health.status === "legacy-bridge") {
          setSettingsStatus(this, "success", `${serviceName}${serviceVersion} responded through its legacy bridge route.${capabilityText}${rateText}`);
        } else {
          setSettingsStatus(this, "success", `${serviceName}${serviceVersion} responded.${capabilityText}${rateText}`);
        }
      } catch (error) {
        clearProviderConnection(this);
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

    root.querySelector('[data-action="open-forge"]')?.addEventListener("click", async () => {
      await openForge();
    });

    syncSettingsProviderPanel(this);
  }

  async _updateObject(_event, _formData) {
    const root = this.element?.[0] ?? this.element;
    const form = root?.querySelector?.("form");
    if (!(form instanceof HTMLFormElement)) return;
    const providerState = settingsFormProviderState(form);
    await persistProviderState(providerState);
    if (forgeDialog?.rendered) {
      refreshForgeProviderSummary(forgeDialog, forgeDialog.element?.querySelector("form"));
    }
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

async function openForge() {
  try {
    assertEnvironment({ requireGM: true });
  } catch (error) {
    ui.notifications.error(error.message);
    return null;
  }

  if (forgeDialog?.rendered) {
    forgeDialog.bringToFront();
    return forgeDialog;
  }

  forgeDialog = new foundry.applications.api.DialogV2({
    classes: ["codex-item-forge"],
    window: {
      title: MODULE_TITLE,
      icon: "fa-solid fa-hammer",
      resizable: true
    },
    position: { width: 1180, height: 760 },
    form: { closeOnSubmit: false },
    content: forgeContent(),
    buttons: [
      {
        action: "compile",
        label: "Compile Request",
        icon: "fa-solid fa-wand-magic-sparkles",
        tooltip: "Convert the description into editable Forge specs",
        class: "codex-forge-compile",
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            setStatus(dialog, "working", "Compiling the item request...");
            setReviewValidated(dialog, false);
            const priorPreview = dialog.element?.querySelector("[data-forge-preview]");
            if (priorPreview) priorPreview.hidden = true;
            const request = formControl(button.form, "request").value.trim();
            const provider = configuredProviderState({
              unresolvedPolicy: formControl(button.form, "unresolvedPolicy").value
            });
            const compilation = await compileWithProvider(request, {
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
            const rawSpecs = JSON.stringify(compilation.specs, null, 2);
            formControl(button.form, "specs").value = rawSpecs;
            formControl(button.form, "reviewApproval").checked = false;
            await Promise.all([
              game.settings.set(MODULE_ID, "lastRequest", request),
              game.settings.set(MODULE_ID, "lastSpecs", rawSpecs),
              persistProviderState(provider)
            ]);
            const diagnostics = dialog.element?.querySelector("[data-forge-diagnostics]");
            if (diagnostics) diagnostics.hidden = true;
            renderCompilationReport(dialog, compilation);
            const validation = await validateSpecs(compilation.specs);
            await renderPreview(dialog, validation);
            showDialogView(button.form, "review");
            const noteCount = compilation.assumptions.length + compilation.warnings.length + compilation.deferred.length;
            const itemCount = compilation.specs.length;
            const draftLabel = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
            setStatus(dialog, noteCount ? "warning" : "success", noteCount
              ? `${draftLabel} validated with ${noteCount} review note${noteCount === 1 ? "" : "s"}. Review the item summary before approval.`
              : `${draftLabel} compiled and validated. Review the item summary before approval.`);
          } catch (error) {
            reportError(dialog, error);
          }
        }
      },
      {
        action: "settings",
        label: "Forge Settings",
        icon: "fa-solid fa-gear",
        tooltip: "Open provider settings, example tools, and diagnostics",
        type: "button",
        callback: async () => openForgeSettings()
      },
      {
        action: "validate",
        label: "Validate",
        icon: "fa-solid fa-check",
        tooltip: "Validate without creating documents",
        class: "codex-forge-validate",
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            setStatus(dialog, "working", "Validating...");
            setReviewValidated(dialog, false);
            const priorPreview = dialog.element?.querySelector("[data-forge-preview]");
            if (priorPreview) priorPreview.hidden = true;
            const { rawSpecs } = readDialogForm(button.form);
            const validation = await validateSpecs(rawSpecs);
            formControl(button.form, "reviewApproval").checked = false;
            const diagnostics = dialog.element?.querySelector("[data-forge-diagnostics]");
            if (diagnostics) diagnostics.hidden = true;
            if (!dialog._codexCompilation) {
              const report = dialog.element?.querySelector("[data-forge-compile-report]");
              if (report) report.hidden = true;
            }
            await game.settings.set(MODULE_ID, "lastSpecs", rawSpecs);
            await renderPreview(dialog, validation);
            const warning = validation.warnings.length ? ` ${validation.warnings.join(" ")}` : "";
            const unresolved = validation.unresolvedMechanicCount
              ? ` ${validation.unresolvedMechanicCount} unresolved mechanic${validation.unresolvedMechanicCount === 1 ? "" : "s"} require review.`
              : "";
            setStatus(dialog, validation.warnings.length || validation.unresolvedMechanicCount ? "warning" : "success", `Specs are valid.${warning}${unresolved}`);
          } catch (error) {
            reportError(dialog, error);
          }
        }
      },
      {
        action: "create",
        label: "Create Items",
        icon: "fa-solid fa-hammer",
        tooltip: "Create the validated world documents",
        class: "codex-forge-create",
        default: true,
        type: "button",
        callback: async (_event, button, dialog) => {
          try {
            const { request, rawSpecs, specs, approved, provider, config } = readDialogForm(button.form);
            if (!approved) {
              showDialogView(button.form, "review");
              setStatus(dialog, "warning", "Review the generated specs and check the approval box before creation.");
              ui.notifications.warn(`${MODULE_TITLE}: Review approval is required before creation.`);
              return;
            }
            setStatus(dialog, "working", "Creating approved world documents...");
            const validation = await validateSpecs(specs);
            if (provider.configuration.unresolvedPolicy === "block" && validation.unresolvedMechanicCount) {
              setStatus(dialog, "warning", `${validation.unresolvedMechanicCount} unresolved mechanic${validation.unresolvedMechanicCount === 1 ? " blocks" : "s block"} item creation under the selected policy.`);
              return;
            }
            await renderPreview(dialog, validation);
            await Promise.all([
              saveDialogState(rawSpecs, config, provider),
              game.settings.set(MODULE_ID, "lastRequest", request)
            ]);
            const result = await createFromSpecs(specs, config);
            const actorText = result.actors.length ? ` and ${result.actors.length} summon actor${result.actors.length === 1 ? "" : "s"}` : "";
            const unresolvedCount = specs.reduce((total, spec) => total + (spec.unresolvedMechanics?.length ?? 0), 0);
            const unresolvedText = unresolvedCount
              ? ` ${unresolvedCount} unresolved mechanic${unresolvedCount === 1 ? " was" : "s were"} preserved on the created item${result.items.length === 1 ? "" : "s"}.`
              : "";
            setStatus(dialog, "success", `Created ${result.items.length} item${result.items.length === 1 ? "" : "s"}${actorText}.${unresolvedText}`);
          } catch (error) {
            reportError(dialog, error);
          }
        }
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

  const migrations = [
    {
      key: "itemFolderName",
      oldValues: ["Codex Item Forge", "Codex Item Forge Beta", "Dungeon Master's Forge"],
      value: "Dungeon Master's Forge V2"
    },
    {
      key: "actorFolderName",
      oldValues: ["Codex Item Forge Summons", "Codex Item Forge Beta Summons", "Dungeon Master's Forge Summons"],
      value: "Dungeon Master's Forge V2 Summons"
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
      oldNames: ["Codex Item Forge", "Codex Item Forge Beta", "Dungeon Master's Forge"],
      name: "Dungeon Master's Forge V2"
    },
    {
      type: "Actor",
      oldNames: ["Codex Item Forge Summons", "Codex Item Forge Beta Summons", "Dungeon Master's Forge Summons"],
      name: "Dungeon Master's Forge V2 Summons"
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

Hooks.once("ready", async () => {
  const module = game.modules.get(MODULE_ID);
  await migrateV2Settings();
  module.api = {
    open: openForge,
    openSettings: openForgeSettings,
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
    version: BUILD_VERSION,
    validate: validateSpecs,
    create: createFromSpecs,
    example: () => foundry.utils.deepClone(EXAMPLE_SPECS)
  };

  console.log(`${MODULE_TITLE} build ${BUILD_VERSION} ready (manifest ${module.version}).`);
});

Hooks.on("getHeaderControlsApplicationV2", (application, controls) => {
  if (!game.user?.isGM) return;

  const ItemDirectory = foundry.applications.sidebar.tabs.ItemDirectory;
  if (!(application instanceof ItemDirectory)) return;
  if (controls.some(control => control.action === MODULE_ID)) return;

  controls.unshift({
    action: MODULE_ID,
    label: MODULE_TITLE,
    icon: "fa-solid fa-hammer",
    onClick: openForge
  });

  controls.unshift({
    action: `${MODULE_ID}-settings`,
    label: `${MODULE_TITLE} Settings`,
    icon: "fa-solid fa-gear",
    onClick: openForgeSettings
  });
});

function isItemDirectory(application) {
  const ItemDirectory = foundry.applications.sidebar.tabs.ItemDirectory;
  return application instanceof ItemDirectory
    || application.collection === game.items
    || application.options?.collection === "Item";
}

function addItemDirectoryButton(application, element) {
  if (!game.user?.isGM || !isItemDirectory(application)) return;

  const search = element?.querySelector?.(".directory-header search");
  if (!search) return;

  const controls = [
    {
      selector: "[data-dungeon-masters-forge-settings]",
      className: "inline-control icon fa-solid fa-gear dungeon-masters-forge-settings-open",
      label: `${MODULE_TITLE} Settings`,
      dataset: "dungeonMastersForgeSettings",
      handler: openForgeSettings
    },
    {
      selector: "[data-dungeon-masters-forge]",
      className: "inline-control icon fa-solid fa-hammer dungeon-masters-forge-open",
      label: MODULE_TITLE,
      dataset: "dungeonMastersForge",
      handler: openForge
    }
  ];

  const collapseButton = search.querySelector(".collapse-all");
  for (const control of controls) {
    if (search.querySelector(control.selector)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = control.className;
    button.dataset[control.dataset] = "";
    button.dataset.tooltip = "";
    button.setAttribute("aria-label", control.label);
    button.title = control.label;
    button.addEventListener("click", control.handler);
    search.insertBefore(button, collapseButton ?? null);
  }
}

Hooks.on("renderItemDirectory", addItemDirectoryButton);

Hooks.on("renderApplicationV2", (application, element) => {
  if (isItemDirectory(application)) addItemDirectoryButton(application, element);
  if (application === forgeDialog) bindForgeUsability(application, element);
});

export { compileItemRequest, createFromSpecs, openForge, validateSpecs };
