import assert from "node:assert/strict";
import test from "node:test";
import { buildFreeTierDeploymentReport } from "../src/deployment-preflight.mjs";
import { config } from "./helpers.mjs";

test("free-tier deployment report is useful and secret-free", () => {
  const report = buildFreeTierDeploymentReport(config({
    mode: "openai",
    publicFreeTier: true,
    allowedOrigins: ["*"],
    trustProxy: true,
    clientDailyLimit: 3,
    clientMonthlyLimit: 20,
    globalDailyLimit: 50,
    openaiApiKey: "must-not-appear",
    quotaHashSecret: "also-must-not-appear-and-is-long-enough"
  }), { kind: "sqlite", durable: true });
  assert.equal(report.ready, true);
  assert.equal(report.access.wildcardOrigins, true);
  assert.equal(report.provider.serverKeyConfigured, true);
  assert.equal(report.quotas.globalPerDay, 50);
  assert.equal(report.quotas.perClientMonth, 20);
  assert.equal(JSON.stringify(report).includes("must-not-appear"), false);
});

test("free-tier deployment report rejects private mode", () => {
  assert.throws(
    () => buildFreeTierDeploymentReport(config(), { kind: "sqlite", durable: true }),
    /DMF_PUBLIC_FREE_TIER=true/
  );
});
