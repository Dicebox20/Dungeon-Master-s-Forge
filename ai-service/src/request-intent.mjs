function itemNameFromChunk(chunk) {
  return chunk.match(/^\s*Item name\s*:\s*(.+)$/im)?.[1]?.trim() ?? "";
}

function analyzeRequestIntent(request) {
  const normalized = String(request ?? "").trim();
  const fieldStarts = [...normalized.matchAll(/^\s*Item name\s*:/gim)];
  let chunks;

  if (fieldStarts.length >= 2) {
    chunks = normalized.split(/(?=^\s*Item name\s*:)/gim).map(entry => entry.trim()).filter(Boolean);
  } else {
    const separated = normalized.split(/^\s*---+\s*$/gm).map(entry => entry.trim()).filter(Boolean);
    chunks = separated.length > 1 ? separated : [normalized];
  }

  const explicitNames = chunks.map(itemNameFromChunk);
  return {
    count: chunks.length,
    chunks,
    explicitNames,
    hasCompleteExplicitNames: explicitNames.length === chunks.length && explicitNames.every(Boolean)
  };
}

export { analyzeRequestIntent, itemNameFromChunk };
