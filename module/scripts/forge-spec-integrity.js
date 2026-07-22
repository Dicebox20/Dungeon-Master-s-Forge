function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalizeForFingerprint(value) {
  if (Array.isArray(value)) return value.map(canonicalizeForFingerprint);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalizeForFingerprint(value[key])]));
  }
  return value;
}

// This is diagnostic change detection, not a security or authenticity check.
function fingerprintForgeSpecs(specs) {
  const input = JSON.stringify(canonicalizeForFingerprint(Array.isArray(specs) ? specs : []));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stableId(label) {
  const base = String(label).replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "Forge";
  let hash = 2166136261;
  for (const character of String(label)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36).padStart(5, "0").slice(-5);
  return `${base}${suffix}`.padEnd(16, "0").slice(0, 16);
}

function validId(value) {
  const normalized = compactText(value);
  return /^[A-Za-z0-9]{16}$/.test(normalized) && !/^0+$/.test(normalized);
}

function uniqueStableId(label, usedIds) {
  let candidate = stableId(label);
  let attempt = 0;
  while (usedIds.has(candidate)) {
    attempt += 1;
    candidate = stableId(`${label}-${attempt}`);
  }
  usedIds.add(candidate);
  return candidate;
}

function sanitizeProfileList(profiles, specName, contextName, usedIds = new Set()) {
  if (!Array.isArray(profiles)) return profiles;
  return profiles.map((profile, index) => {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return profile;
    const next = clone(profile);
    const currentId = compactText(next.profileId);
    if (!validId(currentId) || usedIds.has(currentId)) {
      next.profileId = uniqueStableId(`${specName}-${contextName}-${next.profileName ?? index}`, usedIds);
    } else {
      usedIds.add(currentId);
    }
    return next;
  });
}

function numericWeight(value) {
  const candidate = value && typeof value === "object" ? value.value : value;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function sanitizeActivity(activity, specName, listName, index, usedIds = new Set()) {
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) return null;
  const next = clone(activity);
  const defaultName = listName === "saveActivities" ? `Power ${index + 1}` : `Use ${specName}`;
  const currentId = compactText(next.activityId);
  if (!validId(currentId) || usedIds.has(currentId)) {
    next.activityId = uniqueStableId(`${specName}-${listName}-${next.activityName ?? index}`, usedIds);
  } else {
    usedIds.add(currentId);
  }
  next.activityName = compactText(next.activityName) || defaultName;
  if (Array.isArray(next.summonProfiles)) {
    next.summonProfiles = sanitizeProfileList(next.summonProfiles, specName, `${listName}-${index}`);
  }
  return next;
}

function sanitizeEffect(effect, specName, listName, index) {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) return null;
  const next = clone(effect);
  next.effectId = validId(next.effectId)
    ? next.effectId
    : stableId(`${specName}-${listName}-${next.name ?? index}`);
  next.name = compactText(next.name) || `${specName} Effect`;
  return next;
}

function sanitizeActivityList(spec, listName, usedIds) {
  if (!Array.isArray(spec[listName])) return { changed: false, activities: spec[listName] };
  const activities = spec[listName]
    .map((activity, index) => sanitizeActivity(activity, spec.name, listName, index, usedIds))
    .filter(Boolean);
  const changed = JSON.stringify(activities) !== JSON.stringify(spec[listName]);
  return { changed, activities };
}

function sanitizeForgeSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { applied: false, spec };
  const next = clone(spec);
  const repairs = [];
  const usedActivityIds = new Set();

  for (const [key, suffix] of [["activityId", "activity"], ["profileId", "profile"], ["effectId", "effect"]]) {
    if (next[key] == null || validId(next[key])) continue;
    next[key] = stableId(`${next.name}-${suffix}`);
    repairs.push(`normalized ${key}`);
  }

  if (next.weight != null) {
    const normalized = numericWeight(next.weight);
    if (next.weight !== normalized) {
      next.weight = normalized;
      repairs.push("normalized item weight");
    }
  }

  for (const listName of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    const result = sanitizeActivityList(next, listName, usedActivityIds);
    if (!result.changed) continue;
    next[listName] = result.activities;
    repairs.push(`normalized ${listName}`);
  }

  for (const listName of ["effects", "passiveEffects"]) {
    if (!Array.isArray(next[listName])) continue;
    const effects = next[listName]
      .map((effect, index) => sanitizeEffect(effect, next.name, listName, index))
      .filter(Boolean);
    if (JSON.stringify(effects) === JSON.stringify(next[listName])) continue;
    next[listName] = effects;
    repairs.push(`normalized ${listName}`);
  }

  if (Array.isArray(next.summonProfiles)) {
    const profiles = sanitizeProfileList(next.summonProfiles, next.name, "summon");
    if (JSON.stringify(profiles) !== JSON.stringify(next.summonProfiles)) {
      next.summonProfiles = profiles;
      repairs.push("normalized summonProfiles");
    }
  }

  if (next.summonActivity) {
    const activity = sanitizeActivity(next.summonActivity, next.name, "summonActivity", 0, usedActivityIds);
    if (JSON.stringify(activity) !== JSON.stringify(next.summonActivity)) {
      next.summonActivity = activity;
      repairs.push("normalized summon activity");
    }
  }

  if (Array.isArray(next.unresolvedMechanics)) {
    const mechanics = next.unresolvedMechanics.map((mechanic, index) => {
      if (!mechanic || typeof mechanic !== "object" || Array.isArray(mechanic)) return mechanic;
      const nextMechanic = clone(mechanic);
      nextMechanic.id = validId(nextMechanic.id)
        ? nextMechanic.id
        : stableId(`${next.name}-unresolved-${index}`);
      return nextMechanic;
    });
    if (JSON.stringify(mechanics) !== JSON.stringify(next.unresolvedMechanics)) {
      next.unresolvedMechanics = mechanics;
      repairs.push("normalized unresolvedMechanics");
    }
  }

  if (next.toggleLight && typeof next.toggleLight === "object") {
    const toggle = clone(next.toggleLight);
    const activityId = validId(toggle.activityId) ? toggle.activityId : stableId(`${next.name}-toggle-light`);
    const effectId = validId(toggle.effectId) ? toggle.effectId : stableId(`${next.name}-toggle-light-effect`);
    if (toggle.activityId !== activityId || toggle.effectId !== effectId) {
      next.toggleLight = { ...toggle, activityId, effectId };
      repairs.push("normalized light toggle ids");
    }
  }

  return { applied: repairs.length > 0, spec: next, repairs };
}

export { canonicalizeForFingerprint, fingerprintForgeSpecs, sanitizeForgeSpec };
