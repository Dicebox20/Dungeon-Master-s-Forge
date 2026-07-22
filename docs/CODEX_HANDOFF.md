# Codex Handoff: Dungeon Master's Forge

Updated: 2026-07-22

## Purpose

This file is the compact starting point for a fresh Codex task. It replaces the need to carry a very large debugging chat forward. Read `AGENTS.md`, this file, `docs/STATUS.md`, and `module/ROADMAP.md` before making changes.

## Current Checkout

- Repository: `Dungeon-Master-s-Forge`
- Active branch: `dm_forge/tester`
- Latest known commit: `17d5fa0 Add public tester list`
- Do not delete existing untracked tester ZIP files. They may be user-created release artifacts.

## Tester Distribution

- Tester manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
- Current tester version: `2.23.1-test.45`
- Current tester download: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/releases/dungeon-masters-forge-v2-2.23.1-test.45.zip`
- Current ZIP SHA-256: `1D45EF0BDABBC4EE9485F7715ED61C83E9984314D1C83805ACB1F124B1202F18`

The production manifest remains on `main`. Keep tester artifacts and URLs on `dm_forge/tester` until a release is deliberately promoted.

## Current Compliance State

- Local source candidates are stable `2.23.1` and tester `2.23.1-test.45`.
- Public-facing documentation now describes the runtime AI flow, review-before-create boundary, provider data flow, token storage, diagnostic consent, and unofficial Foundry status.
- The service and module suites currently pass `198/198` and `46/46` respectively.
- The Dice Box Group selected MIT licensing. The stable and tester builders require and include `LICENSE`; isolated candidate archives passed local inspection. Repeat the final build after any source change before an approved release action.
- The existing stable ZIP is an older archive and must not be described as the current compliant submission package.
- Tester build `2.23.1-test.45` and its manifest are published on `dm_forge/tester`. The stable `main` lane, provider keys, quotas, and stable release ZIP remain unchanged.

## Hosted Service

- DigitalOcean service name: Dungeon Master's Forge AI Service
- Last verified service version: `1.6.1`
- Listener: localhost port `8788`, exposed through the configured reverse proxy/domain
- Health route: `/health`
- Last known public access: `public-free-tier`
- Public Free-tier limits: 10 per minute, 100 per client month, 50 global per day
- Private testing service: `https://dmforge-test.137-184-103-220.sslip.io`, authenticated, port `8789`
- Dual-service deployment record: `docs/DUAL_FREE_FORGE_DEPLOYMENT_2026-07-16.md`
- Source release default: Free Forge at the public endpoint above, using `gpt-5.4-mini`; Local Rules remains an explicit offline option.
- The hosted Free Forge previously ran `gpt-4.1-mini`; the private/BYO test service was configured for `gpt-5.4-mini`. Always check the service environment and health response before claiming the hosted model changed.

Never place provider keys in this repository, chat, screenshots, or error reports.

## Recent Verified Progress

- Sweep 006 is recorded in `testing/diagnostics/2026-07-16-beta6-readiness-sweep.md`. The final local structural run is 11 pass, 4 warning, 0 failure; hosted is 8 pass, 7 warning, 0 failure, and a seven-case hosted warning rerun is 1 pass, 6 warning. No structural failure or unsafe output occurred.
- Historical Sweep 006 baseline: the regression runner recognized numeric and `{ value, units }` durations before scoring expected hour/minute mechanics; that sweep passed 187/187 service tests and 37/37 module tests. The current suites are 198/198 and 46/46.
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
- Local tester `2.23.1-test.45` retains the disabled-by-default native Scene Region Forge, adds clearer review-note severity and teal Free Forge fallback notices, and records bounded provider-to-final provenance for diagnostics.
- The 15-case Region sweep passes, native create/update/delete reconciliation works, generated item Active Effects link through `applyActiveEffect`, and a manually created `Manual Weather Guard` behavior survives Forge reconciliation.
- The reusable selected test Region is named `DMF test.41 Autonomous Region`; do not target any other Region during automated testing.
- The recurring `free-forge-beta-sweep` automation was deleted at the user's request. Future item/Region sweeps are manual; do not recreate a scheduled task unless explicitly requested.
- `docs/BETA_V1_MANUAL_VERIFICATION_STANDARD.md` is the required evidence process for future Free Forge sweeps. It defines an opt-in dedicated-Actor harness boundary so manual review is short without weakening strict readiness accounting.
- The first harness foundation now has a disabled-by-default GM setting and module API. It refuses any world except `dmf-test-world`, creates only `DMF Verification Actor` and verification folders, validates copied documents against expectation cards, and never auto-executes activities, macros, Scenes, or Regions.
- `testing/BETA_V1_REPEATABLE_AUTONOMOUS_SWEEP_TASK.md` is the current copy/paste task for manually launched Beta V1 cycles. It separates unattended structural coverage from strict isolated Foundry evidence and keeps Scene Region work opt-in.
- Simple weapons and common consumable projectiles now usually create as the intended Foundry document type and consume correctly.
- The report-failed-item flow and its separate dialog have been added, though its server handling previously returned HTTP 500 and must be smoke-tested before relying on it.
- Deterministic prompt normalization and family routing substantially improved basic prompt success after the earlier template migration.
- The following recent tests were reported successful: Wand of Searing Hail, Ashen Bulwark as half-plate with fire resistance, Cloak of the Stormwatch with AC and lightning resistance, and Bloomdraught healing.

## Known Active Issues

1. Strict readiness is still far below the Beta gate: historical actual Foundry full-function evidence is 2/7 (28.6%), no family has three distinct full-function successes, and the final 42-case gate is ineligible.
2. The current browser automation bridge can read the live Foundry controls but fails on action calls. Restore that layer before counting further live successes; do not restart or alter the user's world merely to work around it.
3. Hosted Free Forge repeatedly degrades some enchantment riders, multi-profile duration/family routes, high-complexity armor/weapon hybrids, and one-turn condition riders. Observe further tagged cases before treating each as a deterministic service defect.
4. Multi-spell staff targeting still needs hardening. The Staff of Tides and Thunder's Tidal Wave activity was created but recently showed a 5-foot range and cube area instead of the intended spell-compatible target data.
5. Item-image selection remains inconsistent. When no system or bundled image is available, the preview and review notes must clearly say a generic fallback is used; no `/undefined` asset request is acceptable.
6. Attunement state can intentionally suppress extra activities. When testing staff or charged items, confirm the created item is attuned before interpreting a basic attack as a routing failure.
7. Error-report submission needs a low-cost smoke test after service changes. Do not submit every isolated failure; group reports by recurring pattern.
8. Build and prove the opt-in `DMF Verification Actor` harness before relying on a high-volume manual sweep. It must not modify campaign Actors, Scenes, Regions, or execute scripts/macros.

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

Finish runtime smoke-testing the local `2.23.1-test.45` candidate. It contains the current item-engine and review-surface fixes plus bounded provider-to-final provenance diagnostics and the separate GM-only, disabled-by-default Native Scene Region Forge workflow. The 14 item families and SRD summoning remain unchanged.

After the candidate passes Foundry document inspection, continue tiered Free Forge item sweeps and the 15-case Region sweep. Keep geometry creation, teleportation, macro execution, automatic world migration, publishing, and hosted deployment outside this milestone unless explicitly approved.

## Launch Checklist Pointers

- `module/ROADMAP.md`: features, blockers, compatibility scope.
- `docs/RELEASE_TASKS.md`: release packaging and Foundry submission work.
- `docs/FOUNDRY_SUBMISSION_BRIEF.md`: staff-facing submission narrative.
- `docs/FREE_TIER_DEPLOYMENT.md`: hosted service and Free Forge setup.
- `docs/LAUNCH_DAY_RUNBOOK.md`: operational launch steps.
- `docs/STABILITY_SWEEP_2026-07-15.md`: current source, package, service, and Foundry stability baseline.
- `docs/SCENE_REGION_MIGRATION_PLAN.md`: native-first Scene Region architecture and module-dependency migration tasks.
