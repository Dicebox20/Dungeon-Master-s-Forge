const damage = (type = "force") => ({ number: 1, denomination: 6, bonus: "", types: [type] });
const uses = () => ({ max: "3", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] });
const save = () => ({ ability: "dex", dc: 15 });
const actor = name => ({ name, type: "beast", ac: 13, hp: { value: 11, max: 11 } });
const effect = name => ({ name, changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }] });

function weapon(kind, name) {
  return {
    kind,
    name,
    description: `${name} description`,
    weaponType: "martialM",
    damage: { base: damage("slashing") },
    extraDamageParts: [damage("fire")]
  };
}

const validSpecs = [
  weapon("weaponExtraDamage", "Validated Blade"),
  {
    ...weapon("weaponConditionOnHit", "Validated Venom Blade"),
    conditionOnHit: { condition: "poisoned", save: { ability: "con", dc: 13 }, durationSeconds: 30 }
  },
  { kind: "passiveEffectEquipment", name: "Validated Ring", description: "Ring description", effects: [effect("Ring Ward")] },
  { kind: "shieldArmorBonus", name: "Validated Shield", description: "Shield description", armorValue: 2, magicalBonus: "1" },
  { kind: "chargedHealing", name: "Validated Vial", description: "Vial description", uses: uses(), healing: damage("healing") },
  { kind: "chargedSaveDamage", name: "Validated Wand", description: "Wand description", uses: uses(), save: save(), damageParts: [damage("thunder")] },
  {
    kind: "multiActivityStaff",
    name: "Validated Staff",
    description: "Staff description",
    uses: uses(),
    activities: [
      { activityName: "Cold Burst", save: save(), damageParts: [damage("cold")] },
      { activityName: "Force Burst", save: save(), damageParts: [damage("force")] }
    ]
  },
  {
    kind: "nativeEnchant",
    name: "Validated Oil",
    description: "Oil description",
    uses: uses(),
    duration: { seconds: 3600 },
    restrictions: { type: "weapon" },
    enchantChanges: [{ key: "system.properties", mode: "ADD", value: "mgc" }]
  },
  { kind: "nativeSummon", name: "Validated Whistle", description: "Whistle description", uses: uses(), summonActor: actor("Friendly Wolf") },
  {
    kind: "nativeMultiProfileSummon",
    name: "Validated Stone",
    description: "Stone description",
    uses: uses(),
    summonProfiles: [
      { profileName: "Wolf", actor: actor("Wolf Spirit") },
      { profileName: "Bear", actor: actor("Bear Spirit") }
    ]
  },
  {
    kind: "casterUtilityEquipment",
    name: "Validated Helm",
    description: "Helm description",
    effects: [effect("Helm Ward")],
    utilityActivities: [], saveActivities: []
  },
  {
    kind: "equipmentPowerSuite",
    name: "Validated Circlet",
    description: "Circlet description",
    effects: [], utilityActivities: [], saveActivities: [],
    attackActivities: [{ activityName: "Mind Lance", damageParts: [damage("psychic")] }]
  },
  {
    kind: "legendaryEquipmentSuite",
    name: "Validated Crown",
    description: "Crown description",
    effects: [], utilityActivities: [], attackActivities: [],
    saveActivities: [{ activityName: "Command", save: { ability: "wis", dc: 18 }, damageParts: [] }]
  },
  {
    ...weapon("artifactWeaponHybrid", "Validated Artifact"),
    toggleLight: { bright: 20, dim: 40 },
    passiveEffects: [], utilityActivities: [], saveActivities: []
  }
];

function ids() {
  let value = 0;
  return () => String(++value).padStart(16, "0");
}

export { actor, damage, ids, uses, validSpecs };
