const SERVICE_NAME = "Dungeon Master's Forge AI Service";
const SERVICE_VERSION = "1.6.1";
const FORGE_SCHEMA_VERSION = "1.0";
const PROMPT_VERSION = "1.1.0";
const MAX_SPECS_PER_REQUEST = 20;

const KNOWN_SPEC_KINDS = Object.freeze([
  "artifactWeaponHybrid",
  "casterUtilityEquipment",
  "chargedHealing",
  "chargedSaveDamage",
  "equipmentPowerSuite",
  "legendaryEquipmentSuite",
  "multiActivityStaff",
  "nativeEnchant",
  "nativeMultiProfileSummon",
  "nativeSummon",
  "passiveEffectEquipment",
  "shieldArmorBonus",
  "weaponConditionOnHit",
  "weaponExtraDamage"
]);

// Kinds select a proven renderer. Capabilities describe mechanics that may be
// composed within those renderers and are not subscription gates.
const COMPOSITIONAL_CAPABILITIES = Object.freeze([
  "areaTargeting",
  "armorAndShields",
  "attunement",
  "chargesAndRecovery",
  "conditions",
  "consumables",
  "damage",
  "enchantments",
  "healing",
  "multiActivityItems",
  "namedSrdSpells",
  "onHitRiders",
  "passiveEffects",
  "savingThrows",
  "spellAttacks",
  "summons",
  "weaponAttacks"
]);

export {
  COMPOSITIONAL_CAPABILITIES,
  FORGE_SCHEMA_VERSION,
  KNOWN_SPEC_KINDS,
  MAX_SPECS_PER_REQUEST,
  PROMPT_VERSION,
  SERVICE_NAME,
  SERVICE_VERSION
};
