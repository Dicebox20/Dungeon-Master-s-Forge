# Dungeon Master's Forge

Dungeon Master's Forge is a Foundry VTT item-creation toolkit for the DND5e system. Describe an item in natural language, review the generated mechanics, then create a core DND5e item only after explicit approval.

The project is building Beta V1 as a dependable starting point for portable Foundry items: native activities, effects, resources, targeting, and summon profiles come first. Optional integrations such as Midi-QOL, DAE, and Item Macro can enhance that foundation when they are installed, but they are not required for the generated item to exist or work in base DND5e.

## Repository Guide

- `module/` - Foundry VTT module source and stable release manifest
- `ai-service/` - reference Forge-compatible AI compilation service
- `docs/STATUS.md` - current verified project snapshot
- `docs/TESTER_QUICKSTART.md` - shortest path for trusted testers and second-machine setup
- `docs/LAUNCH_DAY_RUNBOOK.md` - tester-to-stable promotion and rollback procedure
- `docs/FREE_TIER_DEPLOYMENT.md` - controlled public free-tier service deployment plan
- `docs/SRD_PLAN.md` - system-native DND5e content-resolution plan
- `releases/` - latest verified packaged build
- `testing/` - temporary auto-connected Free Forge tester channel

## Current Release Lanes

- Foundry VTT: v14
- DND5e: 5.3.3
- Stable package: `2.23.1`
- Current tester build: see the tester manifest for the latest published candidate

The current project state includes:

- deterministic normalization and repair for proven item families
- Bring Your Own API support for Forge-compatible remote services
- a hosted Free Forge tester lane for invited beta testing
- review-before-create validation and a dedicated Forge Settings window
- read-only DND5e spell, equipment, actor, monster-feature, and roll-table resolution

## Who This Is For

Dungeon Master's Forge is for:

- Foundry VTT game masters who want to describe an item in ordinary language, review the resulting DND5e mechanics, and create it only after approval.
- People who find the Foundry VTT item creation system too advanced or inaccessible.
- Tables that want a reviewable starting point for homebrew instead of a replacement for DM judgment.
- GMs who want generated mechanics to remain portable to base DND5e before adding optional automation modules.

## What Works Right Now

- Review and validation before any item is created
- Core DND5e weapons, equipment, consumables, effects, charges, attacks, saves, healing, enchantments, summons, conditions, and utility patterns
- Deterministic recovery for known activity, targeting, resource, effect, summon, and named-spell mapping failures
- Read-only reuse of compatible DND5e system content without modifying locked compendiums
- Live AI interpretation through a Forge-compatible Bring Your Own API endpoint or the invited tester lane

## Stable Channel Hosting

The stable package uses a Forge-compatible Bring Your Own API service for live interpretation. The included reference service can run on the Foundry computer, another trusted LAN computer, or a Tailscale-connected computer.

## Tester Channel Hosting

The temporary tester lane automatically connects invited testers to the hosted **Free Forge** allowance. It is used for staged regression sweeps, compatibility checks, and beta feedback before stable promotion.

## Not Yet Included

- Automatic Hosted/Free Forge access in the stable release
- Automatic item-icon image generation
- Compatible ally-aura automation
- Cauldron of Plentiful Resources integration for the current Foundry version

## Manifest Install

- Manifest URL: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Release ZIP: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.23.1.zip`

## Pre-Launch Tester Channel

Invited testers can install the current tester build, which automatically connects to the hosted 20-request calendar-month Free Forge allowance:

- Tester manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
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
