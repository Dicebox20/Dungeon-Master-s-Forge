const TEMPLATE_LAYERS = Object.freeze([
  "baseChassis",
  "classification",
  "passiveMechanics",
  "resourcePool",
  "namedActivities",
  "effects",
  "advancedMechanics"
]);

const ACTIVITY_LISTS = Object.freeze(["attackActivities", "saveActivities", "utilityActivities", "activities"]);
const DIRECT_WEAPON_KINDS = new Set(["weaponExtraDamage", "weaponConditionOnHit"]);
const GENERIC_ACTIVITY_NAME = /^(?:triggered power|secondary effect|utility\s+\d+|save\s+\d+)$/i;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function activityName(activity) {
  return compactText(activity?.activityName).toLowerCase();
}

function isNamedSpellActivity(activity) {
  return /^cast\s+.+/i.test(compactText(activity?.activityName));
}

function spellNameFromActivity(activity) {
  const name = compactText(activity?.activityName);
  const castMatch = name.match(/^Cast\s+(.+)$/i);
  if (castMatch) return compactText(castMatch[1]);
  if (!name || /^attack with\b/i.test(name) || /^summon\b/i.test(name) || GENERIC_ACTIVITY_NAME.test(name)) return "";
  return name;
}

function namedSpellActivityNames(spec) {
  return [...new Set(allActivities(spec)
    .map(({ activity }) => spellNameFromActivity(activity))
    .filter(Boolean))];
}

function numericUseMax(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function chargeLimitFromRequest(request) {
  return numericUseMax(/\b(\d+)\s+charges?\b/i.exec(request)?.[1]);
}

function recoveryFromRequest(request) {
  if (/\b(?:once\s+per\s+)?short\s+rest\b/i.test(request)) {
    return [{ period: "sr", type: "recoverAll", formula: "" }];
  }
  if (/\b(?:once\s+per\s+)?long\s+rest\b/i.test(request)) {
    return [{ period: "lr", type: "recoverAll", formula: "" }];
  }
  if (/\b(?:daily|at\s+dawn|once\s+per\s+day)\b/i.test(request)) {
    const formula = /\bregains?\s+([^.;\n]+?)\s+charges?\b/i.exec(request)?.[1]?.trim() ?? "";
    return [{ period: "dawn", type: formula ? "formula" : "recoverAll", formula }];
  }
  if (/\b\d+\s+charges?\b/i.test(request)) {
    return [{ period: "lr", type: "recoverAll", formula: "" }];
  }
  return [];
}

function normalizeActivityLists(spec) {
  const next = clone(spec);
  let changed = false;
  for (const listName of ACTIVITY_LISTS) {
    if (next[listName] == null) continue;
    if (Array.isArray(next[listName])) continue;
    next[listName] = [];
    changed = true;
  }
  return { changed, spec: next };
}

function allActivities(spec) {
  return ACTIVITY_LISTS.flatMap(listName =>
    (Array.isArray(spec[listName]) ? spec[listName] : []).map(activity => ({ listName, activity }))
  );
}

function activityDestination(activity) {
  const type = compactText(activity?.type).toLowerCase();
  if (type === "attack" || activity?.attack) return "attackActivities";
  if (type === "save" || activity?.save || activity?.damageOnSave) return "saveActivities";
  return "utilityActivities";
}

function materializeTypedActivities(spec) {
  const next = clone(spec);
  const generic = Array.isArray(next.activities) ? next.activities : [];
  if (!generic.length) return { changed: false, spec: next };

  let moved = 0;
  for (const activity of generic) {
    if (!activity || typeof activity !== "object") continue;
    const destination = activityDestination(activity);
    const target = Array.isArray(next[destination]) ? next[destination] : [];
    const name = activityName(activity);
    const sameActivity = target.some(candidate =>
      (activity.activityId && candidate?.activityId === activity.activityId)
      || (name && activityName(candidate) === name)
    );
    if (!sameActivity) target.push(activity);
    next[destination] = target;
    moved += 1;
  }
  delete next.activities;
  return { changed: moved > 0, spec: next, moved };
}

function normalizeSpellActivityCosts(spec, request) {
  if (!/\b(?:once\s+per\s+(?:short|long)\s+rest|once\s+per\s+day|daily|at\s+dawn)\b/i.test(request)) {
    return { changed: false, spec };
  }
  const next = clone(spec);
  let changed = false;
  for (const listName of ACTIVITY_LISTS) {
    if (!Array.isArray(next[listName])) continue;
    next[listName] = next[listName].map(activity => {
      if (!isNamedSpellActivity(activity) || Number(activity?.chargeCost ?? 0) > 0) return activity;
      changed = true;
      return { ...activity, chargeCost: 1 };
    });
  }
  return { changed, spec: next };
}

function removeGenericSpellShadows(spec) {
  const next = clone(spec);
  const namedSpellCount = allActivities(next).filter(({ activity }) => isNamedSpellActivity(activity)).length;
  if (!namedSpellCount) return { changed: false, spec: next };

  let removed = 0;
  for (const listName of ["saveActivities", "utilityActivities", "attackActivities"]) {
    if (!Array.isArray(next[listName])) continue;
    const before = next[listName].length;
    next[listName] = next[listName].filter(activity => !GENERIC_ACTIVITY_NAME.test(compactText(activity?.activityName)));
    removed += before - next[listName].length;
  }
  return { changed: removed > 0, spec: next, removed };
}

function normalizeResourcePool(spec, request) {
  const next = clone(spec);
  const consuming = allActivities(next)
    .map(({ activity }) => Number(activity?.chargeCost ?? 0))
    .filter(cost => Number.isFinite(cost) && cost > 0);
  if (!consuming.length) return { changed: false, spec: next };

  const current = next.uses && typeof next.uses === "object" ? next.uses : {};
  const currentMax = numericUseMax(current.max);
  const requestMax = chargeLimitFromRequest(request);
  const max = currentMax || requestMax || Math.max(...consuming);
  const recovery = Array.isArray(current.recovery) && current.recovery.length
    ? current.recovery
    : recoveryFromRequest(request);
  const uses = {
    spent: Number.isFinite(Number(current.spent)) ? Number(current.spent) : 0,
    max: String(max),
    recovery,
    autoDestroy: Boolean(current.autoDestroy)
  };
  const changed = JSON.stringify(uses) !== JSON.stringify(next.uses ?? {});
  next.uses = uses;
  return { changed, spec: next, uses };
}

function promoteWeaponHybrid(spec) {
  const next = clone(spec);
  if (!DIRECT_WEAPON_KINDS.has(next.kind)) return { changed: false, spec: next };
  const hasActiveMechanics = allActivities(next).length > 0;
  if (!hasActiveMechanics) return { changed: false, spec: next };
  next.kind = "artifactWeaponHybrid";
  return { changed: true, spec: next };
}

function clearResolvedActivityWarnings(spec) {
  const next = clone(spec);
  if (!Array.isArray(next.unresolvedMechanics)) return { changed: false, spec: next };
  const spellNames = namedSpellActivityNames(next);
  if (!spellNames.length) return { changed: false, spec: next };
  const before = next.unresolvedMechanics.length;
  next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => {
    const category = compactText(mechanic?.category).toLowerCase();
    const text = [mechanic?.label, mechanic?.reason, mechanic?.handling].map(compactText).join(" ");
    const mentionsResolvedSpell = spellNames.some(spellName => text.toLowerCase().includes(spellName.toLowerCase()));
    const staleResolvedSpellNote = /(?:spell[- ]cast activity|save-based effect) was not preserved|cannot encode .* spell|activated spell casting is not supported by .* family|does not support spell activities|chosen weapon family has no supported spell-save activity field|daily spell usage integration|partially represented|does not support a spell-activation resource model|does not support a separate spell save dc/i.test(text);
    if (mentionsResolvedSpell && ["unmappedspell", "tableadjudication", "spell"].includes(category)) return false;
    if (staleResolvedSpellNote && ["unmappedspell", "tableadjudication", "spell"].includes(category)) return false;
    return true;
  });
  if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  return { changed: before !== (next.unresolvedMechanics?.length ?? 0), spec: next };
}

function buildLayeredItemBlueprint(spec, request = "") {
  let next = clone(spec);
  const layers = {};
  const assumptions = [];

  const normalized = normalizeActivityLists(next);
  next = normalized.spec;
  layers.baseChassis = { complete: Boolean(next.baseItem || next.equipmentType || next.itemType) };
  layers.classification = { kind: next.kind ?? "" };
  layers.passiveMechanics = { complete: true };

  const promoted = promoteWeaponHybrid(next);
  next = promoted.spec;
  if (promoted.changed) assumptions.push("Promoted the item to the hybrid weapon renderer before attaching active mechanics.");

  const materialized = materializeTypedActivities(next);
  next = materialized.spec;
  if (materialized.changed) assumptions.push("Mapped generic activity payloads into the renderer's typed activity layers.");

  const deduped = removeGenericSpellShadows(next);
  next = deduped.spec;
  if (deduped.changed) assumptions.push("Removed generic activity placeholders shadowed by named spell activities.");

  const costs = normalizeSpellActivityCosts(next, request);
  next = costs.spec;

  const resources = normalizeResourcePool(next, request);
  next = resources.spec;
  if (resources.changed) assumptions.push("Derived one shared item resource pool before rendering charge-consuming activities.");
  layers.resourcePool = { complete: Boolean(resources.uses), uses: resources.uses ?? null };

  const warnings = clearResolvedActivityWarnings(next);
  next = warnings.spec;
  layers.namedActivities = { count: allActivities(next).length };
  layers.effects = { count: (next.effects?.length ?? 0) + (next.passiveEffects?.length ?? 0) };
  layers.advancedMechanics = { unresolved: next.unresolvedMechanics?.length ?? 0 };

  return {
    applied: normalized.changed || promoted.changed || materialized.changed || deduped.changed || costs.changed || resources.changed || warnings.changed,
    spec: next,
    layers,
    assumptions
  };
}

export { TEMPLATE_LAYERS, buildLayeredItemBlueprint };
