# Dungeon Master's Forge Feature Menu

Use this list to choose the features you want to test. Start with one item chassis and add only a few features at a time. Dungeon Master's Forge prepares a reviewed Foundry item; it does not guarantee that every rule or module combination will work without manual review.

## Item Chassis

Choose one document shape first:

- Weapon, including melee, ranged, thrown, magical, and hybrid weapons
- Armor or shield
- Wand, staff, rod, or other charged equipment
- Healing item or consumable
- Enchanted weapon, armor, or shield
- Passive equipment item
- Summoning item using a named DND5e SRD creature
- Equipment suite with several named activities or powers

## Features Supported Now

These are the best starting points for tester prompts. They may still receive assumptions or review notes when the wording is incomplete.

- Magical attack and damage bonuses
- Extra damage on a hit
- Damage formulas and damage types
- Saving throws with an ability, DC, and success or failure result
- Standard conditions with a duration
- Targeting one creature, multiple creatures, self, or an activity-defined target
- Range, reach, thrown range, and area templates when the core activity supports them
- Healing formulas and healing consumables
- Charges, uses, costs, and recovery on dawn, short rest, or long rest
- Several named activities on one item
- Attunement requirements
- Passive bonuses and resistances
- Armor class and shield bonuses
- Spell attacks and named SRD spell activities
- Named SRD summon profiles with a safe fallback when the actor is unavailable
- Enchantments that transfer approved effects to an equipped item or actor
- Utility activities such as light, detection, and other non-damaging powers
- Duration and concentration fields when the requested behavior can be represented safely in core DND5e data

## Verified Automation Templates

These behaviors have a defined route and a specific proof target. The preview should identify the selected layer and required modules before approval.

- **On-hit condition rider**: after an attack hits, ask for a save and apply a standard condition for a defined duration. Preferred route: Midi-QOL plus Item Macro. Fallback: core attack data with review.
- **Self-token light toggle**: activate or toggle bright and dim light from the wielder's actor token. Preferred route: Item Macro. Fallback: portable light data with review.
- **Shared-charge activity set**: provide several named powers that spend from one shared use pool. Route: native DND5e.
- **Attunement effect transfer**: apply an approved passive effect only while the item is equipped and attuned. Preferred route: DAE. Fallback: core effect data with review.
- **Animation presentation**: attach a visual presentation to an activity without changing game state. Preferred route: Automated Animations plus Sequencer. Fallback: the activity remains usable without animation.

## Features That Need Extra Review

These can often be represented, but testers should expect assumptions, a fallback, or a manual step:

- Auras and areas that repeatedly affect creatures over time
- Concentration-linked effects that must end immediately
- Reactions and damage interception
- Ally targeting and target selection prompts
- Forced movement, teleportation, or movement changes
- Class resources or actor-specific resources
- Custom conditions that are not standard DND5e conditions
- Multiple effects that trigger at different workflow moments
- Effects that depend on another item, actor, token, or scene document

## Experimental or Deferred Features

Do not treat these as supported automation yet. They are useful stress tests, but a correct result may be a visible manual-review fallback.

- Actor-sourced concentration auras with once-per-turn damage
- Reaction-based damage protection with target selection and limited uses
- UUID-linked activation for Actors, Tokens, Tiles, Walls, Doors, Locks, Regions, or other world documents
- User-selected summon or profile branches
- Reviewed macros or trusted world actions
- Automatic Region creation, world migration, teleportation, or campaign-changing behavior

## Prompt Building Formula

Use this order when writing a prompt:

`Create [item chassis] named [unique name]. It has [ordinary item features]. It has [activity or power]. When [trigger], it [result]. It targets [target]. It costs [resource] and recovers [recovery]. It requires [attunement or module assumption].`

For a focused test, name the behavior directly:

- `Test an on-hit condition rider with a Constitution save and poisoned for 1 round.`
- `Test a self-target light toggle from the wielder's actor token.`
- `Test two named activities sharing six charges that recover at dawn.`
- `Test an attunement-gated passive resistance using an approved effect path.`
- `Test an activity with an optional animation, but keep the activity functional without the visual layer.`

## Tester Rule

Test one feature alone before combining it with another. Record the intended behavior, the selected automation layer, the live result, and whether the result was full, partial, manual, or failed. A created item is not a successful test until its Foundry document and relevant activity have been checked in-world.
