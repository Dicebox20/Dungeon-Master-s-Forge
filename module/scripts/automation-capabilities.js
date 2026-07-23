import { MODULE_ID } from "./package-identity.js";
import { AUTOMATION_RECIPES } from "./automation-contract.js";
import { AUTOMATION_PRODUCTION_TEMPLATES } from "./automation-templates.js";

const AUTOMATION_CAPABILITY_SCHEMA_VERSION = "1.0";
const KNOWN_MODULES = Object.freeze([
  "midi-qol",
  "dae",
  "itemacro",
  "autoanimations",
  "sequencer",
  "ActiveAuras",
  "times-up",
  "automated-conditions-5e",
  "chris-premades",
  "dnd5e-animations",
  "lib-wrapper",
  "socketlib"
]);
const AUTOMATION_LAYER_REQUIREMENTS = Object.freeze({
  conditionOnHit: Object.freeze({
    layer: "Midi-QOL + Item Macro",
    dependencies: Object.freeze(["midi-qol", "itemacro"]),
    settings: Object.freeze(["midiQolAutomation", "itemMacroAutomation"]),
    fallback: "DND5e core attack and review note"
  }),
  selfTargetLight: Object.freeze({
    layer: "Item Macro",
    dependencies: Object.freeze(["itemacro"]),
    settings: Object.freeze(["itemMacroAutomation"]),
    fallback: "DND5e core item with manual light review"
  }),
  multiActivityResource: Object.freeze({
    layer: "DND5e core",
    dependencies: Object.freeze([]),
    settings: Object.freeze([]),
    fallback: "DND5e core"
  }),
  daeTransferEffect: Object.freeze({
    layer: "Dynamic Active Effects",
    dependencies: Object.freeze(["dae"]),
    settings: Object.freeze(["daeAutomation"]),
    fallback: "DND5e core effect with manual review"
  }),
  animationVisual: Object.freeze({
    layer: "Automated Animations + Sequencer",
    dependencies: Object.freeze(["autoanimations", "sequencer"]),
    settings: Object.freeze([]),
    fallback: "DND5e core activity without a visual effect"
  })
});

const MODULE_LABELS = Object.freeze({
  "midi-qol": "Midi-QOL",
  dae: "DAE",
  itemacro: "Item Macro",
  autoanimations: "Automated Animations",
  sequencer: "Sequencer",
  ActiveAuras: "Active Auras",
  "times-up": "Times Up",
  "automated-conditions-5e": "Automated Conditions 5e",
  "chris-premades": "Chris's Premades",
  "dnd5e-animations": "D&D5e Animations",
  "lib-wrapper": "libWrapper",
  socketlib: "socketlib"
});

const CAPABILITY_HOOKS = Object.freeze([
  "dnd5e.preUseActivity",
  "midi-qol.RollComplete",
  "midi-qol.preCheckHits",
  "midi-qol.preDamageRoll",
  "midi-qol.postActiveEffects",
  "applyActiveEffect",
  "createActiveEffect"
]);

const MIDI_SETTING_KEYS = Object.freeze([
  "enableWorkflow",
  "autoApplyDamage",
  "gmAutoDamage",
  "autoRollDamage",
  "autoCheckSaves",
  "doConcentrationCheck",
  "reactionTimeout"
]);

function moduleInfo(game, id) {
  const module = game?.modules?.get?.(id);
  return {
    id,
    title: String(module?.title ?? MODULE_LABELS[id] ?? id),
    active: module?.active === true,
    version: String(module?.version ?? ""),
    compatibility: module?.compatibility ? {
      minimum: String(module.compatibility.minimum ?? ""),
      verified: String(module.compatibility.verified ?? ""),
      maximum: String(module.compatibility.maximum ?? "")
    } : null,
    requires: Array.isArray(module?.relationships?.requires)
      ? module.relationships.requires.map(requirement => String(requirement?.id ?? requirement)).filter(Boolean)
      : []
  };
}

function foundryMajor(version) {
  const major = Number.parseInt(String(version ?? "").split(".")[0], 10);
  return Number.isFinite(major) ? major : 0;
}

function runtimeActivityTypes(runtime = globalThis) {
  return Object.keys(runtime?.CONFIG?.DND5E?.activityTypes ?? {}).sort();
}

function runtimeHookNames(runtime = globalThis) {
  const events = runtime?.Hooks?.events;
  const names = events instanceof Map ? [...events.keys()] : Object.keys(events ?? {});
  return CAPABILITY_HOOKS.filter(name => names.includes(name));
}

function runtimeMidiSettings(runtime = globalThis) {
  let settings;
  try {
    settings = runtime?.MidiQOL?.configSettings?.();
  } catch {
    settings = null;
  }
  if (!settings || typeof settings !== "object") return {};
  return Object.fromEntries(MIDI_SETTING_KEYS
    .filter(key => settings[key] !== undefined && ["boolean", "number", "string"].includes(typeof settings[key]))
    .map(key => [key, settings[key]]));
}

function resolveAutomationRoute(contractOrRecipe, snapshot = {}) {
  snapshot = snapshot ?? {};
  const hasCapabilitySnapshot = Array.isArray(snapshot.activeModules)
    || Array.isArray(snapshot.modules)
    || Boolean(snapshot.settings)
    || Array.isArray(snapshot.supportedRecipes);
  if (!hasCapabilitySnapshot) return null;
  const recipe = typeof contractOrRecipe === "string"
    ? contractOrRecipe
    : String(contractOrRecipe?.recipe ?? "").trim();
  const requirement = AUTOMATION_LAYER_REQUIREMENTS[recipe];
  if (!requirement) return null;

  const activeModules = new Set(snapshot.activeModules ?? []);
  const moduleRecords = new Map((snapshot.modules ?? []).map(module => [module.id, module]));
  const missingModules = requirement.dependencies.filter(id => {
    const record = moduleRecords.get(id);
    return !(activeModules.has(id) || record?.active === true) || (record && !String(record.version ?? "").trim());
  });
  const settings = snapshot.settings ?? {};
  const missingSettings = requirement.settings.filter(setting => settings[setting] !== true);
  const available = missingModules.length === 0 && missingSettings.length === 0;
  const dependencyLabels = requirement.dependencies.map(id => MODULE_LABELS[id] ?? id);
  const dependencyStates = requirement.dependencies.map(id => {
    const record = moduleRecords.get(id);
    return {
      id,
      label: MODULE_LABELS[id] ?? id,
      active: activeModules.has(id) || record?.active === true,
      installed: Boolean(record?.version),
      version: String(record?.version ?? "")
    };
  });
  const reasons = [
    ...missingModules.map(id => `${MODULE_LABELS[id] ?? id} is inactive or unverified`),
    ...missingSettings.map(setting => `${setting} is disabled`)
  ];

  return {
    recipe,
    layer: requirement.layer,
    selectedLayer: available ? requirement.layer : "DND5e core (fallback)",
    dependencies: [...requirement.dependencies],
    dependencyLabels,
    dependencyStates,
    available,
    status: available ? "available" : "fallback",
    fallback: requirement.fallback,
    missingModules,
    missingSettings,
    reason: available ? "The advertised layer is available in this world." : reasons.join("; ") || "The advertised layer is unavailable."
  };
}

function buildAutomationCapabilitySnapshot({ game = globalThis.game, moduleId = MODULE_ID, moduleVersion = "", config = {}, runtime = globalThis } = {}) {
  const modules = KNOWN_MODULES.map(id => moduleInfo(game, id));
  const activeModules = modules.filter(module => module.active).map(module => module.id);
  const midiQolAutomation = config.midiQolAutomation === true;
  const itemMacroAutomation = config.itemMacroAutomation === true;
  const daeAutomation = config.daeAutomation === true;
  const foundryVersion = String(game?.version ?? "");
  const disabledOnFoundry14 = foundryMajor(foundryVersion) >= 14;
  const warnings = [];
  if (disabledOnFoundry14 && activeModules.includes("ActiveAuras")) warnings.push("Active Auras is not part of the Foundry 14 automation baseline.");
  if (disabledOnFoundry14 && activeModules.includes("times-up")) warnings.push("Times Up is not part of the Foundry 14 automation baseline; use core durations or DAE.");

  const settings = {
    midiQolAutomation,
    itemMacroAutomation,
    daeAutomation,
    authorizeGeneratedAutomation: config.authorizeGeneratedAutomation === true
  };
  const capabilitySeed = { modules, activeModules, settings };
  const routes = AUTOMATION_RECIPES.map(recipe => resolveAutomationRoute(recipe, capabilitySeed));
  const productionRecipes = new Set(AUTOMATION_PRODUCTION_TEMPLATES.flatMap(template => template.recipes));
  const supportedRecipes = routes
    .filter(route => route.available && productionRecipes.has(route.recipe))
    .map(route => route.recipe);
  const supportedTemplates = AUTOMATION_PRODUCTION_TEMPLATES
    .filter(template => template.recipes.every(recipe => supportedRecipes.includes(recipe)))
    .map(template => template.id);
  const context = {
    version: AUTOMATION_CAPABILITY_SCHEMA_VERSION,
    supportedRecipes,
    supportedTemplates,
    activeModules,
    settings,
    routes
  };
  const runtimeEvidence = {
    activityTypes: runtimeActivityTypes(runtime),
    hooks: runtimeHookNames(runtime),
    midiQolSettings: runtimeMidiSettings(runtime)
  };
  return {
    version: AUTOMATION_CAPABILITY_SCHEMA_VERSION,
    foundryVersion,
    systemId: String(game?.system?.id ?? "dnd5e"),
    systemVersion: String(game?.system?.version ?? ""),
    moduleVersion: String(moduleVersion),
    modules,
    supportedRecipes,
    supportedTemplates,
    routes,
    activeModules,
    settings,
    warnings,
    runtime: runtimeEvidence,
    providerContext: context,
    moduleId
  };
}

export {
  AUTOMATION_CAPABILITY_SCHEMA_VERSION,
  AUTOMATION_LAYER_REQUIREMENTS,
  CAPABILITY_HOOKS,
  buildAutomationCapabilitySnapshot,
  resolveAutomationRoute,
  runtimeActivityTypes,
  runtimeHookNames,
  runtimeMidiSettings
};
