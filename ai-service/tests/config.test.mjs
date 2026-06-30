import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.mjs";

test("mock mode starts without an OpenAI key", () => {
  const result = loadConfig({ DMF_AI_MODE: "mock" });
  assert.equal(result.mode, "mock");
  assert.equal(result.defaultModel, "gpt-5.4-mini");
  assert.equal(result.host, "127.0.0.1");
});

test("openai mode requires a server-side key", () => {
  assert.throws(() => loadConfig({ DMF_AI_MODE: "openai" }), /OPENAI_API_KEY/);
});

test("configuration parses origin and model allowlists", () => {
  const result = loadConfig({
    DMF_AI_MODE: "openai",
    OPENAI_API_KEY: "secret",
    OPENAI_MODEL: "gpt-5.4-mini",
    DMF_ALLOWED_MODELS: "gpt-5.4-mini,gpt-5.5",
    DMF_ALLOWED_ORIGINS: "http://10.0.0.26:30000,http://localhost:30000"
  });
  assert.deepEqual(result.allowedModels, ["gpt-5.4-mini", "gpt-5.5"]);
  assert.deepEqual(result.allowedOrigins, ["http://10.0.0.26:30000", "http://localhost:30000"]);
});

test("result cache settings are bounded and can be disabled", () => {
  const disabled = loadConfig({ DMF_CACHE_TTL_MS: "0", DMF_CACHE_MAX_ENTRIES: "0" });
  assert.equal(disabled.cacheTtlMs, 0);
  assert.equal(disabled.cacheMaxEntries, 0);

  const bounded = loadConfig({ DMF_CACHE_TTL_MS: "999999999", DMF_CACHE_MAX_ENTRIES: "999999" });
  assert.equal(bounded.cacheTtlMs, 300000);
  assert.equal(bounded.cacheMaxEntries, 100);
});

test("compilation capacity settings are bounded", () => {
  const configured = loadConfig({
    DMF_MAX_CONCURRENT_COMPILATIONS: "4",
    DMF_MAX_QUEUED_COMPILATIONS: "0"
  });
  assert.equal(configured.maxConcurrentCompilations, 4);
  assert.equal(configured.maxQueuedCompilations, 0);

  const bounded = loadConfig({
    DMF_MAX_CONCURRENT_COMPILATIONS: "500",
    DMF_MAX_QUEUED_COMPILATIONS: "5000"
  });
  assert.equal(bounded.maxConcurrentCompilations, 2);
  assert.equal(bounded.maxQueuedCompilations, 20);
});

test("request complexity limits are configurable and bounded", () => {
  const configured = loadConfig({
    DMF_MAX_REQUEST_CHARS: "12000",
    DMF_MAX_ITEMS_PER_REQUEST: "6"
  });
  assert.equal(configured.maxRequestChars, 12000);
  assert.equal(configured.maxItemsPerRequest, 6);

  const bounded = loadConfig({
    DMF_MAX_REQUEST_CHARS: "1000000",
    DMF_MAX_ITEMS_PER_REQUEST: "21"
  });
  assert.equal(bounded.maxRequestChars, 20000);
  assert.equal(bounded.maxItemsPerRequest, 10);
});

test("non-loopback HTTP OpenAI base URLs are rejected", () => {
  assert.throws(() => loadConfig({ OPENAI_BASE_URL: "http://example.com/v1" }), /HTTPS/);
});
