# Dungeon Master's Forge

Dungeon Master's Forge is a Foundry VTT item-generation toolkit for the DND5e system. It lets a Game Master describe magic items in natural language, review generated mechanics, and create Foundry items only after explicit approval.

## Repository Guide

- `module/` - Foundry VTT module source and stable release manifest
- `ai-service/` - reference Forge-compatible AI compilation service
- `docs/STATUS.md` - current verified project snapshot
- `docs/TESTER_QUICKSTART.md` - shortest path for trusted testers and second-machine setup
- `docs/PROJECT_LAUNCH_CHECKLIST.md` - launch-facing readiness checklist
- `docs/LAUNCH_DAY_RUNBOOK.md` - tester-to-stable promotion and rollback procedure
- `docs/PROJECT_PAGE_COPY.md` - draft project copy that matches the current release state
- `docs/FREE_TIER_DEPLOYMENT.md` - controlled public free-tier service deployment plan
- `docs/SRD_PLAN.md` - system-native DND5e content-resolution plan
- `releases/` - latest verified packaged build
- `testing/` - temporary auto-connected Free Forge tester channel

## Current Release Lanes

- Foundry VTT: v14
- DND5e: 5.3.3
- Workspace stable-manifest candidate: `2.23.0`
- Tester migration lane: `2.23.0-test.4`

The current project state includes:

- Local Rules generation for proven item families
- Bring Your Own API provider support for a Forge-compatible remote service
- review-before-create validation
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

The workspace stable-manifest candidate `2.23.0` still requires a reachable Forge-compatible service for live AI interpretation. The included reference service can run on the Foundry computer, another trusted LAN computer, or a Tailscale-connected computer.

## Tester Channel Hosting

The temporary tester lane `2.23.0-test.4` automatically connects invited testers to the hosted **Free Forge** allowance. That channel exists to validate the package-identity migration and hosted-connection flow before stable promotion.

## Not Yet Included

- Automatic Hosted/Free Forge access in the stable release
- project access control enforcement
- Automatic item-icon image generation
- Compatible ally-aura automation
- Cauldron of Plentiful Resources integration for the current Foundry version

## Manifest Install

- Manifest URL: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Release ZIP: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.23.0.zip`

## Pre-Launch Tester Channel

Invited testers can install `2.23.0-test.4`, which migrates the package identity and automatically connects to the hosted 20-request calendar-month Free Forge allowance:

- Tester manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/codex/package-id-migration/testing/module.json`
- Tester notes: [testing/README.md](./testing/README.md)

The tester channel is temporary and is not the final public launch manifest.

## Using The Module

Open [module/README.md](./module/README.md) for installation, usage, and testing notes.

## AI Service

Open [ai-service/README.md](./ai-service/README.md) for the local service, mock mode, server-key mode, and Bring Your Own API setup.

## Public Boundary

- This export is meant to be the cleaner GitHub-facing surface for the project.
- The working development repo still contains older archives, experiments, regression macros, and extracted verification folders that are intentionally not mirrored here.
- Hosted generation remains disabled in the stable channel. The temporary tester channel enables Free Forge automatically for invited testing.
- project tier planning exists, but project access control enforcement is not yet active in the product.
- The intended launch shape is a real free public tier plus a support-first early supporter tier. Higher hosted or access control-driven tiers remain future work.
