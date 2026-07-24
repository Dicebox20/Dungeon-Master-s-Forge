import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createForgeServer } from "../src/server.mjs";
import { signPaidEntitlement } from "../src/paid-entitlement.mjs";
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
  assert.equal(health.promptVersion, "1.1.0");
  assert.equal(health.access, "private");
  assert.deepEqual(health.quotaStorage, { kind: "disabled", durable: false });
  assert.deepEqual(health.compilation, { active: 0, queued: 0, maxConcurrent: 2, maxQueued: 20 });
  assert.deepEqual(health.requestLimits, {
    maxCharacters: 20000,
    maxItems: 10,
    perMinute: 20,
    perClientDayUsage: 0,
    perClientMonthUsage: 0,
    globalPerDayUsage: 0,
    paidPerMonthUsage: 0
  });
});

test("capabilities endpoint is read-only and does not invoke compilation", async t => {
  let calls = 0;
  const app = await runningServer({}, { compile: async () => { calls += 1; return {}; } });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/capabilities`, { headers: { Origin: origin } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.service.version, "1.6.7");
  assert.equal(body.forge.schemaVersion, "1.0");
  assert.equal(body.forge.supportedKinds.length, 14);
  assert.equal(body.features.hostedForge, false);
  assert.equal(calls, 0);
});

test("error-report endpoint stores failed-item feedback with preview context when enabled", async t => {
  const entries = [];
  const app = await runningServer({
    errorReportsEnabled: true
  }, {
    errorReportStore: {
      async append(entry) {
        entries.push(entry);
        return true;
      }
    }
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/report-error`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer test-client-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      schemaVersion: "1.0",
      source: "dungeon-masters-forge-module",
      module: { id: "dungeon-masters-forge", version: "2.23.0-test.4" },
      environment: { foundryVersion: "14", systemId: "dnd5e", systemVersion: "5.3.3" },
      provider: { id: "hosted-forge", endpointHost: "forge.example", endpointPath: "/v1/forge/compile", unresolvedPolicy: "review" },
      error: { stage: "compile", name: "Error", message: "Remote provider\u0000 returned HTTP 502.\u0007" },
      items: [{ name: "Storm Blade", kind: "weaponExtraDamage", reviewState: "manual-review", notes: [{ state: "warning", label: "Warning", message: "Review charges." }] }],
      compilation: {
        providerLabel: "Bring Your Own API",
        providerMode: "network",
        normalizedRequest: "Create a storm blade.",
        decisions: [{ name: "Storm Blade", pattern: "weaponExtraDamage", unresolvedCount: 1 }],
        assumptions: ["Applied default leveled spell charges."],
        warnings: ["Spell prompt still defaulted to the base attack."],
        deferred: [],
        unresolvedCount: 1
      },
      feedback: {
        kind: "failed-item",
        userNote: "The preview looked fine, but the created item\u0000 always defaulted to the base attack.\u000b",
        desiredOutcome: "I wanted an action that casts Burning Hands from the item using its charges.",
        requestText: "Create a storm blade.",
        generatedSpecsJson: "[{\"name\":\"Storm Blade\"}]",
        statusMessage: "Created 1 item.",
        includedPreviewNotes: true
      }
    })
  });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).stored, true);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].module.id, "dungeon-masters-forge");
  assert.equal(entries[0].items[0].name, "Storm Blade");
  assert.equal(entries[0].feedback.kind, "failed-item");
  assert.match(entries[0].feedback.userNote, /defaulted to the base attack/i);
  assert.match(entries[0].feedback.desiredOutcome, /casts Burning Hands/i);
  assert.equal(entries[0].feedback.includedPreviewNotes, true);
  assert.equal(entries[0].error.message, "Remote provider returned HTTP 502.");
  assert.doesNotMatch(entries[0].feedback.userNote, /[\u0000-\u001f\u007f]/);
  assert.match(entries[0].feedback.userNote, /created item\s+always defaulted to the base attack/);
  assert.equal(entries[0].compilation.decisions[0].pattern, "weaponExtraDamage");
  assert.equal(Object.hasOwn(entries[0], "client"), false);
});

test("error-report endpoint returns a specific storage error when persistence fails", async t => {
  const app = await runningServer({ errorReportsEnabled: true }, {
    errorReportStore: {
      async append() {
        throw new Error("read-only report directory");
      }
    }
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/report-error`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer test-client-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      schemaVersion: "1.0",
      source: "dungeon-masters-forge-module",
      module: { id: "dungeon-masters-forge", version: "2.23.0-test.4" },
      error: { stage: "compile", message: "report test" },
      feedback: { kind: "failed-item", userNote: "report test" }
    })
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "report_storage_unavailable");
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

test("paid membership uses its own bounded monthly capacity bucket", async t => {
  const secret = "test-paid-entitlement-secret-at-least-32-characters";
  const app = await runningServer({
    clientMonthlyUsageLimit: 25,
    paidEntitlementsEnabled: true,
    paidMonthlyUsageLimit: 250,
    paidEntitlementSecret: secret
  });
  t.after(app.close);
  const token = signPaidEntitlement({
    sub: "opaque-member-001",
    tier: "supporter",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, secret);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer test-client-token",
      "Content-Type": "application/json",
      "X-Forge-Membership": token
    },
    body: JSON.stringify(envelope())
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(response.headers.get("x-forge-usage-tier"), "paid-capacity");
  assert.equal(response.headers.get("x-forge-usage-limit"), "250");
  assert.equal(body.usage.tier, "paid-capacity");
});

test("invalid paid membership tokens are rejected instead of falling back to free capacity", async t => {
  const app = await runningServer({
    paidEntitlementsEnabled: true,
    paidEntitlementSecret: "test-paid-entitlement-secret-at-least-32-characters"
  });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer test-client-token",
      "Content-Type": "application/json",
      "X-Forge-Membership": "not-a-valid-token"
    },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "invalid_membership");
});

test("repair attempts are explicit, bounded, and one-shot per reviewed result", async t => {
  const app = await runningServer();
  t.after(app.close);
  const request = envelope();
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer test-client-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      requestMode: "repair-attempt",
      repair: {
        parentRequestId: "repair-parent-01",
        attempt: 1,
        originalRequest: request.request,
        repairNotes: "Preserve the item and correct the reviewed light behavior.",
        currentReviewedSpecs: [{ kind: "weaponExtraDamage", name: "Repair Ember Blade" }],
        reviewNotes: [{ state: "notice", label: "Notice", message: "The light note is stale." }],
        deterministicFindings: ["toggleLight is present."],
        provenance: { providerLane: "bring-your-own" }
      }
    })
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.requestMode, "repair-attempt");

  const repeated = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer test-client-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      requestMode: "repair-attempt",
      repair: {
        parentRequestId: "repair-parent-01",
        attempt: 1,
        originalRequest: request.request,
        repairNotes: "Try the correction again.",
        currentReviewedSpecs: [{ kind: "weaponExtraDamage", name: "Repair Ember Blade" }]
      }
    })
  });
  assert.equal(repeated.status, 409);
  assert.equal((await repeated.json()).error.code, "repair_already_attempted");
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

test("CORS preflight permits negotiated completed-cache refresh requests", async t => {
  const app = await runningServer();
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, cache-control, content-type, x-forge-membership"
    }
  });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /Cache-Control/i);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /X-Forge-Membership/i);
});

test("no-cache compile requests refresh completed cached results", async t => {
  let calls = 0;
  const app = await runningServer({}, {
    compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 0, specs: [], call: ++calls })
  });
  t.after(app.close);
  const request = cacheControl => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer test-client-token",
      "Content-Type": "application/json",
      ...(cacheControl ? { "Cache-Control": cacheControl } : {})
    },
    body: JSON.stringify(envelope())
  });

  const first = await request();
  const refreshed = await request("no-cache");
  const replay = await request();
  assert.equal(first.headers.get("x-forge-cache"), "MISS");
  assert.equal(refreshed.headers.get("x-forge-cache"), "REFRESH");
  assert.equal(replay.headers.get("x-forge-cache"), "HIT");
  assert.equal((await refreshed.json()).call, 2);
  assert.equal((await replay.json()).call, 2);
  assert.equal(calls, 2);
});

test("completed cache hits do not consume hosted usage", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    clientMonthlyUsageLimit: 100,
    globalDailyUsageLimit: 1000,
    allowedOrigins: ["*"]
  }, {
    compile: async () => ({
      schemaVersion: "1.0",
      compilerVersion: "test",
      requestCount: 1,
      specs: [],
      providerUsage: { total_tokens: 25 }
    })
  });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  const first = await request();
  const second = await request();
  assert.match(first.headers.get("access-control-expose-headers"), /X-Forge-Usage-Remaining/);
  assert.equal(first.headers.get("x-forge-usage-charged"), "25");
  assert.equal(first.headers.get("x-forge-usage-remaining"), "75");
  assert.equal(second.headers.get("x-forge-cache"), "HIT");
  assert.equal(second.headers.get("x-forge-usage-charged"), "0");
  assert.equal(second.headers.get("x-forge-usage-remaining"), "75");
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
    clientDailyUsageLimit: 200,
    clientMonthlyUsageLimit: 2000,
    globalDailyUsageLimit: 3000,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [], providerUsage: { total_tokens: 10 } }) });
  t.after(app.close);
  const response = await fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("x-forge-usage-limit"), "2000");
  assert.equal(response.headers.get("x-forge-usage-charged"), "10");
});

test("public free-tier mode enforces per-client daily limits behind a trusted proxy", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyUsageLimit: 5,
    globalDailyUsageLimit: 100,
    cacheTtlMs: 0,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [], providerUsage: { total_tokens: 6 } }) });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": "203.0.113.9", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("x-forge-usage-limit"), "5");
  assert.equal(limited.headers.get("x-forge-usage-remaining"), "0");
  assert.equal((await limited.json()).error.code, "daily_client_usage_limit");
});

test("public free-tier mode enforces per-client monthly limits behind a trusted proxy", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyUsageLimit: 100,
    clientMonthlyUsageLimit: 5,
    globalDailyUsageLimit: 100,
    cacheTtlMs: 0,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [], providerUsage: { total_tokens: 6 } }) });
  t.after(app.close);
  const request = () => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": "203.0.113.19", "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("x-forge-usage-remaining"), "0");
  assert.equal((await limited.json()).error.code, "monthly_client_usage_limit");
});

test("public free-tier mode bypasses hosted quotas when a client provider key is supplied", async t => {
  let seenRequestApiKey = "";
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyUsageLimit: 1,
    clientMonthlyUsageLimit: 1,
    globalDailyUsageLimit: 1,
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
  assert.equal(first.headers.get("x-forge-usage-charged"), "0");
});

test("public free-tier mode enforces a global daily spend ceiling", async t => {
  const app = await runningServer({
    mode: "openai",
    publicFreeTier: true,
    clientToken: "",
    trustProxy: true,
    clientDailyUsageLimit: 100,
    globalDailyUsageLimit: 5,
    cacheTtlMs: 0,
    allowedOrigins: ["*"]
  }, { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [], providerUsage: { total_tokens: 6 } }) });
  t.after(app.close);
  const request = address => fetch(`${app.baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": address, "Content-Type": "application/json" },
    body: JSON.stringify(envelope())
  });
  assert.equal((await request("203.0.113.10")).status, 200);
  const limited = await request("203.0.113.11");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("x-forge-usage-limit"), "5");
  assert.equal(limited.headers.get("x-forge-usage-remaining"), "0");
  assert.equal((await limited.json()).error.code, "daily_global_usage_limit");
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
    clientDailyUsageLimit: 5,
    globalDailyUsageLimit: 100,
    cacheTtlMs: 0,
    allowedOrigins: ["*"],
    quotaDatabasePath: databasePath
  };
  const options = { compile: async () => ({ schemaVersion: "1.0", compilerVersion: "test", requestCount: 1, specs: [], providerUsage: { total_tokens: 6 } }) };
  const request = baseUrl => fetch(`${baseUrl}/v1/forge/compile`, {
    method: "POST",
    headers: { Origin: "https://foundry.example", "X-Forwarded-For": "203.0.113.50", "Content-Type": "application/json", Connection: "close" },
    body: JSON.stringify(envelope())
  });

  const first = await runningServer(overrides, options);
  const health = await fetch(`${first.baseUrl}/health`, { headers: { Origin: "https://foundry.example", Connection: "close" } });
  assert.deepEqual((await health.json()).quotaStorage, { kind: "sqlite-usage", durable: true });
  assert.equal((await request(first.baseUrl)).status, 200);
  await first.close();

  const restarted = await runningServer(overrides, options);
  const limited = await request(restarted.baseUrl);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "daily_client_usage_limit");
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
