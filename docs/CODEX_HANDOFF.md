# Codex Handoff: Dungeon Master's Forge

Updated: 2026-07-23

## Purpose

This file is the compact starting point for a fresh Codex task. It replaces the need to carry a very large debugging chat forward. Read `AGENTS.md`, this file, `docs/STATUS.md`, and `module/ROADMAP.md` before making changes.

## Product Language Boundary

Dungeon Master's Forge is review-first assisted automation, with the GM remaining responsible for the final rules decision. Do not describe the product, a release, or a completion milestone as running without GM judgment. Use precise terms such as `supported automation`, `verified assisted automation`, `manual review`, `GM adjudication`, `experimental`, and `deferred`.

Beta completion measures dependable, reviewable workflows and safe boundaries. It does not mean every DND5e rule, creative request, or third-party module interaction runs without GM judgment.

## Current Checkout

- Repository: `Dungeon-Master-s-Forge`
- Active branch: `dm_forge/tester`
- Latest known commit: `17d5fa0 Add public tester list`
- Do not delete existing untracked tester ZIP files. They may be user-created release artifacts.

## Tester Distribution

- Tester manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
- Current tester version: `2.23.1-test.62` (source/package candidate; publication remains a separate release action)
- Current tester download: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/releases/dungeon-masters-forge-v2-2.23.1-test.62.zip`
- Current ZIP SHA-256: `0C3CE959B99937D736EAC0E42AE1B58CA2C6861511AF8CEA62F9E94186070EA1`

The production manifest remains on `main`. Keep tester artifacts and URLs on `dm_forge/tester` until a release is deliberately promoted.

## Current Compliance State

- Local source candidates are stable `2.23.1` and tester `2.23.1-test.62`.
- Public-facing documentation now describes the runtime AI flow, review-before-create boundary, provider data flow, token storage, diagnostic consent, and unofficial Foundry status.
- The service and module suites currently pass `237/237` and `80/80` respectively.
- The active routing policy is capability-based: native DND5e is selected only when complete and reliable; verified Midi-QOL, DAE, Item Macro, and related routes are preferred when they provide required workflow behavior; portable core data and a review note are the fallback when a route is unavailable or unverified.
- The Dice Box Group selected MIT licensing. The stable and tester builders require and include `LICENSE`; isolated candidate archives passed local inspection. Repeat the final build after any source change before an approved release action.
- The existing stable ZIP is an older archive and must not be described as the current compliant submission package.
- Tester build `2.23.1-test.62` is installed locally and is the current package candidate. The stable `main` lane, provider keys, and stable release ZIP remain unchanged. The explicitly requested public monthly allowance is `500,000` metered usage units.

## Hosted Service

- DigitalOcean service name: Dungeon Master's Forge AI Service
- Last verified service version: `1.6.6`
- Listener: localhost port `8788`, exposed through the configured reverse proxy/domain
- Health route: `/health`
- Last known public access: `public-free-tier`
- Public Free-tier limits: temporary Dice Box Group rollout reports 10 per minute, no daily client block, `500,000` metered usage units per client-month, and a separate `1,000,000,000` global daily ceiling; the private testing lane remains outside the public ledger
- Private testing service: `https://dmforge-test.137-184-103-220.sslip.io`, authenticated, port `8789`; it now runs the usage-metered prompt-contract `1.1.0` candidate from isolated `/opt/dmforge-ai-testing`
- Both service lanes advertise automation contract `1.0`, template catalog `1.0` with 10 records, repair reruns, and negotiated cache refresh. Existing public and private limits were preserved during deployment.
- Dual-service deployment record: `docs/DUAL_FREE_FORGE_DEPLOYMENT_2026-07-16.md`
- Source release default: Free Forge at the public endpoint above, using `gpt-5.4-mini`; Local Rules remains an explicit offline option.
- The hosted Free Forge previously ran `gpt-4.1-mini`; the private/BYO test service was configured for `gpt-5.4-mini`. Always check the service environment and health response before claiming the hosted model changed.

Never place provider keys in this repository, chat, screenshots, or error reports.

## Idea Triage Before Patches

Before each code patch, inspect the accessible Brain Hub organizer project files for Dungeon Master's Forge ideas. Triage each relevant idea autonomously as implement now, defer, or scrap; do not force an idea into a patch merely because it exists. If the private organizer is not accessible in the current signed-in session, record that limitation and continue from the local roadmap and handoff instead of guessing at its contents.

- 2026-07-22 patch triage: the Brain Hub organizer was not accessible in the current Chrome session, so no private organizer ideas were imported. This patch uses only the checked-in near-term repair, preview-navigation, and capacity tasks; UUID/Region, payments, Patreon, and advanced automation-contract expansion remain deferred.

## Recent Verified Progress

- Sweep 006 is recorded in `testing/diagnostics/2026-07-16-beta6-readiness-sweep.md`. The final local structural run is 11 pass, 4 warning, 0 failure; hosted is 8 pass, 7 warning, 0 failure, and a seven-case hosted warning rerun is 1 pass, 6 warning. No structural failure or unsafe output occurred.
- Historical Sweep 006 baseline: the regression runner recognized numeric and `{ value, units }` durations before scoring expected hour/minute mechanics; that sweep passed 187/187 service tests and 37/37 module tests. The current suites are 216/216 and 52/52.
- Foundry visual and console checks again verified Forge controls and found no Forge console error, but browser action calls fail before preview, provider-setting interaction, document creation, use, or Region writes. No item/Region full-function evidence was added.
- Sweep 005 is recorded in `testing/diagnostics/2026-07-16-beta5-readiness-sweep.md`. The corrected 15-case local run scored 11 pass, 4 warnings, and 0 failures; the hosted run scored 8 clean, 7 review-bound, and 0 HTTP failures. Neither layer is strict Foundry full-function evidence.
- Historical Sweep 005 baseline: deterministic local fixes preserved reusable SRD summons, repaired charge recovery, cleared repaired stale summon review notes, and aligned compile-status totals with the visible Warnings, Free Forge, and Notes badges. That sweep passed 187 service tests and 37 module tests.
- A live Webspark preview exposed the prior review-count mismatch and confirmed the request field, policy dropdown, and universal dialog name. Browser automation failed before the installed fix could be rechecked or a created item could be rolled; no item was created in Sweep 005.
- Sweep 004 is recorded in `testing/diagnostics/2026-07-16-beta4-readiness-sweep.md`. The 15-case local structured run scored 10 pass, 1 warning, and 4 incomplete mechanic assertions; the hosted run scored 7 clean and 8 review-boundary results with no HTTP failures.
- A deterministic multi-profile parser defect was repaired in both service and module layers. The fresh `B4L3` retry preserved Giant Toad, Giant Scorpion, and Rhinoceros with zero unresolved mechanics; all 185 service tests and all module tests pass.
- A live tagged Sunmoss Cordial was created and inspected with one action, `3d6` healing, and one consumed Item Use. It remains a strict partial because actual actor healing and item consumption were not executed.
- The universal UI name is now `Dungeon Master's Forge`. Fresh folder defaults are `Dungeon Master's Forge` and `Dungeon Master's Forge Summons`; existing world folder settings are intentionally not migrated automatically.
- Scene Region testing was stopped before applying changes after the user deprioritized it for the initial Free Forge tier. The exact autonomous Region and guarded controls were verified, and no Region behavior was written.
- Live console inspection found no Forge runtime error. `ForgeSettingsApplication` still emits Foundry's V1 Application deprecation warning and should move to ApplicationV2 before Foundry 16 compatibility is required.
- Local tester `2.23.1-test.54` retains the disabled-by-default native Scene Region Forge, adds capability-routed automation metadata, final-spec review-note reconciliation, explicit summon-cost repair, collapsed review categories, the user-confirmed `Retry` repair flow, the compact repair dialog, the Advanced Specification Editor tab, and the hosted capacity indicator. It also prevents malformed no-save aura damage from reaching the provider as an invalid contract, preserves that limitation for manual review, anchors aura activation to the wielder's actor token, restores per-item review notes, and removes the duplicate aggregate preview card. The repair confirmation exposes only the reachable retry field and reports request progress/errors in place.
- The 15-case Region sweep passes, native create/update/delete reconciliation works, generated item Active Effects link through `applyActiveEffect`, and a manually created `Manual Weather Guard` behavior survives Forge reconciliation.
- The reusable selected test Region is named `DMF test.41 Autonomous Region`; do not target any other Region during automated testing.
- The recurring `free-forge-beta-sweep` automation was deleted at the user's request. Future item/Region sweeps are manual; do not recreate a scheduled task unless explicitly requested.
- `docs/BETA_V1_MANUAL_VERIFICATION_STANDARD.md` is the required evidence process for future Free Forge sweeps. It defines an opt-in dedicated-Actor harness boundary so manual review is short without weakening strict readiness accounting.
- The evidence process now requires an immediate structured snapshot when the GM submits review notes or a UI/functionality failure; the GM need not attach JSON, console output, or DMF review-note text unless the live snapshot is blocked or incomplete.
- The first harness foundation now has a disabled-by-default GM setting and module API. It refuses any world except `dmf-test-world`, creates only `DMF Verification Actor` and verification folders, validates copied documents against expectation cards, and never auto-executes activities, provider output, Scenes, or Regions.
- The harness now also exposes an explicit `verification.executeMacro({ macroId | macroName, args })` tester API. It requires the enabled GM/test-world boundary and one exact existing Foundry Macro; it runs only on request and returns the macro identity/result without auto-selecting targets, placing tokens, or executing provider output.
- `testing/BETA_V1_REPEATABLE_AUTONOMOUS_SWEEP_TASK.md` is the current copy/paste task for manually launched Beta V1 cycles. It separates unattended structural coverage from strict isolated Foundry evidence and keeps Scene Region work opt-in.
- Simple weapons and common consumable projectiles now usually create as the intended Foundry document type and consume correctly.
- The user-facing failed-item report flow has been removed. Reviewed network results now use the unchanged-request `Retry` action and the `SEND IT AGAIN!?` repair confirmation; anonymous technical error diagnostics remain separately opt-in.
- Next repair-dialog UI task: remove the duplicated original-prompt display from `SEND IT AGAIN!?`. Keep one large editable repair-notes field with minimal secondary controls; the original prompt remains available in the main Forge window.
- Next capacity UI task: show hosted usage as `Forge Capacity: ##% remaining` in the main DMF window. Explain that complexity, batches, and repairs consume different amounts, while hiding raw bytes, tokens, and internal usage units from ordinary players.
- Deterministic prompt normalization and family routing substantially improved basic prompt success after the earlier template migration.
- The following recent tests were reported successful: Wand of Searing Hail, Ashen Bulwark as half-plate with fire resistance, Cloak of the Stormwatch with AC and lightning resistance, and Bloomdraught healing.

## Known Active Issues

1. Strict readiness is still far below the Beta gate: historical actual Foundry full-function evidence is 2/7 (28.6%), no family has three distinct full-function successes, and the final 42-case gate is ineligible.
2. The Chrome control session dropped after the required Foundry process restart. Chrome, the extension, and native host all pass installation checks, but the supported recovery needs a fresh Chrome window in the selected DMF profile. Foundry is currently at its administrator screen with no world active. Restore control and enter only `dmf-test-world` before counting further live evidence.
3. Hosted Free Forge repeatedly degrades some enchantment riders, multi-profile duration/family routes, high-complexity armor/weapon hybrids, and one-turn condition riders. Observe further tagged cases before treating each as a deterministic service defect.
4. Multi-spell staff targeting still needs hardening. The Staff of Tides and Thunder's Tidal Wave activity was created but recently showed a 5-foot range and cube area instead of the intended spell-compatible target data.
5. Item-image selection remains inconsistent. When no system or bundled image is available, the preview and review notes must clearly say a generic fallback is used; no `/undefined` asset request is acceptable.
6. Attunement state can intentionally suppress extra activities. When testing staff or charged items, confirm the created item is attuned before interpreting a basic attack as a routing failure.
7. Error-report submission needs a low-cost smoke test after service changes. Do not submit every isolated failure; group reports by recurring pattern.
8. Build and prove the opt-in `DMF Verification Actor` harness before relying on a high-volume manual sweep. It must not modify campaign Actors, Scenes, Regions, or execute provider-generated scripts/macros; the separate exact-name/ID macro probe is tester-only and GM-confirmed.
9. The tester build intentionally hides the harness utility buttons while retaining `game.modules.get("dungeon-masters-forge").api.verification`; the current browser bridge could not invoke that page-side API without bypassing its safety boundary. Do not count the harness pass until it is run through the visible harness control or an approved Foundry-side console/API path.

## Recommended Beta Test Sequence

Run the smallest case that exercises changed code before spending on a broad sweep.

1. Consumable projectile: direct-hit acid/alchemist flask and area grenade.
2. Single charged save/damage caster item: Wand of Searing Hail.
3. Multi-spell charged staff: Staff of Tides and Thunder, including Shatter and Tidal Wave targeting.
4. Passive equipment: half plate resistance and a cloak resistance/AC item.
5. Healing consumable.
6. One complex hybrid only after the first five pass: weapon or staff with charges, named spells, area targeting, and one manual-review mechanic.

For a failure, capture the exported item JSON, a brief user observation, the relevant activity/effect screenshot, and only the console lines around the error. Use the in-module report tool for recurring patterns, not every one-off cosmetic issue.

## Next Engineering Milestone

Finish runtime smoke-testing the candidate. The fourteen kinds remain compatibility renderer routes, but they are no longer presented to the model as the full capability ceiling. Safe mechanics can compose across those routes, while executable output and campaign-changing behavior remain behind their existing safety boundaries. The usage-metered prompt-contract `1.1.0` candidate is now live on both the private testing service and the temporary internal public Free Forge lane.

After the candidate passes Foundry document inspection, continue tiered Free Forge item sweeps and the 15-case Region sweep. Keep geometry creation, teleportation, macro execution, automatic world migration, publishing, and hosted deployment outside this milestone unless explicitly approved.

The repair-rerun implementation is complete in the local tester module, private test service, and temporary internal public service. The public lane now advertises `features.repairRerun` and `request.cacheControlRefresh`; the live smoke returned `200` for the first repair and `409 repair_already_attempted` for the duplicate. The temporary public limits are intentionally permissive for the Dice Box Group only. Before broader use, define the final data-based allowance and restore deliberate public guidelines. Helpful defaults remain a separate planned change and must be bounded, provider-consistent, and visible as assumptions. Neither change may bypass fresh review or replace the server's bounded malformed-output retry.

## Launch Checklist Pointers

- `module/ROADMAP.md`: features, blockers, compatibility scope.
- `docs/RELEASE_TASKS.md`: release packaging and Foundry submission work.
- `docs/FOUNDRY_SUBMISSION_BRIEF.md`: staff-facing submission narrative.
- `docs/FREE_TIER_DEPLOYMENT.md`: hosted service and Free Forge setup.
- `docs/LAUNCH_DAY_RUNBOOK.md`: operational launch steps.
- `docs/STABILITY_SWEEP_2026-07-15.md`: current source, package, service, and Foundry stability baseline.
- `docs/SCENE_REGION_MIGRATION_PLAN.md`: capability-routed Scene Region architecture and module-dependency migration tasks.
