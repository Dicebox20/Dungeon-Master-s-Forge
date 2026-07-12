const ITEM_FIELD_PATTERN = /^\s*Item name\s*:/im;

const BASE_ITEMS = [
  "breastplate",
  "quarterstaff",
  "longsword",
  "shortsword",
  "shortbow",
  "longbow",
  "crossbow",
  "hand crossbow",
  "trident",
  "glaive",
  "greataxe",
  "warhammer",
  "rapier",
  "dagger",
  "spear",
  "shield",
  "staff",
  "mace",
  "lance",
  "helm",
  "helmet",
  "amulet",
  "ring",
  "wand",
  "rod",
  "potion",
  "oil",
  "flask",
  "vial",
  "grenade",
  "bomb"
];

const SPELL_NAMES = [
  "Ray of Sickness",
  "Burning Hands",
  "Thunderwave",
  "Ice Knife",
  "Lightning Bolt",
  "Misty Step",
  "Fog Cloud",
  "Sleet Storm",
  "Fireball",
  "Shatter",
  "Command",
  "Cure Wounds",
  "Invisibility",
  "Moonbeam",
  "Ice Storm",
  "Cone of Cold",
  "Flame Strike",
  "Beacon of Hope",
  "Clairvoyance"
];

const SAVE_SPELLS = new Set([
  "Burning Hands",
  "Thunderwave",
  "Fireball",
  "Shatter",
  "Command",
  "Ice Storm",
  "Cone of Cold",
  "Flame Strike",
  "Beacon of Hope"
]);

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function titleCaseWords(value) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseFields(request) {
  const fields = {};
  for (const line of String(request ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]{2,40}):\s*(.+?)\s*$/);
    if (!match) continue;
    fields[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return fields;
}

function firstTitleLine(request) {
  const line = String(request ?? "").split(/\r?\n/).map(value => value.trim()).find(Boolean) ?? "";
  if (!line || line.includes(":") || line.length > 80 || /^(make|create|build|design|craft|generate)\b/i.test(line)) return "";
  return line;
}

function splitItemRequests(request) {
  const normalized = String(request ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const separated = normalized
    .split(/^\s*(?:---+|===+)\s*$/m)
    .map(value => value.trim())
    .filter(Boolean);
  if (separated.length > 1) return separated;

  const lines = normalized.split("\n");
  const itemNameLines = lines
    .map((line, index) => (/^\s*(?:[-*]\s*)?item name\s*:\s*\S/i.test(line) ? index : -1))
    .filter(index => index >= 0);
  if (itemNameLines.length < 2) return [normalized];

  return itemNameLines.map((start, index) => {
    const end = itemNameLines[index + 1] ?? lines.length;
    return lines.slice(start, end).join("\n").trim();
  }).filter(Boolean);
}

function detectBaseItem(text, fields = {}) {
  const explicit = compactText(fields["base item"] ?? fields["item type"]);
  if (explicit) {
    const normalizedExplicit = explicit.toLowerCase();
    const match = BASE_ITEMS.find(item => normalizedExplicit.includes(item));
    if (match) return match;
  }
  const haystack = String(text ?? "").toLowerCase();
  return BASE_ITEMS.find(item => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(haystack)) ?? "";
}

function detectRarity(text, fields = {}) {
  const source = compactText(fields.rarity || text).toLowerCase();
  const labels = ["artifact", "legendary", "very rare", "rare", "uncommon", "common"];
  return labels.find(label => source.includes(label)) ?? "";
}

function detectExplicitName(text, fields = {}) {
  const explicit = compactText(fields["item name"] ?? fields.name);
  if (explicit) return explicit;
  if (/\balchemist(?:'s)?\s+fire\b/i.test(text)) return "Alchemist Fire";
  if (/\bacid\s+flask\b/i.test(text)) return "Acid Flask";
  if (/\bholy\s+water\b/i.test(text)) return "Holy Water";
  const title = firstTitleLine(text);
  if (title) return title;
  const named = String(text ?? "").match(/\b(?:named|called)\s+["']?([^"'.,;\n]+)["']?/i)?.[1]?.trim();
  return named ?? "";
}

function detectMagicalBonus(text, baseItem = "", { skipDefault = false } = {}) {
  const explicit = String(text ?? "").match(/\B\+(\d)\b(?!\s*d)/);
  if (explicit) return explicit[1];
  const attackRolls = /(?:\+\s*(\d)|(\d)\s*\+)\s+to\s+(?:attack|attack rolls?|attack and damage rolls?)/i.exec(text);
  const damageRolls = /(?:\+\s*(\d)|(\d)\s*\+)\s+to\s+damage rolls?/i.exec(text);
  const extracted = attackRolls?.[1] || attackRolls?.[2] || damageRolls?.[1] || damageRolls?.[2] || "";
  if (extracted) return extracted;
  if (!baseItem || skipDefault) return "";
  if (!/\b(?:cast|spell|charges?|damage|resistance|advantage|summon|heal|magical|magic)\b/i.test(text)) return "";
  return "1";
}

function parseDamageParts(text) {
  const parts = [];
  const pattern = /(\d+)d(\d+)(?:\s*\+\s*([+-]?\d+))?\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)(?:\s+damage)?/gi;
  for (const match of String(text ?? "").matchAll(pattern)) {
    parts.push({
      number: Number(match[1]),
      denomination: Number(match[2]),
      bonus: match[3] ?? "",
      type: titleCaseWords(match[4].toLowerCase())
    });
  }
  return parts;
}

function detectAttunement(text, fields = {}) {
  const explicit = compactText(fields.attunement).toLowerCase();
  if (explicit) {
    if (/(?:none|no|not required|does not require)/i.test(explicit)) return "none";
    if (/required/i.test(explicit)) return "required";
  }
  if (/attunement\s*:\s*(?:not required|no|none)|does not require attunement|no attunement/i.test(text)) return "none";
  if (/attunement|required by|requires? attunement/i.test(text)) return "required";
  return "";
}

function detectSpellNames(text, fields = {}) {
  const fieldSpells = compactText(fields.spell || fields.spells)
    .split(/\s*[;,/]\s*|\s+\band\b\s+/i)
    .map(spell => compactText(spell))
    .filter(Boolean);
  const names = new Set();
  for (const fieldSpell of fieldSpells) names.add(titleCaseWords(fieldSpell));
  for (const spellName of SPELL_NAMES) {
    const pattern = new RegExp(`\\b${spellName.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(text)) names.add(spellName);
  }
  return [...names];
}

function detectSpellUsage(text) {
  const source = String(text ?? "");
  const wordMatch = source.match(/\b(once|twice|thrice)\s+per\s+(day|dawn|long rest|short rest)\b/i);
  if (wordMatch) return `${wordMatch[1].toLowerCase()} per ${wordMatch[2].toLowerCase()}`;
  const countMatch = source.match(/\b(\d+)\s+times?\s+per\s+(day|dawn|long rest|short rest)\b/i);
  if (countMatch) return `${countMatch[1]} times per ${countMatch[2].toLowerCase()}`;
  if (/\b(?:once|twice|thrice)\b/i.test(source)) return source.match(/\b(?:once|twice|thrice)\b/i)[0].toLowerCase();
  if (/\b\d+\s+charges?\b/i.test(source)) return "uses charges";
  return "";
}

function detectChargeSummary(text) {
  const source = String(text ?? "");
  const max = source.match(/\b(\d+)\s+charges?\b/i)?.[1] ?? "";
  if (!max) return "";
  const recharge = source.match(/regains?\s+([^.;\n]+?)\s+charges?\s+(?:daily at dawn|at dawn|daily|on a long rest|per long rest|after a long rest|on a short rest|after a short rest)/i)?.[1]?.trim() ?? "";
  if (recharge) return `${max} charges; regains ${recharge}`;
  return `${max} charges`;
}

function detectSaveDc(text, spellNames = []) {
  const explicit = String(text ?? "").match(/\b(?:spell\s+save\s+)?dc\s*(\d+)\b/i)?.[1];
  if (explicit) return explicit;
  return spellNames.some(spell => SAVE_SPELLS.has(spell)) ? "15" : "";
}

function detectThrowableConsumable(text, fields = {}) {
  const explicitType = compactText(fields["item type"] ?? fields["base item"]);
  const haystack = `${explicitType}\n${String(text ?? "")}`;
  if (!/\b(?:grenade|bomb|flask|vial|alchemist(?:'s)?\s+fire|acid\s+flask|holy\s+water)\b/i.test(haystack)) return false;
  return /\b(?:throw|thrown|hurl|lob|splash|burst|explode|explodes?)\b/i.test(haystack);
}

function detectThrownRange(text) {
  const match = String(text ?? "").match(/\bwithin\s+(\d+)\s*feet?\b/i)
    ?? String(text ?? "").match(/\brange\s+of\s+(\d+)\s*feet?\b/i)
    ?? String(text ?? "").match(/\bto\s+a\s+point\s+within\s+(\d+)\s*feet?\b/i);
  return match ? `${match[1]} feet` : "";
}

function detectAreaSummary(text) {
  const radiusArea = String(text ?? "").match(/\b(\d+)\s*[- ]?(?:foot|feet)\s*[- ]?radius\s+(sphere|cylinder)\b/i);
  if (radiusArea) return `${radiusArea[1]}-foot-radius ${radiusArea[2].toLowerCase()}`;
  const area = String(text ?? "").match(/\b(\d+)\s*[- ]?(?:foot|feet)\s+(cone|cube|line|sphere|cylinder)\b/i);
  if (!area) return "";
  return `${area[1]}-foot ${area[2].toLowerCase()}`;
}

function buildLayeredBrief(chunk, extracted) {
  const sections = [];

  const baseLines = [];
  if (extracted.baseItem) baseLines.push(`Base item: ${titleCaseWords(extracted.baseItem)}`);
  if (extracted.rarity) baseLines.push(`Rarity: ${titleCaseWords(extracted.rarity)}`);
  if (extracted.attunement === "required") baseLines.push("Attunement: Required");
  if (extracted.attunement === "none") baseLines.push("Attunement: None");
  if (extracted.magicalBonus) baseLines.push(`Magical bonus: +${extracted.magicalBonus}`);
  if (extracted.throwableConsumable) baseLines.push("Item type: Consumable projectile");
  if (baseLines.length) {
    sections.push(["Complexity layer 1 - Base chassis", ...baseLines].join("\n"));
  }

  const riderLines = [];
  if (extracted.damageParts.length) {
    riderLines.push(`Extra hit damage: ${extracted.damageParts.map(part =>
      `${part.number}d${part.denomination}${part.bonus ? ` ${part.bonus}` : ""} ${part.type.toLowerCase()}`
    ).join("; ")}`);
  }
  if (riderLines.length) {
    sections.push(["Complexity layer 2 - Passive riders", ...riderLines].join("\n"));
  }

  const resourceLines = [];
  if (extracted.spellUsage) resourceLines.push(`Spell usage: ${extracted.spellUsage}`);
  if (extracted.chargeSummary) resourceLines.push(`Charges: ${extracted.chargeSummary}`);
  if (extracted.throwableConsumable && /\b(?:consumed|one use|single use)\b/i.test(chunk)) {
    resourceLines.push("Use model: Consumed after one use");
  }
  if (resourceLines.length) {
    sections.push(["Complexity layer 3 - Resource model", ...resourceLines].join("\n"));
  }

  const activityLines = [];
  if (extracted.spellNames.length) activityLines.push(`Spell: ${extracted.spellNames.join("; ")}`);
  if (extracted.saveDc) activityLines.push(`Spell save DC: ${extracted.saveDc}`);
  if (extracted.throwableConsumable) {
    activityLines.push("Activation: Throw as an action");
    if (extracted.throwRange) activityLines.push(`Range: ${extracted.throwRange}`);
    if (extracted.areaSummary) activityLines.push(`Area: ${extracted.areaSummary}`);
  }
  if (activityLines.length) {
    sections.push(["Complexity layer 4 - Named activities", ...activityLines].join("\n"));
  }

  if (!sections.length) return compactText(chunk);
  return sections.join("\n\n");
}

function normalizeSingleItemRequest(chunk) {
  const original = String(chunk ?? "").trim();
  const fields = parseFields(original);
  const baseItem = detectBaseItem(original, fields);
  const throwableConsumable = detectThrowableConsumable(original, fields);
  const extracted = {
    name: detectExplicitName(original, fields),
    baseItem,
    rarity: detectRarity(original, fields),
    magicalBonus: detectMagicalBonus(original, baseItem, { skipDefault: throwableConsumable }),
    damageParts: parseDamageParts(original),
    spellNames: detectSpellNames(original, fields),
    spellUsage: detectSpellUsage(original),
    saveDc: detectSaveDc(original, detectSpellNames(original, fields)),
    chargeSummary: detectChargeSummary(original),
    attunement: detectAttunement(original, fields),
    throwableConsumable,
    throwRange: detectThrownRange(original),
    areaSummary: detectAreaSummary(original)
  };

  const layeredBrief = buildLayeredBrief(original, extracted);
  const normalized = extracted.name
    ? `Item name: ${extracted.name}\n\n${layeredBrief}`
    : layeredBrief;
  const changed = compactText(normalized) !== compactText(original) && !ITEM_FIELD_PATTERN.test(original);

  return {
    original,
    normalized,
    changed,
    extracted
  };
}

function normalizeItemRequest(request) {
  const originalRequest = String(request ?? "").trim();
  const chunks = splitItemRequests(originalRequest);
  const items = chunks.map(normalizeSingleItemRequest);
  const normalizedRequest = items.map(item => item.normalized).join("\n\n---\n\n").trim();
  const notes = [];
  if (items.some(item => item.changed)) {
    notes.push("Converted the request into a layered Forge brief before compilation.");
  }
  if (items.some(item => item.extracted.magicalBonus === "1" && !/\+\s*1\b/.test(item.original))) {
    notes.push("Defaulted missing magical bonus hints to +1 for magical weapon or armor bases.");
  }
  if (items.some(item => item.extracted.saveDc === "15" && !/\bdc\s*\d+\b/i.test(item.original))) {
    notes.push("Defaulted unspecified spell save DC hints to 15 for leveled save spells.");
  }
  return {
    originalRequest,
    normalizedRequest: normalizedRequest || originalRequest,
    changed: compactText(normalizedRequest) !== compactText(originalRequest),
    items,
    notes
  };
}

export { normalizeItemRequest, splitItemRequests };
