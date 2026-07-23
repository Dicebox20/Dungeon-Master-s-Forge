const ITEM_FIELD_PATTERN = /^\s*Item name\s*:/im;

const BASE_ITEMS = [
  "half plate",
  "plate armor",
  "plate",
  "chain mail",
  "scale mail",
  "studded leather",
  "leather armor",
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
  "Poison Spray",
  "Ray of Sickness",
  "Cloudkill",
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

function unwrapNameQuotes(value) {
  const text = compactText(value);
  const pairs = [["\"", "\""], ["'", "'"], ["“", "”"], ["‘", "’"]];
  for (const [opening, closing] of pairs) {
    if (text.startsWith(opening) && text.endsWith(closing) && text.length > opening.length + closing.length) {
      return compactText(text.slice(opening.length, -closing.length));
    }
  }
  return text;
}

function titleCaseWords(value) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function replaceLanguageAlias(source, pattern, replacement, label, matches) {
  let replaced = false;
  const text = source.replace(pattern, (...args) => {
    replaced = true;
    if (typeof replacement === "function") return replacement(...args);
    return replacement.replace(/\$(\d+)/g, (_token, index) => String(args[Number(index)] ?? ""));
  });
  if (replaced) matches.add(label);
  return text;
}

// This is intentionally a small, deterministic adapter rather than a second
// interpretation pass. Every replacement expands to wording the existing
// extraction and family templates already understand.
function normalizeDndLanguage(request) {
  const matches = new Set();
  let text = String(request ?? "");
  text = replaceLanguageAlias(text, /\bonce\s+a\s+day\b/gi, "once per day", "once a day", matches);
  text = replaceLanguageAlias(text, /\b(?:pop|burn)\s+(\d+)\s+charges?\b/gi, "spend $1 charges", "spend charges", matches);
  text = replaceLanguageAlias(text, /\b(?:tops?\s+(?:itself\s+)?(?:back\s+)?up|gets?)\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(?:charges?\s+)?back\s+at\s+dawn\b/gi, "regains $1 charges daily at dawn", "dawn charge recovery", matches);
  text = replaceLanguageAlias(text, /\bat\s+dawn,?\s+roll\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+and\s+(?:put|get)\s+that\s+many\s+charges?\s+back\b/gi, "regains $1 charges daily at dawn", "dawn charge recovery", matches);
  text = replaceLanguageAlias(text, /\bshrug\s+off\s+(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder)(?:\s+damage)?\b/gi, "resistance to $1 damage", "damage resistance", matches);
  text = replaceLanguageAlias(text, /\b(?:chug(?:ging)?|drink(?:ing)?)\s+(?:it|this)\s+takes?\s+an\s+action\b/gi, "a creature can drink it as an action", "drink as an action", matches);
  text = replaceLanguageAlias(text, /\bgets?\s+(?:you|the\s+(?:drinker|user|wearer))\s+back\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+HP\b/gi, "regain $1 hit points", "healing hit points", matches);
  text = replaceLanguageAlias(text, /\b(?:one-and-done|single-use)\b/gi, "consumed after one use", "single use", matches);
  text = replaceLanguageAlias(text, /\bcall\s+in\s+(a\s+)?friendly\b/gi, "summon a friendly", "summon creature", matches);
  for (const spellName of SPELL_NAMES) {
    const escaped = spellName.replace(/[^A-Za-z ]/g, "\\$&").replace(/\s+/g, "\\s+");
    text = replaceLanguageAlias(text, new RegExp(`\\b(?:bamf\\s+with|fire\\s+off|drop|go\\s+nova\\s+with)\\s+${escaped}\\b`, "gi"), `cast ${spellName}`, "cast named spell", matches);
  }
  return { text, aliases: [...matches] };
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

function explicitNameValue(value) {
  const text = compactText(value);
  if (!text) return "";
  const beforeInstruction = text.match(/^(.{2,80}?)[.!?]\s+(?=(?:make|create|build|design|craft|generate)\b)/i)?.[1];
  return unwrapNameQuotes(beforeInstruction ?? text);
}

function firstTitleLine(request) {
  const line = String(request ?? "").split(/\r?\n/).map(value => value.trim()).find(Boolean) ?? "";
  if (!line || line.includes(":") || /^(make|create|build|design|craft|generate)\b/i.test(line)) return "";
  const beforeInstruction = line.match(/^(.{2,80}?)[.!?]\s+(?=(?:make|create|build|design|craft|generate)\b)/i)?.[1];
  if (beforeInstruction) return unwrapNameQuotes(beforeInstruction);
  if (line.length > 80) return "";
  return unwrapNameQuotes(line);
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
  const explicit = explicitNameValue(fields["item name"] ?? fields.name);
  if (explicit) return explicit;
  if (/\balchemist(?:'s)?\s+fire\b/i.test(text)) return "Alchemist Fire";
  if (/\bacid\s+flask\b/i.test(text)) return "Acid Flask";
  if (/\bholy\s+water\b/i.test(text)) return "Holy Water";
  const title = firstTitleLine(text);
  if (title) return title;
  const named = String(text ?? "").match(/\b(?:named|called)\s+(?:"([^"]+)"|'([^']+)'|(.+?))(?=\s+(?:with|that|which|who|it|once|as|while|requiring|requires)\b|[.,;\n]|$)/i);
  return unwrapNameQuotes(named?.[1] ?? named?.[2] ?? named?.[3]);
}

function detectMagicalBonus(text, baseItem = "", { skipDefault = false } = {}) {
  const explicit = String(text ?? "").match(/\B\+(\d)\b(?!\s*d)/);
  if (explicit) return explicit[1];
  const attackRolls = /(?:\+\s*(\d)|(\d)\s*\+)\s+to\s+(?:attack|attack rolls?|attack and damage rolls?)/i.exec(text);
  const damageRolls = /(?:\+\s*(\d)|(\d)\s*\+)\s+to\s+damage rolls?/i.exec(text);
  const extracted = attackRolls?.[1] || attackRolls?.[2] || damageRolls?.[1] || damageRolls?.[2] || "";
  return extracted;
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
  if (/attunement\s*:\s*(?:not required|no|none)|(?:does|do)(?:\s+not|n't)\s+(?:need|require)\s+attunement|no attunement/i.test(text)) return "none";
  if (/attunement|required by|requires? attunement/i.test(text)) return "required";
  return "";
}

function detectCastSpellNames(text) {
  const names = [];
  const pattern = /\bcast\s+([A-Za-z][A-Za-z'-]*(?:\s+(?:of|the|[A-Za-z][A-Za-z'-]*)){0,4}?)(?=\s+(?:with|using|at|for|from|by|once|twice|thrice|\d+\s+times?)\b|[,.;\n]|$)/gi;
  for (const match of String(text ?? "").matchAll(pattern)) {
    const name = compactText(match[1]);
    if (!name || /\b(?:charge|damage|save|saving|creature|target|action)\b/i.test(name)) continue;
    names.push(titleCaseWords(name));
  }
  return names;
}

function detectSpellNames(text, fields = {}) {
  const fieldSpells = compactText(fields.spell || fields.spells)
    .split(/\s*[;,/]\s*|\s+\band\b\s+/i)
    .map(spell => compactText(spell))
    .filter(Boolean);
  const names = new Map();
  const addName = spellName => names.set(compactText(spellName).toLowerCase(), spellName);
  for (const fieldSpell of fieldSpells) addName(titleCaseWords(fieldSpell));
  for (const spellName of detectCastSpellNames(text)) addName(spellName);
  for (const spellName of SPELL_NAMES) {
    const pattern = new RegExp(`\\b${spellName.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(text)) addName(spellName);
  }
  return [...names.values()];
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
  const rechargeMatch = source.match(/regains?\s+([^.;\n]+?)\s+charges?\s+(daily at dawn|at dawn|daily|on a long rest|per long rest|after a long rest|on a short rest|after a short rest)/i);
  const recharge = rechargeMatch?.[1]?.trim() ?? "";
  const cadence = rechargeMatch?.[2]?.toLowerCase() ?? "";
  if (recharge) return `${max} charges; regains ${recharge}${cadence ? ` ${cadence}` : ""}`;
  return `${max} charges`;
}

function detectSaveDc(text, spellNames = []) {
  const explicit = String(text ?? "").match(/\b(?:spell\s+save\s+)?dc\s*(\d+)\b/i)?.[1];
  return explicit ?? "";
}

function detectSaveAbility(text) {
  const match = String(text ?? "").match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+sav(?:e|ing throw)\b/i)
    ?? String(text ?? "").match(/\bsave\s*:\s*(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/i);
  return match ? titleCaseWords(match[1].toLowerCase()) : "";
}

function detectSaveActivity(text) {
  return /\b(?:saving throw|[a-z]+\s+save|save\s*:)\b/i.test(String(text ?? ""));
}

function detectDamageResistances(text) {
  const source = String(text ?? "");
  const damageTypes = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
  return damageTypes.filter(type => new RegExp(`\\bresistance to ${type}(?: damage)?\\b`, "i").test(source));
}

function detectHealingFormula(text) {
  const match = String(text ?? "").match(/\b(?:regain|restore|heal|healing)\b[^.!?]*?(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+hit points?\b/i);
  return match?.[1]?.replace(/\s+/g, " ") ?? "";
}

function detectChargeCost(text) {
  const match = String(text ?? "").match(/\bspend\s+(\d+)\s+charges?\b/i)
    ?? String(text ?? "").match(/\buses?\s+(\d+)\s+charges?\b/i);
  return match ? Number(match[1]) : 0;
}

function detectHalfOnSuccess(text) {
  return /\bhalf(?:\s+as\s+much)?\s+(?:damage\s+)?on\s+(?:a\s+)?success\b/i.test(String(text ?? ""));
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
  const radiusArea = String(text ?? "").match(/\b(\d+)\s*(?:-|\s)?(?:foot|feet)\s*(?:-|\s)?radius\s+(sphere|cylinder)\b/i);
  if (radiusArea) return `${radiusArea[1]}-foot-radius ${radiusArea[2].toLowerCase()}`;
  const area = String(text ?? "").match(/\b(\d+)\s*(?:-|\s)?(?:foot|feet)\s+(cone|cube|line|sphere|cylinder)\b/i);
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
  if (extracted.damageParts.length && !extracted.saveActivity) {
    riderLines.push(`Extra hit damage: ${extracted.damageParts.map(part =>
      `${part.number}d${part.denomination}${part.bonus ? ` ${part.bonus}` : ""} ${part.type.toLowerCase()}`
    ).join("; ")}`);
  }
  if (extracted.damageResistances.length) {
    riderLines.push(`Resistance to: ${extracted.damageResistances.map(type => `${type} damage`).join("; ")}`);
  }
  if (riderLines.length) {
    sections.push(["Complexity layer 2 - Passive riders", ...riderLines].join("\n"));
  }

  const resourceLines = [];
  if (extracted.spellUsage) resourceLines.push(`Spell usage: ${extracted.spellUsage}`);
  if (extracted.chargeSummary) resourceLines.push(`Charges: ${extracted.chargeSummary}`);
  if ((extracted.throwableConsumable || ["potion", "oil"].includes(extracted.baseItem)) && /\b(?:consumed|one use|single use)\b/i.test(chunk)) {
    resourceLines.push("Use model: Consumed after one use");
  }
  if (resourceLines.length) {
    sections.push(["Complexity layer 3 - Resource model", ...resourceLines].join("\n"));
  }

  const activityLines = [];
  if (extracted.spellNames.length) activityLines.push(`Spell: ${extracted.spellNames.join("; ")}`);
  if (extracted.healingFormula) activityLines.push(`Healing: ${extracted.healingFormula} hit points`);
  if (extracted.saveActivity) {
    activityLines.push("Activation: Action");
    if (extracted.saveAbility || extracted.saveDc) {
      activityLines.push(`Saving throw: ${extracted.saveAbility || "Dexterity"} DC ${extracted.saveDc || "15"}`);
    }
    if (extracted.damageParts.length) {
      activityLines.push(`Damage on failed save: ${extracted.damageParts.map(part =>
        `${part.number}d${part.denomination}${part.bonus ? ` ${part.bonus}` : ""} ${part.type.toLowerCase()}`
      ).join("; ")}${extracted.halfOnSuccess ? "; half damage on success" : ""}`);
    }
    if (extracted.chargeCost) activityLines.push(`Charge cost: ${extracted.chargeCost}`);
    if (extracted.areaSummary) activityLines.push(`Area: ${extracted.areaSummary}`);
  } else if (extracted.saveDc) {
    activityLines.push(`Spell save DC: ${extracted.saveDc}`);
  }
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
  const language = normalizeDndLanguage(original);
  const canonical = language.text;
  const fields = parseFields(canonical);
  const baseItem = detectBaseItem(canonical, fields);
  const throwableConsumable = detectThrowableConsumable(canonical, fields);
  const extracted = {
    name: detectExplicitName(canonical, fields),
    baseItem,
    rarity: detectRarity(canonical, fields),
    magicalBonus: detectMagicalBonus(canonical, baseItem, { skipDefault: throwableConsumable }),
    damageParts: parseDamageParts(canonical),
    spellNames: detectSpellNames(canonical, fields),
    spellUsage: detectSpellUsage(canonical),
    saveDc: detectSaveDc(canonical, detectSpellNames(canonical, fields)),
    saveAbility: detectSaveAbility(canonical),
    saveActivity: detectSaveActivity(canonical),
    damageResistances: detectDamageResistances(canonical),
    healingFormula: detectHealingFormula(canonical),
    chargeCost: detectChargeCost(canonical),
    halfOnSuccess: detectHalfOnSuccess(canonical),
    chargeSummary: detectChargeSummary(canonical),
    attunement: detectAttunement(canonical, fields),
    throwableConsumable,
    throwRange: detectThrownRange(original),
    areaSummary: detectAreaSummary(original)
  };

  const layeredBrief = buildLayeredBrief(canonical, extracted);
  const structured = extracted.name
    ? `Item name: ${extracted.name}\n\n${layeredBrief}`
    : layeredBrief;
  // Preserve the concise player-facing wording so service-side recovery can
  // distinguish a trinket or charm from a model-inferred weapon chassis.
  const normalized = compactText(structured) === compactText(original)
    ? structured
    : `${structured}\n\nOriginal request: ${original}`;
  const changed = compactText(normalized) !== compactText(original) && !ITEM_FIELD_PATTERN.test(original);

  return {
    original,
    normalized,
    changed,
    extracted,
    languageAliases: language.aliases
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
  const languageAliases = [...new Set(items.flatMap(item => item.languageAliases ?? []))];
  if (languageAliases.length) {
    notes.push(`Recognized D&D shorthand: ${languageAliases.join(", ")}.`);
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
