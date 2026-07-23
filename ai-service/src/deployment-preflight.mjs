import { SERVICE_NAME, SERVICE_VERSION } from "./constants.mjs";
import { ServiceError } from "./errors.mjs";

function buildFreeTierDeploymentReport(config, quotaStorage) {
  if (!config.publicFreeTier) {
    throw new ServiceError(500, "invalid_configuration", "Free-tier deployment preflight requires DMF_PUBLIC_FREE_TIER=true.");
  }
  return {
    ready: quotaStorage?.kind === "sqlite-usage" && quotaStorage?.durable === true,
    service: { name: SERVICE_NAME, version: SERVICE_VERSION },
    listener: { host: config.host, port: config.port },
    access: {
      publicFreeTier: true,
      wildcardOrigins: config.allowedOrigins.includes("*"),
      trustProxy: config.trustProxy
    },
    usage: {
      perMinute: config.rateLimitPerMinute,
      perClientDay: config.clientDailyUsageLimit,
      perClientMonth: config.clientMonthlyUsageLimit,
      globalPerDay: config.globalDailyUsageLimit,
      unit: "provider-token-or-estimated-data",
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
