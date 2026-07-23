# Automation One-at-a-Time Sweep

Use one prompt at a time with a fresh run tag and a fresh item name. Inspect the preview, advanced specification, review notes, created Foundry document, and live behavior before moving to the next prompt.

Answer each question with `PASS`, `PARTIAL`, `MANUAL`, `FAIL`, or `NOT TESTED`. Use the same answer format for every prompt so failures can be compared.

## 1. On-Hit Condition Rider

### Prompt

```text
Create an uncommon magical longsword named Frostmark Brand [AUTO-C01]. It is a +1 longsword, so it grants a +1 bonus to attack and damage rolls. Each hit deals an additional 1d6 cold damage.

When this weapon hits a creature, that creature must make a DC 13 Constitution saving throw. On a failed save, it is poisoned for 1 round. On a successful save, no condition is applied. This rider should use the hit target, apply only once per attack workflow, and use Midi-QOL plus Item Macro when those modules and settings are available. If that route is unavailable, preserve the attack and damage and clearly mark the rider for manual review.
```

### Expected route

- Template: `workflow-condition-rider`
- Recipe: `conditionOnHit`
- Preferred layer: Midi-QOL + Item Macro
- Fallback: core attack workflow with manual review

### Questionnaire

- Did the item name `Frostmark Brand [AUTO-C01]` remain unchanged?
- Did the item import or create successfully as a longsword?
- Did the +1 bonus to attack rolls work?
- Did the +1 bonus to damage rolls work?
- Did each hit deal an additional `1d6` cold damage?
- Did the target receive a DC 13 Constitution saving throw after a hit?
- On a failed save, did the target become poisoned for 1 round?
- On a successful save, did the target avoid the poisoned condition?
- Did the rider apply only to the hit target?
- Did the rider apply only once for one attack workflow?
- Did the preview identify the selected automation layer and required modules?
- Did the review notes accurately describe the condition rider without unrelated blockers?
- Final status: `PASS` / `PARTIAL` / `MANUAL` / `FAIL` / `NOT TESTED`
- Evidence or failure details:

## 2. Self-Token Light Toggle

### Prompt

```text
Create an uncommon magical quarterstaff named Emberwick Staff [AUTO-L01]. It is a +1 quarterstaff, so it grants a +1 bonus to attack and damage rolls.

The staff has a utility activity called Ignite the Staff. When activated, it toggles bright light out to 20 feet and dim light for an additional 20 feet. The light must originate from the wielder's actor token, not from a selected target. Activating it a second time should turn the light off. It should not open an unrelated target-selection dialog. Use Item Macro for the reversible toggle when available; otherwise preserve the light details for manual review.
```

### Expected route

- Template: `self-token-light-toggle`
- Recipe: `selfTargetLight`
- Preferred layer: Item Macro
- Fallback: portable light metadata with manual review

### Questionnaire

- Did the item name `Emberwick Staff [AUTO-L01]` remain unchanged?
- Did the item import or create successfully as a quarterstaff?
- Did the +1 bonus to attack rolls work?
- Did the +1 bonus to damage rolls work?
- Did the `Ignite the Staff` activity appear with the correct name?
- Did activation create 20 feet of bright light?
- Did activation create an additional 20 feet of dim light?
- Did the light originate from the wielder's actor token?
- Did activation avoid asking for an unrelated target?
- Did activating the activity a second time turn the light off?
- Did the preview identify Item Macro and its required setting?
- Did the review notes distinguish self-targeted light from target-based effects?
- Final status: `PASS` / `PARTIAL` / `MANUAL` / `FAIL` / `NOT TESTED`
- Evidence or failure details:

## 3. Shared-Charge Activity Set

### Prompt

```text
Create a rare staff named Tideglass Staff [AUTO-R03]. It requires attunement and has 6 charges. It regains 1d4 charges each day at dawn.

The staff has three separate named activities, all using the same item charge pool:

1. Brine Mend: as an action, spend 1 charge to restore 2d8 hit points to one creature within touch range.
2. Thunderclap: as an action, spend 2 charges to force creatures in a 15-foot cone to make a DC 14 Constitution saving throw, taking 3d8 thunder damage on a failed save and half as much on a success.
3. Veil of Water: as an action, spend 3 charges to create a 10-minute concentration effect on the wielder that grants resistance to fire damage.

Use native DND5e activities and one shared item use pool. Do not create three independent charge pools.
```

### Expected route

- Template: `shared-charge-activity-set`
- Recipe: `multiActivityResource`
- Preferred layer: native DND5e
- Required proof: every activity uses the same pool and recovery is stored once

### Questionnaire

- Did the item name `Tideglass Staff [AUTO-R03]` remain unchanged?
- Did the item import or create successfully as a staff?
- Did attunement remain required?
- Did the item have a maximum of 6 charges?
- Did the pool recover `1d4` charges at dawn?
- Did `Brine Mend` appear as its own activity?
- Did `Brine Mend` cost exactly 1 charge?
- Did `Brine Mend` heal one creature for `2d8` hit points?
- Did `Thunderclap` appear as its own activity?
- Did `Thunderclap` cost exactly 2 charges?
- Did `Thunderclap` use a 15-foot cone?
- Did `Thunderclap` use a DC 14 Constitution save?
- Did `Thunderclap` deal `3d8` thunder damage and half damage on a success?
- Did `Veil of Water` appear as its own activity?
- Did `Veil of Water` cost exactly 3 charges?
- Did the three activities spend from one shared pool?
- Did the item avoid creating duplicate independent charge pools?
- Did the preview and review notes identify native DND5e as the selected layer?
- Final status: `PASS` / `PARTIAL` / `MANUAL` / `FAIL` / `NOT TESTED`
- Evidence or failure details:

## 4. Attunement Effect Transfer

### Prompt

```text
Create a rare cloak named Cinderveil Mantle [AUTO-E04]. It requires attunement. While the cloak is equipped and attuned, the wearer has resistance to fire damage and gains a +1 bonus to saving throws.

Represent these as approved DND5e effect changes transferred to the equipped item or wearer through the Dynamic Active Effects layer when DAE is available. The effects must not apply while the cloak is unattuned or unequipped, and removing the cloak must remove the transferred effects without creating duplicates. If DAE is unavailable, preserve the approved effect data and clearly mark the transfer behavior for manual review.
```

### Expected route

- Template: `attunement-effect-transfer`
- Recipe: `daeTransferEffect`
- Preferred layer: DAE
- Fallback: native effect data with manual review

### Questionnaire

- Did the item name `Cinderveil Mantle [AUTO-E04]` remain unchanged?
- Did the item import or create successfully as a cloak or equipment item?
- Did attunement remain required?
- While equipped and attuned, did fire resistance apply?
- While equipped and attuned, did the +1 saving throw bonus apply?
- While unattuned, were the effects inactive?
- After unequipping, were the effects removed?
- After re-equipping, did the effects return exactly once?
- Did the effect use approved DND5e system paths?
- Did the preview identify DAE and its required setting?
- Did the review notes distinguish attunement transfer from a permanent item effect?
- Final status: `PASS` / `PARTIAL` / `MANUAL` / `FAIL` / `NOT TESTED`
- Evidence or failure details:

## 5. Animation Presentation

### Prompt

```text
Create an uncommon magical dagger named Starfall Needle [AUTO-V05]. It is a +1 dagger, so it grants a +1 bonus to attack and damage rolls. Each hit deals an additional 1d4 radiant damage.

Give the normal attack activity an optional visual presentation named Starfall Spark using Automated Animations and Sequencer when those modules are available. The visual should play from the wielder's token toward the hit target. It must not change damage, targeting, conditions, resources, or any other game state. If the animation modules or asset are unavailable, the dagger's attack must still work normally and the preview must state that the visual layer was skipped or requires manual review.
```

### Expected route

- Template: `animation-presentation`
- Recipe: `animationVisual`
- Preferred layer: Automated Animations + Sequencer
- Fallback: no animation with manual review

### Questionnaire

- Did the item name `Starfall Needle [AUTO-V05]` remain unchanged?
- Did the item import or create successfully as a dagger?
- Did the +1 bonus to attack rolls work?
- Did the +1 bonus to damage rolls work?
- Did each hit deal an additional `1d4` radiant damage?
- Did the normal attack still work when the visual layer was unavailable?
- If the modules were available, did `Starfall Spark` play from the wielder toward the hit target?
- Did the animation avoid changing damage or target selection?
- Did the animation avoid creating conditions or spending resources?
- Did the preview identify the visual layer and required modules?
- If the visual asset was unavailable, did the review note clearly describe the fallback?
- Did the review notes avoid treating a cosmetic animation limitation as an item-function blocker?
- Final status: `PASS` / `PARTIAL` / `MANUAL` / `FAIL` / `NOT TESTED`
- Evidence or failure details:

## Sweep Summary

- Prompt with the cleanest full-function result:
- Prompt with the most useful review note:
- Prompt with the first structural failure:
- Prompt with the first live-behavior failure:
- Repeated failure pattern:
- Recommended patch:
- Safe to combine two production automations in the next sweep: `YES` / `NO`
