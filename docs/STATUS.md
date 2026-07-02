# Dungeon Master's Forge Release Status

Updated: 2026-07-01

## Publish Candidate

- Public export candidate: `2.21.11`
- Module manifest target: `module/module.json`
- Release ZIP: `releases/dungeon-masters-forge-v2-2.21.11.zip`
- Release ZIP SHA-256: `74DA9C920CAB94C4140639845DB94CCDF10F8BA6E6AD13D714542F5A0E6A0F9F`
- Manifest URL target: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Download URL target: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.21.11.zip`

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
- Restored explicit settings persistence, corrected provider-form discovery, and added a standard Save Settings action.
- Reworked the API fields into readable full-width rows and corrected the oversized Foundry notes spacing in `2.21.10`.
- Removed the underlying standard-form flex collision and verified consistent 10 px field spacing plus full-width API controls in `2.21.11`.
- Added AI service `1.3.0` public free-tier alpha controls and deployment documentation without enabling Hosted Forge prematurely.

## Current Technical State

- The module includes the split-pane Description/Result workflow, Forge Settings, Local Rules, Bring Your Own API, and review-before-create validation.
- Read-only native DND5e resolution now covers modern spell, equipment, actor, monster feature, and roll-table lookup without mutating compendium content.
- The reference AI service supports private server-key, personal client-key, and bounded public free-tier alpha deployments. Hosted Forge remains disabled until a public HTTPS endpoint and durable accounting exist.
- Cauldron of Plentiful Resources remains optional and deferred because its current release is incompatible with this Foundry version.
- The launch-day Patreon plan is now centered on a real free public tier plus a support-first Founding Patron tier, with entitlement-gated hosting deferred.

## Validation

- Workspace module tests pass.
- Workspace AI service tests pass (73 tests).
- Public export module tests pass after the filename-surface sync from `codex-item-forge.js` to `dungeon-masters-forge.js`.
- Public export AI service tests pass (73 tests).
- The currently installed Foundry build on disk is `2.21.11`.
- The installed module file count is `37`, matching the current workspace copy.
- Foundry Check Connection succeeds against `http://localhost:8788/v1/forge/compile`, and the saved Bring Your Own API selection survives a cold page reload.
- A true remote compile succeeds in Foundry against service `1.3.0`: Live Ember Dagger returned as a validated `weaponExtraDamage` spec with the requested base and fire damage. No world document was created during the smoke test.
- The local service and Foundry model setting are aligned to the configured `gpt-4.1-mini` allowlist.
- A direct shell smoke proof now succeeds against the canonical `8788` service for both `/v1/forge/capabilities` and `/v1/forge/compile`.
- The service-side contract normalizer now accepts `pattern` as a live-model alias for Forge `kind`; that patch is covered by tests and still needs one successful in-Foundry live compile confirmation.

## Next Release Tasks

See:

- `docs/RELEASE_TASKS.md`
- `docs/PATREON_LAUNCH_CHECKLIST.md`
