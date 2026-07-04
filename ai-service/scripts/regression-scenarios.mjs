const familySweep = [
  {
    id: "family-weapon-extra",
    label: "weaponExtraDamage",
    strictKind: true,
    expectedKinds: ["weaponExtraDamage"],
    prompt: "Create an uncommon shortsword called Emberwake Blade. It is a +1 shortsword, and every hit deals an extra 1d4 fire damage. It does not require attunement."
  },
  {
    id: "family-weapon-condition",
    label: "weaponConditionOnHit",
    strictKind: true,
    expectedKinds: ["weaponConditionOnHit"],
    prompt: "Create a rare spear called Thorn of the Mire. It is a +1 spear that deals an extra 1d4 poison damage on a hit. Any creature struck must make a DC 14 Constitution saving throw or be poisoned for 1 minute."
  },
  {
    id: "family-passive-equipment",
    label: "passiveEffectEquipment",
    strictKind: true,
    expectedKinds: ["passiveEffectEquipment"],
    prompt: "Create a rare cloak called Cloak of the Stormwatch. While worn, it grants +1 AC and resistance to lightning damage. It requires attunement."
  },
  {
    id: "family-shield-armor",
    label: "shieldArmorBonus",
    strictKind: true,
    expectedKinds: ["shieldArmorBonus"],
    prompt: "Create a rare suit of half plate called Ashen Bulwark. It is +1 half plate armor, not a shield, and it grants resistance to fire damage while equipped. It requires attunement."
  },
  {
    id: "family-charged-healing",
    label: "chargedHealing",
    strictKind: true,
    expectedKinds: ["chargedHealing"],
    prompt: "Create an uncommon potion called Bloomdraught. As an action, a creature can drink it to regain 3d4 + 3 hit points. It has 1 use and is consumed after drinking."
  },
  {
    id: "family-charged-save",
    label: "chargedSaveDamage",
    strictKind: true,
    expectedKinds: ["chargedSaveDamage"],
    prompt: "Create a rare wand called Wand of Searing Hail. It has 6 charges and regains 1d6 charges daily at dawn. As an action, the wielder can spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Dexterity saving throw, taking 4d6 fire damage on a failed save or half on a success."
  },
  {
    id: "family-multi-activity-staff",
    label: "multiActivityStaff",
    strictKind: true,
    expectedKinds: ["multiActivityStaff"],
    prompt: "Create a rare staff called Staff of Tides and Thunder. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 2 charges to cast Shatter at DC 15, or spend 3 charges to cast Tidal Wave at DC 15. It requires attunement."
  },
  {
    id: "family-native-enchant",
    label: "nativeEnchant",
    strictKind: true,
    expectedKinds: ["nativeEnchant"],
    prompt: "Create an uncommon oil called Oil of Frostbite Edge. Applying it to one nonmagical weapon takes an action. For 1 hour, that weapon becomes magical and deals an extra 1d4 cold damage. The oil is consumed after one use."
  },
  {
    id: "family-native-summon",
    label: "nativeSummon",
    strictKind: true,
    expectedKinds: ["nativeSummon"],
    prompt: "Create a rare whistle called Shepherd's Mooncall. Once per long rest, the wielder can use an action to summon a friendly dire wolf for 1 hour."
  },
  {
    id: "family-native-multi-summon",
    label: "nativeMultiProfileSummon",
    strictKind: true,
    expectedKinds: ["nativeMultiProfileSummon"],
    prompt: "Create a very rare idol called Idol of the Three Hells. Once per long rest, as an action, the wielder summons a friendly fiend and chooses whether it appears as a Demon, Devil, or Yugoloth. The summon lasts for 1 hour."
  },
  {
    id: "family-caster-utility",
    label: "casterUtilityEquipment",
    strictKind: true,
    expectedKinds: ["casterUtilityEquipment"],
    prompt: "Create a rare circlet called Circlet of Quiet Sight. While worn, it grants +1 to spell attack rolls and spell save DC. It also lets the wearer cast Detect Thoughts once per long rest. It requires attunement by a spellcaster."
  },
  {
    id: "family-equipment-power-suite",
    label: "equipmentPowerSuite",
    strictKind: true,
    expectedKinds: ["equipmentPowerSuite"],
    prompt: "Create a very rare mask called Mask of the Soul Lance. It has 5 charges and regains 1d4 + 1 charges daily at dawn. As an action, the wearer can spend 1 charge to make a ranged spell attack against one creature within 90 feet, dealing 4d8 psychic damage on a hit. It requires attunement."
  },
  {
    id: "family-legendary-suite",
    label: "legendaryEquipmentSuite",
    strictKind: true,
    expectedKinds: ["legendaryEquipmentSuite"],
    prompt: "Create a legendary crown called Crown of the Ashen Throne. While worn, it grants +1 AC and resistance to necrotic damage. It has 3 charges and regains all charges at dawn. As an action, the wearer can spend 1 charge to cast Command with a DC 17 Wisdom save. It requires attunement."
  },
  {
    id: "family-artifact-hybrid",
    label: "artifactWeaponHybrid",
    strictKind: true,
    expectedKinds: ["artifactWeaponHybrid"],
    prompt: "Create an artifact greatsword called Dawnrend. It is a +3 greatsword that deals an extra 1d6 radiant damage and 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC. As a bonus action, the blade can ignite, shedding 20 feet of bright light and another 20 feet of dim light. Once per dawn, it can cast Flame Strike with a DC 18 Dexterity save, dealing 4d6 fire damage and 4d6 radiant damage, half on a success."
  }
];

const hybridSweep = [
  {
    id: "hybrid-weapon-summon",
    label: "Weapon + Summon",
    strictKind: false,
    expectedKinds: ["weaponExtraDamage", "nativeSummon"],
    prompt: "Create a rare dagger called Packfang Knife. It is a +1 dagger that deals an extra 1d4 cold damage on every hit. Once per long rest, as an action, it can summon a friendly wolf for 1 hour. It does not require attunement."
  },
  {
    id: "hybrid-weapon-condition-blast",
    label: "Weapon + Condition + Charged Blast",
    strictKind: false,
    expectedKinds: ["weaponConditionOnHit", "chargedSaveDamage"],
    prompt: "Create a rare spear called Stormsting Pike. It is a +1 spear that deals an extra 1d4 lightning damage on a hit. Any creature struck must succeed on a DC 14 Constitution saving throw or be poisoned for 1 minute. The weapon also has 4 charges, and as an action the wielder can spend 1 charge to force creatures in a 15-foot cone to make a DC 14 Dexterity saving throw, taking 3d6 thunder damage on a failed save or half on a success. It regains 1d4 charges daily at dawn."
  },
  {
    id: "hybrid-passive-healing",
    label: "Passive Gear + Healing Charges",
    strictKind: false,
    expectedKinds: ["passiveEffectEquipment", "chargedHealing"],
    prompt: "Create a rare amulet called Heartglass Pendant. While worn, it grants +1 AC. It has 3 charges, and as an action the wearer can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch. It regains all charges at dawn. It requires attunement."
  },
  {
    id: "hybrid-shield-enchant",
    label: "Shield + Enchant",
    strictKind: false,
    expectedKinds: ["shieldArmorBonus", "nativeEnchant"],
    prompt: "Create an uncommon shield called Mirrorbark Buckler. It is a +1 shield. Once per long rest, the bearer can use an action to enchant one nonmagical weapon for 1 hour. The enchanted weapon becomes magical and deals an extra 1d4 radiant damage."
  },
  {
    id: "hybrid-caster-healing",
    label: "Caster Gear + Healing Charges",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "chargedHealing"],
    prompt: "Create a rare circlet called Mercy of the Third Eye. While worn, it grants +1 to spell attack rolls and spell save DC. It has 2 charges, and the wearer can spend 1 charge as an action to restore 3d4 + 3 hit points to a creature they touch. It regains both charges on a long rest. It requires attunement by a spellcaster."
  },
  {
    id: "hybrid-passive-blast",
    label: "Passive Gear + Charged Blast",
    strictKind: false,
    expectedKinds: ["passiveEffectEquipment", "chargedSaveDamage"],
    prompt: "Create a rare cloak called Emberveil Mantle. While worn, it grants resistance to fire damage. It has 5 charges, and as an action the wearer can spend 1 charge to exhale a 15-foot cone of embers. Creatures in the area must make a DC 14 Dexterity saving throw, taking 4d6 fire damage on a failed save or half on a success. The cloak regains 1d4 + 1 charges daily at dawn. It requires attunement."
  },
  {
    id: "hybrid-staff-fiend-summon",
    label: "Multi-Spell Staff + Multi-Profile Summon",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "nativeMultiProfileSummon"],
    prompt: "Create a very rare staff called Staff of the Three Tempests. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, the wielder can spend 3 charges to cast Shatter at DC 15 or 5 charges to cast Ice Storm at DC 15. It can also spend 4 charges to summon a friendly fiend for 1 hour, and the wielder chooses whether the spirit appears as a Demon, Devil, or Yugoloth. It requires attunement."
  },
  {
    id: "hybrid-enchant-summon",
    label: "Enchant Consumable + Summon",
    strictKind: false,
    expectedKinds: ["nativeEnchant", "nativeSummon"],
    prompt: "Create a rare oil called Mooncall Unguent. Applying it to one nonmagical weapon takes an action. For 1 hour, that weapon becomes magical and deals an extra 1d4 cold damage. When the oil is used, it also summons a friendly wolf for 10 minutes. The oil is consumed after one use."
  },
  {
    id: "hybrid-legendary-fiend-summon",
    label: "Legendary Gear + Multi-Profile Summon",
    strictKind: false,
    expectedKinds: ["legendaryEquipmentSuite", "nativeMultiProfileSummon"],
    prompt: "Create a legendary idol called Throne of the Ninth Gate. While carried, it grants +1 AC and resistance to necrotic damage. It has 3 charges and regains all charges daily at dawn. As an action, the bearer can spend 1 charge to cast Command at DC 17. It can also spend 2 charges to summon a friendly fiend for 1 hour, choosing whether it appears as a Demon, Devil, or Yugoloth. It requires attunement."
  },
  {
    id: "hybrid-shield-caster",
    label: "Shield + Caster Utility",
    strictKind: false,
    expectedKinds: ["shieldArmorBonus", "casterUtilityEquipment"],
    prompt: "Create a rare shield called Warden's Eclipse. It is a +1 shield. While equipped, it grants +1 to spell attack rolls and spell save DC. It also allows the bearer to cast Detect Thoughts once per long rest. It requires attunement by a spellcaster."
  },
  {
    id: "hybrid-power-suite-condition",
    label: "Power Suite + Weapon Condition",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "weaponConditionOnHit"],
    prompt: "Create a very rare helm called Helm of the Venom Ray. It has 5 charges and regains 1d4 + 1 charges daily at dawn. As an action, the wearer can spend 1 charge to make a ranged spell attack against one creature within 90 feet, dealing 4d8 poison damage on a hit. A creature damaged by this attack must make a DC 13 Constitution saving throw or be poisoned for 1 minute. It requires attunement."
  },
  {
    id: "hybrid-legendary-weapon",
    label: "Legendary Gear + Weapon Hybrid",
    strictKind: false,
    expectedKinds: ["legendaryEquipmentSuite", "artifactWeaponHybrid", "weaponExtraDamage"],
    prompt: "Create a legendary greataxe called Ashlord's Divide. It is a +3 greataxe that deals an extra 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC and resistance to necrotic damage. It has 1 daily use of Command at DC 17. It requires attunement."
  },
  {
    id: "hybrid-artifact-enchant",
    label: "Artifact Weapon + Enchant",
    strictKind: false,
    expectedKinds: ["artifactWeaponHybrid", "nativeEnchant", "weaponExtraDamage"],
    prompt: "Create an artifact longsword called Dawnforger. It is a +3 longsword that deals an extra 1d6 radiant damage and 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC. As a bonus action, the blade can ignite, shedding 20 feet of bright light and another 20 feet of dim light. Once per dawn, it can cast Flame Strike at DC 18. In addition, once per long rest the wielder can use an action to enchant one nonmagical weapon for 1 hour, making it magical and causing it to deal an extra 1d4 fire damage."
  },
  {
    id: "hybrid-staff-healing-summon",
    label: "Staff + Healing + Summon",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "chargedHealing", "nativeSummon"],
    prompt: "Create a rare quarterstaff called Shepherd's Reliquary. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement."
  }
];

const transcriptSweep = [
  {
    id: "transcript-wand-shattering-ice",
    label: "Wand of Shattering Ice",
    strictKind: true,
    expectedKinds: ["chargedSaveDamage"],
    prompt: "Create a rare wand called Wand of Shattering Ice. It has 7 charges and regains 1d6+1 charges daily at dawn. As an action, the wielder can spend 1 charge to create a 15-foot cone of freezing shards. Creatures in the cone must make a DC 15 Dexterity saving throw, taking 4d6 cold damage on a failed save, or half as much on a success."
  },
  {
    id: "transcript-rod-cracking-thunder",
    label: "Rod of Cracking Thunder",
    strictKind: true,
    expectedKinds: ["chargedSaveDamage"],
    prompt: "Create a rare rod called Rod of Cracking Thunder. It has 6 charges and regains 1d6 charges daily at dawn. As an action, the wielder can spend 1 charge to unleash a 30-foot line of thunderous force. Each creature in the line must make a DC 15 Constitution saving throw, taking 4d8 thunder damage on a failed save, or half as much on a success. This item has only one activated power."
  },
  {
    id: "transcript-potion-verdant-renewal",
    label: "Potion of Verdant Renewal",
    strictKind: true,
    expectedKinds: ["chargedHealing"],
    prompt: "Create an uncommon potion called Potion of Verdant Renewal. When a creature drinks it as an action, they regain 4d4+4 hit points and end one disease affecting them. The potion is consumed after use."
  },
  {
    id: "transcript-mace-dazing-stars",
    label: "Mace of Dazing Stars",
    strictKind: true,
    expectedKinds: ["weaponConditionOnHit"],
    prompt: "Create a rare mace called Mace of Dazing Stars. It is a +1 mace that deals an extra 1d6 radiant damage on hit. When it hits a creature, the target must succeed on a DC 15 Wisdom saving throw or be stunned until the end of the wielder's next turn. It requires attunement."
  },
  {
    id: "transcript-mace-of-stunning",
    label: "Mace of Stunning",
    strictKind: true,
    expectedKinds: ["weaponConditionOnHit"],
    prompt: "Create a rare mace called Mace of Stunning. It is a +1 mace. On a hit, the target must make a DC 15 Wisdom saving throw or be stunned for 1 round."
  },
  {
    id: "transcript-venomkiss-shortsword",
    label: "Venomkiss Shortsword",
    strictKind: true,
    expectedKinds: ["weaponExtraDamage"],
    prompt: "Create an uncommon shortsword called Venomkiss Shortsword. It is a +1 shortsword that deals an extra 1d4 poison damage on a hit. It does not require attunement."
  },
  {
    id: "transcript-frostguard-plate",
    label: "Frostguard Plate",
    strictKind: true,
    expectedKinds: ["shieldArmorBonus"],
    prompt: "Create a very rare suit of plate armor called Frostguard Plate. It is +2 plate armor that grants resistance to fire damage while equipped. It requires attunement."
  },
  {
    id: "transcript-moonshadow-leather",
    label: "Moonshadow Leather",
    strictKind: true,
    expectedKinds: ["shieldArmorBonus"],
    prompt: "Create a rare suit of leather armor called Moonshadow Leather. It is +1 leather armor that grants advantage on Dexterity saving throws while equipped. It does not require attunement."
  },
  {
    id: "transcript-stonehide-breastplate",
    label: "Stonehide Breastplate",
    strictKind: true,
    expectedKinds: ["shieldArmorBonus"],
    prompt: "Create a rare armor item called Stonehide Breastplate. This is breastplate armor, not a shield. It is +1 breastplate armor that grants resistance to poison damage while equipped. It does not require attunement."
  },
  {
    id: "transcript-staff-ember-frost",
    label: "Staff of Ember and Frost",
    strictKind: true,
    expectedKinds: ["multiActivityStaff", "equipmentPowerSuite"],
    prompt: "Create a rare staff called Staff of Ember and Frost. It has 10 charges and regains 1d6+4 charges daily at dawn. As an action, the wielder can spend 1 charge to cast Burning Hands at DC 15, dealing 3d6 fire damage in a 15-foot cone. As an action, the wielder can spend 2 charges to cast Ice Knife at +7 to hit, dealing 1d10 piercing damage and 2d6 cold damage. It requires attunement by a spellcaster."
  }
];

const regressionSweeps = Object.freeze({
  family: familySweep,
  hybrid: hybridSweep,
  transcript: transcriptSweep
});

export { familySweep, hybridSweep, regressionSweeps, transcriptSweep };
