import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { HOSTED_FORGE_RELEASE_CONFIG, normalizeHostedReleaseConfig } from "../scripts/hosted-release-config.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function assertManifestDownloadExists(relativeManifestPath) {
  const manifest = readJson(relativeManifestPath);
  const downloadName = new URL(manifest.download).pathname.split("/").pop();
  assert.ok(downloadName, `${relativeManifestPath} should declare a download file name`);
  const releaseFolder = path.dirname(relativeManifestPath).endsWith("testing")
    ? path.join(repoRoot, "testing", "releases")
    : path.join(repoRoot, "releases");
  const downloadPath = path.join(releaseFolder, downloadName);
  assert.ok(fs.existsSync(downloadPath), `${relativeManifestPath} download target is missing locally: ${downloadPath}`);
}

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

test("stable manifest download artifact exists locally", () => {
  assertManifestDownloadExists("module/module.json");
});

test("tester manifest download artifact exists locally", () => {
  assertManifestDownloadExists("testing/module.json");
});
