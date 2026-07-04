# Dungeon Master's Forge System Content Plan

Updated: 2026-06-28

## Test-World Baseline

- World: `DMF Test World`
- Foundry VTT: v14 build 364
- DND5e: 5.3.3
- Active Forge companions: Midi-QOL, DAE, and Item Macro
- Forge diagnostics: 6/6 passed without creating world documents
- Cauldron of Plentiful Resources: deferred because its current release is incompatible with this Foundry version

## Available DND5e Content

The DND5e system exposes modern locked packs for Rules, Character Classes, Character Origins, Feats, Spells, Equipment, Roll Tables, Actors, and Monster Features. The new world also presents system-provided world folders for Character Classes, Character Origins, Equipment, Feats, and Spells.

## Safe Integration Boundary

- Discover system-owned DND5e packs at runtime from Foundry metadata; do not depend on fixed pack IDs alone.
- Prefer modern DND5e content over legacy packs when both contain an exact match.
- Resolve exact spell, equipment, actor, monster-feature, and roll-table names before synthesizing mechanics.
- Prefer system-native SRD spell activity data when an item casts a known exact-name spell; this should mirror the safe parts of dragging a DND5e spell into an item workflow, then layering item-specific charges, DCs, uses, or activation overrides on top.
- Treat system content as an installed runtime reference. Do not copy bulk SRD text or assets into the Forge module or its release archives.
- Copy only the document fields required to create the user's reviewed item, and preserve source UUID provenance when a system document is used.
- Never mutate locked system packs or their documents.
- Fall back to the existing portable Forge specification when no compatible system document exists.
- Surface ambiguous names, incompatible document schemas, and non-system matches for GM review rather than guessing.
- Keep Cauldron optional and deferred; system-native resolution must not require it.

## First Implementation Milestone

1. Add a read-only DND5e content resolver for exact-name spell and equipment lookup.
2. Return source UUID, pack label, document type, system version, and a small compatibility result without importing a document.
3. Add non-destructive diagnostics for known modern entries such as Command, Flame Strike, a longsword, and plate armor.
4. Use resolved spell mechanics only after schema validation and explicit review.
5. Add charge-scaled spell item support so shared-charge spell items default spell cost to spell level and preserve upcast charge-spend choices for review.
6. Expand to actors, monster features, and roll tables after spell and equipment resolution is proven.
