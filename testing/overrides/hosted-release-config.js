const HOSTED_FORGE_RELEASE_CONFIG = Object.freeze({
  enabled: true,
  label: "Free Forge",
  endpoint: "https://dmforge.137-184-103-220.sslip.io/v1/forge/compile",
  model: "gpt-4.1-mini"
});

function normalizeHostedReleaseConfig(input = HOSTED_FORGE_RELEASE_CONFIG) {
  const enabled = input?.enabled === true;
  const label = String(input?.label ?? "Free Forge").trim() || "Free Forge";
  const endpoint = String(input?.endpoint ?? "").trim();
  const model = String(input?.model ?? "").trim();
  if (!enabled) return Object.freeze({ enabled: false, label, endpoint: "", model: "" });

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Enabled Free Forge releases require a valid endpoint URL.");
  }
  if (url.protocol !== "https:") throw new Error("Enabled Free Forge releases require an HTTPS endpoint.");
  if (url.username || url.password) throw new Error("Free Forge endpoint URLs cannot contain credentials.");
  if (url.hash) throw new Error("Free Forge endpoint URLs cannot contain fragments.");
  return Object.freeze({ enabled: true, label, endpoint: url.toString(), model });
}

export { HOSTED_FORGE_RELEASE_CONFIG, normalizeHostedReleaseConfig };
