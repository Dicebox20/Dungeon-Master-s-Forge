import assert from "node:assert/strict";
import test from "node:test";
import { HOSTED_FORGE_RELEASE_CONFIG, normalizeHostedReleaseConfig } from "../scripts/hosted-release-config.js";

test("release configuration is internally consistent", () => {
  const configured = normalizeHostedReleaseConfig(HOSTED_FORGE_RELEASE_CONFIG);
  assert.equal(configured.label, "Free Forge");
  if (HOSTED_FORGE_RELEASE_CONFIG.enabled) {
    assert.equal(configured.enabled, true);
    assert.match(configured.endpoint, /^https:/);
  } else {
    assert.deepEqual(configured, { enabled: false, label: "Free Forge", endpoint: "", model: "" });
  }
});

test("private releases accept only credential-free HTTPS endpoints", () => {
  const configured = normalizeHostedReleaseConfig({
    enabled: true,
    label: "Free Forge",
    endpoint: "https://forge.example/v1/forge/compile",
    model: "gpt-4.1-mini"
  });
  assert.equal(configured.enabled, true);
  assert.equal(configured.endpoint, "https://forge.example/v1/forge/compile");
  assert.throws(() => normalizeHostedReleaseConfig({ enabled: true, endpoint: "http://forge.example/compile" }), /HTTPS/);
  assert.throws(() => normalizeHostedReleaseConfig({ enabled: true, endpoint: "https://user:secret@forge.example/compile" }), /credentials/);
});
