import assert from "node:assert/strict";
import {
  REMOTE_PROVIDER_SCHEMA_VERSION,
  buildRemoteProviderRequest,
  capabilitiesEndpointFor,
  healthEndpointFor,
  reportEndpointFor,
  normalizeRemoteBridgeDescriptor,
  normalizeRemoteEndpoint,
  normalizeRemoteCapabilities,
  normalizeRemoteHealth,
  normalizeRemoteProviderResponse,
  remoteErrorDetail,
  remoteHttpError,
  redactProviderConfiguration,
  requestRemoteHealth,
  requestRemoteCapabilities,
  requestRemoteServiceStatus,
  requestRemoteCompilation
} from "../scripts/provider-contract.js";

assert.equal(normalizeRemoteEndpoint("https://forge.example/api/compile"), "https://forge.example/api/compile");
assert.equal(normalizeRemoteEndpoint("http://localhost:8787/compile"), "http://localhost:8787/compile");
assert.equal(normalizeRemoteEndpoint("http://10.0.0.26:8787/v1/forge/compile"), "http://10.0.0.26:8787/v1/forge/compile");
assert.equal(normalizeRemoteEndpoint("http://192.168.1.40:8787/compile"), "http://192.168.1.40:8787/compile");
assert.equal(normalizeRemoteEndpoint("http://100.91.178.55:8788/v1/forge/compile"), "http://100.91.178.55:8788/v1/forge/compile");
assert.equal(normalizeRemoteEndpoint("http://100.64.0.1:8788/compile"), "http://100.64.0.1:8788/compile");
assert.equal(normalizeRemoteEndpoint("http://100.127.255.254:8788/compile"), "http://100.127.255.254:8788/compile");
assert.throws(() => normalizeRemoteEndpoint("http://100.63.255.255:8788/compile"), /must use HTTPS/);
assert.throws(() => normalizeRemoteEndpoint("http://100.128.0.1:8788/compile"), /must use HTTPS/);
assert.throws(() => normalizeRemoteEndpoint("http://forge.example/compile"), /must use HTTPS/);
assert.throws(() => normalizeRemoteEndpoint("https://user:secret@forge.example/compile"), /credentials/);
assert.throws(() => normalizeRemoteEndpoint("https://forge.example/compile#secret"), /fragment/);
assert.equal(
  capabilitiesEndpointFor("https://forge.example/v1/forge/compile?ignored=true"),
  "https://forge.example/v1/forge/capabilities"
);
assert.equal(
  capabilitiesEndpointFor("https://forge.example/api/compile"),
  "https://forge.example/api/capabilities"
);
assert.equal(
  healthEndpointFor("https://forge.example/v1/forge/compile"),
  "https://forge.example/health"
);
assert.equal(
  healthEndpointFor("https://forge.example/api/compile?ignored=true"),
  "https://forge.example/health"
);
assert.equal(
  reportEndpointFor("https://forge.example/v1/forge/compile"),
  "https://forge.example/v1/forge/report-error"
);

assert.deepEqual(redactProviderConfiguration({
  endpoint: "https://forge.example/compile",
  apiKey: "abc123",
  nested: { access_token: "def456", model: "forge-model" },
  emptySecret: ""
}), {
  endpoint: "https://forge.example/compile",
  apiKey: "[redacted]",
  nested: { access_token: "[redacted]", model: "forge-model" },
  emptySecret: ""
});

const requestBody = buildRemoteProviderRequest("Create a fire dagger", {
  model: "forge-model",
  unresolvedPolicy: "block",
  context: {
    foundryVersion: "14.0",
    systemId: "dnd5e",
    systemVersion: "5.3.3",
    moduleVersion: "2.8.0",
    supportedKinds: ["weaponExtraDamage"],
    automationCapabilities: {
      version: "1.0",
      supportedRecipes: ["conditionOnHit"],
      activeModules: ["midi-qol", "itemacro"],
      settings: { midiQolAutomation: true, itemMacroAutomation: true }
    }
  }
});
assert.equal(requestBody.schemaVersion, REMOTE_PROVIDER_SCHEMA_VERSION);
assert.equal(requestBody.options.unresolvedPolicy, "block");
assert.equal(requestBody.context.systemId, "dnd5e");
assert.equal(requestBody.context.automationCapabilities.supportedRecipes[0], "conditionOnHit");
assert.equal(JSON.stringify(requestBody).includes("token"), false);

const repairRequestBody = buildRemoteProviderRequest("Create a fire dagger", {
  requestMode: "repair-attempt",
  repair: {
    parentRequestId: "repair-parent-01",
    attempt: 1,
    originalRequest: "Create a fire dagger",
    repairNotes: "Keep the weapon and correct the light toggle review note.",
    currentReviewedSpecs: [{ kind: "weaponExtraDamage", name: "Remote Ember Dagger" }]
  }
});
assert.equal(repairRequestBody.requestMode, "repair-attempt");
assert.equal(repairRequestBody.repair.attempt, 1);
assert.equal(repairRequestBody.repair.parentRequestId, "repair-parent-01");

const normalizedRepairRequestBody = buildRemoteProviderRequest("Layered brief from a second normalization pass", {
  requestMode: "repair-attempt",
  repair: {
    parentRequestId: "repair-parent-02",
    attempt: 1,
    originalRequest: "Layered brief retained with the reviewed result",
    repairNotes: "Preserve the reviewed mechanics.",
    currentReviewedSpecs: [{ kind: "weaponExtraDamage", name: "Remote Ember Dagger" }]
  }
});
assert.equal(normalizedRepairRequestBody.request, normalizedRepairRequestBody.repair.originalRequest);

const validPayload = {
  schemaVersion: REMOTE_PROVIDER_SCHEMA_VERSION,
  compilerVersion: "remote-test",
  promptVersion: "1.0.0",
  preparedSpecFingerprint: "SHA256:0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
  request: "Create a fire dagger",
  requestCount: 1,
  specs: [{ kind: "weaponExtraDamage", name: "Remote Ember Dagger" }],
  assumptions: [],
  warnings: ["Review remote output."],
  deferred: []
};
const normalized = normalizeRemoteProviderResponse(validPayload, { id: "bring-your-own", label: "Bring Your Own API" });
assert.equal(normalized.provider, "bring-your-own");
assert.equal(normalized.providerMode, "network");
assert.equal(normalized.promptVersion, "1.0.0");
assert.equal(normalized.preparedSpecFingerprint, "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
assert.deepEqual(normalized.decisions, [{
  name: "Remote Ember Dagger",
  pattern: "weaponExtraDamage",
  unresolvedCount: 0
}]);

let capturedRequest;
const fetchImpl = async (url, init) => {
  capturedRequest = { url, init };
  return { ok: true, status: 200, json: async () => validPayload };
};
const remoteResult = await requestRemoteCompilation({
  endpoint: "https://forge.example/api/compile",
  token: "private-token",
  request: "Create a fire dagger",
  model: "forge-model",
  provider: { id: "bring-your-own", label: "Bring Your Own API" },
  fetchImpl
});
assert.equal(capturedRequest.init.method, "POST");
assert.equal(capturedRequest.init.headers.Authorization, "Bearer private-token");
assert.equal(capturedRequest.init.headers["Cache-Control"], undefined);
assert.equal(JSON.parse(capturedRequest.init.body).request, "Create a fire dagger");
assert.equal(JSON.stringify(remoteResult).includes("private-token"), false);
assert.equal(remoteResult.specs[0].name, "Remote Ember Dagger");

const meteredResult = await requestRemoteCompilation({
  endpoint: "https://forge.example/api/compile",
  request: "Create a metered fire dagger",
  provider: { id: "bring-your-own", label: "Bring Your Own API" },
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: {
      get(name) {
        const values = {
          "x-forge-usage-limit": "1000",
          "x-forge-usage-remaining": "250",
          "x-forge-usage-charged": "25",
          "x-forge-cache": "MISS"
        };
        return values[name.toLowerCase()] ?? null;
      }
    },
    json: async () => validPayload
  })
});
assert.deepEqual(meteredResult.usage.capacity, { limit: 1000, remaining: 250, percentRemaining: 25 });
assert.equal(meteredResult.usage.chargedUnits, 25);
assert.equal(meteredResult.usage.cacheStatus, "MISS");

await requestRemoteCompilation({
  endpoint: "https://forge.example/api/compile",
  token: "private-token",
  request: "Create a fresh fire dagger",
  model: "forge-model",
  provider: { id: "bring-your-own", label: "Bring Your Own API" },
  refreshCompletedCache: true,
  fetchImpl
});
assert.equal(capturedRequest.init.headers["Cache-Control"], "no-cache");

const invalidFingerprint = normalizeRemoteProviderResponse({
  ...validPayload,
  preparedSpecFingerprint: "not-a-fingerprint"
}, { id: "bring-your-own", label: "Bring Your Own API" });
assert.equal(invalidFingerprint.preparedSpecFingerprint, undefined);

const validCapabilities = {
  service: { name: "Test Forge", version: "1.0.0" },
  forge: {
    schemaVersion: "1.0",
    promptVersion: "1.0.0",
    supportedKinds: ["weaponExtraDamage", "nativeSummon"]
  },
  request: { maxCharacters: 20000, maxItems: 10 },
  features: {
    reviewBeforeCreation: true,
    declarativeModelOutputOnly: true,
    executableModelOutput: false,
    hostedForge: false
  }
};
const capabilities = normalizeRemoteCapabilities(validCapabilities, {
  supportedKinds: ["chargedHealing", "weaponExtraDamage"]
});
assert.equal(capabilities.status, "compatible");
assert.deepEqual(capabilities.compatibleKinds, ["weaponExtraDamage"]);
const validHealth = {
  status: "ok",
  service: "Dungeon Master's Forge AI Service",
  version: "1.1.0",
  promptVersion: "1.0.0",
  mode: "openai",
  requestLimits: { perMinute: 20 }
};
const health = normalizeRemoteHealth(validHealth);
assert.equal(health.status, "ok");
assert.equal(health.service.name, "Dungeon Master's Forge AI Service");
assert.equal(health.service.version, "1.1.0");
assert.equal(health.mode, "openai");
const legacyBridge = normalizeRemoteBridgeDescriptor({
  ok: true,
  message: "Foundry AI bridge is running.",
  endpoint: "/api/compile"
}, {
  endpoint: "http://localhost:8787/api/compile"
});
assert.equal(legacyBridge.status, "legacy-bridge");
assert.equal(legacyBridge.service.name, "Foundry AI bridge is running.");
assert.equal(legacyBridge.bridge.endpoint, "/api/compile");
assert.throws(
  () => normalizeRemoteCapabilities(validCapabilities, { supportedKinds: ["chargedHealing"] }),
  /do not share/
);
assert.throws(
  () => normalizeRemoteCapabilities({ ...validCapabilities, forge: { ...validCapabilities.forge, schemaVersion: "2.0" } }),
  /unsupported Forge schema/
);
assert.throws(
  () => normalizeRemoteCapabilities({ ...validCapabilities, features: { executableModelOutput: true } }),
  /declarative-output safety policy/
);

let capabilityRequest;
const discovered = await requestRemoteCapabilities({
  endpoint: "https://forge.example/v1/forge/compile",
  token: "private-token",
  supportedKinds: ["weaponExtraDamage"],
  fetchImpl: async (url, init) => {
    capabilityRequest = { url, init };
    return { ok: true, status: 200, json: async () => validCapabilities };
  }
});
assert.equal(capabilityRequest.url, "https://forge.example/v1/forge/capabilities");
assert.equal(capabilityRequest.init.method, "GET");
assert.equal(capabilityRequest.init.headers.Authorization, "Bearer private-token");
assert.deepEqual(discovered.compatibleKinds, ["weaponExtraDamage"]);
let healthRequest;
const discoveredHealth = await requestRemoteHealth({
  endpoint: "https://forge.example/v1/forge/compile",
  token: "private-token",
  fetchImpl: async (url, init) => {
    healthRequest = { url, init };
    return { ok: true, status: 200, json: async () => validHealth };
  }
});
assert.equal(healthRequest.url, "https://forge.example/health");
assert.equal(healthRequest.init.method, "GET");
assert.equal(healthRequest.init.headers.Authorization, "Bearer private-token");
assert.equal(discoveredHealth.mode, "openai");
let serviceStatusRequests = [];
const serviceStatus = await requestRemoteServiceStatus({
  endpoint: "https://forge.example/v1/forge/compile",
  token: "private-token",
  supportedKinds: ["weaponExtraDamage"],
  fetchImpl: async (url, init) => {
    serviceStatusRequests.push({ url, init });
    if (url === "https://forge.example/health") {
      return { ok: true, status: 200, json: async () => validHealth };
    }
    if (url === "https://forge.example/v1/forge/capabilities") {
      return { ok: true, status: 200, json: async () => validCapabilities };
    }
    throw new Error(`Unexpected URL ${url}`);
  }
});
assert.deepEqual(serviceStatusRequests.map(request => request.url), [
  "https://forge.example/health",
  "https://forge.example/v1/forge/capabilities"
]);
assert.equal(serviceStatus.health.mode, "openai");
assert.deepEqual(serviceStatus.capabilities.compatibleKinds, ["weaponExtraDamage"]);

const legacyDiscovery = await requestRemoteCapabilities({
  endpoint: "https://forge.example/v1/forge/compile",
  supportedKinds: ["weaponExtraDamage"],
  fetchImpl: async () => ({ ok: false, status: 404 })
});
assert.equal(legacyDiscovery.status, "not-supported");
assert.deepEqual(legacyDiscovery.compatibleKinds, ["weaponExtraDamage"]);
const legacyHealth = await requestRemoteHealth({
  endpoint: "https://forge.example/v1/forge/compile",
  fetchImpl: async () => ({ ok: false, status: 404 })
});
assert.equal(legacyHealth.status, "not-supported");
let bridgeHealthRequests = [];
const discoveredBridgeHealth = await requestRemoteHealth({
  endpoint: "http://localhost:8787/api/compile",
  fetchImpl: async (url, init) => {
    bridgeHealthRequests.push({ url, init });
    if (url === "http://localhost:8787/health") return { ok: false, status: 404 };
    if (url === "http://localhost:8787/") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, message: "Foundry AI bridge is running.", endpoint: "/api/compile" })
      };
    }
    throw new Error(`Unexpected URL ${url}`);
  }
});
assert.deepEqual(bridgeHealthRequests.map(request => request.url), [
  "http://localhost:8787/health",
  "http://localhost:8787/"
]);
assert.equal(discoveredBridgeHealth.status, "legacy-bridge");
assert.equal(discoveredBridgeHealth.service.name, "Foundry AI bridge is running.");
assert.equal(discoveredBridgeHealth.bridge.endpoint, "/api/compile");

const monthlyLimitError = remoteHttpError({
  status: 429,
  headers: {
    get(name) {
      return name?.toLowerCase() === "x-monthlylimit-limit" ? "20" : null;
    }
  }
}, "Remote provider", {
  error: {
    code: "monthly_client_limit",
    message: "This free-tier client has reached its monthly Forge AI limit."
  }
});
assert.match(monthlyLimitError.message, /monthly hosted usage allowance reached/i);
assert.match(monthlyLimitError.message, /20 usage units/i);

const dailyGlobalLimitError = remoteHttpError({
  status: 429,
  headers: {
    get(name) {
      return name?.toLowerCase() === "x-globaldailylimit-limit" ? "50" : null;
    }
  }
}, "Remote provider", {
  error: {
    code: "daily_global_limit",
    message: "The Dungeon Master's Forge free-tier daily allowance has been reached."
  }
});
assert.match(dailyGlobalLimitError.message, /shared hosted usage safeguard reached/i);
assert.match(dailyGlobalLimitError.message, /50 usage units/i);

const usageLimitError = remoteHttpError({
  status: 429,
  headers: {
    get(name) {
      return name?.toLowerCase() === "x-forge-usage-limit" ? "1000000" : null;
    }
  }
}, "Remote provider", {
  error: {
    code: "monthly_client_usage_limit",
    message: "This Free Forge client has reached its monthly hosted usage allowance."
  }
});
assert.match(usageLimitError.message, /monthly hosted usage allowance reached/i);
assert.match(usageLimitError.message, /1000000 usage units/i);

assert.throws(
  () => normalizeRemoteProviderResponse({ schemaVersion: REMOTE_PROVIDER_SCHEMA_VERSION, specs: [] }),
  /non-empty specs array/
);
assert.throws(
  () => normalizeRemoteProviderResponse({ schemaVersion: "0", specs: [{ kind: "x", name: "y" }] }),
  /schema version/
);
await assert.rejects(
  requestRemoteCompilation({
    endpoint: "https://forge.example/api/compile",
    request: "Create a dagger",
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      headers: { get: name => name.toLowerCase() === "retry-after" ? "12" : null }
    })
  }),
  /HTTP 429.*12 seconds/
);
await assert.rejects(
  requestRemoteCompilation({
    endpoint: "https://forge.example/api/compile",
    request: "Create a dagger",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      headers: { get: () => null },
      json: async () => ({
        error: {
          code: "invalid_model_output",
          message: "The generated damage activity was incomplete.",
          requestId: "request-123"
        }
      })
    })
  }),
  /damage activity was incomplete.*invalid_model_output.*request request-123.*HTTP 502/
);
assert.deepEqual(remoteErrorDetail({
  error: { code: "bad<code>", message: "Bad\noutput<script>", requestId: "id-1" }
}), {
  code: "bad code",
  message: "Bad output script",
  requestId: "id-1"
});
await assert.rejects(
  requestRemoteCompilation({
    endpoint: "https://forge.example/api/compile",
    request: "Create a dagger",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } })
  }),
  /invalid JSON/
);
await assert.rejects(
  requestRemoteHealth({
    endpoint: "https://forge.example/api/compile",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: "degraded" }) })
  }),
  /reported status/
);

export const testedRemoteContractCases = 42;
