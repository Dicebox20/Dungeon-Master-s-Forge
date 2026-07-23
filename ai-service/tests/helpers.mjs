import { KNOWN_SPEC_KINDS } from "../src/constants.mjs";

function config(overrides = {}) {
  return {
    host: "127.0.0.1",
    port: 0,
    mode: "mock",
    allowedOrigins: ["http://10.0.0.26:30000"],
    clientToken: "test-client-token",
    publicFreeTier: false,
    trustProxy: false,
    rateLimitPerMinute: 20,
    clientDailyUsageLimit: 0,
    clientMonthlyUsageLimit: 0,
    globalDailyUsageLimit: 0,
    paidEntitlementsEnabled: false,
    paidMonthlyUsageLimit: 1000000,
    paidEntitlementSecret: "test-paid-entitlement-secret-at-least-32-characters",
    quotaDatabasePath: ":memory:",
    quotaHashSecret: "test-quota-hash-secret-at-least-32-characters",
    errorReportsEnabled: false,
    errorReportPath: "./data/error-reports.jsonl",
    errorReportRetentionDays: 30,
    maxConcurrentCompilations: 2,
    maxQueuedCompilations: 20,
    cacheTtlMs: 300000,
    cacheMaxEntries: 100,
    maxRequestChars: 20000,
    maxItemsPerRequest: 10,
    bodyLimitBytes: 131072,
    openaiApiKey: "test-openai-key",
    openaiBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4-mini",
    allowedModels: ["gpt-5.4-mini"],
    openaiTimeoutMs: 1000,
    maxOutputTokens: 12000,
    ...overrides
  };
}

function envelope(overrides = {}) {
  return {
    schemaVersion: "1.0",
    request: "Mock Ember Blade\nCreate an uncommon longsword that deals 1d4 extra fire damage.",
    context: {
      foundryVersion: "14",
      systemId: "dnd5e",
      systemVersion: "5.3.3",
      moduleVersion: "2.15.0",
      supportedKinds: [...KNOWN_SPEC_KINDS]
    },
    options: { model: "", unresolvedPolicy: "review" },
    ...overrides
  };
}

export { config, envelope };
