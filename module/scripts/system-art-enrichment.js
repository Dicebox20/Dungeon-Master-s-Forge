const SYSTEM_EQUIPMENT_ART_FAMILIES = new Set([
  "weaponExtraDamage",
  "artifactWeaponHybrid",
  "weaponConditionOnHit",
  "shieldArmorBonus",
  "passiveEffectEquipment",
  "multiActivityStaff",
  "equipmentPowerSuite",
  "casterUtilityEquipment"
]);

function compact(value) {
  return String(value ?? "").trim();
}

function hasImage(value) {
  const normalized = compact(value);
  return normalized && normalized !== "undefined" && normalized !== "null";
}

function needsFallbackItemArt(value) {
  const normalized = compact(value);
  return !normalized || normalized === "icons/svg/item-bag.svg";
}

function supportsSystemEquipmentArt(spec = {}) {
  return SYSTEM_EQUIPMENT_ART_FAMILIES.has(String(spec.kind ?? ""));
}

function applySystemEquipmentArt(spec, img) {
  if (!supportsSystemEquipmentArt(spec) || !hasImage(img)) return spec;
  return {
    ...spec,
    img: compact(img)
  };
}

function spellActivityMatches(activityName, spellName) {
  const normalizedActivity = compact(activityName).toLowerCase();
  const normalizedSpell = compact(spellName).toLowerCase();
  if (!normalizedActivity || !normalizedSpell) return false;
  return normalizedActivity === normalizedSpell || normalizedActivity === `cast ${normalizedSpell}`;
}

function applySpellActivityArt(spec, spellName, img) {
  if (!hasImage(img)) return spec;

  const listNames = ["activities", "utilityActivities", "saveActivities", "attackActivities"];
  let changed = false;
  const next = { ...spec };

  for (const listName of listNames) {
    const activities = Array.isArray(spec?.[listName]) ? spec[listName] : null;
    if (!activities?.length) continue;

    const updated = activities.map(activity => {
      if (!spellActivityMatches(activity?.activityName, spellName)) return activity;
      changed = true;
      return {
        ...activity,
        activityImg: compact(img)
      };
    });

    next[listName] = updated;
  }

  return changed ? next : spec;
}

function firstActivityImage(spec = {}) {
  for (const listName of ["activities", "saveActivities", "utilityActivities", "attackActivities"]) {
    for (const activity of spec?.[listName] ?? []) {
      const img = compact(activity?.activityImg ?? activity?.img);
      if (hasImage(img)) return img;
    }
  }
  return "";
}

function applyFallbackActivityArt(spec) {
  if (!needsFallbackItemArt(spec?.img)) return spec;
  const fallback = firstActivityImage(spec);
  return hasImage(fallback) ? { ...spec, img: fallback } : spec;
}

export {
  SYSTEM_EQUIPMENT_ART_FAMILIES,
  applySpellActivityArt,
  applyFallbackActivityArt,
  applySystemEquipmentArt,
  hasImage,
  needsFallbackItemArt,
  spellActivityMatches,
  supportsSystemEquipmentArt
};
