import { SERVICE_NAME, SERVICE_VERSION } from "./constants.mjs";
import { ServiceError } from "./errors.mjs";

function buildFreeTierDeploymentReport(config, quotaStorage) {
  if (!config.publicFreeTier) {
    throw new ServiceError(500, "invalid_configuration", "Free-tier deployment preflight requires DMF_PUBLIC_FREE_TIER=true.");
  }
  return {
    ready: quotaStorage?.kind === "sqlite" && quotaStorage?.durable === true,
    service: { name: SERVICE_NAME, version: SERVICE_VERSION },
    listener: { host: config.host, port: config.port },
    access: {
      publicFreeTier: true,
      wildcardOrigins: config.allowedOrigins.includes("*"),
      trustProxy: config.trustProxy
    },
    quotas: {
      perMinute: config.rateLimitPerMinute,
      perClientDay: config.clientDailyLimit,
      perClientMonth: config.clientMonthlyLimit,
      globalPerDay: config.globalDailyLimit,
      storage: quotaStorage
    },
    provider: {
      mode: config.mode,
      model: config.defaultModel,
      allowedModels: [...config.allowedModels],
      serverKeyConfigured: Boolean(config.openaiApiKey)
    }
  };
}

export { buildFreeTierDeploymentReport };
