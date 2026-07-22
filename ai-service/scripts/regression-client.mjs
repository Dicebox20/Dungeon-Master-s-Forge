import { readFileSync } from "node:fs";
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
const runTag = String(process.env.DMF_RUN_TAG ?? "").trim().replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40);
const includeSpecs = /^(?:1|true|yes)$/i.test(String(process.env.DMF_INCLUDE_SPECS ?? "").trim());
const sweepFile = String(process.env.DMF_SWEEP_FILE ?? "").trim();
const fileSweep = sweepFile
  ? JSON.parse(readFileSync(sweepFile, "utf8"))
  : null;
const baseScenarios = fileSweep
  ? (Array.isArray(fileSweep) ? fileSweep : fileSweep.scenarios)
  : regressionSweeps[sweepName];

if (!Array.isArray(baseScenarios)) {
  if (sweepFile) {
    console.error(`DMF_SWEEP_FILE "${sweepFile}" must contain a scenario array or an object with a scenarios array.`);
    process.exit(1);
  }
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

function mechanicalText(value, key = "", tokens = []) {
  if (value == null) return tokens.join(" ");
  if (Array.isArray(value)) {
    for (const entry of value) mechanicalText(entry, key, tokens);
    return tokens.join(" ");
  }
  if (typeof value !== "object") {
    if (key === "description") return tokens.join(" ");
    const raw = String(value);
    if (key === "duration" && Number(value) === 3600) tokens.push("1 hour");
    if (key === "duration" && Number(value) === 60) tokens.push("1 minute");
    const normalized = raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/([+-])/g, " $1 ");
    const aliases = {
      warpick: "war pick",
      int: "intelligence",
      str: "strength",
      dex: "dexterity",
      con: "constitution",
      wis: "wisdom",
      cha: "charisma",
      longRest: "long rest",
      shortRest: "short rest"
    };
    tokens.push(raw, normalized, aliases[raw] ?? "");
    return tokens.join(" ");
  }

  const number = Number(value.number);
  const denomination = Number(value.denomination);
  if (Number.isFinite(number) && Number.isFinite(denomination) && number > 0 && denomination > 0) {
    const bonus = String(value.bonus ?? "").trim().replace(/\s+/g, "");
    const dice = `${number}d${denomination}${bonus}`;
    tokens.push(dice, dice.replace(/([+-])/g, " $1 "));
  }
  if (Number(value.seconds) === 3600 || Number(value.durationSeconds) === 3600) tokens.push("1 hour");
  if (Number(value.seconds) === 60 || Number(value.durationSeconds) === 60) tokens.push("1 minute");
  // DND5e activities commonly encode duration as { value, units }, not seconds.
  if (key === "duration" && Number(value.value) > 0) {
    const units = String(value.units ?? "").trim().toLowerCase();
    if (["hour", "hours"].includes(units)) tokens.push(`${Number(value.value)} hour`);
    if (["minute", "minutes"].includes(units)) tokens.push(`${Number(value.value)} minute`);
  }
  if (["target", "template"].includes(key) && Number(value.size) > 0) tokens.push(`${value.size}-foot`);
  if (key === "save" && value.dc != null) tokens.push(`DC ${value.dc}`);
  if (key === "uses" && value.autoDestroy === true) tokens.push("consumed");

  // Review-only text must never satisfy an assertion that a mechanic was
  // actually compiled into the Foundry document shape.
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if ([
      "description",
      "chatFlavor",
      "originalRequest",
      "unresolvedMechanics",
      "requestedText",
      "reason",
      "handling"
    ].includes(entryKey)) continue;
    // Effect-path keys such as system.skills.ste.roll.mode carry meaningful
    // structured mechanics that are not repeated in their scalar values.
    tokens.push(entryKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " "));
    mechanicalText(entryValue, entryKey, tokens);
  }
  return tokens.join(" ");
}

function missingExpectedMechanics(specs, expectedMechanics = []) {
  const text = mechanicalText(specs).toLowerCase();
  return expectedMechanics.filter(mechanic => !text.includes(String(mechanic).toLowerCase()));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function taggedPrompt(prompt, scenarioId) {
  if (!runTag || /\[[^\]]+\]/.test(prompt)) return prompt;
  const tag = `${runTag}-${scenarioId}`.slice(0, 80);
  const match = /(\bcalled\s+)(.+?)(?=\.\s)/i.exec(prompt);
  if (!match) return prompt;
  const itemName = `${match[2]} [${tag}]`;
  const taggedRequest = prompt.replace(match[0], `${match[1]}${itemName}`);
  // Item name makes the test identifier an exact request contract instead of
  // relying on the model to preserve a descriptive name suffix.
  return `Item name: ${itemName}\n${taggedRequest}`;
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
  const prompt = taggedPrompt(scenario.prompt, scenario.id);
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
          request: prompt,
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
    const missingMechanics = missingExpectedMechanics(payload?.specs ?? [], scenario.expectedMechanics ?? []);
    const mechanicsMatch = missingMechanics.length === 0;
    const itemCount = Number(payload?.requestCount ?? payload?.specs?.length ?? 0);
    const ok = response.ok && itemCount === 1 && kindMatch && mechanicsMatch;

    results.push({
      id: scenario.id,
      label: scenario.label,
      status: ok ? "PASS" : (response.ok ? "WARN" : "FAIL"),
      httpStatus: response.status,
      returnedName: payload?.specs?.[0]?.name ?? null,
      returnedKind: firstKind || null,
      expectedKinds: scenario.expectedKinds ?? [],
      strictKind: Boolean(scenario.strictKind),
      kindMatch,
      expectedMechanics: scenario.expectedMechanics ?? [],
      missingMechanics,
      itemCount,
      requestId: payload?.error?.requestId ?? null,
      errorCode: payload?.error?.code ?? null,
      errorMessage: payload?.error?.message ?? null,
      unresolvedCount: Number(payload?.unresolvedMechanics?.length ?? 0),
      ...(includeSpecs ? { specs: payload?.specs ?? [] } : {}),
      attempts,
      durationMs: Date.now() - started
    });
  } catch (error) {
    results.push({
      id: scenario.id,
      label: scenario.label,
      status: "FAIL",
      httpStatus: null,
      returnedName: null,
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
  sweep: fileSweep?.name ?? fileSweep?.suite ?? sweepName,
  sweepFile: sweepFile || null,
  runTag: runTag || null,
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
