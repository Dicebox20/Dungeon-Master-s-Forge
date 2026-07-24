# Dungeon Master's Forge Release Status

Updated: 2026-07-23

## Provider Default

- The source release now defaults to the hosted Free Forge endpoint using `gpt-5.4-mini`.
- Local Rules remains available as an explicit offline provider, and Bring Your Own API remains unchanged.
- The public and private services now run the locally verified repair-capable `1.6.7` source for temporary Dice Box Group testing. Provider keys, manifests, release artifacts, the private testing service, and the existing quota ledgers remain intact.

## Current Local Snapshot

- Stable source candidate: `2.23.1`; the existing stable ZIP has not been rebuilt after the current compliance edits.
- Tester source candidate: `2.23.1-test.64`, with its manifest, release ZIP, and local Foundry installation prepared for `dm_forge/tester`; publication remains a separate Git release action.
- Hosted service: `1.6.7`; both lanes advertise automation contract `1.0` and template catalog `1.0` with 10 records, while only four production recipes are negotiated. The public client allowance remains `500,000` metered usage units per calendar month, calibrated to roughly 50 prompts from the previous prompt-count baseline. The `10/minute` safeguard and separate `1,000,000,000` global daily ceiling remain in place; the private testing lane remains outside the public ledger.
- Private testing candidate: safe compositional capabilities are advertised separately from the fourteen compatibility renderer routes. Prompt-count quotas have been replaced with provider-token or deterministic data-size usage metering. Cache hits and client-funded provider requests are uncharged.
- Last completed verification suites passed `80/80` module tests and `245/245` AI-service tests locally. The all-automation contract sweep covers every production template and confirms all planned templates remain deferred. A fresh ten-item hosted sweep returned `200` for every request and passed `10/10` semantic JSON audits after the checker was aligned with the canonical Foundry-facing contract. Tester `.63` remains installed locally while `.64` is the refreshed public package candidate, and both Droplet services are healthy on the deployed `1.6.7` service contract.
- The source patch adds a capability-gated `SEND IT AGAIN!?` repair confirmation flow, fresh approval gating, and bounded report provenance. The public service now advertises `features.repairRerun` and `request.cacheControlRefresh`; a live smoke verified `200` then duplicate `409 repair_already_attempted`. The UUID capture design remains roadmap-only.
- The local compliance audit covers AI-content classification, runtime approval, executable-output boundaries, token handling, diagnostics consent, external-provider disclosure, branding, and package contents.
- The Dice Box Group selected MIT licensing. The notice and manifest references are present. The existing stable repository release ZIP was not replaced. Prior tester archives and the pre-`.62` local installation are preserved, with the public monthly allowance set to `500,000` metered usage units.
- The stable `main` lane still requires a separate approved release synchronization; do not treat the tester build as the stable public release.

## Beta V1 Sweep 004

- Added a fresh 15-prompt simple/medium/complex pack at `testing/beta-v1-tiered-sweep-004.json` and durable results at `testing/diagnostics/2026-07-16-beta4-readiness-sweep.md`.
- Repaired explicit summon-choice parsing so natural phrasing such as `Rhinoceros when it shows up` preserves the third selectable profile instead of dropping it.
- Verified 185/185 AI-service tests and all module tests.
- Created and structurally inspected a tagged healing consumable in Foundry. The strict readiness gate remains blocked by insufficient repeated actual-use evidence per family.
- Removed `V2` from the universal product title and changed fresh item/actor folder defaults without migrating existing world folders.
- Deferred additional live Scene Region work for the later Master-tier cycle; no Region write occurred in this sweep.

## Beta V1 Sweep 005

- Added the fresh tiered prompt pack `testing/beta-v1-tiered-sweep-005.json` and the durable record `testing/diagnostics/2026-07-16-beta5-readiness-sweep.md`.
- The corrected local structural sweep is 11 pass, 4 warnings, 0 failures; the hosted structural sweep is 8 pass, 7 warnings, 0 failures. These are not strict full-function Foundry success rates.
- Repaired reusable summon/recovery normalization and stale repaired-summon review notes locally. Reworked compile-status badges to use the same deduplicated Warnings, Free Forge, and Notes counts as the review panels.
- Historical Sweep 005 baseline: `187/187` service tests and `37/37` module tests passed. No tester manifest, release artifact, hosted service, limit, or Region behavior was changed in that sweep.
- Browser control became unreliable after the pre-patch live review check, so no document was created and no actual-use evidence was added. Beta V1 remains ineligible for the final 42-case gate and is not ready for manual inspection.

## Beta V1 Sweep 006

- Added `testing/beta-v1-tiered-sweep-006.json` and `testing/diagnostics/2026-07-16-beta6-readiness-sweep.md` with fresh simple, medium, and complex SRD spell, summon, condition, consumable, armor, enchantment, and hybrid coverage.
- Final local results are 11 pass, 4 warning, 0 failure; hosted results are 8 pass, 7 warning, 0 failure; the focused seven-case hosted warning rerun is 1 pass, 6 warning, 0 failure.
- Repaired only a regression-runner duration scoring defect. The historical Sweep 006 baseline passed `187/187` service tests and `37/37` module tests, including native Region compiler behavior coverage.
- Live Foundry control can inspect the UI and console but cannot execute safe actions, so no item/Region document, use, review-total confirmation, provider-dropdown check, or `Manual Weather Guard` preservation check was added. Beta V1 remains below every strict readiness gate.

## Publish Candidate

- Stable release candidate: `2.23.1`
- Current tester release candidate: `2.23.1-test.64`
- Current tester ZIP SHA-256: `CACF437BA6886AB9E338C9E90393027B5C393648094CBC04C8C2AE0173B2D3B9`
- Module manifest target: `module/module.json`
- Release ZIP: `releases/dungeon-masters-forge-v2-2.23.1.zip`
- Existing stable ZIP SHA-256: `C597701CD56224D925B3270D6AAC26417E6E2FD94F5774E826BDD68529EC25C4` (not rebuilt during the current compliance audit)
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
- Added AI service `1.5.0` calendar-month client quotas for the former 20-generation Free Forge allowance.
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
- The reference AI service supports private server-key, personal client-key, and bounded public free-tier deployments. Service `1.6.1` is live on the official Droplet with the temporary Dice Box Group rollout and one bounded invalid-output retry; Hosted Forge remains disabled in the stable public module until the final release review is complete.
- Cauldron of Plentiful Resources remains optional and deferred because its current release is incompatible with this Foundry version.
- The roadmap now tracks charge-scaled multi-spell items where spell level is the default charge cost and extra charge spend can upcast supported SRD spells.
- Exact-name SRD spell requests should use system-native spell activity provenance when it fully expresses the requested spell and remains reliable; otherwise use the best verified compatibility route and leave the fallback visible in review notes.
- Automation routing is capability-based: native DND5e is selected for complete reliable mechanics, verified Midi-QOL/DAE/Item Macro layers are preferred when they supply missing workflow behavior, and portable core data is the explicit fallback when an advanced layer is unavailable or unverified.
- Opt-in remote error report uploads are implemented with redaction, consent, rate limiting, and a configurable 30-day default retention window. They remain disabled unless the connected service explicitly enables the route.

## Validation

- Workspace module tests pass.
- The current workspace AI service suite passes `198` tests.
- Public export module tests pass after the filename-surface sync to `dungeon-masters-forge.js`.
- Public export AI service tests remain covered by the current workspace suite.
- The current local tester candidate is `2.23.1-test.54`, installed locally after restoring per-item review notes and removing the duplicate aggregate card.
- The installed module manifest on disk matches the tester manifest target for `dungeon-masters-forge`.
- Foundry Check Connection succeeds against `http://localhost:8788/v1/forge/compile`, and the saved Bring Your Own API selection survives a cold page reload.
- A true remote compile succeeds in Foundry against service `1.3.0`: Live Ember Dagger returned as a validated `weaponExtraDamage` spec with the requested base and fire damage. No world document was created during the smoke test.
- The current reference service and tester candidate are aligned to the configured `gpt-5.4-mini` allowlist.
- A direct shell smoke proof now succeeds against the canonical `8788` service for both `/v1/forge/capabilities` and `/v1/forge/compile`.
- The service-side contract normalizer now accepts `pattern` as a live-model alias for Forge `kind`; that patch is covered by tests and still needs one successful in-Foundry live compile confirmation.
- Tailscale HTTP endpoint acceptance is covered by module tests and merged; a second-machine Tailscale compile remains the next external verification.
- The local stable manifest and existing `2.23.1` ZIP target are aligned in the workspace release metadata; remote publication remains pending.
- AI service `1.6.1` is live on the Droplet with the existing quota ledger intact.
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
