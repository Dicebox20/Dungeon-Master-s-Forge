import assert from "node:assert/strict";
import { compileItemRequest } from "../scripts/request-compiler.js";
import { buildReviewSummaries } from "../scripts/review-summary.js";

function review(request) {
  const compilation = compileItemRequest(request);
  return buildReviewSummaries(compilation.specs, compilation)[0];
}

const weapon = review("Emberglass Dagger\nUncommon magic dagger. Its attacks deal an extra 1d4 fire damage.");
assert.equal(weapon.kindLabel, "Extra-damage weapon");
assert.equal(weapon.rarity, "Uncommon");
assert.ok(weapon.mechanics.some(value => value.includes("Attack: 1d4 + modifier piercing damage")));
assert.ok(weapon.mechanics.some(value => value.includes("Extra damage: 1d4 fire damage")));

const ring = review("Ring of Steadfast Warding\nRare ring requiring attunement. It grants +1 to AC and saving throws.");
assert.equal(ring.attunement, "Attunement required");
assert.ok(ring.mechanics.some(value => value.includes("+1 AC")));
assert.ok(ring.mechanics.some(value => value.includes("+1 saving throws")));

const staff = review("Staff of Winter's Judgment\nRare staff requiring attunement. It has 10 charges and DC 15. Cast Ice Storm for 4 charges and Cone of Cold for 5 charges. Regains 1d6 + 4 charges at dawn.");
assert.equal(staff.kindLabel, "Multi-spell item");
assert.ok(staff.mechanics.some(value => value.includes("10 uses; regains 1d6 + 4 at dawn")));
assert.ok(staff.mechanics.some(value => value.includes("Cast Ice Storm: 4 charges; DC 15 Dexterity save")));
assert.ok(staff.mechanics.some(value => value.includes("Cast Cone of Cold: 5 charges; DC 15 Constitution save")));
assert.ok(staff.notes.some(note => note.label === "Attunement" && /Attune this item/i.test(note.message)));

const summon = review("Infernal Calling Stone\nVery rare item requiring attunement. Once per long rest summon a friendly fiend, choosing Demon, Devil, or Yugoloth.");
assert.equal(summon.kindLabel, "Selectable summon");
assert.ok(summon.mechanics.includes("Summon choice: Demon, Devil, Yugoloth"));

const oil = review("Oil of Ember Edge\nUncommon consumable oil. As an action, apply it to one nonmagical weapon. For 1 hour it becomes magical and deals an extra 1d4 fire damage. One use, consumed.");
assert.ok(oil.mechanics.some(value => value.includes("Enchant Weapon for 1 hour")));
assert.ok(oil.mechanics.some(value => value.includes("Adds 1d4 fire damage")));

const plainLanguageOil = buildReviewSummaries([{
  kind: "nativeEnchant",
  name: "Stormglass Oil",
  rarity: "uncommon",
  duration: { value: 1, units: "hour", seconds: 3600 },
  restrictions: { type: "weapon" },
  enchantChanges: [
    { key: "system.properties", mode: "ADD", value: "mgc" },
    { key: "system.damage.parts", mode: "CUSTOM", value: "+1d4 lightning damage on hit" }
  ]
}], null)[0];
assert.ok(plainLanguageOil.mechanics.some(value => value.includes("Adds 1d4 lightning damage")));

const automationReview = buildReviewSummaries([{
  kind: "weaponConditionOnHit",
  name: "Gravebell",
  description: "A weapon with a restrained condition rider.",
  conditionOnHit: { condition: "poisoned", targetCreatureType: "undead" },
  automation: { recipe: "conditionOnHit", targetFilter: { creatureType: "undead" }, requires: ["midi-qol", "itemacro"] }
}], null)[0];
assert.equal(automationReview.unresolvedCount, 0);
assert.ok(automationReview.notes.some(note => note.label === "Automation contract" && /trusted postActiveEffects/i.test(note.message)));

const lightWarningReconciled = buildReviewSummaries([{
  kind: "artifactWeaponHybrid",
  name: "Ashen Mercy",
  toggleLight: { activityName: "Ignite the Flame", bright: 20, dim: 40 },
  utilityActivities: [{
    activityName: "Ignite the Flame",
    description: "As a bonus action, ignite the blade to shed bright and dim light."
  }]
}], {
  warnings: ["A requested light effect was not preserved in the generated Foundry structure."]
})[0];
assert.equal(lightWarningReconciled.notes.some(note => /requested light effect/i.test(note.message)), false);

const magicArmor = buildReviewSummaries([{
  kind: "shieldArmorBonus",
  name: "Moonshadow Leather",
  description: "A rare suit of leather armor. It grants +1 AC while worn.",
  rarity: "rare",
  armorValue: 1,
  magicalBonus: "1"
}], null)[0];
assert.equal(magicArmor.kindLabel, "Magic armor");
assert.ok(magicArmor.mechanics.some(value => value.includes("Armor bonus +1 AC")));

const magicShield = buildReviewSummaries([{
  kind: "shieldArmorBonus",
  name: "Sentinel Shield of the Deep",
  description: "A rare shield that grants +2 AC while wielded.",
  rarity: "rare",
  armorValue: 2,
  magicalBonus: "2"
}], null)[0];
assert.equal(magicShield.kindLabel, "Magic shield");
assert.ok(magicShield.mechanics.some(value => value.includes("Shield bonus +2 AC")));

const unresolved = review("Crown of Shared Aura\nLegendary crown requiring attunement. It emits a 30-foot aura granting allies +1 AC. It restores 1 sorcery point. It casts Fly once per dawn.");
assert.equal(unresolved.unresolvedCount, 3);
assert.equal(unresolved.reviewState, "manual-review");
assert.equal(unresolved.reviewStateLabel, "3 manual review notes");
assert.deepEqual(unresolved.unresolvedLabels, [
  "Ally-affecting aura",
  "Class-specific resource",
  "Unmapped spell casting"
]);
assert.deepEqual(unresolved.notes.filter(note => note.state === "unresolved").map(note => note.label), [
  "Ally-affecting aura",
  "Class-specific resource",
  "Unmapped spell casting"
]);
assert.ok(unresolved.notes.every(note => note.message.length > 0));

const freeForgeUnresolved = buildReviewSummaries([{
  kind: "passiveEffectEquipment",
  name: "Free Forge Boundary Test",
  rarity: "rare",
  unresolvedMechanics: [{
    label: "Ally-affecting aura",
    requestedText: "Allies within 10 feet gain +1 AC.",
    handling: "Review and add an aura manually if desired."
  }]
}], {
  providerLabel: "Free Forge",
  assumptions: [],
  warnings: [],
  deferred: []
})[0];
assert.equal(freeForgeUnresolved.notes.filter(note => note.state === "free-forge").length, 1);
assert.match(freeForgeUnresolved.notes.find(note => note.state === "free-forge")?.message ?? "", /simplified this result/i);

const byoUnresolved = buildReviewSummaries([{
  kind: "passiveEffectEquipment",
  name: "BYO Boundary Test",
  rarity: "rare",
  unresolvedMechanics: [{ label: "Ally-affecting aura", requestedText: "Allies gain +1 AC." }]
}], {
  providerLabel: "Bring Your Own API",
  assumptions: [],
  warnings: [],
  deferred: []
})[0];
assert.equal(byoUnresolved.notes.some(note => note.state === "free-forge"), false);

const notices = buildReviewSummaries([{
  kind: "weaponConditionOnHit",
  name: "Notice Test Blade",
  rarity: "rare",
  conditionOnHit: { condition: "poisoned", save: { ability: "con", dc: 13 }, durationSeconds: 60, targetCreatureType: "undead" }
}], {
  assumptions: [],
  warnings: ["The request uses standard on-hit rider wording."],
  deferred: []
})[0];
assert.deepEqual(notices.notes.filter(note => note.state === "notice").map(note => note.label), ["Notice"]);
assert.equal(notices.notes.some(note => note.state === "warning"), false);
assert.ok(notices.mechanics.some(value => /target filter: Undead/.test(value)));

assert.equal(weapon.reviewState, "forge-ready");
assert.equal(weapon.reviewStateLabel, "Forge-ready");
assert.deepEqual(weapon.unresolvedLabels, []);

const referenced = buildReviewSummaries([{
  kind: "weaponExtraDamage",
  name: "Resolver Test Blade",
  img: "icons/weapons/swords/sword-guard.webp",
  rarity: "rare",
  attunement: "",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  extraDamageParts: [],
  systemReferences: [{
    label: "System equipment",
    message: "Longsword from Equipment",
    uuid: "Compendium.dnd5e.equipment24.phbwepLongsword0"
  }]
}], null)[0];
assert.deepEqual(referenced.notes.filter(note => note.state === "reference").map(note => note.label), ["System equipment"]);
assert.equal(referenced.notes.find(note => note.state === "reference")?.handling, "Compendium.dnd5e.equipment24.phbwepLongsword0");

const resolvedSpellWarnings = buildReviewSummaries([{
  kind: "artifactWeaponHybrid",
  name: "Stormforged Longsword",
  description: "A longsword with Thunderwave.",
  rarity: "rare",
  damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] }, versatile: { number: null, denomination: null, bonus: "", types: [] } },
  attackActivities: [],
  utilityActivities: [],
  saveActivities: [{
    activityId: "Stormwave001",
    activityName: "Cast Thunderwave",
    save: { ability: "con", dc: 15 },
    damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["thunder"] }],
    target: { template: { type: "cube", size: 15, units: "ft" }, affects: { type: "creature" }, prompt: true },
    range: { units: "self" }
  }]
}], {
  assumptions: [],
  warnings: [
    "[Stormforged Longsword] The request mixes a weapon with a spell activity; this spec preserves the weapon chassis and rider damage, but Thunderwave remains unresolved.",
    "[Stormforged Longsword] weaponExtraDamage cannot encode spell save DCs or spellcasting activities."
  ],
  deferred: [
    "[Stormforged Longsword] Thunderwave spell activity and its DC 15 save are deferred for table handling or for conversion to a spell-granting item family."
  ]
})[0];

assert.equal(resolvedSpellWarnings.notes.some(note => /Thunderwave remains unresolved|spell save DCs or spellcasting activities|deferred for table handling/i.test(note.message)), false);

const consumableProjectile = buildReviewSummaries([{
  kind: "equipmentPowerSuite",
  name: "Alchemist Fire",
  description: "A thrown flask of flame.",
  itemType: "consumable",
  consumableType: "trinket",
  rarity: "uncommon",
  uses: { max: "1", recovery: [], autoDestroy: true },
  attackActivities: [{
    activityId: "ThrowFlask000001",
    activityName: "Throw Alchemist Fire",
    attackType: "ranged",
    attackClassification: "weapon",
    range: { value: 20, units: "ft" },
    target: { affects: { count: "1", type: "creature" }, prompt: true },
    damageParts: [{ number: 1, denomination: 4, bonus: "", types: ["fire"] }]
  }]
}], null)[0];
assert.equal(consumableProjectile.kindLabel, "Consumable projectile");

export const testedReviewSummaryCount = 31;
