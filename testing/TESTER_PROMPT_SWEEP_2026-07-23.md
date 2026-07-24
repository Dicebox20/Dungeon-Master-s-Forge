# Tester Prompt Sweep: 2026-07-23

Run these in order with a fresh Foundry world item name for each prompt. Review the Forge preview before approval, then inspect the created item before using it. These prompts stay inside the current production boundary: DND5e core, Midi-QOL plus Item Macro, Item Macro self-target utilities, and DAE passive effects.

For every prompt, record:

- Did the preview preserve the requested name and item chassis?
- Did the review notes identify the selected layer and required modules accurately?
- Did the generated JSON contain the requested activities, effects, uses, targets, and formulas?
- Did the created Foundry document preserve those details?
- Did the activity behave correctly in a safe test scene?

## 1. Simple Weapon

```text
Create an uncommon longsword named "Emberwake Blade [TEST-01]". It is a +1 magical longsword, and every hit deals an extra 1d4 fire damage. It does not require attunement.
```

Check the base weapon, +1 attack and damage, extra fire damage, and no unnecessary automation warning.

## 2. Passive Equipment Effect

```text
Create a rare cloak named "Stormwatch Mantle [TEST-02]". It requires attunement. While worn, it grants +1 AC and resistance to lightning damage. These are passive equipped effects and do not require an activation button.
```

Check the cloak chassis, attunement gate, AC bonus, lightning resistance, and DAE or core effect layer shown in the review.

## 3. Healing Consumable

```text
Create an uncommon potion named "Bloomdraught [TEST-03]". As an action, one creature that drinks it regains 3d4 + 3 hit points. It has one use and is consumed after drinking. It does not require attunement.
```

Check one action activity, one-creature targeting, the healing formula, one use, and consumption after use.

## 4. Single Charged Save Power

```text
Create a rare wand named "Hailglass Wand [TEST-04]". It has 6 charges and regains 1d6 charges daily at dawn. As an action, the wielder can spend 1 charge to create a 15-foot cone of freezing shards. Creatures in the cone make a DC 14 Dexterity saving throw, taking 4d6 cold damage on a failed save or half damage on a success. It requires attunement by a spellcaster.
```

Check the charge pool, daily recovery, action activity, cone template, Dexterity save, cold damage, half-damage success rule, and attunement requirement.

## 5. Shared Charges With Multiple Activities

```text
Create a rare quarterstaff named "Cinderfrost Staff [TEST-05]". It requires attunement by a spellcaster. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 2 charges to cast Burning Hands at DC 15 in a 15-foot cone, or spend 3 charges to cast Shatter at DC 15. Both powers use the same charge pool and must appear as separate named activities.
```

Check two distinct activities, their individual charge costs, one shared use pool, recovery, and each spell's targeting and save data.

## 6. On-Hit Condition Rider

```text
Create a rare spear named "Mirethorn Pike [TEST-06]". It is a +1 magical spear that deals an extra 1d4 poison damage on a hit. Once per turn when it hits a creature, that creature must make a DC 14 Constitution saving throw. On a failed save, it is poisoned until the end of the wielder's next turn. It requires attunement.
```

Check the weapon attack, extra poison damage, once-per-turn rider, Constitution save, poisoned condition, duration, and whether the review identifies the Midi-QOL plus Item Macro route when those modules are active.

## 7. Self-Target Light Toggle

```text
Create an artifact greatsword named "Dawncoil Oathblade [TEST-07]". It requires attunement. It is a +3 greatsword that deals an extra 1d8 radiant damage on every hit. As a bonus action, the wielder can ignite or extinguish the blade. While ignited, the wielder's actor token emits 20 feet of bright light and 20 additional feet of dim light. The light must originate from the wielder's token, affect no other token, and be reversible.
```

Check the +3 weapon, radiant damage, bonus-action utility activity, actor-token light source, reversible toggle, and Item Macro requirement.

## 8. Attunement-Gated Passive Transfer

```text
Create a very rare ring named "Ashen Focus Ring [TEST-08]". It requires attunement by a spellcaster. While attuned and worn, it grants +1 to spell attack rolls, +1 to spell save DC, and resistance to fire damage. These benefits must be represented as removable passive effects tied to the item's equipped and attuned state.
```

Check the ring chassis, spell attack bonus, spell save DC, fire resistance, attunement/equipped gating, and the DAE effect paths shown in the review and JSON.

## 9. Mixed Production Automation

```text
Create a legendary staff named "Lantern of the Two Winters [TEST-09]". It requires attunement by a spellcaster. It is a quarterstaff that grants a +2 magical bonus to attack and damage rolls. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, the wielder can spend 2 charges to cast Ice Knife at +8 to hit, or spend 3 charges to cast Shatter at DC 16. As a bonus action, the wielder can ignite or extinguish a cold blue light; while ignited, the wielder's actor token emits 20 feet of bright light and 20 additional feet of dim light. The light is self-targeted and reversible.
```

Check the quarterstaff chassis, shared charge pool, two named activities, spell attack/save data, and the separate self-token light toggle. Confirm the review does not claim the light changes damage or targets other actors.

## 10. Full Current-Boundary Hybrid

```text
Create an artifact halberd named "Winter's Mercy [TEST-10]". It requires attunement by a martial character. It is a +3 magical halberd that deals an extra 1d8 cold damage on every hit. Once per turn when it hits a creature, the target must make a DC 17 Constitution saving throw or become restrained until the end of the wielder's next turn. While equipped and attuned, the wielder gains resistance to cold damage and +1 AC. The halberd has 12 charges and regains 1d6 + 6 charges daily at dawn. As an action, the wielder can spend 3 charges to cast Cone of Cold at DC 17, or 4 charges to summon a friendly Giant Eagle for 1 hour. As a bonus action, the wielder can ignite or extinguish the halberd; while ignited, the wielder's actor token emits 20 feet of bright light and 20 additional feet of dim light. The light is reversible and self-targeted.
```

Check the complete review boundary: weapon chassis, extra damage, on-hit condition rider, attunement-gated passive effects, shared charges, save activity, SRD summon profile, self-token light toggle, required modules, and every manual-review note. Do not treat a successful import as proof that every live behavior works.

## Reporting

Use the tester questionnaire for each item. Mark each stage separately as `PASS`, `PARTIAL`, `MANUAL`, `FAIL`, or `NOT TESTED`. For a failure, send the item name, the exact failed checkpoint, exported JSON, and only the nearby console error. Do not send API keys, passwords, or private campaign data.
