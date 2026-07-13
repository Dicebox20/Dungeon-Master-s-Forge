import { compileItemRequest } from "./request-compiler.js";
import { requestRemoteCapabilities, requestRemoteCompilation } from "./provider-contract.js";
import { HOSTED_FORGE_RELEASE_CONFIG, normalizeHostedReleaseConfig } from "./hosted-release-config.js";
import { normalizeItemRequest } from "./request-normalization.js";

const LOCAL_PROVIDER_ID = "local-rules";
const HOSTED_PROVIDER_ID = "hosted-forge";
const HOSTED_RELEASE = normalizeHostedReleaseConfig(HOSTED_FORGE_RELEASE_CONFIG);
const DEFAULT_PROVIDER_ID = HOSTED_RELEASE.enabled ? HOSTED_PROVIDER_ID : LOCAL_PROVIDER_ID;
const SUPPORTED_SPEC_KINDS = Object.freeze([
  "artifactWeaponHybrid",
  "casterUtilityEquipment",
  "chargedHealing",
  "chargedSaveDamage",
  "equipmentPowerSuite",
  "legendaryEquipmentSuite",
  "multiActivityStaff",
  "nativeEnchant",
  "nativeMultiProfileSummon",
  "nativeSummon",
  "passiveEffectEquipment",
  "shieldArmorBonus",
  "weaponConditionOnHit",
  "weaponExtraDamage"
]);

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: LOCAL_PROVIDER_ID,
    label: "Local Rules",
    mode: "offline",
    available: true,
    configuration: Object.freeze([
      Object.freeze({
        id: "unresolvedPolicy",
        label: "Unresolved mechanics",
        type: "select",
        default: "review",
        persistence: "client",
        secret: false,
        options: Object.freeze([
          Object.freeze({ value: "review", label: "Allow after review" }),
          Object.freeze({ value: "block", label: "Block item creation" })
        ])
      })
    ])
  }),
  Object.freeze({
    id: "bring-your-own",
    label: "Bring Your Own API",
    mode: "network",
    available: true,
    configuration: Object.freeze([
      Object.freeze({
        id: "endpoint",
        label: "Endpoint",
        type: "url",
        default: "",
        persistence: "client",
        secret: false,
        required: true
      }),
      Object.freeze({
        id: "model",
        label: "Model",
        type: "text",
        default: "",
        persistence: "client",
        secret: false,
        required: false
      }),
      Object.freeze({
        id: "apiToken",
        label: "API token",
        type: "password",
        default: "",
        persistence: "session",
        secret: true,
        required: false
      }),
      Object.freeze({
        id: "unresolvedPolicy",
        label: "Unresolved mechanics",
        type: "select",
        default: "review",
        persistence: "client",
        secret: false,
        required: false,
        options: Object.freeze([
          Object.freeze({ value: "review", label: "Allow after review" }),
          Object.freeze({ value: "block", label: "Block item creation" })
        ])
      })
    ])
  }),
  Object.freeze({
    id: HOSTED_PROVIDER_ID,
    label: HOSTED_RELEASE.label,
    mode: "network",
    available: HOSTED_RELEASE.enabled,
    connection: Object.freeze({ endpoint: HOSTED_RELEASE.endpoint, model: HOSTED_RELEASE.model, apiToken: "" }),
    configuration: Object.freeze([
      Object.freeze({
        id: "unresolvedPolicy",
        label: "Unresolved mechanics",
        type: "select",
        default: "review",
        persistence: "client",
        secret: false,
        options: Object.freeze([
          Object.freeze({ value: "review", label: "Allow after review" }),
          Object.freeze({ value: "block", label: "Block item creation" })
        ])
      })
    ])
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listProviders() {
  return clone(PROVIDERS);
}

function getProvider(providerId = DEFAULT_PROVIDER_ID) {
  return PROVIDERS.find(provider => provider.id === providerId) ?? null;
}

function providerDefaults(providerId = DEFAULT_PROVIDER_ID) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);
  return Object.fromEntries(provider.configuration.map(field => [field.id, field.default]));
}

function normalizeProviderConfiguration(providerId, configuration = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);

  const normalized = providerDefaults(providerId);
  for (const field of provider.configuration) {
    const supplied = configuration[field.id];
    if (supplied == null) continue;
    if (field.type === "select" && !field.options.some(option => option.value === supplied)) {
      throw new Error(`Invalid ${field.label.toLowerCase()} value "${supplied}" for ${provider.label}.`);
    }
    normalized[field.id] = field.type === "select" ? supplied : String(supplied);
  }
  return normalized;
}

function partitionProviderConfiguration(providerId, configuration = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);
  const normalized = normalizeProviderConfiguration(providerId, configuration);
  const persisted = {};
  const session = {};
  const diagnostics = {};
  const secretFieldIds = [];

  for (const field of provider.configuration) {
    const value = normalized[field.id];
    const sessionOnly = field.persistence === "session" || field.secret;
    if (sessionOnly) session[field.id] = value;
    else persisted[field.id] = value;
    diagnostics[field.id] = field.secret && value ? "[redacted]" : value;
    if (field.secret) secretFieldIds.push(field.id);
  }

  return { persisted, session, diagnostics, secretFieldIds };
}

function providerReadiness(providerId, configuration = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);
  const normalized = normalizeProviderConfiguration(providerId, configuration);
  const missing = provider.configuration
    .filter(field => field.required && !String(normalized[field.id] ?? "").trim())
    .map(field => field.id);
  return {
    providerId: provider.id,
    available: provider.available,
    ready: provider.available && missing.length === 0,
    status: !provider.available ? "disabled" : missing.length ? "configuration-required" : "ready",
    missing
  };
}

function networkProviderConfiguration(providerId, configuration = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);
  if (provider.mode !== "network") throw new Error(`${provider.label} is not a network provider.`);
  const normalized = normalizeProviderConfiguration(providerId, configuration);
  if (provider.id === "bring-your-own") return normalized;
  return {
    endpoint: provider.connection?.endpoint ?? "",
    model: provider.connection?.model ?? "",
    apiToken: provider.connection?.apiToken ?? "",
    unresolvedPolicy: normalized.unresolvedPolicy
  };
}

async function compileWithProvider(request, options = {}) {
  const normalization = normalizeItemRequest(request);
  const compileRequest = normalization.normalizedRequest;
  const providerId = options.providerId ?? DEFAULT_PROVIDER_ID;
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown Forge provider "${providerId}".`);
  if (!provider.available) throw new Error(`${provider.label} is not available in this release.`);

  const configuration = normalizeProviderConfiguration(providerId, options.configuration);
  const readiness = providerReadiness(providerId, configuration);
  if (!readiness.ready) {
    const missing = readiness.missing.map(id => provider.configuration.find(field => field.id === id)?.label ?? id);
    throw new Error(`${provider.label} requires: ${missing.join(", ")}.`);
  }

  if (provider.mode === "network") {
    const partitioned = partitionProviderConfiguration(provider.id, configuration);
    const connection = networkProviderConfiguration(provider.id, configuration);
    const requestedKinds = options.context?.supportedKinds ?? SUPPORTED_SPEC_KINDS;
    const capabilities = options.preflightCapabilities
      ? await requestRemoteCapabilities({
        endpoint: connection.endpoint,
        token: connection.apiToken,
        supportedKinds: requestedKinds,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs
      })
      : null;
    const result = await requestRemoteCompilation({
      endpoint: connection.endpoint,
      model: connection.model,
      token: connection.apiToken,
      unresolvedPolicy: connection.unresolvedPolicy,
      request: compileRequest,
      context: {
        ...options.context,
        supportedKinds: capabilities?.compatibleKinds ?? requestedKinds
      },
      provider,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs
    });
    return {
      ...result,
      originalRequest: normalization.originalRequest,
      normalizedRequest: compileRequest,
      normalization,
      providerCapabilities: capabilities,
      providerConfiguration: {
        ...partitioned.diagnostics,
        ...(provider.id === HOSTED_PROVIDER_ID ? { endpoint: connection.endpoint, model: connection.model } : {})
      }
    };
  }

  if (provider.id !== LOCAL_PROVIDER_ID) {
    throw new Error(`${provider.label} does not have a compiler adapter.`);
  }

  return {
    ...compileItemRequest(compileRequest),
    originalRequest: normalization.originalRequest,
    normalizedRequest: compileRequest,
    normalization,
    provider: provider.id,
    providerLabel: provider.label,
    providerMode: provider.mode,
    providerConfiguration: configuration
  };
}

function mechanicsRequestForCompilation(compilation, fallback = "") {
  const candidates = [
    compilation?.originalRequest,
    fallback,
    compilation?.request,
    compilation?.normalizedRequest
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }
  return "";
}

export {
  DEFAULT_PROVIDER_ID,
  HOSTED_PROVIDER_ID,
  LOCAL_PROVIDER_ID,
  compileWithProvider,
  getProvider,
  listProviders,
  mechanicsRequestForCompilation,
  networkProviderConfiguration,
  normalizeProviderConfiguration,
  partitionProviderConfiguration,
  providerReadiness,
  providerDefaults,
  SUPPORTED_SPEC_KINDS
};
