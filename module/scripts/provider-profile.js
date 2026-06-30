import {
  getProvider,
  normalizeProviderConfiguration,
  partitionProviderConfiguration,
  providerReadiness
} from "./providers.js";

const PROVIDER_PROFILE_SCHEMA_VERSION = "1.0";

function createProviderProfile(providerId, configuration = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);
  const partitioned = partitionProviderConfiguration(providerId, configuration);
  return {
    schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
    providerId: provider.id,
    configuration: partitioned.persisted
  };
}

function serializeProviderProfile(providerId, configuration = {}) {
  return JSON.stringify(createProviderProfile(providerId, configuration), null, 2);
}

function parseProviderProfile(input) {
  let profile;
  try {
    profile = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw new Error("Provider profile must be valid JSON.");
  }

  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("Provider profile must be a JSON object.");
  }
  if (profile.schemaVersion !== PROVIDER_PROFILE_SCHEMA_VERSION) {
    throw new Error(`Provider profile must use schema version ${PROVIDER_PROFILE_SCHEMA_VERSION}.`);
  }

  const provider = getProvider(profile.providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${profile.providerId}".`);
  if (!profile.configuration || typeof profile.configuration !== "object" || Array.isArray(profile.configuration)) {
    throw new Error("Provider profile configuration must be a JSON object.");
  }

  const fields = new Map(provider.configuration.map(field => [field.id, field]));
  for (const key of Object.keys(profile.configuration)) {
    const field = fields.get(key);
    if (!field) throw new Error(`Provider profile contains unknown configuration field "${key}".`);
    if (field.secret || field.persistence === "session") {
      throw new Error(`Provider profile cannot contain secret or session-only field "${key}".`);
    }
  }

  const normalized = normalizeProviderConfiguration(provider.id, profile.configuration);
  const partitioned = partitionProviderConfiguration(provider.id, normalized);
  return {
    schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
    providerId: provider.id,
    configuration: partitioned.persisted,
    readiness: providerReadiness(provider.id, normalized)
  };
}

export {
  PROVIDER_PROFILE_SCHEMA_VERSION,
  createProviderProfile,
  parseProviderProfile,
  serializeProviderProfile
};
