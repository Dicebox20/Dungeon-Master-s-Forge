# Dungeon Master's Forge Release Status

Updated: 2026-07-01

## Publish Candidate

- Public export candidate: `2.21.7`
- Module manifest target: `module/module.json`
- Release ZIP: `releases/dungeon-masters-forge-v2-2.21.7.zip`
- Release ZIP SHA-256: `15EEE42C266DB27F9CBE1C2C552157ECA8FC6DF3DC6DCEB57F6508C8C63FA9C0`
- Manifest URL target: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Download URL target: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.21.7.zip`

## Release-Prep Pass

- Synced the public module export forward to the `2.21.7` workspace candidate.
- Added public manifest and download metadata to the release manifest.
- Copied the `2.21.7` tested ZIP into `releases/`.
- Synced the public module tests, docs, examples, and the live provider-draft compile fix needed for the `2.21.7` candidate.
- Added LAN-testing guidance for the reference AI service so other trusted computers can reach the Forge endpoint on a private network.
- Synced the reference AI service and module docs forward to the new client-key OpenAI flow for Bring Your Own API.
- Added a dedicated Patreon launch checklist to keep launch-facing work separate from the long-term roadmap.
- Added a trusted-tester quickstart and basic GitHub issue templates so outside testers have a cleaner launch path.
- Promoted the compact review-note badge polish into the packaged `2.21.7` build and installed it into Foundry while the app was closed.
- Restored the missing Items sidebar Forge launcher in the tested `2.21.7` build and rebuilt the release ZIPs after live verification.

## Current Technical State

- The module includes the split-pane Description/Result workflow, Forge Settings, Local Rules, Bring Your Own API, and review-before-create validation.
- Read-only native DND5e resolution now covers modern spell, equipment, actor, monster feature, and roll-table lookup without mutating compendium content.
- The reference AI service remains personal and self-hosted only. It now supports both server-key and personal client-key OpenAI deployments. Hosted Forge is still intentionally disabled.
- Cauldron of Plentiful Resources remains optional and deferred because its current release is incompatible with this Foundry version.
- The launch-day Patreon plan is now centered on a real free public tier plus a support-first Founding Patron tier, with entitlement-gated hosting deferred.

## Validation

- Workspace module tests pass.
- Workspace AI service tests pass (68 tests).
- Public export module tests pass after the filename-surface sync from `codex-item-forge.js` to `dungeon-masters-forge.js`.
- Public export AI service tests pass (68 tests).
- The currently installed Foundry build on disk is `2.21.7`.
- The installed module file count is `36`, matching the current workspace copy.
- A live BYO smoke retest is still pending against the updated canonical endpoint at `http://localhost:8788/v1/forge/compile`, which reports service `1.2.0` in `openai` mode.
- The service-side contract normalizer now accepts `pattern` as a live-model alias for Forge `kind`; that patch is covered by tests and still needs one successful in-Foundry live compile confirmation.

## Next Release Tasks

See:

- `docs/RELEASE_TASKS.md`
- `docs/PATREON_LAUNCH_CHECKLIST.md`
