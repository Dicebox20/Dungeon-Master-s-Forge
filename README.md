# Dungeon Master's Forge

Dungeon Master's Forge is a Foundry VTT item-generation toolkit for the DND5e system. This public export keeps the reusable source, the reference AI service, the latest verified archive, and the planning docs while leaving older private test artifacts out of view.

## Repository Layout

- `module/` - active Foundry module source
- `ai-service/` - reference local AI compilation service
- `docs/STATUS.md` - current verified project snapshot
- `docs/TESTER_QUICKSTART.md` - shortest path for trusted testers and second-machine setup
- `docs/PROJECT_LAUNCH_CHECKLIST.md` - launch-facing readiness checklist
- `docs/PROJECT_PAGE_COPY.md` - draft project copy that matches the current release state
- `docs/FREE_TIER_DEPLOYMENT.md` - controlled public free-tier service deployment plan
- `docs/SRD_PLAN.md` - system-native DND5e content-resolution plan
- `releases/` - latest verified packaged build

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

## What Still Requires Self-Hosting

Live AI interpretation currently requires a reachable Forge-compatible service. The included reference service can run on the Foundry computer, another trusted LAN computer, or a Tailscale-connected computer. Public installers are not automatically connected to a shared free-tier meter yet.

## Not Yet Included

- Automatic Hosted/Free Forge access
- project access control enforcement
- Durable public quota accounting
- Automatic item-icon image generation
- Compatible ally-aura automation
- Cauldron of Plentiful Resources integration for the current Foundry version

## Manifest Install

- Manifest URL: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Release ZIP: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.21.12.zip`

## Using The Module

Open [module/README.md](./module/README.md) for installation, usage, and testing notes.

## Using The Reference AI Service

Open [ai-service/README.md](./ai-service/README.md) for the local service, mock mode, and Bring Your Own API endpoint details.

## Notes

- This export is meant to be the cleaner GitHub-facing surface for the project.
- The working development repo still contains older archives, experiments, regression macros, and extracted verification folders that are intentionally not mirrored here.
- Hosted generation remains disabled. The supported live path is still the local or self-hosted Bring Your Own API workflow.
- project tier planning exists, but project access control enforcement is not yet active in the product.
- The intended launch shape is a real free public tier plus a public release plan. Higher hosted or access control-driven tiers remain future work.
