import assert from "node:assert/strict";
import {
  REMOTE_PROVIDER_SCHEMA_VERSION,
  buildRemoteProviderRequest,
  capabilitiesEndpointFor,
  healthEndpointFor,
  normalizeRemoteBridgeDescriptor,
  normalizeRemoteEndpoint,
  normalizeRemoteCapabilities,
  normalizeRemoteHealth,
  normalizeRemoteProviderResponse,
  redactProviderConfiguration,
  requestRemoteHealth,
  requestRemoteCapabilities,
  requestRemoteCompilation
} from "../scripts/provider-contract.js";

assert.equal(normalizeRemoteEndpoint("https://forge.example/api/compile"), "https://forge.example/api/compile");
assert.equal(normalizeRemoteEndpoint("http://localhost:8787/compile"), "http://localhost:8787/compile");
assert.equal(normalizeRemoteEndpoint("http://10.0.0.26:8787/v1/forge/compile"), "http://10.0.0.26:8787/v1/forge/compile");
assert.equal(normalizeRemoteEndpoint("http://192.168.1.40:8787/compile"), "http://192.168.1.40:8787/compile");
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
    supportedKinds: ["weaponExtraDamage"]
  }
});
assert.equal(requestBody.schemaVersion, REMOTE_PROVIDER_SCHEMA_VERSION);
assert.equal(requestBody.options.unresolvedPolicy, "block");
assert.equal(requestBody.context.systemId, "dnd5e");
assert.equal(JSON.stringify(requestBody).includes("token"), false);

const validPayload = {
  schemaVersion: REMOTE_PROVIDER_SCHEMA_VERSION,
  compilerVersion: "remote-test",
  promptVersion: "1.0.0",
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
assert.equal(JSON.parse(capturedRequest.init.body).request, "Create a fire dagger");
assert.equal(JSON.stringify(remoteResult).includes("private-token"), false);
assert.equal(remoteResult.specs[0].name, "Remote Ember Dagger");

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

export const testedRemoteContractCases = 39;
