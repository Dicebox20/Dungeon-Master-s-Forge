const PATTERN_GUIDANCE = Object.freeze({
  weaponExtraDamage: "Magic weapon. Use weaponType, baseItem, properties, damage.base, damage.versatile, magicalBonus, range, extraDamageParts, and attackName.",
  weaponConditionOnHit: "Magic weapon with extraDamageParts and conditionOnHit. conditionOnHit includes condition, save ability/DC, and duration seconds. Keep the attack and condition rider together only for this family.",
  passiveEffectEquipment: "Passive worn item. Use equipmentType, effects with changes [{key, mode:'ADD'|'OVERRIDE'|'CUSTOM', value}], rarity, attunement, and description.",
  shieldArmorBonus: "Magic shield. Use armorValue 2, magicalBonus, baseItem:'shield', rarity, attunement, and description.",
  chargedHealing: "Healing consumable or charged item. Use itemType, consumableType when relevant, uses, activationType, healing, and autoDestroy for consumed items.",
  chargedSaveDamage: "One save/damage activity. Use uses, activityId, activationType, chargeCost, save {ability,dc}, damageParts, target, and halfOnSave. Thrown grenades, bombs, splash flasks, and similar one-use area projectiles belong here when their primary resolved mechanic is a single save-plus-damage activity.",
  multiActivityStaff: "Shared charge item with activities. Each activity has activityId, activityName, chargeCost, save, damageParts, target, and halfOnSave. Put recovery only on the shared uses object.",
  nativeEnchant: "One-use native enchantment. Oils, unguents, salves, coatings, and similar applied enchantments use this family. Use activityId, effectId, uses, duration, restrictions, and enchantChanges. Enchantment changes target the selected weapon or armor, not the oil itself.",
  nativeSummon: "One summon profile. Use activityId, profileId, uses, activationType, duration, range, target, and summonActor with name/type/AC/HP/abilities/movement/traits/items.",
  nativeMultiProfileSummon: "Selectable summon profiles. Use summonActivity and summonProfiles; every profile has profileId, profileName, and actor. Keep profiles mechanically distinct and friendly.",
  casterUtilityEquipment: "Caster item combining passive effects with known utility spell activities. Use effects, uses, utilityActivities, saveActivities when a spell has a save, and resistances through Active Effect changes.",
  equipmentPowerSuite: "Complex non-weapon equipment or consumable projectile. Use effects, uses, attackActivities, utilityActivities, saveActivities, summonActivity, and summonProfiles as needed. Keep each command as a separate activity. Thrown alchemical fire, acid flasks, and similar one-use attack consumables may use this family when they need a consumable chassis plus explicit attack activity.",
  legendaryEquipmentSuite: "Complex legendary non-weapon item. Use passive effects, shared charges, separate utility/save/attack/summon activities, and unresolved records for table-adjudicated clauses.",
  artifactWeaponHybrid: "Artifact weapon. Use normal weapon damage, optional extraDamageParts only for on-hit riders, passiveEffects, toggleLight, uses, utilityActivities, and separate saveActivities for activated spell damage. Never make activated spell damage part of every weapon attack."
});

const COMMON_GUIDANCE = `
Use DND5e v5.3.3-compatible values. Rarity values include common, uncommon, rare, veryRare, legendary, and artifact. Attunement is usually "" or "required". Damage parts use {number, denomination, bonus, types:[damageType]}. Uses use {max, recovery:[{period,type,formula?}], autoDestroy?}; consumed single-use items may use recovery:[] with autoDestroy:true. Saves use {ability, dc}. Ranges use {value, long?, units:'ft'}; areas use target.template with type and size. Effect changes use Foundry paths such as system.attributes.ac.bonus, system.bonuses.abilities.save, system.bonuses.msak.attack, system.bonuses.rsak.attack, system.attributes.spelldc, and system.traits.dr.value.

Every item must emit exactly one supported kind. When a request mixes mechanics from multiple families, choose the dominant supported family and move unsupported or secondary behavior into unresolvedMechanics instead of inventing a hybrid schema. Every activityId, effectId, profileId, toggle-light ID, and unresolved-mechanic ID must be exactly 16 ASCII alphanumeric characters. The service will fill missing IDs, but never invent malformed ones. Separate attacks, healing, saves, utility powers, enchantments, and summons into distinct activities. Existing spells with a saving throw must use saveActivities even when they deal no damage. Oils, unguents, salves, and coatings that enchant a weapon, armor, or shield must use nativeEnchant instead of chargedSaveDamage. Throwable grenades, bombs, flasks, and vials are consumable projectile documents, not weapons; never add magicalBonus or attackBonus unless the request explicitly asks for that bonus. nativeSummon stores the summoned creature stat block under summonActor, not actor. Unknown spells, ally auras, class-resource restoration, and table-judgment clauses become unresolvedMechanics instead of fake personal effects.

Each unresolved mechanic is {category,label,requestedText,reason,handling,resolved:false}. Preserve the exact requested clause in requestedText. Supported unresolved categories include allyAura, classResource, unmappedSpell, and tableAdjudication.
`;

function guidanceForKinds(kinds) {
  return kinds.map(kind => `- ${kind}: ${PATTERN_GUIDANCE[kind]}`).filter(line => !line.endsWith("undefined")).join("\n");
}

export { COMMON_GUIDANCE, PATTERN_GUIDANCE, guidanceForKinds };
