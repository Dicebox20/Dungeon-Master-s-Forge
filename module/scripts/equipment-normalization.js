const DEFAULT_ITEM_ICON = "icons/svg/item-bag.svg";

const VALID_ITEM_DOCUMENT_TYPES = Object.freeze([
  "weapon",
  "equipment",
  "consumable",
  "tool",
  "loot",
  "backpack",
  "container",
  "feat",
  "spell"
]);

const IMPLEMENT_CATEGORIES = Object.freeze(["rod", "wand", "staff"]);

const ARMOR_PROFILES = Object.freeze([
  { pattern: /\bshield\b/i, equipmentType: "shield", baseItem: "shield", armorValue: 2, armorDex: null, weight: 6, isShield: true, label: "Shield" },
  { pattern: /\bplate(?:\s+armor)?\b/i, equipmentType: "heavy", baseItem: "plate", armorValue: 18, armorDex: null, weight: 65, strength: 15, label: "Plate Armor" },
  { pattern: /\bsplint(?:\s+armor)?\b/i, equipmentType: "heavy", baseItem: "splint", armorValue: 17, armorDex: null, weight: 60, strength: 15, label: "Splint Armor" },
  { pattern: /\bchain\s+mail\b/i, equipmentType: "heavy", baseItem: "chainmail", armorValue: 16, armorDex: null, weight: 55, strength: 13, label: "Chain Mail" },
  { pattern: /\bring\s+mail\b/i, equipmentType: "heavy", baseItem: "ringmail", armorValue: 14, armorDex: null, weight: 40, label: "Ring Mail" },
  { pattern: /\bhalf\s*plate\b/i, equipmentType: "medium", baseItem: "halfplate", armorValue: 15, armorDex: 2, weight: 40, label: "Half Plate" },
  { pattern: /\bbreastplate\b/i, equipmentType: "medium", baseItem: "breastplate", armorValue: 14, armorDex: 2, weight: 20, label: "Breastplate" },
  { pattern: /\bscale\s+mail\b/i, equipmentType: "medium", baseItem: "scalemail", armorValue: 14, armorDex: 2, weight: 45, label: "Scale Mail" },
  { pattern: /\bhide(?:\s+armor)?\b/i, equipmentType: "medium", baseItem: "hide", armorValue: 12, armorDex: 2, weight: 12, label: "Hide Armor" },
  { pattern: /\bstudded\s+leather(?:\s+armor)?\b/i, equipmentType: "light", baseItem: "studded", armorValue: 12, armorDex: null, weight: 13, label: "Studded Leather Armor" },
  { pattern: /\bleather(?:\s+armor)?\b/i, equipmentType: "light", baseItem: "leather", armorValue: 11, armorDex: null, weight: 10, label: "Leather Armor" },
  { pattern: /\bpadded(?:\s+armor)?\b/i, equipmentType: "light", baseItem: "padded", armorValue: 11, armorDex: null, weight: 8, label: "Padded Armor" }
]);

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMagicalBonus(value, fallback = "") {
  const normalized = compact(value);
  if (!normalized) return fallback;
  if (/^(?:true|false|null|undefined|nan)$/i.test(normalized)) return fallback;
  if (!/^[+-]?\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return fallback;
    return String(Math.trunc(numeric));
  }
  const unsigned = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  return unsigned === "-0" ? "0" : unsigned;
}

function normalizeWeight(value, fallback = 0) {
  const source = value && typeof value === "object" ? value.value : value;
  if (source === "" || source == null) return fallback;
  const numeric = Number(source);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function specSearchText(spec = {}) {
  return [
    spec.name,
    spec.baseItem,
    spec.equipmentType,
    spec.itemType,
    spec.description
  ].map(compact).filter(Boolean).join(" ");
}

function safeItemIcon(value, fallback = DEFAULT_ITEM_ICON) {
  const normalized = compact(value);
  if (!normalized || normalized === "undefined" || normalized === "null") return fallback;
  return normalized;
}

function normalizeItemDocumentType(value, fallback = "equipment") {
  const normalized = compact(value);
  if (!normalized) return fallback;
  if (IMPLEMENT_CATEGORIES.includes(normalized.toLowerCase())) return "equipment";
  return VALID_ITEM_DOCUMENT_TYPES.includes(normalized) ? normalized : fallback;
}

function isImplementCategory(value) {
  return IMPLEMENT_CATEGORIES.includes(compact(value).toLowerCase());
}

function inferArmorProfile(spec = {}) {
  const text = specSearchText(spec);
  const profile = ARMOR_PROFILES.find(entry => {
    if (!entry.pattern.test(text)) return false;
    if (entry.isShield && /\bnot\s+(?:a\s+)?shield\b/i.test(text)) return false;
    return true;
  });
  if (profile) return { isShield: false, ...profile };
  return {
    equipmentType: spec.equipmentType ?? "shield",
    baseItem: spec.baseItem ?? "shield",
    armorValue: spec.armorValue ?? 2,
    armorDex: spec.armorDex ?? null,
    weight: spec.weight ?? 6,
    strength: spec.strength ?? null,
    isShield: true,
    label: "Shield"
  };
}

function armorBonusValue(spec = {}, profile = inferArmorProfile(spec)) {
  const explicit = normalizeMagicalBonus(spec.magicalBonus);
  if (explicit && explicit !== "0") return explicit;
  return "1";
}

export {
  DEFAULT_ITEM_ICON,
  armorBonusValue,
  inferArmorProfile,
  isImplementCategory,
  normalizeMagicalBonus,
  normalizeItemDocumentType,
  normalizeWeight,
  safeItemIcon
};
