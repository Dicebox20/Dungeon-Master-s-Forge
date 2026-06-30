# Dungeon Master's Forge

Dungeon Master's Forge is a Foundry VTT item-generation toolkit for the DND5e system. This public export keeps the reusable source, the reference AI service, the latest verified archive, and the planning docs while leaving older private test artifacts out of view.

## Repository Layout

- `module/` - active Foundry module source
- `ai-service/` - reference local AI compilation service
- `docs/STATUS.md` - current verified project snapshot
- `docs/SRD_PLAN.md` - system-native DND5e content-resolution plan
- `releases/` - latest verified packaged build

## Current Verified Baseline

- Foundry VTT: v14
- DND5e: 5.3.3
- Module build: 2.21.2

The current verified module includes:

- split-pane **Description** and **Result** workflow
- review-before-create item generation
- Local Rules and Bring Your Own API provider support
- dedicated Forge Settings window
- read-only native DND5e spell and equipment resolution

## Using The Module

Open [module/README.md](./module/README.md) for installation, usage, and testing notes.

## Using The Reference AI Service

Open [ai-service/README.md](./ai-service/README.md) for the local service, mock mode, and Bring Your Own API endpoint details.

## Notes

- This export is meant to be the cleaner GitHub-facing surface for the project.
- The working development repo still contains older archives, experiments, regression macros, and extracted verification folders that are intentionally not mirrored here.
- Hosted generation remains disabled. The supported live path is still the local or self-hosted Bring Your Own API workflow.
