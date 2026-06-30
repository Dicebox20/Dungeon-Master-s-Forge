import { KNOWN_SPEC_KINDS } from "../src/constants.mjs";

const endpoint = process.env.DMF_ENDPOINT ?? "http://127.0.0.1:8787/v1/forge/compile";
const token = process.env.DMF_CLIENT_TOKEN ?? "";
const headers = { "Content-Type": "application/json", Accept: "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

const response = await fetch(endpoint, {
  method: "POST",
  headers,
  body: JSON.stringify({
    schemaVersion: "1.0",
    request: "Item name: Batch Ember Blade\nDamage: 1d4 fire\n\nItem name: Batch Winter Blade\nDamage: 1d4 cold",
    context: {
      foundryVersion: "14",
      systemId: "dnd5e",
      systemVersion: "5.3.3",
      moduleVersion: "2.15.0",
      supportedKinds: KNOWN_SPEC_KINDS
    },
    options: { model: "", unresolvedPolicy: "review" }
  })
});

const payload = await response.json();
if (!response.ok) {
  console.error(`${response.status} ${payload?.error?.code ?? "request_failed"}: ${payload?.error?.message ?? "Unknown error"}`);
  process.exitCode = 1;
} else {
  const summary = {
    schemaVersion: payload.schemaVersion,
    compilerVersion: payload.compilerVersion,
    promptVersion: payload.promptVersion,
    cache: response.headers.get("x-forge-cache"),
    requestCount: payload.requestCount,
    items: payload.specs.map(spec => ({ name: spec.name, kind: spec.kind }))
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.requestCount !== 2 || summary.items[0]?.name !== "Batch Ember Blade" || summary.items[1]?.name !== "Batch Winter Blade") {
    console.error("Batch integrity smoke check failed.");
    process.exitCode = 1;
  }
}
