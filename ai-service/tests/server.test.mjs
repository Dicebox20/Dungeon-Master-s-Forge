import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createForgeServer } from "../src/server.mjs";
import { config, envelope } from "./helpers.mjs";
import { validSpecs } from "./fixtures/valid-specs.mjs";

async function runningServer(overrides = {}, options = {}) {
  const server = createForgeServer({
    config: config(overrides),
    logger: { info() {} },
    ...options
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections?.();
    })
  };
}

const origin = "http://10.0.0.26:30000";

test("health endpoint reports mock mode and allows configured Foundry origin", async t => {
  const app = await runningServer();
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/health`, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  const health = await response.json();
  assert.equal(health.mode, "mock");
  assert.equal(health.promptVersion, "1.0.0");
  assert.equal(health.access, "private");
  assert.deepEqual(health.quotaStorage, { kind: "disabled", durable: false });
  assert.deepEqual(health.compilation, { active: 0, queued: 0, maxConcurrent: 2, maxQueued: 20 });
  assert.deepEqual(health.requestLimits, { maxCharacters: 20000, maxItems: 10, perMinute: 20, perClientDay: 0, perClientMonth: 0, globalPerDay: 0 });
});

test("capabilities endpoint is read-only and does not invoke compilation", async t => {
  let calls = 0;
  const app = await runningServer({}, { compile: async () => { calls += 1; return {}; } });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/capabilities`, { headers: { Origin: origin } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.service.version, "1.6.0");
  assert.equal(body.forge.schemaVersion, "1.0");
  assert.equal(body.forge.supportedKinds.length, 14);
  assert.equal(body.features.hostedForge, false);
  assert.equal(calls, 0);
});

test("mock compile completes the Forge 1.0 contract", async t => {
  const app = await runningServer();
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer test-client-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(envelope())
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.schemaVersion, "1.0");
  assert.equal(body.specs[0].kind, "weaponExtraDamage");
  assert.match(body.compilerVersion, /^dmf-ai-service\//);
  assert.equal(response.headers.get("x-forge-cache"), "MISS");
});

test("duplicate compile requests are served from the result cache", async t => {
  let calls = 0;
  const compile = async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 0, specs: [] });
  const app = await runningServer({}, { compile: async payload => { calls += 1; return compile(payload); } });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer test-client-token", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  const first = await request();
  const second = await request();
  assert.equal(first.headers.get("x-forge-cache"), "MISS");
  assert.equal(second.headers.get("x-forge-cache"), "HIT");
  assert.equal(calls, 1);
});

test("wrong client tokens are rejected before compilation", async t => {
  const app = await runningServer();
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer wrong", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "unauthorized");
});

test("openai mode accepts a client-supplied key when no server key is configured", async t => {
  let seenRequestApiKey = "";
  const app = await runningServer({
    mode: "openai",
    openaiApiKey: "",
    clientToken: "",
    cacheTtlMs: 0
  }, {
    openaiAdapter: async (envelope, options) => {
      seenRequestApiKey = options.requestApiKey;
      return {
        specs: [{ ...validSpecs[0], name: "Client Key Blade" }],
        assumptions: [],
        warnings: [],
        deferred: []
      };
    }
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer client-openai-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).schemaVersion, "1.0");
  assert.equal(seenRequestApiKey, "client-openai-key");
});

test("openai HTTP compile normalizes pattern aliases before responding", async t => {
  const app = await runningServer({
    mode: "openai",
    openaiApiKey: "",
    clientToken: "",
    cacheTtlMs: 0
  }, {
    openaiAdapter: async () => ({
      specs: [{
        pattern: "weaponExtraDamage",
        name: "Pattern Blade",
        description: "A live HTTP alias test.",
        rarity: "uncommon",
        attunement: "",
        weaponType: "simpleM",
        baseItem: "dagger",
        properties: ["finesse", "light", "thrown", "magical"],
        damage: {
          base: { number: 1, denomination: "d4", bonus: "@mod", types: ["piercing"] },
          versatile: { number: null, denomination: null, bonus: "", types: [] }
        },
        range: { value: 20, long: 60, reach: 5, units: "ft" },
        mastery: "nick",
        extraDamageParts: [{ number: 1, denomination: "d4", bonus: "", types: ["fire"] }],
        attackName: "Pattern Strike"
      }],
      assumptions: [],
      warnings: [],
      deferred: []
    })
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer client-openai-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(envelope())
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.specs[0].kind, "weaponExtraDamage");
  assert.deepEqual(body.specs[0].properties, ["fin", "lgt", "thr", "mgc"]);
  assert.equal(body.specs[0].damage.base.denomination, 4);
  assert.equal(body.specs[0].extraDamageParts[0].denomination, 4);
});

test("openai client-key mode rejects missing bearer keys before compilation", async t => {
  let calls = 0;
  const app = await runningServer({
    mode: "openai",
    openaiApiKey: "",
    clientToken: ""
  }, {
    openaiAdapter: async () => {
      calls += 1;
      return { specs: [{ kind: "weaponExtraDamage", name: "Never Runs" }], assumptions: [], warnings: [], deferred: [] };
    }
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "missing_openai_key");
  assert.equal(calls, 0);
});

test("unconfigured browser origins are rejected", async t => {
  const app = await runningServer();
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/health`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "origin_not_allowed");
});

test("per-client rate limits return 429", async t => {
  const app = await runningServer({ clientToken: "", rateLimitPerMinute: 1 });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get("retry-after"), /^\d+$/);
  assert.equal(limited.headers.get("x-ratelimit-remaining"), "0");
});

test("public free-tier mode accepts anonymous requests and reports bounded quotas", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    clientDailyLimit: 2,
    clientMonthlyLimit: 20,
    globalDailyLimit: 3,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [] }) });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("x-dailylimit-limit"), "2");
  assert.equal(response.headers.get("x-monthlylimit-limit"), "20");
  assert.equal(response.headers.get("x-globaldailylimit-limit"), "3");
});

test("public free-tier mode enforces per-client daily limits behind a trusted proxy", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyLimit: 1,
    globalDailyLimit: 10,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [] }) });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": "203.0.113.9", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "daily_client_limit");
});

test("public free-tier mode enforces per-client monthly limits behind a trusted proxy", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyLimit: 10,
    clientMonthlyLimit: 1,
    globalDailyLimit: 10,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [] }) });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": "203.0.113.19", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("x-monthlylimit-remaining"), "0");
  assert.equal((await limited.json()).error.code, "monthly_client_limit");
});

test("public free-tier mode bypasses hosted quotas when a client provider key is supplied", async t => {
  let seenRequestApiKey = "";
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyLimit: 1,
    clientMonthlyLimit: 1,
    globalDailyLimit: 1,
    allowedOrigins: ["*"],
    cacheTtlMs: 0
  }, {
    openaiAdapter: async (_envelope, options) => {
      seenRequestApiKey = options.requestApiKey;
      return {
        specs: [{ ...validSpecs[0], name: "BYO Quota Bypass Blade" }],
        assumptions: [],
        warnings: [],
        deferred: []
      };
    }
  });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: "https://foundry.example",
      "X-Forwarded-For": "203.0.113.77",
      Authorization: "Bearer client-openai-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(envelope())
  });
  const first = await request();
  const second = await request();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(seenRequestApiKey, "client-openai-key");
  assert.equal(first.headers.get("x-monthlylimit-limit"), null);
  assert.equal(first.headers.get("x-dailylimit-limit"), null);
  assert.equal(first.headers.get("x-globaldailylimit-limit"), null);
});

test("public free-tier mode enforces a global daily spend ceiling", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyLimit: 10,
    globalDailyLimit: 1,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [] }) });
  t.after(app.close);
  const request = address => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": address, "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request("203.0.113.10")).status, 200);
  const limited = await request("203.0.113.11");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "daily_global_limit");
});

test("public free-tier HTTP quotas survive a service restart", async t => {
  const directory = mkdtempSync(join(tmpdir(), "dmf-http-quota-"));
  const databasePath = join(directory, "quota.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const overrides = {
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyLimit: 1,
    globalDailyLimit: 10,
    allowedOrigins: ["*"],
    quotaDatabasePath: databasePath
  };
  const options = { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [] }) };
  const request = baseUrl => fetch(`${baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": "203.0.113.50", "Content-Type": "application/json", Connection: "close" },
    body: JSON.stringify(envelope())
  });

  const first = await runningServer(overrides, options);
  const health = await fetch(`${first.baseUrl}/health`, { headers: { Origin: "https://foundry.example", Connection: "close" } });
  assert.deepEqual((await health.json()).quotaStorage, { kind: "sqlite", durable: true });
  assert.equal((await request(first.baseUrl)).status, 200);
  await first.close();

  const restarted = await runningServer(overrides, options);
  const limited = await request(restarted.baseUrl);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "daily_client_limit");
  await restarted.close();
});

test("legacy API compile path remains compatible", async t => {
  const app = await runningServer();
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/api/compile`, {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer test-client-token", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).schemaVersion, "1.0");
});

test("a full compilation queue returns a retryable service_busy error", async t => {
  let release;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const compile = () => new Promise(resolve => {
    release = resolve;
    markStarted();
  });
  const app = await runningServer({
    clientToken: "",
    cacheTtlMs: 0,
    maxConcurrentCompilations: 1,
    maxQueuedCompilations: 0
  }, { compile });
  t.after(app.close);
  const request = body => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(envelope({ request: body }))
  });
  const active = request("active request");
  await started;
  const overflow = await request("overflow request");
  assert.equal(overflow.status, 503);
  assert.equal(overflow.headers.get("retry-after"), "5");
  assert.equal((await overflow.json()).error.code, "service_busy");
  release({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 0, specs: [] });
  assert.equal((await active).status, 200);
});

test("oversized item batches are rejected before the adapter runs", async t => {
  let calls = 0;
  const app = await runningServer({ maxItemsPerRequest: 1 }, {
    mockAdapter: async () => { calls += 1; return { specs: [] }; }
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer test-client-token", "Content-Type": "application/json" },
    body: JSON.stringify(envelope({ request: "Item name: One\n\nItem name: Two" }))
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "item_batch_too_large");
  assert.equal(calls, 0);
});
