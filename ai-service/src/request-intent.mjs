function itemNameFromChunk(chunk) {
  return chunk.match(/^\s*Item name\s*:\s*(.+)$/im)?.[1]?.trim() ?? "";
}

const TITLE_WORD = String.raw`(?:[A-Z0-9][A-Za-z0-9'"-]*|of|the|and|or|for|to|a|an|in|on|with|without|from)`;
const TITLE_LINE_PATTERN = new RegExp(`^[A-Z][A-Za-z0-9'"-]*(?: ${TITLE_WORD}){0,7}$`);
const TITLE_SENTENCE_PATTERN = new RegExp(`^[A-Z][A-Za-z0-9'"-]*(?: ${TITLE_WORD}){0,7}[.!?]$`);

function looksLikeStandaloneItemChunk(chunk) {
  const normalized = String(chunk ?? "").trim();
  if (!normalized) return false;

  const firstLine = normalized.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!firstLine) return false;
  const firstSentence = normalized.match(/^([^.!?]+[.!?])/)?.[1]?.trim() ?? "";

  if (/^(create|make|generate|build|craft)\b/i.test(firstLine)) return true;
  if (/^(item name|name|title)\s*:/i.test(firstLine)) return true;

  const hasItemMetadata = /\bitem type\b\s*:|\brarity\b\s*:|\battunement\b\s*:|\bcharges?\b\s*:|\bactivation\b\s*:/i.test(normalized);
  const firstLineLooksLikeTitle = TITLE_LINE_PATTERN.test(firstLine);
  const firstSentenceLooksLikeTitle = TITLE_SENTENCE_PATTERN.test(firstSentence);
  const hasInlineItemSignals = /\b(common|uncommon|rare|very rare|legendary|artifact|weapon|armor|shield|bow|crossbow|dagger|sword|spear|lance|staff|wand|potion|amulet|ring|helm|gauntlets?|breastplate|chain mail|studded leather|charges?|cast|summon|heal|ignite)\b|(?:^|[^\w])\+\d(?:[^\w]|$)/i.test(normalized);
  return (hasItemMetadata && firstLineLooksLikeTitle)
    || (firstSentenceLooksLikeTitle && hasInlineItemSignals);
}

function analyzeRequestIntent(request) {
  const normalized = String(request ?? "").trim();
  const fieldStarts = [...normalized.matchAll(/^\s*Item name\s*:/gim)];
  let chunks;

  if (fieldStarts.length >= 2) {
    chunks = normalized.split(/(?=^\s*Item name\s*:)/gim).map(entry => entry.trim()).filter(Boolean);
  } else {
    const separated = normalized.split(/^\s*---+\s*$/gm).map(entry => entry.trim()).filter(Boolean);
    if (separated.length > 1) {
      chunks = separated;
    } else {
      const paragraphSeparated = normalized.split(/\n\s*\n+/).map(entry => entry.trim()).filter(Boolean);
      chunks = paragraphSeparated.length >= 2 && paragraphSeparated.every(looksLikeStandaloneItemChunk)
        ? paragraphSeparated
        : [normalized];
    }
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
