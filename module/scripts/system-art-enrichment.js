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

const CONSUMABLE_PROJECTILE_ART = Object.freeze({
  acid: "icons/weapons/thrown/grenade-chemical.webp",
  cold: "icons/weapons/thrown/bomb-fuse-blue.webp",
  fire: "icons/weapons/thrown/grenade-incendiary.webp",
  genericGrenade: "icons/weapons/thrown/grenade-round.webp",
  genericFlask: "icons/consumables/potions/potion-flask-corked-orange.webp",
  lightning: "icons/weapons/thrown/grenade-energy.webp",
  poison: "icons/weapons/thrown/grenade-chemical.webp",
  thunder: "icons/weapons/thrown/bomb-pressure-black.webp"
});

const BASE_CHASSIS_ART = Object.freeze({
  wand: "icons/weapons/wands/wand-gem-red.webp"
});

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

function consumableProjectileFallbackImage(spec = {}, requestText = "") {
  const source = [
    spec.name,
    spec.description,
    spec.baseItem,
    spec.itemType,
    spec.consumableType,
    requestText
  ].filter(Boolean).join(" ");
  const isGrenade = /\b(?:grenade|bomb)\b/i.test(source);
  const isFlask = /\b(?:flask|vial|alchemist(?:'s)? fire|acid flask|holy water)\b/i.test(source);
  const isThrownConsumable = spec.itemType === "consumable"
    && /\b(?:throw|thrown|hurl|lob|consumable projectile)\b/i.test(source);
  if (!isGrenade && !isFlask && !isThrownConsumable) return "";

  if (/\b(?:lightning|electric|arc\w*)\b/i.test(source)) return CONSUMABLE_PROJECTILE_ART.lightning;
  if (/\b(?:cold|frost\w*|ice)\b/i.test(source)) return CONSUMABLE_PROJECTILE_ART.cold;
  if (/\b(?:thunder\w*|sonic|concussive)\b/i.test(source)) return CONSUMABLE_PROJECTILE_ART.thunder;
  if (/\b(?:acid|corrosive)\b/i.test(source)) return isGrenade
    ? CONSUMABLE_PROJECTILE_ART.acid
    : "icons/consumables/potions/bottle-conical-green.webp";
  if (/\b(?:poison|toxic|gas)\b/i.test(source)) return isGrenade
    ? CONSUMABLE_PROJECTILE_ART.poison
    : "icons/consumables/potions/bottle-conical-green.webp";
  if (/\b(?:fire|flame|incendiary|burn)\b/i.test(source)) return isGrenade
    ? CONSUMABLE_PROJECTILE_ART.fire
    : CONSUMABLE_PROJECTILE_ART.genericFlask;
  return isGrenade ? CONSUMABLE_PROJECTILE_ART.genericGrenade : CONSUMABLE_PROJECTILE_ART.genericFlask;
}

function applyConsumableProjectileFallbackArt(spec = {}, requestText = "") {
  if (!needsFallbackItemArt(spec?.img)) return { applied: false, status: "existing", spec };
  const img = consumableProjectileFallbackImage(spec, requestText);
  if (!img) return { applied: false, status: "missing", spec };
  return {
    applied: true,
    status: "fallback",
    img,
    spec: { ...spec, img }
  };
}

function applyBaseChassisFallbackArt(spec = {}, requestText = "") {
  const source = [spec.name, spec.baseItem, spec.equipmentType, requestText].filter(Boolean).join(" ");
  if (!/\bwand\b/i.test(source)) return { applied: false, status: "missing", spec };

  const current = compact(spec.img);
  const incompatible = needsFallbackItemArt(current) || /\/staves?\//i.test(current);
  if (!incompatible) return { applied: false, status: "existing", spec };

  const img = BASE_CHASSIS_ART.wand;
  return {
    applied: true,
    status: "fallback",
    img,
    spec: { ...spec, img }
  };
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
  BASE_CHASSIS_ART,
  CONSUMABLE_PROJECTILE_ART,
  SYSTEM_EQUIPMENT_ART_FAMILIES,
  applyBaseChassisFallbackArt,
  applyConsumableProjectileFallbackArt,
  applySpellActivityArt,
  applyFallbackActivityArt,
  applySystemEquipmentArt,
  consumableProjectileFallbackImage,
  hasImage,
  needsFallbackItemArt,
  spellActivityMatches,
  supportsSystemEquipmentArt
};
