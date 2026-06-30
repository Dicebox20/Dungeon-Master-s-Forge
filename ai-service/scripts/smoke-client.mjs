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
    request: "Reference Service Smoke Blade\nCreate an uncommon longsword that deals an extra 1d4 fire damage.",
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
  console.log(JSON.stringify({
    schemaVersion: payload.schemaVersion,
    compilerVersion: payload.compilerVersion,
    promptVersion: payload.promptVersion,
    cache: response.headers.get("x-forge-cache"),
    requestCount: payload.requestCount,
    items: payload.specs.map(spec => ({ name: spec.name, kind: spec.kind }))
  }, null, 2));
}
