# Dungeon Master's Forge AI Prompt Sweep

Updated: 2026-07-02

This file is a live-AI prompt pack for testing one prompt against each supported Forge item family.

These prompts are intentionally written in more ordinary GM language than the deterministic Local Rules examples. The goal is to pressure-test AI interpretation, not just pattern matching.

## 1. `weaponExtraDamage`

Create an uncommon shortsword called Emberwake Blade. It is a +1 shortsword, and every hit deals an extra 1d4 fire damage. It does not require attunement.

## 2. `weaponConditionOnHit`

Create a rare spear called Thorn of the Mire. It is a +1 spear that deals an extra 1d4 poison damage on a hit. Any creature struck must make a DC 14 Constitution saving throw or be poisoned for 1 minute.

## 3. `passiveEffectEquipment`

Create a rare cloak called Cloak of the Stormwatch. While worn, it grants +1 AC and resistance to lightning damage. It requires attunement.

## 4. `shieldArmorBonus`

Create a rare suit of half plate called Ashen Bulwark. It is +1 half plate armor, not a shield, and it grants resistance to fire damage while equipped. It requires attunement.

## 5. `chargedHealing`

Create an uncommon potion called Bloomdraught. As an action, a creature can drink it to regain 3d4 + 3 hit points. It has 1 use and is consumed after drinking.

## 6. `chargedSaveDamage`

Create a rare wand called Wand of Searing Hail. It has 6 charges and regains 1d6 charges daily at dawn. As an action, the wielder can spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Dexterity saving throw, taking 4d6 fire damage on a failed save or half on a success.

## 7. `multiActivityStaff`

Create a rare staff called Staff of Tides and Thunder. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 2 charges to cast Shatter at DC 15, or spend 3 charges to cast Tidal Wave at DC 15. It requires attunement.

## 8. `nativeEnchant`

Create an uncommon oil called Oil of Frostbite Edge. Applying it to one nonmagical weapon takes an action. For 1 hour, that weapon becomes magical and deals an extra 1d4 cold damage. The oil is consumed after one use.

## 9. `nativeSummon`

Create a rare whistle called Shepherd's Mooncall. Once per long rest, the wielder can use an action to summon a friendly dire wolf for 1 hour.

## 10. `nativeMultiProfileSummon`

Create a very rare idol called Idol of the Three Hells. Once per long rest, as an action, the wielder summons a friendly fiend and chooses whether it appears as a Demon, Devil, or Yugoloth. The summon lasts for 1 hour.

## 11. `casterUtilityEquipment`

Create a rare circlet called Circlet of Quiet Sight. While worn, it grants +1 to spell attack rolls and spell save DC. It also lets the wearer cast Detect Thoughts once per long rest. It requires attunement by a spellcaster.

## 12. `equipmentPowerSuite`

Create a very rare mask called Mask of the Soul Lance. It has 5 charges and regains 1d4 + 1 charges daily at dawn. As an action, the wearer can spend 1 charge to make a ranged spell attack against one creature within 90 feet, dealing 4d8 psychic damage on a hit. It requires attunement.

## 13. `legendaryEquipmentSuite`

Create a legendary crown called Crown of the Ashen Throne. While worn, it grants +1 AC and resistance to necrotic damage. It has 3 charges and regains all charges at dawn. As an action, the wearer can spend 1 charge to cast Command with a DC 17 Wisdom save. It requires attunement.

## 14. `artifactWeaponHybrid`

Create an artifact greatsword called Dawnrend. It is a +3 greatsword that deals an extra 1d6 radiant damage and 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC. As a bonus action, the blade can ignite, shedding 20 feet of bright light and another 20 feet of dim light. Once per dawn, it can cast Flame Strike with a DC 18 Dexterity save, dealing 4d6 fire damage and 4d6 radiant damage, half on a success.

## Suggested Run Order

If the active provider has strict quotas or per-minute limits, use this order:

1. `weaponExtraDamage`
2. `chargedSaveDamage`
3. `shieldArmorBonus`
4. `passiveEffectEquipment`
5. `chargedHealing`
6. `weaponConditionOnHit`
7. `nativeEnchant`
8. `nativeSummon`
9. `nativeMultiProfileSummon`
10. `casterUtilityEquipment`
11. `equipmentPowerSuite`
12. `multiActivityStaff`
13. `legendaryEquipmentSuite`
14. `artifactWeaponHybrid`

## Suggested Success Checks

For each created item, confirm:

- the prompt routes to the expected family
- the preview renders without a broken image request
- validation succeeds
- the item is created in the expected folder
- activities, effects, uses, and recharge data appear on the item sheet
- no new Dungeon Master's Forge console errors appear during compile, validate, or create
