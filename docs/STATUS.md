# Dungeon Master's Forge Release Status

Updated: 2026-07-09

## Publish Candidate

- Stable release candidate: `2.23.1`
- Current tester release: `2.23.1-test.3`
- Module manifest target: `module/module.json`
- Release ZIP: `releases/dungeon-masters-forge-v2-2.23.1.zip`
- Release ZIP SHA-256: `07D6A3DA23E77E8FBE37F5F5D5E36CECB1B81C03E8FA00B2C3E87D675F916462`
- Manifest URL target: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- Download URL target: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.23.1.zip`

Historical validation notes below still mention earlier `2.23.0-test.*` smoke passes where that was the active tester lane at the time.

## Release-Prep Pass

- Synced the public module export forward to the `2.21.7` workspace candidate.
- Added public manifest and download metadata to the release manifest.
- Copied the `2.21.7` tested ZIP into `releases/`.
- Synced the public module tests, docs, examples, and the live provider-draft compile fix needed for the `2.21.7` candidate.
- Added LAN-testing guidance for the reference AI service so other trusted computers can reach the Forge endpoint on a private network.
- Synced the reference AI service and module docs forward to the new client-key OpenAI flow for Bring Your Own API.
- Added a dedicated project launch checklist to keep launch-facing work separate from the long-term roadmap.
- Added a trusted-tester quickstart and basic GitHub issue templates so outside testers have a cleaner launch path.
- Promoted the compact review-note badge polish into the packaged `2.21.7` build and installed it into Foundry while the app was closed.
- Restored the missing Items sidebar Forge launcher in the tested `2.21.7` build and rebuilt the release ZIPs after live verification.
- Restored explicit settings persistence, corrected provider-form discovery, and added a standard Save Settings action.
- Reworked the API fields into readable full-width rows and corrected the oversized Foundry notes spacing in `2.21.10`.
- Removed the underlying standard-form flex collision and verified consistent 10 px field spacing plus full-width API controls in `2.21.11`.
- Added Tailscale `100.64.0.0/10` endpoint support for private cross-network testing in `2.21.12`.
- Merged the Tailscale endpoint-support pull request into GitHub `main`.
- Added AI service `1.3.0` public free-tier alpha controls and deployment documentation without enabling Hosted Forge prematurely.
- Added AI service `1.4.0` durable SQLite daily quotas with HMAC-pseudonymized client identifiers and strict public-mode configuration checks.
- Added AI service `1.5.0` calendar-month client quotas for the official 20-generation Free Forge allowance.
- Added AI service `1.6.0` bounded model-output retry and safe request-id error logging after an invited tester exposed an opaque `502` failure.
- Added a review-UX hardening pass that makes dominant-family hybrid results explicit in the Forge Result pane, including:
  - per-item Forge-ready versus manual-review state badges
  - a compact unresolved-mechanics overview row
  - per-item hybrid alert cards listing preserved manual-review mechanics
  - compile-report pills for validated specs, warnings, and preserved manual-review mechanics
- Added further workspace-side hybrid-output recovery hardening after the July 2/3 mixed-family sweeps, including:
  - condition rider alias and duration recovery for `weaponConditionOnHit`
  - dice-expression normalization for malformed healing and activity damage parts
  - consumed single-use recovery handling for summon and enchant outputs
  - fallback activity-name backfilling for suite outputs
  - broader kind inference for obvious suite-style equipment responses
- Added a reusable AI-service regression runner with three prompt packs:
  - `family` for one-prompt-per-kind strict routing checks
  - `hybrid` for mixed-family compile stress checks
  - `transcript` for real tester-failure replays
- Added a July 3 contract-recovery hardening pass for live OpenAI hybrid drift, including:
  - shared `uses` recovery for mixed staff outputs
  - summon-aware guardrails for single-activity staff fallback
  - text-valued `toggleLight` radii recovery
  - numbered activity-array merge support such as `utilityActivities2` and `utilityActivities3`
  - tuple-style damage-part normalization for live model output
  - broader activity/effect alias normalization
  - greataxe base-damage recovery for artifact and legendary weapon hybrids
- Added a disabled-by-default module activation seam for automatic Free Forge selection in private hosted builds without publishing a temporary endpoint.
- Added a `2.23.0-test.1` tester channel that migrates the package identity to `dungeon-masters-forge`, enables Free Forge automatically, and displays safe structured remote errors.
- Repaired live tester normalization issues in `2.23.0-test.2`, including:
  - safe preview icon fallback instead of `/undefined`
  - armor-versus-shield normalization for `shieldArmorBonus`
  - valid DND5e document-type normalization for rod, wand, and staff outputs
  - safe single-use healing potion normalization without forced recovery entries
  - known-weapon base-damage recovery for condition-on-hit outputs
  - bounded `kind` inference for obvious weapon and multi-activity staff outputs

## Current Technical State

- The module includes the split-pane Description/Result workflow, Forge Settings, Local Rules, Bring Your Own API, and review-before-create validation.
- Read-only native DND5e resolution now covers modern spell, equipment, actor, monster feature, and roll-table lookup without mutating compendium content.
- The reference AI service supports private server-key, personal client-key, and bounded public free-tier deployments. Service `1.6.0` is live on the official Droplet with a 20-generation calendar-month client allowance and one bounded invalid-output retry; Hosted Forge remains disabled in the stable public module until a project-owned hostname and final module smoke pass exist.
- Cauldron of Plentiful Resources remains optional and deferred because its current release is incompatible with this Foundry version.
- The launch-day project plan is now centered on a real free public tier plus a public release plan, with access control-gated hosting deferred.
- The roadmap now tracks charge-scaled multi-spell items where spell level is the default charge cost and extra charge spend can upcast supported SRD spells.
- Exact-name SRD spell requests should prefer system-native spell activity provenance before falling back to synthesized activities when the Foundry DND5e schema allows it.
- Opt-in remote error report uploads are now tracked as a hosted-support improvement. They should remain disabled until redaction, consent, retention, and rate limits are implemented.

## Validation

- Workspace module tests pass.
- The packaged/export AI service snapshot still passes at its currently exported `95`-test baseline.
- Public export module tests pass after the filename-surface sync to `dungeon-masters-forge.js`.
- Public export AI service tests pass (95 tests).
- The currently installed Foundry build on disk is `2.23.0-test.2`.
- The installed module manifest on disk matches the tester manifest target for `dungeon-masters-forge`.
- Foundry Check Connection succeeds against `http://localhost:8788/v1/forge/compile`, and the saved Bring Your Own API selection survives a cold page reload.
- A true remote compile succeeds in Foundry against service `1.3.0`: Live Ember Dagger returned as a validated `weaponExtraDamage` spec with the requested base and fire damage. No world document was created during the smoke test.
- The local service and Foundry model setting are aligned to the configured `gpt-4.1-mini` allowlist.
- A direct shell smoke proof now succeeds against the canonical `8788` service for both `/v1/forge/capabilities` and `/v1/forge/compile`.
- The service-side contract normalizer now accepts `pattern` as a live-model alias for Forge `kind`; that patch is covered by tests and still needs one successful in-Foundry live compile confirmation.
- Tailscale HTTP endpoint acceptance is covered by module tests and merged; a second-machine Tailscale compile remains the next external verification.
- The public manifest and `2.23.0` stable ZIP target are aligned in the workspace release metadata.
- AI service `1.6.0` is live on the Droplet with the existing quota ledger intact.
- AI service `1.6.0` previously passed the 95-test baseline after the tester-output recovery fixes.
- The workspace AI service suite now passes 119 tests after the July 3 hybrid-shape recovery additions and kind-priority hardening.
- The workspace AI service suite now passes 121 tests after the July 3 hosted hybrid-recovery pass for single-summon and missing-kind staff outputs.
- The workspace AI service suite now passes 122 tests after the July 3 retry-hint and hybrid review-state additions.
- The AI service now includes `npm run smoke:regression` for repeatable live compile sweeps against the canonical local `8788` endpoint.
- The AI service now includes `npm run quota:admin` for trusted-host inspection and reset of the public free-tier SQLite ledger.
- The live regression runner now respects `Retry-After` on public free-tier `429 rate_limited` responses so broad sweeps stop misreporting temporary meter pressure as hard compile failures.
- The independently extracted `2.23.0-test.2` package passes the packaged module tests.
- A local stable `2.23.0` release archive now exists and matches the stable manifest download target; the module suite includes an artifact-presence guard so future manifest bumps fail fast if the ZIP is missing.
- A live Foundry smoke pass on the installed `2.23.0-test.2` build succeeded through open, validate, approve, and create flow using the split-pane Forge window. The resulting `Flamefire Dagger` appeared in the Items directory search, and no new Dungeon Master's Forge console errors were observed.
- The temporary staging hostname is present only in the tester channel; the stable release remains endpoint-free.
- A full July 3 live `hybrid` OpenAI regression sweep now passes `14/14` scenarios against the hardened contract layer with `0` compile failures.
- A July 3 hosted Free Forge live Foundry pass now succeeds on the current machine through compile, review, approval, and item creation after resetting the tester monthly client bucket on the Droplet.
- The hosted Free Forge service now also passes fresh live shell regressions for:
  - `hybrid-staff-healing-summon` as a valid `equipmentPowerSuite` with `1` preserved unresolved mechanic instead of a `502`
  - `hybrid-weapon-summon`
  - `hybrid-staff-fiend-summon`
  - `hybrid-shield-caster`
- A broad same-machine hosted hybrid sweep is now known to be quota-sensitive because the public free-tier client identity groups repeated requests from one test host; when the month/day tester bucket is reset between hard cases, the remaining hosted scenarios also pass individually:
  - `hybrid-legendary-fiend-summon`
  - `hybrid-power-suite-condition`
  - `hybrid-legendary-weapon`
  - `hybrid-artifact-enchant`
  - `hybrid-staff-healing-summon`
- The next targeted Foundry live regression should confirm one mixed-family prompt in the updated module UI after the next install/update, with special attention to the new manual-review badges and preserved `unresolvedMechanics` messaging.
- New generated items should no longer display a visible "Generated by Dungeon Master's Forge" description line or forced visible source label.

## Next Release Tasks

See:

- `docs/RELEASE_TASKS.md`
- `docs/PROJECT_LAUNCH_CHECKLIST.md`
