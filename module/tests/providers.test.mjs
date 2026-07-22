import assert from "node:assert/strict";
import {
  DEFAULT_PROVIDER_ID,
  HOSTED_PROVIDER_ID,
  LOCAL_PROVIDER_ID,
  compileWithProvider,
  getProvider,
  listProviders,
  mechanicsRequestForCompilation,
  networkProviderConfiguration,
  normalizeProviderConfiguration,
  partitionProviderConfiguration,
  providerReadiness,
  providerDefaults
} from "../scripts/providers.js";

assert.equal(mechanicsRequestForCompilation({
  originalRequest: "Create a wand with a save cone.",
  request: "Base item: Wand\nSaving throw: Dexterity DC 14"
}, "Create a wand requiring attunement."), "Create a wand requiring attunement.");
assert.equal(mechanicsRequestForCompilation({
  request: "Base item: Wand"
}, "Create a fallback wand."), "Create a fallback wand.");
assert.equal(mechanicsRequestForCompilation({
  normalizedRequest: "Base item: Wand"
}), "Base item: Wand");
assert.equal(mechanicsRequestForCompilation(null), "");

const providers = listProviders();
assert.deepEqual(providers.map(provider => provider.id), ["local-rules", "bring-your-own", "hosted-forge"]);
assert.equal(DEFAULT_PROVIDER_ID, getProvider(HOSTED_PROVIDER_ID).available ? HOSTED_PROVIDER_ID : LOCAL_PROVIDER_ID);
assert.equal(getProvider(LOCAL_PROVIDER_ID).available, true);
assert.equal(getProvider("bring-your-own").available, true);
assert.equal(getProvider(HOSTED_PROVIDER_ID).label, "Free Forge");
assert.equal(providerDefaults(LOCAL_PROVIDER_ID).unresolvedPolicy, "review");
assert.deepEqual(normalizeProviderConfiguration(LOCAL_PROVIDER_ID, { unresolvedPolicy: "block" }), {
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

assert.deepEqual(providerReadiness(LOCAL_PROVIDER_ID), {
  providerId: LOCAL_PROVIDER_ID,
  available: true,
  ready: true,
  status: "ready",
  missing: []
});
assert.equal(providerReadiness(HOSTED_PROVIDER_ID).status, getProvider(HOSTED_PROVIDER_ID).available ? "ready" : "disabled");
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
  providerId: LOCAL_PROVIDER_ID,
  configuration: { unresolvedPolicy: "review" }
});
assert.equal(localResult.provider, LOCAL_PROVIDER_ID);
assert.equal(localResult.providerLabel, "Local Rules");
assert.equal(localResult.providerMode, "offline");
assert.equal(localResult.providerConfiguration.unresolvedPolicy, "review");
assert.equal(localResult.specs[0].kind, "weaponExtraDamage");

const normalizedLocal = await compileWithProvider("Create a dagger that deals an additional 1d6 fire damage, 1d6 force damage, gives +1 to attack rolls, and can cast Burning Hands once per day.", {
  providerId: LOCAL_PROVIDER_ID,
  configuration: { unresolvedPolicy: "review" }
});
assert.equal(normalizedLocal.normalization.changed, true);
assert.match(normalizedLocal.request, /Spell: Burning Hands/);
assert.match(normalizedLocal.request, /Base item: Dagger/);
assert.match(normalizedLocal.request, /Complexity layer 1 - Base chassis/);

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
assert.match(JSON.parse(remoteRequest.init.body).request, /Complexity layer 1 - Base chassis/);
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
    providerId: LOCAL_PROVIDER_ID,
    configuration: { unresolvedPolicy: "ignore" }
  }),
  /Invalid unresolved mechanics value/
);

if (getProvider(HOSTED_PROVIDER_ID).available) {
  const hostedConnection = networkProviderConfiguration(HOSTED_PROVIDER_ID, { unresolvedPolicy: "review" });
  assert.match(hostedConnection.endpoint, /^https:/);
  assert.equal(hostedConnection.apiToken, "");
  const hostedResult = await compileWithProvider("Make a free-tier fire dagger", {
    providerId: HOSTED_PROVIDER_ID,
    configuration: { unresolvedPolicy: "review" },
    context: { foundryVersion: "14", systemVersion: "5.3.3", moduleVersion: "2.22.0" },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: "1.0",
        specs: [{ kind: "weaponExtraDamage", name: "Hosted Fire Dagger" }],
        assumptions: [],
        warnings: [],
        deferred: []
      })
    })
  });
  assert.equal(hostedResult.provider, HOSTED_PROVIDER_ID);
  assert.equal(hostedResult.specs[0].name, "Hosted Fire Dagger");
}

export const testedProviderCount = providers.length;
export const testedProviderConfigurationCases = 30;
