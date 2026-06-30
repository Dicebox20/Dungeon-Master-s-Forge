import assert from "node:assert/strict";
import {
  PROVIDER_PROFILE_SCHEMA_VERSION,
  createProviderProfile,
  parseProviderProfile,
  serializeProviderProfile
} from "../scripts/provider-profile.js";

const configuration = {
  endpoint: "https://forge.example/api/compile",
  model: "forge-model",
  apiToken: "private-token",
  unresolvedPolicy: "block"
};

const profile = createProviderProfile("bring-your-own", configuration);
assert.deepEqual(profile, {
  schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
  providerId: "bring-your-own",
  configuration: {
    endpoint: "https://forge.example/api/compile",
    model: "forge-model",
    unresolvedPolicy: "block"
  }
});
assert.equal(JSON.stringify(profile).includes("private-token"), false);

const serialized = serializeProviderProfile("bring-your-own", configuration);
assert.equal(serialized.includes("private-token"), false);
const parsed = parseProviderProfile(serialized);
assert.deepEqual(parsed.configuration, profile.configuration);
assert.equal(parsed.readiness.status, "ready");
assert.deepEqual(parsed.readiness.missing, []);

assert.deepEqual(createProviderProfile("local-rules", { unresolvedPolicy: "review" }), {
  schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
  providerId: "local-rules",
  configuration: { unresolvedPolicy: "review" }
});

assert.throws(() => parseProviderProfile("not json"), /valid JSON/);
assert.throws(() => parseProviderProfile({ schemaVersion: "0", providerId: "local-rules", configuration: {} }), /schema version/);
assert.throws(() => parseProviderProfile({ schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION, providerId: "missing", configuration: {} }), /Unknown Forge provider/);
assert.throws(() => parseProviderProfile({ schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION, providerId: "local-rules", configuration: [] }), /configuration must be a JSON object/);
assert.throws(() => parseProviderProfile({
  schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
  providerId: "bring-your-own",
  configuration: { apiToken: "must-not-import" }
}), /cannot contain secret or session-only field/);
assert.throws(() => parseProviderProfile({
  schemaVersion: PROVIDER_PROFILE_SCHEMA_VERSION,
  providerId: "bring-your-own",
  configuration: { hiddenValue: "unknown" }
}), /unknown configuration field/);

export const testedProviderProfileCases = 13;
