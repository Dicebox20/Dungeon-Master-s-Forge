# Dungeon Master's Forge Tier Gating Plan

This file turns the Patreon tier notes into implementation-facing scaffolding.

## Current State

- The public product vision for tiers lives in `docs/patreon-tiers.md`.
- Free Forge is enabled only in the temporary tester channel.
- No billing, entitlement verification, or remote tier enforcement is active.
- Founding Patron does not gate features or usage at launch.

## New Catalog

The source-of-truth tier catalog now lives in:

- `scripts/tier-catalog.js`

It defines:

- stable tier ids
- stable feature ids
- tier summaries, pricing, and suggested monthly ranges
- per-tier supported feature lists
- helper functions for future feature-gating checks

## Intended Use

The catalog is meant to support three future layers:

1. Product messaging:
   - show what a tier unlocks in docs, settings, or Hosted Forge onboarding

2. Request review:
   - mark a requested mechanic as requiring a higher tier before any remote generation is attempted

3. Hosted Forge entitlement enforcement:
   - allow the server to decide whether a requested feature is permitted for the authenticated user

## Early Feature Mapping

These feature ids are the first stable gating keys:

- `basicItems`
- `customPassives`
- `activeEffectsBasic`
- `activeEffectsAdvanced`
- `multiActivityItems`
- `srdSpells2`
- `srdSpells4`
- `srdSpells7`
- `srdSpells10Plus`
- `summoning`
- `midiQol`
- `activityMacro`
- `advancedAutomation`
- `realmforgedItems`
- `sceneTransferPackages`
- `monksActiveTiles`
- `imageGeneration`

## Safe Next Steps

1. Tag each proven local request-to-spec pattern with one or more feature ids.
2. Add optional review warnings when a requested pattern exceeds the currently selected product tier.
3. Keep Local Rules fully usable for development and personal use until Hosted Forge entitlement checks actually exist.
4. Add server-side tier metadata to Hosted Forge only after authentication and user identity are real.
