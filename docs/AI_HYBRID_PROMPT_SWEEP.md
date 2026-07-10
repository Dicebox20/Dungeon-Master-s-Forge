# Dungeon Master's Forge AI Hybrid Prompt Sweep

Updated: 2026-07-02

This file is a live-AI stress pack for hybrid items that deliberately mix supported Forge families.

These prompts are not meant to be clean one-pattern examples. They are meant to expose routing and normalization failures when one item request combines mechanics that previously worked in isolation.

## Coverage Rule

When running this sweep repeatedly, do not keep reusing the same small set of base items.

Rotate across a broad spread of item chassis so the hybrid tests also exercise base-item recovery and weapon/armor normalization:

- simple melee weapons
- martial melee weapons
- finesse weapons
- heavy weapons
- polearms
- simple ranged weapons
- martial ranged weapons
- shields
- light armor
- medium armor
- heavy armor
- caster gear such as staffs, wands, rods, helms, rings, and amulets

Prefer changing the physical base item while keeping the mixed-mechanics pressure high. A good sweep should vary both the mechanic family mix and the underlying equipment chassis.

## Hybrid Sweep

## 1. Weapon + Summon

Create a rare dagger called Packfang Knife. It is a +1 dagger that deals an extra 1d4 cold damage on every hit. Once per long rest, as an action, it can summon a friendly wolf for 1 hour. It does not require attunement.

Families mixed:

- `weaponExtraDamage`
- `nativeSummon`

## 2. Weapon + Condition + Charged Blast

Create a rare spear called Stormsting Pike. It is a +1 spear that deals an extra 1d4 lightning damage on a hit. Any creature struck must succeed on a DC 14 Constitution saving throw or be poisoned for 1 minute. The weapon also has 4 charges, and as an action the wielder can spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Dexterity saving throw, taking 3d6 thunder damage on a failed save or half on a success. It regains 1d4 charges daily at dawn.

Families mixed:

- `weaponConditionOnHit`
- `chargedSaveDamage`

## 3. Passive Gear + Healing Charges

Create a rare amulet called Heartglass Pendant. While worn, it grants +1 AC. It has 3 charges, and as an action the wearer can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch. It regains all charges at dawn. It requires attunement.

Families mixed:

- `passiveEffectEquipment`
- `chargedHealing`

## 4. Shield + Enchant

Create an uncommon shield called Mirrorbark Buckler. It is a +1 shield. Once per long rest, the bearer can use an action to enchant one nonmagical weapon for 1 hour. The enchanted weapon becomes magical and deals an extra 1d4 radiant damage.

Families mixed:

- `shieldArmorBonus`
- `nativeEnchant`

## 5. Caster Gear + Healing Charges

Create a rare circlet called Mercy of the Third Eye. While worn, it grants +1 to spell attack rolls and spell save DC. It has 2 charges, and the wearer can spend 1 charge as an action to restore 3d4 + 3 hit points to a creature they touch. It regains both charges on a long rest. It requires attunement by a spellcaster.

Families mixed:

- `casterUtilityEquipment`
- `chargedHealing`

## 6. Passive Gear + Charged Blast

Create a rare cloak called Emberveil Mantle. While worn, it grants resistance to fire damage. It has 5 charges, and as an action the wearer can spend 1 charge to exhale a 15-foot cone of embers. Creatures in the area must make a DC 14 Dexterity saving throw, taking 4d6 fire damage on a failed save or half on a success. The cloak regains 1d4 + 1 charges daily at dawn. It requires attunement.

Families mixed:

- `passiveEffectEquipment`
- `chargedSaveDamage`

## 7. Multi-Spell Staff + Multi-Profile Summon

Create a very rare staff called Staff of the Three Tempests. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, the wielder can spend 3 charges to cast Shatter at DC 15 or 5 charges to cast Ice Storm at DC 15. It can also spend 4 charges to summon a friendly fiend for 1 hour, and the wielder chooses whether the spirit appears as a Demon, Devil, or Yugoloth. It requires attunement.

Families mixed:

- `multiActivityStaff`
- `nativeMultiProfileSummon`

## 8. Enchant Consumable + Summon

Create a rare oil called Mooncall Unguent. Applying it to one nonmagical weapon takes an action. For 1 hour, that weapon becomes magical and deals an extra 1d4 cold damage. When the oil is used, it also summons a friendly wolf for 10 minutes. The oil is consumed after one use.

Families mixed:

- `nativeEnchant`
- `nativeSummon`

## 9. Legendary Gear + Multi-Profile Summon

Create a legendary idol called Throne of the Ninth Gate. While carried, it grants +1 AC and resistance to necrotic damage. It has 3 charges and regains all charges daily at dawn. As an action, the bearer can spend 1 charge to cast Command at DC 17. It can also spend 2 charges to summon a friendly fiend for 1 hour, choosing whether it appears as a Demon, Devil, or Yugoloth. It requires attunement.

Families mixed:

- `legendaryEquipmentSuite`
- `nativeMultiProfileSummon`

## 10. Shield + Caster Utility

Create a rare shield called Warden's Eclipse. It is a +1 shield. While equipped, it grants +1 to spell attack rolls and spell save DC. It also allows the bearer to cast Detect Thoughts once per long rest. It requires attunement by a spellcaster.

Families mixed:

- `shieldArmorBonus`
- `casterUtilityEquipment`

## 11. Power Suite + Weapon Condition

Create a very rare helm called Helm of the Venom Ray. It has 5 charges and regains 1d4 + 1 charges daily at dawn. As an action, the wearer can spend 1 charge to make a ranged spell attack against one creature within 90 feet, dealing 4d8 poison damage on a hit. A creature damaged by this attack must make a DC 13 Constitution saving throw or be poisoned for 1 minute. It requires attunement.

Families mixed:

- `equipmentPowerSuite`
- `weaponConditionOnHit`

## 12. Legendary Gear + Weapon Hybrid

Create a legendary greataxe called Ashlord's Divide. It is a +3 greataxe that deals an extra 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC and resistance to necrotic damage. It has 1 daily use of Command at DC 17. It requires attunement.

Families mixed:

- `legendaryEquipmentSuite`
- `artifactWeaponHybrid`

## 13. Artifact Weapon + Enchant

Create an artifact longsword called Dawnforger. It is a +3 longsword that deals an extra 1d6 radiant damage and 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC. As a bonus action, the blade can ignite, shedding 20 feet of bright light and another 20 feet of dim light. Once per dawn, it can cast Flame Strike at DC 18. In addition, once per long rest the wielder can use an action to enchant one nonmagical weapon for 1 hour, making it magical and causing it to deal an extra 1d4 fire damage.

Families mixed:

- `artifactWeaponHybrid`
- `nativeEnchant`

## 14. Staff + Healing + Summon

Create a rare quarterstaff called Shepherd's Reliquary. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement.

Families mixed:

- `multiActivityStaff`
- `chargedHealing`
- `nativeSummon`

## Suggested Checks

For each prompt, record:

- whether compile succeeds
- which `kind` the AI routes to
- whether the requested secondary mechanic survives normalization
- whether validation succeeds
- whether item creation succeeds
- whether the created item lands in the world without new Dungeon Master's Forge console errors
