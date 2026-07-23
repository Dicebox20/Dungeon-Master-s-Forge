import { MODULE_ID } from "./package-identity.js";
import { AUTOMATION_DEPENDENCIES, AUTOMATION_RECIPES } from "./automation-contract.js";

const AUTOMATION_CAPABILITY_SCHEMA_VERSION = "1.0";
const KNOWN_MODULES = Object.freeze(["midi-qol", "dae", "itemacro", "autoanimations", "sequencer", "ActiveAuras", "times-up"]);

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

function buildAutomationCapabilitySnapshot({ game = globalThis.game, moduleId = MODULE_ID, moduleVersion = "", config = {} } = {}) {
  const modules = KNOWN_MODULES.map(id => moduleInfo(game, id));
  const activeModules = modules.filter(module => module.active).map(module => module.id);
  const midiQolAutomation = config.midiQolAutomation === true;
  const itemMacroAutomation = config.itemMacroAutomation === true;
  const daeAutomation = config.daeAutomation === true;
  const foundryVersion = String(game?.version ?? "");
  const supportedRecipes = AUTOMATION_RECIPES.filter(recipe => {
    const dependencies = AUTOMATION_DEPENDENCIES[recipe] ?? [];
    if (recipe === "conditionOnHit" && (!midiQolAutomation || !itemMacroAutomation)) return false;
    if (recipe === "selfTargetLight" && !itemMacroAutomation) return false;
    return dependencies.every(id => activeModules.includes(id))
      && (recipe !== "daeTransferEffect" || daeAutomation);
  });
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
  const context = {
    version: AUTOMATION_CAPABILITY_SCHEMA_VERSION,
    supportedRecipes,
    activeModules,
    settings
  };
  return {
    version: AUTOMATION_CAPABILITY_SCHEMA_VERSION,
    foundryVersion,
    systemId: String(game?.system?.id ?? "dnd5e"),
    systemVersion: String(game?.system?.version ?? ""),
    moduleVersion: String(moduleVersion),
    modules,
    supportedRecipes,
    activeModules,
    settings,
    warnings,
    providerContext: context,
    moduleId
  };
}

export { AUTOMATION_CAPABILITY_SCHEMA_VERSION, buildAutomationCapabilitySnapshot };
