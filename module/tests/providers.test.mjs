import assert from "node:assert/strict";
import {
  DEFAULT_PROVIDER_ID,
  compileWithProvider,
  getProvider,
  listProviders,
  normalizeProviderConfiguration,
  partitionProviderConfiguration,
  providerReadiness,
  providerDefaults
} from "../scripts/providers.js";

const providers = listProviders();
assert.deepEqual(providers.map(provider => provider.id), ["local-rules", "bring-your-own", "hosted-forge"]);
assert.equal(getProvider(DEFAULT_PROVIDER_ID).available, true);
assert.equal(getProvider("bring-your-own").available, true);
assert.equal(providerDefaults(DEFAULT_PROVIDER_ID).unresolvedPolicy, "review");
assert.deepEqual(normalizeProviderConfiguration(DEFAULT_PROVIDER_ID, { unresolvedPolicy: "block" }), {
  unresolvedPolicy: "block"
});

assert.deepEqual(providerDefaults("bring-your-own"), {
  endpoint: "",
  model: "",
  apiToken: "",
  unresolvedPolicy: "review"
});

const byoConfiguration = {
  endpoint: "https://forge.example/api/compile",
  model: "forge-model",
  apiToken: "private-token",
  unresolvedPolicy: "block"
};
const partitioned = partitionProviderConfiguration("bring-your-own", byoConfiguration);
assert.deepEqual(partitioned.persisted, {
  endpoint: "https://forge.example/api/compile",
  model: "forge-model",
  unresolvedPolicy: "block"
});
assert.deepEqual(partitioned.session, { apiToken: "private-token" });
assert.equal(partitioned.diagnostics.apiToken, "[redacted]");
assert.equal(JSON.stringify(partitioned.persisted).includes("private-token"), false);
assert.equal(JSON.stringify(partitioned.diagnostics).includes("private-token"), false);
assert.deepEqual(partitioned.secretFieldIds, ["apiToken"]);

assert.deepEqual(providerReadiness(DEFAULT_PROVIDER_ID), {
  providerId: DEFAULT_PROVIDER_ID,
  available: true,
  ready: true,
  status: "ready",
  missing: []
});
assert.deepEqual(providerReadiness("bring-your-own"), {
  providerId: "bring-your-own",
  available: true,
  ready: false,
  status: "configuration-required",
  missing: ["endpoint"]
});
assert.deepEqual(providerReadiness("bring-your-own", byoConfiguration), {
  providerId: "bring-your-own",
  available: true,
  ready: true,
  status: "ready",
  missing: []
});

const localResult = await compileWithProvider("Make a rifle that does fire damage", {
  providerId: DEFAULT_PROVIDER_ID,
  configuration: { unresolvedPolicy: "review" }
});
assert.equal(localResult.provider, DEFAULT_PROVIDER_ID);
assert.equal(localResult.providerLabel, "Local Rules");
assert.equal(localResult.providerMode, "offline");
assert.equal(localResult.providerConfiguration.unresolvedPolicy, "review");
assert.equal(localResult.specs[0].kind, "weaponExtraDamage");

await assert.rejects(
  compileWithProvider("Make a dagger", { providerId: "missing-provider" }),
  /Unknown Forge provider/
);
await assert.rejects(
  compileWithProvider("Make a dagger", { providerId: "bring-your-own" }),
  /requires: Endpoint/
);

let remoteRequest;
const remoteResult = await compileWithProvider("Make a fire dagger", {
  providerId: "bring-your-own",
  configuration: byoConfiguration,
  context: { foundryVersion: "14", systemVersion: "5.3.3", moduleVersion: "2.15.0" },
  fetchImpl: async (url, init) => {
    remoteRequest = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: "1.0",
        specs: [{ kind: "weaponExtraDamage", name: "Remote Fire Dagger" }],
        assumptions: [],
        warnings: [],
        deferred: []
      })
    };
  }
});
assert.equal(remoteResult.provider, "bring-your-own");
assert.equal(remoteResult.specs[0].name, "Remote Fire Dagger");
assert.equal(remoteResult.providerConfiguration.apiToken, "[redacted]");
assert.equal(remoteRequest.url, byoConfiguration.endpoint);
assert.equal(JSON.parse(remoteRequest.init.body).context.supportedKinds.length, 14);
assert.equal(JSON.stringify(remoteResult).includes("private-token"), false);

const preflightRequests = [];
const preflightResult = await compileWithProvider("Make a fire dagger", {
  providerId: "bring-your-own",
  configuration: { ...byoConfiguration, endpoint: "https://forge.example/v1/forge/compile" },
  context: { foundryVersion: "14", systemVersion: "5.3.3", moduleVersion: "2.16.0" },
  preflightCapabilities: true,
  fetchImpl: async (url, init) => {
    preflightRequests.push({ url, init });
    if (init.method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          service: { name: "Test Forge", version: "1.0.0" },
          forge: { schemaVersion: "1.0", promptVersion: "1.0.0", supportedKinds: ["weaponExtraDamage"] },
          features: { declarativeModelOutputOnly: true, executableModelOutput: false }
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: "1.0",
        compilerVersion: "dmf-ai-service/1.0.0",
        promptVersion: "1.0.0",
        specs: [{ kind: "weaponExtraDamage", name: "Preflight Fire Dagger" }]
      })
    };
  }
});
assert.equal(preflightRequests.length, 2);
assert.equal(preflightRequests[0].url, "https://forge.example/v1/forge/capabilities");
assert.equal(preflightRequests[0].init.method, "GET");
assert.deepEqual(JSON.parse(preflightRequests[1].init.body).context.supportedKinds, ["weaponExtraDamage"]);
assert.equal(preflightResult.providerCapabilities.status, "compatible");
assert.equal(preflightResult.promptVersion, "1.0.0");
await assert.rejects(
  compileWithProvider("Make a dagger", {
    providerId: DEFAULT_PROVIDER_ID,
    configuration: { unresolvedPolicy: "ignore" }
  }),
  /Invalid unresolved mechanics value/
);

export const testedProviderCount = providers.length;
export const testedProviderConfigurationCases = 25;
