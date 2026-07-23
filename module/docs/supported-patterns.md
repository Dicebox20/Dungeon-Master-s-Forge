# Dungeon Master's Forge Pattern Index

This is the list of engine patterns that have been confirmed in testing.

## Request Batches

You can compile multiple prompts in one pass. Separate free-form items with a line containing `---`, or use repeated detailed blocks beginning with `Item name:`. Each compiled item keeps its own pattern decision, and assumptions or warnings identify the item they affect.

## Advanced Prompt Mappings

The confirmed advanced mappings include:

- `multiActivityStaff` keeps Ice Storm and Cone of Cold as separate save activities with their own charge costs while sharing one item charge pool. Demon, Devil, and Yugoloth choices use `nativeMultiProfileSummon` and create one friendly summon actor per selectable profile.
- `nativeEnchant` handles one-use oils that add elemental weapon damage. `equipmentPowerSuite` handles explicit ranged or melee attacks made by worn equipment. Unsupported enchantment changes and incomplete attack damage stay visible for review.
- `artifactWeaponHybrid` keeps normal weapon damage, passive AC, the Item Macro light toggle, and the charged Flame Strike save activity separate so using one power does not trigger another.
- Unsupported ally auras, class-resource restoration, and unmapped spells become structured `unresolvedMechanics` records. Each record keeps the requested text, the reason it needs review, the suggested next step, and an editable resolution state. Ally-only bonuses are not applied as personal effects.
- Request compilation runs through a provider registry. `local-rules` is the offline compiler, `bring-your-own` supports the Forge `1.0` network contract, and `hosted-forge` is available when the release has a valid hosted configuration. The unresolved-mechanics setting controls whether reviewed items may be created or must be blocked.

## Provider API

- `forge.compile(request)`: backward-compatible synchronous Local Rules compilation.
- `await forge.compileWithProvider(request, options)`: provider-neutral asynchronous compilation.
- `forge.providers()`: cloned provider metadata suitable for interfaces and diagnostics.
- `forge.contentResolver.*`: read-only exact-name lookup for system-native DND5e Spell and Equipment entries.

## Diagnostics

The non-destructive Diagnostics command and `diagnosticsWithValidation()` API check condition weapons, multi-spell charges, multi-profile summons, native enchantments, hybrid artifacts, and unresolved-mechanic provenance through both request compilation and the Foundry engine validator. Diagnostics never invoke a factory or write world documents.

System-content diagnostics also cover native DND5e Spell and Equipment lookups. They prefer system-owned modern packs, report source UUID provenance, and never import, clone, or modify compendium documents.

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
- unknown spell mappings: preserved as `unmappedSpell` unresolved records until a deterministic or remote provider supplies an activity mapping.

## Existing Spell Rule

When an item casts or reproduces an existing DND5e spell, model the parts Foundry can automate. Use `saveActivities` for spells with saving throws, even if they deal no damage, such as Command or Fear. Reserve utility activities for spells or clauses where no attack roll, saving throw, damage, healing, enchantment, summon, or active effect can be cleanly represented.

## Charge-Scaled Spell Item Rule

Items with a shared charge pool and multiple spell activities should default each spell's charge cost to the spell level when the request does not specify another cost. A 3rd-level spell costs 3 charges, a 7th-level spell costs 7 charges, and so on. When the user asks for upcasting, preserve the base spell activity and expose the extra charge spend as an upcast/scaling review target rather than flattening it into a separate unrelated power.

## Native SRD Spell Activity Rule

When a requested item casts an exact-name DND5e SRD spell, prefer the read-only system content resolver and source UUID provenance before synthesizing a hand-made activity. If Foundry's DND5e item workflow can safely copy or derive the spell's activity shape the same way a GM can drag a spell onto an item, use that system-native activity data as the first choice, then apply item-specific charge cost, uses, save DC, or activation overrides during review. Never mutate locked system packs.

## Utility Macro Rule

Set `macroCommand` on a utility activity when a reviewed power must update a resource or document that a normal DND5e activity cannot change. The engine embeds the Item Macro command and registers that activity with Midi-QOL. Class-resource macros remain deferred until the workflow can identify the actor's embedded feature safely.

## Story Material Rule

If a requested feature depends on table judgment or unsupported automation, retain it in the description and add a structured unresolved record. Utility reminder text can supplement that record when the item needs an obvious play-time prompt. Examples include:

- choosing which allies are affected by an aura
- attack redirection
- narrow social advantage
- once-per-turn bonus damage choices
- once-per-dawn limits separate from item charges
