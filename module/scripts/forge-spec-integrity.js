function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
  return /^[A-Za-z0-9]{16}$/.test(compactText(value));
}

function numericWeight(value) {
  const candidate = value && typeof value === "object" ? value.value : value;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function sanitizeActivity(activity, specName, listName, index) {
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) return null;
  const next = clone(activity);
  const defaultName = listName === "saveActivities" ? `Power ${index + 1}` : `Use ${specName}`;
  next.activityId = validId(next.activityId)
    ? next.activityId
    : stableId(`${specName}-${listName}-${next.activityName ?? index}`);
  next.activityName = compactText(next.activityName) || defaultName;
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

function sanitizeActivityList(spec, listName) {
  if (!Array.isArray(spec[listName])) return { changed: false, activities: spec[listName] };
  const activities = spec[listName]
    .map((activity, index) => sanitizeActivity(activity, spec.name, listName, index))
    .filter(Boolean);
  const changed = JSON.stringify(activities) !== JSON.stringify(spec[listName]);
  return { changed, activities };
}

function sanitizeForgeSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { applied: false, spec };
  const next = clone(spec);
  const repairs = [];

  if (next.weight != null) {
    const normalized = numericWeight(next.weight);
    if (next.weight !== normalized) {
      next.weight = normalized;
      repairs.push("normalized item weight");
    }
  }

  for (const listName of ["activities", "attackActivities", "saveActivities", "utilityActivities"]) {
    const result = sanitizeActivityList(next, listName);
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

  if (next.summonActivity) {
    const activity = sanitizeActivity(next.summonActivity, next.name, "summonActivity", 0);
    if (JSON.stringify(activity) !== JSON.stringify(next.summonActivity)) {
      next.summonActivity = activity;
      repairs.push("normalized summon activity");
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

export { sanitizeForgeSpec };
