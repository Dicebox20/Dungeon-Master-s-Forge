function utf8Bytes(value) {
  return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value ?? null), "utf8");
}

function normalizeProviderUsage(value = {}) {
  const inputTokens = Math.max(0, Number(value.input_tokens ?? value.inputTokens ?? 0) || 0);
  const outputTokens = Math.max(0, Number(value.output_tokens ?? value.outputTokens ?? 0) || 0);
  const totalTokens = Math.max(inputTokens + outputTokens, Number(value.total_tokens ?? value.totalTokens ?? 0) || 0);
  return { inputTokens, outputTokens, totalTokens };
}

function measureUsage(payload, result) {
  const provider = normalizeProviderUsage(result?.providerUsage);
  const fallbackUnits = Math.max(1, Math.ceil((utf8Bytes(payload) + utf8Bytes(result)) / 4));
  const units = Math.max(1, Math.ceil(provider.totalTokens || fallbackUnits));
  return { units, ...provider, source: provider.totalTokens > 0 ? "provider-tokens" : "estimated-data" };
}

export { measureUsage, normalizeProviderUsage, utf8Bytes };
