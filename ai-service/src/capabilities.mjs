import {
  FORGE_SCHEMA_VERSION,
  KNOWN_SPEC_KINDS,
  PROMPT_VERSION,
  SERVICE_NAME,
  SERVICE_VERSION
} from "./constants.mjs";

function serviceCapabilities(config) {
  return {
    service: {
      name: SERVICE_NAME,
      version: SERVICE_VERSION
    },
    forge: {
      schemaVersion: FORGE_SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      supportedKinds: [...KNOWN_SPEC_KINDS]
    },
    request: {
      maxCharacters: config.maxRequestChars,
      maxItems: config.maxItemsPerRequest,
      unresolvedPolicies: ["review", "block"]
    },
    features: {
      batch: true,
      reviewBeforeCreation: true,
      declarativeModelOutputOnly: true,
      executableModelOutput: false,
      hostedForge: config.publicFreeTier === true,
      publicFreeTier: config.publicFreeTier === true
    }
  };
}

export { serviceCapabilities };
