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

// Deliberately informal player phrasing. Keep this pack separate so language
// recognition can improve without weakening the deterministic family sweeps.
const languageSweep = [
  {
    id: "language-simple-rapier-acid",
    label: "Simple slang: extra damage",
    strictKind: true,
    expectedKinds: ["weaponExtraDamage"],
    prompt: "Make me an uncommon rapier called Greenflash. It is a +1 rapier that pops for an extra 1d6 acid on a hit. No attunement needed."
  },
  {
    id: "language-simple-leather-poison",
    label: "Simple slang: resistance",
    strictKind: true,
    expectedKinds: ["shieldArmorBonus"],
    prompt: "Create a rare set of +1 leather armor called Bogrunner's Leathers. While I have it on, I can shrug off poison damage. It does not need attunement."
  },
  {
    id: "language-simple-healing-draught",
    label: "Simple slang: healing consumable",
    strictKind: true,
    expectedKinds: ["chargedHealing"],
    prompt: "Make a common one-and-done healing draught called Redcap's Pick-Me-Up. Chugging it takes an action and gets you back 2d4 + 2 HP. The bottle is gone after."
  },
  {
    id: "language-simple-black-bear",
    label: "Simple slang: summon black bear",
    strictKind: true,
    expectedKinds: ["nativeSummon"],
    prompt: "Create an uncommon whistle called Bear Buddy. Once a day, use an action to call in a friendly black bear pal for an hour."
  },
  {
    id: "language-simple-misty-step",
    label: "Simple slang: bamf utility",
    strictKind: true,
    expectedKinds: ["casterUtilityEquipment"],
    prompt: "Make an uncommon ring called Skipstone. The wearer can bamf with Misty Step once per long rest. It needs attunement."
  },
  {
    id: "language-medium-thunderwave-rod",
    label: "Medium slang: charged Thunderwave",
    strictKind: false,
    expectedKinds: ["chargedSaveDamage", "equipmentPowerSuite"],
    prompt: "Create a rare rod called Crowdclearer. It has 7 charges; at dawn, roll 1d6 and put that many charges back. Pop 1 charge as an action to throw a Thunderwave at DC 14. It needs attunement by a spellcaster."
  },
  {
    id: "language-medium-scouting-lens",
    label: "Medium slang: caster utility spells",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "equipmentPowerSuite"],
    prompt: "Make a rare wizard's monocle called Far-Sight. While worn it gives +1 to spell attacks and spell save DC. Once per long rest, it can cast Clairvoyance or Fog Cloud. It needs attunement by a caster."
  },
  {
    id: "language-medium-longbow-poison",
    label: "Medium slang: condition rider",
    strictKind: true,
    expectedKinds: ["weaponConditionOnHit"],
    prompt: "Create a rare longbow called Mookdropper. It is a +1 longbow and its arrows deal an extra 1d6 poison on a hit. Anyone tagged by an arrow makes a DC 14 Constitution save or is poisoned for one round. No attunement."
  },
  {
    id: "language-medium-giant-spider",
    label: "Medium slang: summon giant spider",
    strictKind: true,
    expectedKinds: ["nativeSummon"],
    prompt: "Create a rare onyx figurine called Wallcrawler. Once per long rest, crack it as an action to conjure a friendly giant spider buddy for 1 hour."
  },
  {
    id: "language-medium-invisibility-oil",
    label: "Medium slang: enchant plus Invisibility",
    strictKind: false,
    expectedKinds: ["nativeEnchant", "equipmentPowerSuite", "casterUtilityEquipment"],
    prompt: "Make an uncommon oil called Ghostcoat. Smear it on one mundane weapon as an action: for 1 hour that weapon counts as magical and hits for an extra 1d4 cold. The user can also go invisible with Invisibility once per long rest. The oil is single-use."
  },
  {
    id: "language-high-tempest-eagle-staff",
    label: "High slang: spells plus giant eagle summon",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "multiActivityStaff", "nativeSummon"],
    prompt: "Create a very rare staff called Stormchaser. It has 10 charges and gets 1d6 + 4 back at dawn. Spend 2 charges to fire off Lightning Bolt at DC 16, 3 charges to drop Sleet Storm, or 4 charges to call a friendly giant eagle mount for 1 hour. It is a caster's staff and needs attunement."
  },
  {
    id: "language-high-hand-crossbow-suite",
    label: "High slang: weapon plus spell attack suite",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "weaponExtraDamage", "artifactWeaponHybrid"],
    prompt: "Make a very rare hand crossbow called Hexslinger. It is a +2 hand crossbow that pings for an extra 1d6 psychic on every hit. It has 6 charges, regains 1d4 + 2 at dawn, and can burn 1 charge to make a Ray of Sickness spell attack at +7 to hit or burn 3 charges to drop Fireball at DC 15. Needs attunement by a spellcaster."
  },
  {
    id: "language-high-moonlit-relic",
    label: "High slang: healing plus Moonbeam",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "chargedHealing", "casterUtilityEquipment"],
    prompt: "Create a very rare holy symbol called Moonlit Reliquary. It has 8 charges and tops itself back up by 1d6 + 2 at dawn. As an action, burn 2 charges to cast Cure Wounds at 3rd level, or 3 charges to drop Moonbeam at DC 15. Once per long rest the wearer can bamf with Misty Step. It needs attunement by a cleric or druid."
  },
  {
    id: "language-high-panther-cloak",
    label: "High slang: defensive gear plus panther summon",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "passiveEffectEquipment", "nativeSummon"],
    prompt: "Make a legendary cloak called Nightwatch Mantle. While worn, it gives +1 AC and lets the wearer shrug off necrotic damage. It has 5 charges, gets all of them back at dawn, and can spend 2 charges to cast Invisibility or 3 charges to call a friendly panther for an hour. Needs attunement."
  },
  {
    id: "language-high-nova-glaive",
    label: "High slang: artifact nova hybrid",
    strictKind: false,
    expectedKinds: ["artifactWeaponHybrid", "equipmentPowerSuite", "legendaryEquipmentSuite"],
    prompt: "Create an artifact glaive called Sunspike. It is a +3 glaive that smacks for an extra 1d8 radiant on every hit. While attuned, it gives +1 AC. As a bonus action, it lights up for 20 feet bright and 20 feet dim. Once per dawn, the wielder can go nova with Flame Strike at DC 18."
  }
];

// Beta V1 coverage uses distinct SRD spells and summon profiles in each tier.
// The matching runner verifies that these named mechanics survive the service contract.
const betaV1TieredSweep = [
  {
    id: "beta-simple-misty-step-ring",
    label: "Simple: Misty Step utility",
    strictKind: true,
    expectedKinds: ["casterUtilityEquipment"],
    expectedMechanics: ["Misty Step"],
    prompt: "Create an uncommon ring called Phase Pebble. Once per long rest, the attuned wearer can cast Misty Step."
  },
  {
    id: "beta-simple-invisibility-cloak",
    label: "Simple: Invisibility utility",
    strictKind: true,
    expectedKinds: ["casterUtilityEquipment"],
    expectedMechanics: ["Invisibility"],
    prompt: "Create an uncommon cloak called Veilthread. Once per long rest, the attuned wearer can cast Invisibility."
  },
  {
    id: "beta-simple-cure-wounds-chalice",
    label: "Simple: Cure Wounds healing",
    strictKind: false,
    expectedKinds: ["chargedHealing", "casterUtilityEquipment", "equipmentPowerSuite"],
    expectedMechanics: ["Cure Wounds"],
    prompt: "Create an uncommon chalice called Kindled Cup. Once per long rest, the attuned bearer can cast Cure Wounds at 2nd level."
  },
  {
    id: "beta-simple-ice-knife-wand",
    label: "Simple: Ice Knife attack",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "equipmentPowerSuite", "chargedSaveDamage"],
    expectedMechanics: ["Ice Knife"],
    prompt: "Create an uncommon wand called Shardtwig. It has 3 charges and regains 1d3 charges daily at dawn. As an action, spend 1 charge to cast Ice Knife at DC 14. It requires attunement by a spellcaster."
  },
  {
    id: "beta-simple-owlbear-figurine",
    label: "Simple: Owlbear summon",
    strictKind: true,
    expectedKinds: ["nativeSummon"],
    expectedMechanics: ["Owlbear"],
    prompt: "Create a rare figurine called Hearthpaw. Once per long rest, as an action, it summons a friendly owlbear that obeys the wielder for 1 hour."
  },
  {
    id: "beta-medium-farseer-orb",
    label: "Medium: Clairvoyance, Fog Cloud, and Detect Thoughts",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "equipmentPowerSuite"],
    expectedMechanics: ["Clairvoyance", "Fog Cloud", "Detect Thoughts"],
    prompt: "Create a rare orb called Far Horizon. It requires attunement by a spellcaster. Once per long rest, the wearer can cast Clairvoyance, Fog Cloud, or Detect Thoughts."
  },
  {
    id: "beta-medium-lightning-rod",
    label: "Medium: Lightning Bolt line",
    strictKind: false,
    expectedKinds: ["chargedSaveDamage", "equipmentPowerSuite", "multiActivityStaff"],
    expectedMechanics: ["Lightning Bolt"],
    prompt: "Create a rare rod called Stormline. It has 6 charges and regains 1d6 charges daily at dawn. As an action, spend 3 charges to cast Lightning Bolt at DC 15. It requires attunement."
  },
  {
    id: "beta-medium-moonbeam-symbol",
    label: "Medium: Moonbeam concentration",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "equipmentPowerSuite"],
    expectedMechanics: ["Moonbeam"],
    prompt: "Create a rare holy symbol called Moon's Witness. It has 4 charges and regains 1d4 charges daily at dawn. As an action, spend 2 charges to cast Moonbeam at DC 15. It requires attunement by a cleric or druid."
  },
  {
    id: "beta-medium-fireball-grimoire",
    label: "Medium: Fireball sphere",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "equipmentPowerSuite", "chargedSaveDamage"],
    expectedMechanics: ["Fireball"],
    prompt: "Create a rare grimoire called Ash Index. It has 5 charges and regains 1d4 + 1 charges daily at dawn. As an action, spend 3 charges to cast Fireball at DC 15. It requires attunement by a wizard."
  },
  {
    id: "beta-medium-infernal-idol",
    label: "Medium: multi-profile fiend summon",
    strictKind: true,
    expectedKinds: ["nativeMultiProfileSummon"],
    expectedMechanics: ["Demon", "Devil", "Yugoloth"],
    prompt: "Create a very rare idol called Gatekeeper's Token. Once per long rest, as an action, it summons a friendly fiend for 1 hour. The wielder chooses whether it appears as a Demon, Devil, or Yugoloth."
  },
  {
    id: "beta-complex-winter-scepter",
    label: "Complex: Sleet Storm, Ice Storm, and Cone of Cold",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "equipmentPowerSuite"],
    expectedMechanics: ["Sleet Storm", "Ice Storm", "Cone of Cold"],
    prompt: "Create a very rare scepter called Winter's Verdict. It requires attunement by a spellcaster and has 12 charges, regaining 1d6 + 6 at dawn. As an action, spend 3 charges to cast Sleet Storm, 4 charges to cast Ice Storm at DC 16, or 5 charges to cast Cone of Cold at DC 16."
  },
  {
    id: "beta-complex-solar-glaive",
    label: "Complex: Flame Strike artifact weapon",
    strictKind: false,
    expectedKinds: ["artifactWeaponHybrid", "equipmentPowerSuite", "legendaryEquipmentSuite"],
    expectedMechanics: ["Flame Strike", "fire", "radiant"],
    prompt: "Create an artifact glaive called Dawn Tribunal. It requires attunement. It is a +3 glaive that deals an extra 1d8 radiant damage on every hit and grants +1 AC while attuned. Once per dawn, the wielder can cast Flame Strike at DC 18. As a bonus action, it sheds bright light for 20 feet and dim light for 20 more feet."
  },
  {
    id: "beta-complex-tide-vision-staff",
    label: "Complex: Tidal Wave, Clairvoyance, and Giant Spider",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "equipmentPowerSuite", "nativeSummon"],
    expectedMechanics: ["Tidal Wave", "Clairvoyance", "Giant Spider"],
    prompt: "Create a very rare staff called Atlas of the Deep. It requires attunement by a spellcaster and has 10 charges, regaining 1d6 + 4 at dawn. As an action, spend 4 charges to cast Tidal Wave at DC 16, spend 3 charges to cast Clairvoyance, or spend 3 charges to summon a friendly giant spider for 1 hour."
  },
  {
    id: "beta-complex-venom-mantle",
    label: "Complex: Ray of Sickness, Command, and Panther",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "legendaryEquipmentSuite", "nativeSummon"],
    expectedMechanics: ["Ray of Sickness", "Command", "Panther"],
    prompt: "Create a legendary cloak called Serpent's Audience. It requires attunement, grants resistance to poison damage, and has 7 charges that all return at dawn. As an action, spend 1 charge to cast Ray of Sickness at DC 16, 2 charges to cast Command at DC 16, or 3 charges to summon a friendly panther for 1 hour."
  },
  {
    id: "beta-complex-ember-reliquary",
    label: "Complex: Burning Hands, Shatter, Invisibility, and Cure Wounds",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "casterUtilityEquipment", "chargedHealing"],
    expectedMechanics: ["Burning Hands", "Shatter", "Invisibility", "Cure Wounds"],
    prompt: "Create a very rare amulet called Ember Reliquary. It requires attunement by a spellcaster and has 8 charges, regaining 1d6 + 2 at dawn. As an action, spend 1 charge to cast Burning Hands at DC 15, 2 charges to cast Shatter at DC 15, or 2 charges to cast Cure Wounds at 3rd level. Once per long rest, the wearer can cast Invisibility."
  }
];

// Sweep two deliberately avoids the named spells, summons, condition riders,
// and bonus combinations exercised by the first Beta V1 matrix.
const betaV1TieredSweep2 = [
  {
    id: "beta2-simple-magic-missile-wand",
    label: "Simple: Magic Missile utility wand",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "equipmentPowerSuite", "chargedSaveDamage"],
    expectedMechanics: ["Magic Missile"],
    prompt: "Create an uncommon wand called Starling Wand. It has 3 charges and regains 1d3 charges daily at dawn. As an action, spend 1 charge to cast Magic Missile at 1st level. It requires attunement by a spellcaster."
  },
  {
    id: "beta2-simple-prone-flail",
    label: "Simple: necrotic rider and prone on hit",
    strictKind: true,
    expectedKinds: ["weaponConditionOnHit"],
    expectedMechanics: ["necrotic", "prone"],
    prompt: "Create a rare +1 flail called Gravetide Flail. On a hit it deals an extra 1d6 necrotic damage, and the target must succeed on a DC 14 Strength save or fall prone until the start of its next turn. It requires attunement."
  },
  {
    id: "beta2-simple-scout-boots",
    label: "Simple: speed and Stealth bonuses",
    strictKind: true,
    expectedKinds: ["passiveEffectEquipment"],
    expectedMechanics: ["Stealth"],
    prompt: "Create uncommon boots called Mossway Boots. While worn, they increase walking speed by 5 feet and grant advantage on Dexterity (Stealth) checks. They do not require attunement."
  },
  {
    id: "beta2-simple-giant-owl-horn",
    label: "Simple: Giant Owl summon",
    strictKind: true,
    expectedKinds: ["nativeSummon"],
    expectedMechanics: ["Giant Owl"],
    prompt: "Create a rare horn called Nightwing Call. Once per long rest, as an action, it summons a friendly Giant Owl that obeys the bearer for 1 hour."
  },
  {
    id: "beta2-simple-lesser-restoration-tonic",
    label: "Simple: Lesser Restoration consumable",
    strictKind: false,
    expectedKinds: ["casterUtilityEquipment", "chargedHealing", "equipmentPowerSuite"],
    expectedMechanics: ["Lesser Restoration"],
    prompt: "Create an uncommon one-use tonic called Clearblood Tonic. Drinking it takes an action and casts Lesser Restoration on the drinker. The tonic is consumed after use."
  },
  {
    id: "beta2-medium-web-ray-rod",
    label: "Medium: Web and Scorching Ray",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "equipmentPowerSuite", "casterUtilityEquipment"],
    expectedMechanics: ["Web", "Scorching Ray"],
    prompt: "Create a rare rod called Cinderweb Rod. It has 7 charges and regains 1d6 + 1 at dawn. As an action, spend 2 charges to cast Web at DC 15 or 2 charges to cast Scorching Ray with a +7 spell attack bonus. It requires attunement by a spellcaster."
  },
  {
    id: "beta2-medium-seeing-shield",
    label: "Medium: initiative, Perception, and See Invisibility",
    strictKind: false,
    expectedKinds: ["shieldArmorBonus", "passiveEffectEquipment", "casterUtilityEquipment", "equipmentPowerSuite"],
    expectedMechanics: ["See Invisibility"],
    prompt: "Create a rare +1 shield called Vigilant Mirror. While equipped, it grants +2 initiative and advantage on Wisdom (Perception) checks. Once per long rest, the bearer can cast See Invisibility. It requires attunement."
  },
  {
    id: "beta2-medium-fear-longbow",
    label: "Medium: psychic rider, frightened, and Fear",
    strictKind: false,
    expectedKinds: ["weaponConditionOnHit", "artifactWeaponHybrid", "equipmentPowerSuite"],
    expectedMechanics: ["psychic", "frightened", "Fear"],
    prompt: "Create a very rare +1 longbow called Dreadwhisper. Its arrows deal an extra 1d6 psychic damage. On a hit, the target must succeed on a DC 15 Wisdom save or become frightened until the end of its next turn. Once per long rest, the wielder can cast Fear at DC 15. It requires attunement."
  },
  {
    id: "beta2-medium-brown-bear-idol",
    label: "Medium: Brown Bear summon and temporary hit points",
    strictKind: false,
    expectedKinds: ["nativeSummon", "equipmentPowerSuite", "legendaryEquipmentSuite"],
    expectedMechanics: ["Brown Bear"],
    prompt: "Create a rare idol called Hearth Ursine. Once per long rest, as an action, it summons a friendly Brown Bear for 1 hour. When summoned, the bearer also gains 2d8 temporary hit points. It requires attunement."
  },
  {
    id: "beta2-medium-darkness-bat-oil",
    label: "Medium: weapon enchant, Darkness, and Giant Bat",
    strictKind: false,
    expectedKinds: ["nativeEnchant", "equipmentPowerSuite", "nativeSummon"],
    expectedMechanics: ["Darkness", "Giant Bat"],
    prompt: "Create a rare one-use oil called Gloamwing Oil. Applying it to a nonmagical weapon takes an action. For 1 hour the weapon becomes +1 and deals an extra 1d4 necrotic damage. When applied, it also casts Darkness centered on the weapon and summons a friendly Giant Bat for 10 minutes."
  },
  {
    id: "beta2-complex-archmage-staff",
    label: "Complex: Wall of Fire, Disintegrate, and Teleport",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "equipmentPowerSuite", "legendaryEquipmentSuite", "casterUtilityEquipment"],
    expectedMechanics: ["Wall of Fire", "Disintegrate", "Teleport"],
    prompt: "Create a legendary staff called Meridian Breaker. It has 15 charges and regains 1d8 + 7 charges at dawn. As an action, spend 4 charges to cast Wall of Fire at DC 18, 6 charges to cast Disintegrate at DC 18, or 7 charges to cast Teleport. While attuned by a spellcaster it grants +2 to spell attack rolls and spell save DC."
  },
  {
    id: "beta2-complex-earthquake-maul",
    label: "Complex: stunned on hit, defensive bonuses, and Earthquake",
    strictKind: false,
    expectedKinds: ["artifactWeaponHybrid", "weaponConditionOnHit", "legendaryEquipmentSuite"],
    expectedMechanics: ["thunder", "stunned", "Earthquake"],
    prompt: "Create an artifact +3 maul called Worldbell. It deals an extra 1d8 thunder damage on every hit. Once per turn on a hit, the target must make a DC 18 Constitution save or be stunned until the end of its next turn. While attuned, the wielder gains +2 AC and advantage on Constitution saving throws. Once per dawn, it casts Earthquake at DC 18."
  },
  {
    id: "beta2-complex-couatl-crown",
    label: "Complex: Chain Lightning, Globe, Heal, and Couatl",
    strictKind: false,
    expectedKinds: ["legendaryEquipmentSuite", "equipmentPowerSuite", "casterUtilityEquipment"],
    expectedMechanics: ["Chain Lightning", "Globe of Invulnerability", "Heal", "Couatl"],
    prompt: "Create a legendary crown called Crown of the Upper Sky. It has 12 charges and regains 1d6 + 6 at dawn. Spend 6 charges to cast Chain Lightning at DC 18, 6 charges to cast Globe of Invulnerability, 6 charges to cast Heal, or 5 charges to summon a friendly Couatl for 1 hour. While attuned, it grants resistance to lightning and radiant damage."
  },
  {
    id: "beta2-complex-guardian-plate",
    label: "Complex: Spirit Guardians, Banishment, and Guardian of Faith",
    strictKind: false,
    expectedKinds: ["legendaryEquipmentSuite", "equipmentPowerSuite", "shieldArmorBonus", "casterUtilityEquipment"],
    expectedMechanics: ["Spirit Guardians", "Banishment", "Guardian of Faith"],
    prompt: "Create very rare +2 plate armor called Saint's Redoubt. It requires attunement by a cleric, grants resistance to radiant and necrotic damage, and has 10 charges that regain 1d6 + 4 at dawn. Spend 3 charges to cast Spirit Guardians at DC 17, 4 charges to cast Banishment at DC 17, or 4 charges to cast Guardian of Faith."
  },
  {
    id: "beta2-complex-sunbeam-elk-bow",
    label: "Complex: Sunbeam, Blade Barrier, Haste, and Giant Elk",
    strictKind: false,
    expectedKinds: ["artifactWeaponHybrid", "legendaryEquipmentSuite", "equipmentPowerSuite"],
    expectedMechanics: ["Sunbeam", "Blade Barrier", "Haste", "Giant Elk", "blinded"],
    prompt: "Create an artifact +3 longbow called Horizon Nail. It scores a critical hit on a 19 or 20 and deals an extra 1d8 radiant damage. A creature hit must succeed on a DC 18 Constitution save or be blinded until the end of its next turn. It has 15 charges and regains 1d8 + 7 at dawn: spend 6 for Sunbeam at DC 18, 6 for Blade Barrier at DC 18, 3 for Haste, or 5 to summon a friendly Giant Elk for 1 hour. It requires attunement."
  }
];

const betaV1ReadinessSweep1 = [
  {
    id: "ready1-simple-force-pick",
    label: "Simple: force-damage war pick",
    strictKind: true,
    expectedKinds: ["weaponExtraDamage"],
    expectedMechanics: ["force"],
    prompt: "Create an uncommon +1 war pick called Riftspike. Every hit deals an extra 1d4 force damage. It does not require attunement."
  },
  {
    id: "ready1-simple-restoring-cordial",
    label: "Simple: single-use healing cordial",
    strictKind: true,
    expectedKinds: ["chargedHealing"],
    expectedMechanics: ["healing"],
    prompt: "Create an uncommon one-use cordial called Dockside Remedy. Drinking it takes an action and restores 2d6 + 2 hit points. The bottle is consumed after use."
  },
  {
    id: "ready1-simple-owl-lenses",
    label: "Simple: darkvision and Perception lenses",
    strictKind: true,
    expectedKinds: ["passiveEffectEquipment"],
      expectedMechanics: ["darkvision", "system.skills.prc.roll.mode"],
    prompt: "Create uncommon goggles called Owlglass Lenses. While worn, they grant 60-foot darkvision and advantage on Wisdom (Perception) checks. They do not require attunement."
  },
  {
    id: "ready1-simple-giant-goat-bell",
    label: "Simple: Giant Goat summon",
    strictKind: true,
    expectedKinds: ["nativeSummon"],
    expectedMechanics: ["Giant Goat"],
    prompt: "Create a rare handbell called Cragherd Bell. Once per long rest, ringing it as an action summons a friendly Giant Goat for 1 hour."
  },
  {
    id: "ready1-simple-storm-oil",
    label: "Simple: lightning weapon oil",
    strictKind: true,
    expectedKinds: ["nativeEnchant"],
    expectedMechanics: ["lightning"],
    prompt: "Create an uncommon one-use oil called Stormglass Oil. Applying it to one nonmagical weapon takes an action. For 1 hour, the weapon becomes magical and deals an extra 1d4 lightning damage. The oil is consumed after use."
  },
  {
    id: "ready1-medium-restraining-whip",
    label: "Medium: cold whip with restrained rider",
    strictKind: true,
    expectedKinds: ["weaponConditionOnHit"],
    expectedMechanics: ["cold", "restrained"],
    prompt: "Create a rare +1 whip called Wintercoil. On a hit it deals an extra 1d4 cold damage, and the target must succeed on a DC 14 Strength save or be restrained until the end of its next turn. It requires attunement."
  },
  {
    id: "ready1-medium-erupting-wand",
    label: "Medium: charged Erupting Earth wand",
    strictKind: false,
    expectedKinds: ["chargedSaveDamage", "casterUtilityEquipment", "equipmentPowerSuite"],
    expectedMechanics: ["Erupting Earth"],
    prompt: "Create a rare wand called Faultline Wand. It has 7 charges and regains 1d6 + 1 charges at dawn. As an action, spend 3 charges to cast Erupting Earth at DC 15. It requires attunement by a spellcaster."
  },
  {
    id: "ready1-medium-scale-armor",
    label: "Medium: cold-resistant scale mail",
    strictKind: true,
    expectedKinds: ["shieldArmorBonus"],
    expectedMechanics: ["cold"],
    prompt: "Create rare +1 scale mail called Rimewake Scales. While equipped, it grants resistance to cold damage. It is armor, not a shield, and does not require attunement."
  },
  {
    id: "ready1-medium-arcane-eye",
    label: "Medium: Arcane Eye caster monocle",
    strictKind: true,
    expectedKinds: ["casterUtilityEquipment"],
    expectedMechanics: ["Arcane Eye"],
    prompt: "Create a rare monocle called Surveyor's Third Eye. While worn, it grants +1 to spell attack rolls and spell save DC, and it can cast Arcane Eye once per long rest. It requires attunement by a spellcaster."
  },
  {
    id: "ready1-medium-three-fiends",
    label: "Medium: three-profile fiend summon",
    strictKind: true,
    expectedKinds: ["nativeMultiProfileSummon"],
    expectedMechanics: ["Demon", "Devil", "Yugoloth"],
    prompt: "Create a very rare censer called Censer of the Three Contracts. Once per long rest, as an action, it summons a friendly fiend for 1 hour. The wielder chooses Demon, Devil, or Yugoloth when activating it. It requires attunement."
  },
  {
    id: "ready1-complex-stone-staff",
    label: "Complex: Sleet Storm, Blight, and Wall of Stone staff",
    strictKind: false,
    expectedKinds: ["multiActivityStaff", "equipmentPowerSuite", "legendaryEquipmentSuite"],
    expectedMechanics: ["Sleet Storm", "Blight", "Wall of Stone"],
    prompt: "Create a very rare staff called Staff of the Broken Season. It has 12 charges and regains 1d6 + 6 charges at dawn. Spend 3 charges to cast Sleet Storm at DC 17, 4 charges to cast Blight at DC 17, or 5 charges to cast Wall of Stone. It requires attunement by a spellcaster."
  },
  {
    id: "ready1-complex-wayfarer-mantle",
    label: "Complex: mobility suite with Rhinoceros summon",
    strictKind: false,
    expectedKinds: ["equipmentPowerSuite", "legendaryEquipmentSuite", "casterUtilityEquipment"],
    expectedMechanics: ["Dimension Door", "Freedom of Movement", "Rhinoceros"],
    prompt: "Create a very rare cloak called Wayfarer's Siege Mantle. It has 10 charges and regains 1d6 + 4 at dawn. Spend 4 charges to cast Dimension Door, 4 charges to cast Freedom of Movement, or 5 charges to summon a friendly Rhinoceros for 1 hour. It requires attunement."
  },
  {
    id: "ready1-complex-weather-crown",
    label: "Complex: Sunburst, Control Weather, and Mass Cure Wounds crown",
    strictKind: false,
    expectedKinds: ["legendaryEquipmentSuite", "equipmentPowerSuite", "casterUtilityEquipment"],
    expectedMechanics: ["Sunburst", "Control Weather", "Mass Cure Wounds"],
    prompt: "Create a legendary crown called Crown of the Turning Sky. It has 15 charges and regains 1d8 + 7 at dawn. Spend 8 charges to cast Sunburst at DC 18, 8 charges to cast Control Weather, or 5 charges to cast Mass Cure Wounds. While attuned, it grants resistance to radiant and thunder damage."
  },
  {
    id: "ready1-complex-gravity-halberd",
    label: "Complex: blinded halberd, Reverse Gravity, and Giant Eagle",
    strictKind: false,
    expectedKinds: ["artifactWeaponHybrid", "legendaryEquipmentSuite", "equipmentPowerSuite"],
    expectedMechanics: ["radiant", "blinded", "Reverse Gravity", "Giant Eagle"],
    prompt: "Create an artifact +3 halberd called Zenith Hook. Every hit deals an extra 1d8 radiant damage. Once per turn on a hit, the target must succeed on a DC 18 Constitution save or be blinded until the end of its next turn. It has 15 charges and regains 1d8 + 7 at dawn: spend 7 charges to cast Reverse Gravity at DC 18 or 5 charges to summon a friendly Giant Eagle for 1 hour. It requires attunement."
  },
  {
    id: "ready1-complex-void-plate",
    label: "Complex: Antimagic Field, Power Word Stun, and Elephant plate",
    strictKind: false,
    expectedKinds: ["legendaryEquipmentSuite", "equipmentPowerSuite", "shieldArmorBonus", "casterUtilityEquipment"],
    expectedMechanics: ["Antimagic Field", "Power Word Stun", "Elephant"],
    prompt: "Create legendary +2 plate armor called Bastion of the Quiet World. It has 18 charges and regains 1d10 + 8 at dawn. Spend 8 charges to cast Antimagic Field, 8 charges to cast Power Word Stun, or 5 charges to summon a friendly Elephant for 1 hour. While attuned, it grants resistance to force and psychic damage."
  }
];

const regressionSweeps = Object.freeze({
  family: familySweep,
  hybrid: hybridSweep,
  transcript: transcriptSweep,
  language: languageSweep,
  beta: betaV1TieredSweep,
  beta2: betaV1TieredSweep2,
  readiness1: betaV1ReadinessSweep1
});

export { betaV1ReadinessSweep1, betaV1TieredSweep, betaV1TieredSweep2, familySweep, hybridSweep, languageSweep, regressionSweeps, transcriptSweep };
