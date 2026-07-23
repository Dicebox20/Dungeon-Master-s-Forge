import { MODULE_ID } from "./package-identity.js";
import { AUTOMATION_RECIPES } from "./automation-contract.js";

const AUTOMATION_CAPABILITY_SCHEMA_VERSION = "1.0";
const KNOWN_MODULES = Object.freeze(["midi-qol", "dae", "itemacro", "autoanimations", "sequencer", "ActiveAuras", "times-up"]);
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
  sequencer: "Sequencer"
});

function moduleInfo(game, id) {
  const module = game?.modules?.get?.(id);
  return {
    id,
    active: module?.active === true,
    version: String(module?.version ?? "")
  };
}

function foundryMajor(version) {
  const major = Number.parseInt(String(version ?? "").split(".")[0], 10);
  return Number.isFinite(major) ? major : 0;
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
    available,
    status: available ? "available" : "fallback",
    fallback: requirement.fallback,
    missingModules,
    missingSettings,
    reason: available ? "The advertised layer is available in this world." : reasons.join("; ") || "The advertised layer is unavailable."
  };
}

function buildAutomationCapabilitySnapshot({ game = globalThis.game, moduleId = MODULE_ID, moduleVersion = "", config = {} } = {}) {
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
  const supportedRecipes = routes.filter(route => route.available).map(route => route.recipe);
  const context = {
    version: AUTOMATION_CAPABILITY_SCHEMA_VERSION,
    supportedRecipes,
    activeModules,
    settings,
    routes
  };
  return {
    version: AUTOMATION_CAPABILITY_SCHEMA_VERSION,
    foundryVersion,
    systemId: String(game?.system?.id ?? "dnd5e"),
    systemVersion: String(game?.system?.version ?? ""),
    moduleVersion: String(moduleVersion),
    modules,
    supportedRecipes,
    routes,
    activeModules,
    settings,
    warnings,
    providerContext: context,
    moduleId
  };
}

export { AUTOMATION_CAPABILITY_SCHEMA_VERSION, AUTOMATION_LAYER_REQUIREMENTS, buildAutomationCapabilitySnapshot, resolveAutomationRoute };
