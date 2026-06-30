const endpoint = process.env.DMF_CAPABILITIES_ENDPOINT ?? "http://127.0.0.1:8787/v1/forge/capabilities";
const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
const payload = await response.json();

if (!response.ok) {
  console.error(`${response.status}: capabilities request failed`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    serviceVersion: payload.service?.version,
    schemaVersion: payload.forge?.schemaVersion,
    promptVersion: payload.forge?.promptVersion,
    supportedKinds: payload.forge?.supportedKinds?.length,
    maxItems: payload.request?.maxItems,
    hostedForge: payload.features?.hostedForge
  }, null, 2));
  if (payload.features?.hostedForge !== false || payload.features?.executableModelOutput !== false) {
    console.error("Capabilities safety boundary is not in the expected state.");
    process.exitCode = 1;
  }
}
