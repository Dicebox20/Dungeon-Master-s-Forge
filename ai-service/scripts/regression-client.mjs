import { KNOWN_SPEC_KINDS } from "../src/constants.mjs";
import { regressionSweeps } from "./regression-scenarios.mjs";

const endpoint = process.env.DMF_ENDPOINT ?? "http://127.0.0.1:8788/v1/forge/compile";
const token = process.env.DMF_CLIENT_TOKEN ?? "";
const sweepName = (process.env.DMF_SWEEP ?? "family").trim().toLowerCase();
const requestedScenarioIds = String(process.env.DMF_SCENARIOS ?? "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);
const limit = Number.parseInt(String(process.env.DMF_LIMIT ?? "").trim(), 10);
const delayMs = Math.max(0, Number.parseInt(String(process.env.DMF_REQUEST_DELAY_MS ?? "0").trim(), 10) || 0);
const rateLimitRetries = Math.max(0, Number.parseInt(String(process.env.DMF_RETRY_429 ?? "2").trim(), 10) || 0);
const baseScenarios = regressionSweeps[sweepName];

if (!baseScenarios) {
  console.error(`Unknown DMF_SWEEP "${sweepName}". Use one of: ${Object.keys(regressionSweeps).join(", ")}`);
  process.exit(1);
}

let scenarios = requestedScenarioIds.length
  ? baseScenarios.filter(scenario => requestedScenarioIds.includes(scenario.id))
  : [...baseScenarios];

if (requestedScenarioIds.length && scenarios.length !== requestedScenarioIds.length) {
  const found = new Set(scenarios.map(scenario => scenario.id));
  const missing = requestedScenarioIds.filter(id => !found.has(id));
  console.error(`Unknown scenario id(s) for DMF_SWEEP "${sweepName}": ${missing.join(", ")}`);
  process.exit(1);
}

if (Number.isFinite(limit) && limit > 0) scenarios = scenarios.slice(0, limit);
if (!scenarios.length) {
  console.error(`No regression scenarios selected for DMF_SWEEP "${sweepName}".`);
  process.exit(1);
}

const headers = { "Content-Type": "application/json", Accept: "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

const context = {
  foundryVersion: "14",
  systemId: "dnd5e",
  systemVersion: "5.3.3",
  moduleVersion: "2.15.0",
  supportedKinds: KNOWN_SPEC_KINDS
};

const results = [];
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelayMs(response, payload) {
  const code = String(payload?.error?.code ?? "").trim().toLowerCase();
  if (code !== "rate_limited") return 0;
  const retryAfterSeconds = Number.parseInt(String(response.headers.get("retry-after") ?? "").trim(), 10);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) return retryAfterSeconds * 1000;
  return 0;
}

for (const [index, scenario] of scenarios.entries()) {
  if (delayMs > 0 && index > 0) await sleep(delayMs);
  const started = Date.now();
  try {
    let response;
    let payload = {};
    let attempts = 0;
    while (true) {
      attempts += 1;
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          schemaVersion: "1.0",
          request: scenario.prompt,
          context,
          options: { model: "", unresolvedPolicy: "review" }
        })
      });

      payload = await response.json().catch(() => ({}));
      const backoffMs = retryDelayMs(response, payload);
      if (!response.ok && backoffMs > 0 && attempts <= rateLimitRetries + 1) {
        await sleep(backoffMs);
        continue;
      }
      break;
    }

    const firstKind = payload?.specs?.[0]?.kind ?? "";
    const kindMatch = !scenario.expectedKinds?.length || scenario.expectedKinds.includes(firstKind);
    const itemCount = Number(payload?.requestCount ?? payload?.specs?.length ?? 0);
    const ok = response.ok && itemCount === 1 && (!scenario.strictKind || kindMatch);

    results.push({
      id: scenario.id,
      label: scenario.label,
      status: ok ? "PASS" : (response.ok ? "WARN" : "FAIL"),
      httpStatus: response.status,
      returnedKind: firstKind || null,
      expectedKinds: scenario.expectedKinds ?? [],
      strictKind: Boolean(scenario.strictKind),
      kindMatch,
      itemCount,
      requestId: payload?.error?.requestId ?? null,
      errorCode: payload?.error?.code ?? null,
      errorMessage: payload?.error?.message ?? null,
      unresolvedCount: Number(payload?.unresolvedMechanics?.length ?? 0),
      attempts,
      durationMs: Date.now() - started
    });
  } catch (error) {
    results.push({
      id: scenario.id,
      label: scenario.label,
      status: "FAIL",
      httpStatus: null,
      returnedKind: null,
      expectedKinds: scenario.expectedKinds ?? [],
      strictKind: Boolean(scenario.strictKind),
      kindMatch: false,
      itemCount: 0,
      requestId: null,
      errorCode: "client_exception",
      errorMessage: error instanceof Error ? error.message : String(error),
      unresolvedCount: 0,
      attempts: 1,
      durationMs: Date.now() - started
    });
  }
}

const summary = {
  endpoint,
  sweep: sweepName,
  selectedScenarios: scenarios.map(scenario => scenario.id),
  totals: {
    scenarios: results.length,
    pass: results.filter(result => result.status === "PASS").length,
    warn: results.filter(result => result.status === "WARN").length,
    fail: results.filter(result => result.status === "FAIL").length
  },
  results
};

console.log(JSON.stringify(summary, null, 2));

if (summary.totals.fail > 0) process.exitCode = 1;
