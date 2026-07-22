/*
 * Summon requests name an intended DND5e actor. Free Forge only creates a
 * summon when that exact actor can be resolved from system-owned SRD content.
 */

function titleCase(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, character => character.toUpperCase());
}

const GENERIC_SUMMON_TERMS = new Set([
  "ally",
  "companion",
  "creature",
  "familiar",
  "spirit",
  "summon"
]);

function cleanCreatureName(value) {
  const candidate = String(value ?? "")
    .replace(/^[\s,.:;]+|[\s,.:;]+$/g, "")
    .replace(/^(?:(?:a|an|the|one)\s+)?(?:friendly|loyal|tame)\s+/i, "")
    .replace(/^(?:a|an|the|one)\s+/i, "")
    .replace(/^(?:friendly|loyal|tame)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!candidate || candidate.length > 60 || !/^[a-z][a-z' -]*$/i.test(candidate)) return "";
  return GENERIC_SUMMON_TERMS.has(candidate.toLowerCase()) ? "" : titleCase(candidate);
}

function extractCandidateAfterSummon(text) {
  const candidates = [...String(text ?? "").matchAll(/\b(?:summon|conjure|call forth|call in)\s+(?:(?:a|an|the)\s+)?([a-z][a-z' -]{0,80})/gi)]
    .map(match => match[1]
      .split(/\s+(?:that|which|who|for|within|in|at|as|to|and|with|from|while|until|whose|serves?|obeys?|appears?)\b/i)[0])
    .map(cleanCreatureName)
    .filter(Boolean);
  // Item text often names a power first, then states its concrete creature.
  return candidates.at(-1) ?? "";
}

function extractNamedSrdSummon(text) {
  return extractCandidateAfterSummon(text);
}

function genericSrdSummonActor(creatureName) {
  const profileName = titleCase(creatureName);
  return {
    name: `Friendly ${profileName}`,
    // The renderer resolves and clones the exact SRD actor; no synthetic stats belong here.
    srdActorName: profileName,
    requireSrdActor: true
  };
}

function namedSrdSummonActor(profileName, srdActorName = profileName) {
  return {
    ...genericSrdSummonActor(profileName),
    srdActorName: titleCase(srdActorName)
  };
}

export {
  extractNamedSrdSummon,
  genericSrdSummonActor,
  namedSrdSummonActor
};
