import {
  COMPOSITIONAL_CAPABILITIES,
  FORGE_SCHEMA_VERSION,
  KNOWN_SPEC_KINDS,
  PROMPT_VERSION,
  SERVICE_NAME,
  SERVICE_VERSION
} from "./constants.mjs";
import { AUTOMATION_CONTRACT_VERSION, AUTOMATION_RECIPES, AUTOMATION_ROUTES } from "./automation-contract.mjs";
import { AUTOMATION_TEMPLATE_VERSION, AUTOMATION_TEMPLATES } from "./automation-templates.mjs";

function serviceCapabilities(config) {
  return {
    service: {
      name: SERVICE_NAME,
      version: SERVICE_VERSION
    },
    forge: {
      schemaVersion: FORGE_SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      supportedKinds: [...KNOWN_SPEC_KINDS],
      kindRole: "compatibility-renderer",
      compositionalCapabilities: [...COMPOSITIONAL_CAPABILITIES],
      automationContract: {
        version: AUTOMATION_CONTRACT_VERSION,
        templateVersion: AUTOMATION_TEMPLATE_VERSION,
        declarativeOnly: true,
        recipes: AUTOMATION_RECIPES.filter(recipe => AUTOMATION_TEMPLATES.some(template => template.status === "production" && template.recipes.includes(recipe))),
        routes: AUTOMATION_ROUTES
          .filter(route => AUTOMATION_TEMPLATES.some(template => template.status === "production" && template.recipes.includes(route.recipe)))
          .map(route => ({ ...route })),
        templates: AUTOMATION_TEMPLATES.map(template => ({ ...template, capabilityIds: [...template.capabilityIds], recipes: [...template.recipes], fields: [...template.fields], requiredModules: [...template.requiredModules] })),
        workflowPasses: ["postActiveEffects", "activity"],
        targetSources: ["hitTargets", "failedSaves", "self", "selectedTargets"]
      },
      capabilityPolicy: "All safe declarative capabilities are available in Free Forge; capacity tiers meter hosted compute, not item mechanics."
    },
    request: {
      maxCharacters: config.maxRequestChars,
      maxItems: config.maxItemsPerRequest,
      unresolvedPolicies: ["review", "block"],
      cacheControlRefresh: true
    },
    features: {
      batch: true,
      reviewBeforeCreation: true,
      repairRerun: true,
      declarativeModelOutputOnly: true,
      executableModelOutput: false,
      hostedForge: config.publicFreeTier === true,
      publicFreeTier: config.publicFreeTier === true,
      paidCapacity: config.paidEntitlementsEnabled === true
    },
    metering: {
      model: "usage-units",
      cacheHitsCharged: false,
      clientProviderKeysCharged: false
    },
    capacity: {
      freeMonthlyUsage: config.clientMonthlyUsageLimit,
      paidEntitlementsEnabled: config.paidEntitlementsEnabled === true,
      paidMonthlyUsage: config.paidEntitlementsEnabled ? config.paidMonthlyUsageLimit : null
    }
  };
}

export { serviceCapabilities };
