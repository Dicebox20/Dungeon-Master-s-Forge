function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stableFeatureId(label) {
  const base = String(label).replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "Feature";
  let hash = 2166136261;
  for (const character of String(label)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36).padStart(5, "0").slice(-5);
  return `${base}${suffix}`.padEnd(16, "0").slice(0, 16);
}

function namedSpellRequests(request) {
  const names = new Set();
  const pattern = /\bcast\s+([^.;]+)/gi;
  for (const match of String(request ?? "").matchAll(pattern)) {
    for (const candidate of String(match[1]).split(/\s*,\s*|\s+(?:and|or)\s+/i)) {
      const name = compactText(candidate
        .replace(/^(?:and|or)\s+/i, "")
        .replace(/\b(?:from|using|with|at|for|by)\b.*$/i, ""));
      if (/^[A-Z][A-Za-z]*(?:\s+(?:of|the|[A-Z][A-Za-z]*))*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

function feature(type, status, label, requestedText, handling = "") {
  return { type, status, label, requestedText, handling };
}

async function planItemFeatures(request, options = {}) {
  const text = compactText(request);
  const features = [];
  const clauses = text.split(/(?<=[.;])\s+/).filter(Boolean);
  const clauseFor = pattern => clauses.find(clause => pattern.test(clause)) ?? text;

  if (/\b(?:weapon|dagger|sword|axe|glaive|trident|bow|crossbow|staff|mace|hammer|spear|whip)\b/i.test(text)) {
    features.push(feature("weaponBase", "native", "Weapon base", clauseFor(/\b(?:weapon|dagger|sword|axe|glaive|trident|bow|crossbow|staff|mace|hammer|spear|whip)\b/i)));
  }
  if (/\bextra\s+\d+\s*d\s*\d+\s+[a-z]+\s+damage\b/i.test(text)) {
    features.push(feature("extraDamage", "native", "Extra weapon damage", clauseFor(/\bextra\s+\d+\s*d\s*\d+\s+[a-z]+\s+damage\b/i)));
  }
  if (/\b\d+\s+charges?\b/i.test(text)) {
    features.push(feature("charges", "native", "Charge pool", clauseFor(/\b\d+\s+charges?\b/i)));
  }
  if (/\bregains?\b[^.]*\b(?:dawn|rest)\b/i.test(text)) {
    features.push(feature("recovery", "native", "Charge recovery", clauseFor(/\bregains?\b[^.]*\b(?:dawn|rest)\b/i)));
  }
  if (/\bupcast\b|\badditional charges?\b[^.]*\bspell level\b/i.test(text)) {
    features.push(feature("spellScaling", "native", "Spell-level charge scaling", clauseFor(/\bupcast\b|\badditional charges?\b[^.]*\bspell level\b/i)));
  }

  const resolveSpell = options.resolveSpell;
  for (const spellName of namedSpellRequests(text)) {
    let resolution = null;
    try {
      resolution = typeof resolveSpell === "function" ? await resolveSpell(spellName) : null;
    } catch {
      resolution = null;
    }
    if (resolution?.status === "compatible") {
      features.push(feature("spell", "native", `System spell: ${spellName}`, clauseFor(new RegExp(`\\b${spellName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"))));
    } else {
      features.push(feature(
        "spell",
        "manual",
        `Unavailable system spell: ${spellName}`,
        clauseFor(new RegExp(`\\b${spellName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")),
        `No compatible system spell named ${spellName} was available for safe automatic activity construction.`
      ));
    }
  }

  if (/\b(?:summon|conjure|call forth|calls forth)\b/i.test(text)) {
    const summonClause = clauseFor(/\b(?:summon|conjure|call forth|calls forth)\b/i);
    const conditional = /\b(?:while|when|if)\b[^.]*\bwater\b/i.test(text) && /\b(?:while|when|if)\b[^.]*\b(?:land|ground)\b/i.test(text);
    features.push(feature(
      conditional ? "conditionalSummon" : "summon",
      conditional ? "manual" : "native",
      conditional ? "Conditional summon" : "Summon",
      summonClause,
      conditional ? "Create separate summon activities for each creature; environmental selection and shared limits require GM or supported automation control." : ""
    ));
  }

  if (/\bonce per (?:short|long) rest\b/i.test(text) && features.some(entry => entry.type === "conditionalSummon")) {
    features.push(feature(
      "sharedUseLimit",
      "manual",
      "Shared conditional-use limit",
      clauseFor(/\bonce per (?:short|long) rest\b/i),
      "The shared rest limit across conditional summon activities requires GM or supported automation control."
    ));
  }

  return {
    request: text,
    features,
    native: features.filter(entry => entry.status === "native"),
    manual: features.filter(entry => entry.status === "manual")
  };
}

function applyFeaturePlanToSpec(spec, plan) {
  const manual = plan?.manual ?? [];
  if (!manual.length) return { applied: false, spec };
  const next = JSON.parse(JSON.stringify(spec));
  const unresolved = Array.isArray(next.unresolvedMechanics) ? [...next.unresolvedMechanics] : [];
  let applied = false;
  for (const entry of manual) {
    const key = `${entry.type}:${entry.label}`.toLowerCase();
    const alreadyPresent = unresolved.some(mechanic => `${mechanic.category}:${mechanic.label}`.toLowerCase() === key);
    if (alreadyPresent) continue;
    unresolved.push({
      id: stableFeatureId(`${next.name}-${entry.type}-${entry.label}`),
      category: entry.type,
      label: entry.label,
      requestedText: entry.requestedText,
      reason: entry.handling || "This requested feature requires manual review.",
      handling: entry.handling || "Review this feature before creating the item.",
      resolved: false
    });
    applied = true;
  }
  return applied ? { applied: true, spec: { ...next, unresolvedMechanics: unresolved } } : { applied: false, spec };
}

export { applyFeaturePlanToSpec, namedSpellRequests, planItemFeatures };
