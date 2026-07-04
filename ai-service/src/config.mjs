import { ServiceError } from "./errors.mjs";
import { MAX_SPECS_PER_REQUEST } from "./constants.mjs";

function list(value, fallback = []) {
  const entries = String(value ?? "")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
  return entries.length ? entries : [...fallback];
}

function integer(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function flag(value, fallback = false) {
  if (value == null || String(value).trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function baseUrl(value) {
  const normalized = String(value ?? "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new ServiceError(500, "invalid_configuration", "OPENAI_BASE_URL must be a valid URL.");
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new ServiceError(500, "invalid_configuration", "OPENAI_BASE_URL must use HTTPS unless it targets loopback development.");
  }
  return normalized;
}

function loadConfig(env = process.env) {
  const mode = String(env.DMF_AI_MODE ?? "mock").trim().toLowerCase();
  if (!new Set(["mock", "openai"]).has(mode)) {
    throw new ServiceError(500, "invalid_configuration", "DMF_AI_MODE must be mock or openai.");
  }

  const defaultModel = String(env.OPENAI_MODEL ?? "gpt-5.4-mini").trim();
  const allowedModels = list(env.DMF_ALLOWED_MODELS, [defaultModel]);
  if (!allowedModels.includes(defaultModel)) allowedModels.unshift(defaultModel);

  const publicFreeTier = flag(env.DMF_PUBLIC_FREE_TIER, false);
  const config = {
    host: String(env.DMF_HOST ?? "127.0.0.1").trim(),
    port: integer(env.DMF_PORT, 8787, { min: 0, max: 65535 }),
    mode,
    allowedOrigins: list(env.DMF_ALLOWED_ORIGINS, ["http://localhost:30000", "http://127.0.0.1:30000"]),
    clientToken: String(env.DMF_CLIENT_TOKEN ?? ""),
    publicFreeTier,
    trustProxy: flag(env.DMF_TRUST_PROXY, false),
    rateLimitPerMinute: integer(env.DMF_RATE_LIMIT_PER_MINUTE, 20, { min: 1, max: 10000 }),
    clientDailyLimit: integer(env.DMF_CLIENT_DAILY_LIMIT, 0, { min: 0, max: 100000 }),
    clientMonthlyLimit: integer(env.DMF_CLIENT_MONTHLY_LIMIT, publicFreeTier ? 20 : 0, { min: 0, max: 100000 }),
    globalDailyLimit: integer(env.DMF_GLOBAL_DAILY_LIMIT, publicFreeTier ? 100 : 0, { min: 0, max: 1000000 }),
    quotaDatabasePath: String(env.DMF_QUOTA_DATABASE_PATH ?? (publicFreeTier ? "./data/free-tier-quota.sqlite" : ":memory:")).trim(),
    quotaHashSecret: String(env.DMF_QUOTA_HASH_SECRET ?? ""),
    errorReportsEnabled: flag(env.DMF_ERROR_REPORTS_ENABLED, publicFreeTier),
    errorReportPath: String(env.DMF_ERROR_REPORT_PATH ?? "./data/error-reports.jsonl").trim(),
    maxConcurrentCompilations: integer(env.DMF_MAX_CONCURRENT_COMPILATIONS, 2, { min: 1, max: 100 }),
    maxQueuedCompilations: integer(env.DMF_MAX_QUEUED_COMPILATIONS, 20, { min: 0, max: 1000 }),
    cacheTtlMs: integer(env.DMF_CACHE_TTL_MS, 300000, { min: 0, max: 86400000 }),
    cacheMaxEntries: integer(env.DMF_CACHE_MAX_ENTRIES, 100, { min: 0, max: 10000 }),
    maxRequestChars: integer(env.DMF_MAX_REQUEST_CHARS, 20000, { min: 100, max: 100000 }),
    maxItemsPerRequest: integer(env.DMF_MAX_ITEMS_PER_REQUEST, 10, { min: 1, max: MAX_SPECS_PER_REQUEST }),
    bodyLimitBytes: integer(env.DMF_BODY_LIMIT_BYTES, 131072, { min: 1024, max: 1048576 }),
    openaiApiKey: String(env.OPENAI_API_KEY ?? ""),
    openaiBaseUrl: baseUrl(env.OPENAI_BASE_URL),
    defaultModel,
    allowedModels,
    openaiTimeoutMs: integer(env.DMF_OPENAI_TIMEOUT_MS, 90000, { min: 1000, max: 600000 }),
    maxOutputTokens: integer(env.DMF_MAX_OUTPUT_TOKENS, 12000, { min: 256, max: 128000 })
  };

  config.allowClientApiKeyFallback = mode === "openai" && !config.openaiApiKey;
  if (config.publicFreeTier) {
    if (config.mode !== "openai" || !config.openaiApiKey) {
      throw new ServiceError(500, "invalid_configuration", "Public free-tier mode requires OpenAI mode and a server-side OPENAI_API_KEY.");
    }
    if (config.clientToken) {
      throw new ServiceError(500, "invalid_configuration", "Public free-tier mode must not require a shared DMF_CLIENT_TOKEN.");
    }
    if (!config.allowedOrigins.includes("*")) {
      throw new ServiceError(500, "invalid_configuration", "Public free-tier mode requires DMF_ALLOWED_ORIGINS=* so downloaded Foundry installations can connect.");
    }
    if (config.clientMonthlyLimit < 1 || config.globalDailyLimit < 1) {
      throw new ServiceError(500, "invalid_configuration", "Public free-tier mode requires positive client monthly and global daily limits.");
    }
    if (!config.quotaDatabasePath || config.quotaDatabasePath === ":memory:") {
      throw new ServiceError(500, "invalid_configuration", "Public free-tier mode requires a durable DMF_QUOTA_DATABASE_PATH.");
    }
    if (config.quotaHashSecret.length < 32) {
      throw new ServiceError(500, "invalid_configuration", "Public free-tier mode requires DMF_QUOTA_HASH_SECRET with at least 32 characters.");
    }
  }
  return config;
}

export { loadConfig };
