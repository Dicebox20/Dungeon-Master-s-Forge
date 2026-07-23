# Dungeon Master's Forge

Dungeon Master's Forge is a Foundry VTT item-creation toolkit for DND5e. Describe the item you want, review the mechanics it comes up with, and create a core DND5e item only after you approve it.

We are working toward Beta V1 as a dependable starting point for portable Foundry items. Native activities, effects, resources, targeting, and summon profiles come first. Optional integrations such as Midi-QOL, DAE, and Item Macro can add richer automation when installed, but they are not required for the item to exist or work in base DND5e.

## Repository Guide

- `module/` - Foundry VTT module source and stable release manifest
- `ai-service/` - reference Forge-compatible compilation service
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
- Stable package: see the stable manifest for the currently published version
- Current tester build: see the tester manifest for the current candidate; tester updates are published separately from the stable release

Right now, the project includes:

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
- Free Forge summons clone exact system-owned DND5e SRD actors only. Named creatures without an exact SRD match, generated creature stat blocks, and custom summons remain a manual-authoring or Bring Your Own API path.
- Deterministic recovery for known activity, targeting, resource, effect, summon, and named-spell mapping failures
- Read-only reuse of compatible DND5e system content without modifying locked compendiums
- Live prompt interpretation through a Forge-compatible Bring Your Own API endpoint or the invited tester lane

## Stable Channel

The stable package uses a Forge-compatible Bring Your Own API service for live interpretation. The included reference service can run on the Foundry computer, another trusted computer on your LAN, or a computer connected through Tailscale.

## Tester Channel

The temporary tester build connects invited testers to the hosted **Free Forge** allowance automatically. We use it for staged regression checks, compatibility testing, and feedback before a stable release.

## Not Yet Included

- Automatic Hosted/Free Forge access in the stable release
- Automatic item-icon image generation
- Compatible ally-aura automation
- Cauldron of Plentiful Resources integration for the current Foundry version

## Manifest Install

- Manifest URL: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Release ZIP: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.23.1.zip`

## Pre-Launch Tester Channel

Invited testers can install the current tester build, which automatically connects to the hosted 100-prompt calendar-month Free Forge allowance:

- Tester manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
- Tester notes: [testing/README.md](./testing/README.md)
- Tester list and public thank-you page: [testing/testers.md](./testing/testers.md)

The tester channel is temporary and is not the final public launch manifest.

## Using The Module

Open [module/README.md](./module/README.md) for installation, usage, and testing notes.

## Hosted Forge Service

Open [ai-service/README.md](./ai-service/README.md) for the local service, mock mode, server-key mode, and Bring Your Own API setup.

## Repository Note

- This repository is the cleaner GitHub-facing project surface.
- The working development copy still contains older archives, experiments, regression macros, and extracted verification folders that are intentionally not mirrored here.
- Hosted generation remains disabled in the stable channel. The temporary tester build enables Free Forge automatically for invited testing.
