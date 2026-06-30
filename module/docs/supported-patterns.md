# Dungeon Master's Forge V2 Pattern Index

These are the confirmed engine patterns available in V2.

## Request Batches

V2.2 can compile multiple natural-language requests in one pass. Separate free-form items with a line containing `---`, or use repeated detailed blocks beginning with `Item name:`. Every compiled item retains its own pattern decision, and assumptions or warnings identify the affected item.

## Advanced Request Mappings

V2.3 maps the proven Staff of Winter's Judgment family to `multiActivityStaff`: Ice Storm and Cone of Cold receive separate save activities and charge costs while sharing the item's charge pool. It also maps Demon, Devil, and Yugoloth choice requests to `nativeMultiProfileSummon`, producing one friendly summon actor per selectable profile.

V2.4 maps one-use oils that grant extra elemental weapon damage to `nativeEnchant`. It also maps explicit ranged or melee attacks from worn equipment to `equipmentPowerSuite` attack activities. Both mappings remain conservative: unsupported enchantment changes and underspecified attack damage are surfaced for review.

V2.5 maps the proven Stormfire Reaver family to `artifactWeaponHybrid`. Normal weapon damage, passive AC, the Item Macro light toggle, and the charged Flame Strike save activity remain separate so using one power cannot accidentally trigger the others.

V2.6 adds structured `unresolvedMechanics` records for ally auras, class resources, and spells outside the deterministic map. Each record preserves the requested text, reason, recommended handling, and editable resolution state. Aura clauses are excluded from personal passive-effect parsing, preventing an ally-only AC bonus from being applied to the wearer.

V2.7 routes request compilation through a provider registry. `local-rules` remains the available offline compiler. `bring-your-own` and `hosted-forge` reserve stable provider IDs but remain unavailable until their network transports and credential boundaries are implemented. Provider configuration currently controls whether reviewed unresolved mechanics may be created or must block creation.

## Provider API

- `forge.compile(request)`: backward-compatible synchronous Local Rules compilation.
- `await forge.compileWithProvider(request, options)`: provider-neutral asynchronous compilation.
- `forge.providers()`: cloned provider metadata suitable for interfaces and diagnostics.
- `forge.contentResolver.*`: read-only exact-name lookup for system-native DND5e Spell and Equipment entries.

## Diagnostics

V2.9 adds a non-destructive Diagnostics command and `diagnosticsWithValidation()` API. It checks condition weapons, multi-spell charges, multi-profile summons, native enchantments, hybrid artifacts, and unresolved-mechanic provenance through both request compilation and the Foundry engine validator. Diagnostics never invoke a factory or write world documents.

V2.19 adds read-only system-content diagnostics for native DND5e Spell and Equipment lookups. These checks prefer system-owned modern packs, report source UUID provenance, and never import, clone, or modify compendium documents.

## Core Item Patterns

- `weaponExtraDamage`: magic weapons with base weapon damage plus extra damage dice.
- `chargedHealing`: consumables or items with heal activities and item-use consumption.
- `chargedSaveDamage`: one save/damage activity with item-use consumption.
- `multiActivityStaff`: shared charge pool with several save/damage spell activities.
- `passiveEffectEquipment`: equipment with transfer Active Effects.
- `wondrousPassive`: convenience wrapper for passive wondrous items.
- `shieldArmorBonus`: convenience wrapper for magic shields.

## Advanced Patterns

- `nativeEnchant`: DND5e native enchant activity for weapon/armor enchantments.
- `nativeSummon`: DND5e native summon activity with one generated actor/profile.
- `nativeMultiProfileSummon`: DND5e native summon activity with multiple profile choices.
- `artifactWeaponHybrid`: weapon with attack patching plus utility/save powers.
- `weaponConditionOnHit`: weapon attack with Midi-QOL/Item Macro condition rider.
- `casterUtilityEquipment`: caster equipment with passive effects and utility powers.
- `legendaryEquipmentSuite`: complex non-weapon legendary item with passives, charges, utility activities, save activities, and optional summons.
- `equipmentPowerSuite`: complex equipment item with passives, attack activities, utility activities, save activities, and optional summons.
- utility activity Item Macros: scripted self-service powers such as restoring an embedded actor resource.

## Equipment Attack Activities

Use `attackActivities` when a worn item, wondrous item, helm, ring, staff, or similar non-weapon item makes an attack roll of its own. This is appropriate for psionic blasts, eye rays, wand bolts, command-word rays, and similar powers.

Confirmed test: Helm of the Psimaster created a working ranged psychic attack activity and a native summon activity. The summon actor correctly received embedded Psionic Strike and Disciplined Staff items. Automated Animations recognized the psychic lance-style attack and added an animation without extra configuration.

Confirmed structure:

- `CONFIG.DND5E.activityTypes.attack.documentClass`
- `attack.type.value`: `ranged` or `melee`
- `attack.type.classification`: usually `spell` for magical or psionic item attacks
- `attack.ability`: an ability such as `int` or `spellcasting`
- `attack.bonus`: use `@prof` when the item should add proficiency
- `damage.parts`: item power damage, with `includeBase: false` for non-weapon equipment

## Deferred Pattern

- automated ally aura buffs: deferred until Active Auras is compatible with the user's Foundry version; emitted as `allyAura` unresolved records.
- class-specific resource restoration: deferred because Ki/Focus and similar pools vary across rules editions, imports, and embedded class features; emitted as `classResource` unresolved records.
- unknown spell mappings: preserved as `unmappedSpell` unresolved records until a deterministic or AI provider supplies an activity mapping.

## Existing Spell Rule

When an item casts or reproduces an existing DND5e spell, model the parts Foundry can automate. Use `saveActivities` for spells with saving throws, even if they deal no damage, such as Command or Fear. Reserve utility activities for spells or clauses where no attack roll, saving throw, damage, healing, enchantment, summon, or active effect can be cleanly represented.

## Utility Macro Rule

Set `macroCommand` on a utility activity when a reviewed power must update a resource or document that a normal DND5e activity cannot change. The engine embeds the Item Macro command and registers that activity with Midi-QOL. Class-resource macros remain deferred until the workflow can identify the actor's embedded feature safely.

## Story Material Rule

If a requested feature depends on table judgment or unsupported automation, retain it in the description and add a structured unresolved record. Utility reminder text can supplement that record when the item needs an obvious play-time prompt. Examples include:

- choosing which allies are affected by an aura
- attack redirection
- narrow social advantage
- once-per-turn bonus damage choices
- once-per-dawn limits separate from item charges
