# Capability Routing Policy

Last reviewed: 2026-07-23

## Decision

Dungeon Master's Forge no longer uses a blanket native-first rule. It selects the least complicated layer that fully and reliably expresses the requested mechanic:

1. Use native DND5e when the installed system can represent the complete mechanic reliably.
2. Prefer a verified Midi-QOL, DAE, Item Macro, Automated Animations, Sequencer, or combined route when that layer supplies required timing, targeting, reactions, conditions, concentration, resource workflow, or presentation behavior.
3. Preserve portable DND5e data and add a review note when the preferred route is unavailable, disabled, version-unknown, or not separately verified.

The selected layer, required modules, settings assumptions, and fallback are shown before approval. A capability advertisement is not a use-result guarantee; created-document inspection and safe use testing still decide whether a route is proven.

## Route Contract

Each declarative automation recipe advertises:

- the recipe name;
- the selected layer;
- required module IDs and relevant settings;
- whether the route is available in the active world;
- the portable fallback and any missing dependencies.

The provider may emit only recipes advertised as available. The module derives the display route locally so a model cannot claim a stronger layer than the Foundry runtime actually supports.

## Acceptance Criteria

- Native-only mechanics remain valid when all optional modules are disabled.
- A mechanic that needs a verified module route selects that route instead of being downgraded solely because it is not native.
- A recipe that needs multiple modules lists all of them; unrelated module settings are not treated as hidden prerequisites.
- An unavailable route produces portable data plus a clear review note, not silent partial automation.
- Preview badges and notes identify the selected layer and required modules before approval.
- Provider output cannot inject scripts, arbitrary macros, world writes, Region writes, or UUID actions.
- Review, approval, GM permission, code confirmation, and separate world-change approvals remain required.

## Current Routes

| Recipe | Selected layer when available | Required modules | Fallback |
| --- | --- | --- | --- |
| `conditionOnHit` | Midi-QOL + Item Macro | `midi-qol`, `itemacro` | Core attack and review note |
| `selfTargetLight` | Item Macro | `itemacro` | Core item and manual light review |
| `multiActivityResource` | DND5e core | none | DND5e core |
| `daeTransferEffect` | Dynamic Active Effects | `dae` | Core effect and review note |
| `animationVisual` | Automated Animations + Sequencer | `autoanimations`, `sequencer` | Core activity without visual effect |

This list describes proven declarative route contracts, not a promise that every Foundry module combination or arbitrary JavaScript automation is supported.
