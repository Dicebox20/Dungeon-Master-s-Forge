const SERVICE_NAME = "Dungeon Master's Forge AI Service";
const SERVICE_VERSION = "1.6.1";
const FORGE_SCHEMA_VERSION = "1.0";
const PROMPT_VERSION = "1.0.0";
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

export { FORGE_SCHEMA_VERSION, KNOWN_SPEC_KINDS, MAX_SPECS_PER_REQUEST, PROMPT_VERSION, SERVICE_NAME, SERVICE_VERSION };
