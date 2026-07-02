# Dungeon Master's Forge

Dungeon Master's Forge is a Foundry VTT item-generation toolkit for the DND5e system. This public export keeps the reusable source, the reference AI service, the latest verified archive, and the planning docs while leaving older private test artifacts out of view.

## Repository Layout

- `module/` - active Foundry module source
- `ai-service/` - reference local AI compilation service
- `docs/STATUS.md` - current verified project snapshot
- `docs/TESTER_QUICKSTART.md` - shortest path for trusted testers and second-machine setup
- `docs/PATREON_LAUNCH_CHECKLIST.md` - launch-facing readiness checklist
- `docs/LAUNCH_DAY_RUNBOOK.md` - tester-to-stable promotion and rollback procedure
- `docs/PATREON_PAGE_COPY.md` - draft Patreon copy that matches the current release state
- `docs/FREE_TIER_DEPLOYMENT.md` - controlled public free-tier service deployment plan
- `docs/SRD_PLAN.md` - system-native DND5e content-resolution plan
- `releases/` - latest verified packaged build
- `testing/` - temporary auto-connected Free Forge tester channel

## Current Release Candidate

- Foundry VTT: v14
- DND5e: 5.3.3
- Module build: 2.21.12

The current release candidate includes:

- split-pane **Description** and **Result** workflow
- review-before-create item generation
- Local Rules and Bring Your Own API provider support
- dedicated Forge Settings window
- read-only native DND5e spell, equipment, actor, monster feature, and roll-table resolution

## Who This Is For

Dungeon Master's Forge is for Foundry VTT game masters who want to describe an item in ordinary language, review the resulting DND5e mechanics, and create the item only after approving it. The current build is best suited to GMs who are comfortable enabling a module and, for unrestricted AI interpretation, running or connecting to a small companion service.

## What Works Right Now

- Offline generation for the Forge's confirmed Local Rules patterns
- Live AI interpretation through a Forge-compatible Bring Your Own API endpoint
- Review and validation before any item is created
- Weapons, equipment, consumables, effects, charges, attacks, saves, healing, enchantments, summons, conditions, and scripted utility patterns
- Read-only reuse of compatible DND5e system content without modifying locked compendiums
- Private-network testing over LAN or Tailscale addresses

## Stable Channel Hosting

The stable `2.21.12` manifest still requires a reachable Forge-compatible service for live AI interpretation. The included reference service can run on the Foundry computer, another trusted LAN computer, or a Tailscale-connected computer.

## Not Yet Included

- Automatic Hosted/Free Forge access in the stable release
- Patreon entitlement enforcement
- Automatic item-icon image generation
- Compatible ally-aura automation
- Cauldron of Plentiful Resources integration for the current Foundry version

## Manifest Install

- Manifest URL: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Release ZIP: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.21.12.zip`

## Pre-Launch Tester Channel

Invited testers can install `2.22.0-test.5`, which automatically connects to the hosted 20-request calendar-month Free Forge allowance:

- Tester manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/refs/heads/codex/launch-readiness-docs/testing/module.json`
- Tester notes: [testing/README.md](./testing/README.md)

The tester channel is temporary and is not the final public launch manifest.

## Using The Module

Open [module/README.md](./module/README.md) for installation, usage, and testing notes.

## Using The Reference AI Service

Open [ai-service/README.md](./ai-service/README.md) for the local service, mock mode, and Bring Your Own API endpoint details.

## Notes

- This export is meant to be the cleaner GitHub-facing surface for the project.
- The working development repo still contains older archives, experiments, regression macros, and extracted verification folders that are intentionally not mirrored here.
- Hosted generation remains disabled in the stable channel. The temporary tester channel enables Free Forge automatically for invited testing.
- Patreon tier planning exists, but Patreon entitlement enforcement is not yet active in the product.
- The intended launch shape is a real free public tier plus a support-first Founding Patron tier. Higher hosted or entitlement-driven tiers remain future work.
