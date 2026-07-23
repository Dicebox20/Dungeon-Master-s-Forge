# Changelog

## Unreleased

## 2.23.1-test.62

- Preserves every declared automation route in advanced specification JSON, including mixed condition and self-light items.
- Advertises only four production routes; animation presentation remains planned until its trusted renderer and harness evidence exist.
- Keeps provider output declarative-only while the local Foundry renderer remains responsible for reviewed automation code.
- Updates the tester package for the current service contract and automation review guidance.

## 2.23.1-test.61

- Gates trusted condition, light, and utility macro payloads on the local Item Macro/Midi-QOL settings instead of treating declarative automation metadata as executable code.
- Adds macro activity and Midi-QOL hook details to isolated harness snapshots and optional expectation cards.
- Keeps the hosted service declarative-only; no provider-generated scripts or macros are accepted.
- Adds focused compatibility tests for the DMF execution plan and preserves the explicit GM-only macro probe boundary.

## 2.23.1-test.60

- Normalizes common trigger and target wording for every production automation template while preserving strict rejection of unknown or planned routes.
- Keeps the service and Foundry module on the same catalog-defined trigger defaults.

- `2.23.1-test.59` adds a bounded translation layer for observed automation labels such as `on-hit`, trusted-local authority wording, free-form fallback text, and production template names. It also validates and discards safe template-description metadata echoed by the provider before strict runtime validation.
- `2.23.1-test.58` adds the initial bounded translation layer for observed automation labels such as `on-hit`, trusted-local authority wording, free-form fallback text, and production template names.
- `2.23.1-test.57` reconciles the automation-template catalog across the service and module, packages the current provider and preflight runtime together, adds compatibility coverage for roadmap-bound automation, and refreshes the tester release identity after the `.56` package drift audit.
- `2.23.1-test.56` routes generated DND5e activities through the system's public `createActivity`, `updateActivity`, and `deleteActivity` APIs, adds a strict Foundry DataModel preflight before writes, and records capability/document snapshots in the isolated harness.
- `2.23.1-test.54` restores the per-item review-note text tree and removes the duplicate aggregate review-notes panel from the preview.
- `2.23.1-test.53` adds capability-routed automation metadata to the preview and hosted capabilities response, shows the selected layer and required modules before approval, and removes the duplicate per-item review-notes card.
- `2.23.1-test.52` prevents malformed no-save aura damage from becoming a provider 502, preserves it as explicit manual review, and anchors aura activation to the wielder's actor token. The public Free Forge lane now uses a `500,000` metered-unit monthly allowance calibrated to roughly 50 prompts from the prior prompt-count baseline.
- The repair consent checkbox now sits in the footer with a visible checked state and hover tooltip. Repair reruns now send the user's original request instead of the internal layered brief.
- `2.23.1-test.51` removes the evidence panels from the repair confirmation so the single retry text box is immediately reachable. The dialog now reports request progress/errors before closing.
- `2.23.1-test.50` fixes a first-preview regression that removed the Advanced Specification Editor's `specs` control before normalized JSON could be written.
- `2.23.1-test.49` includes the missing advanced automation runtime files, the compact one-textbox repair dialog, the Advanced Specification Editor preview tab, and the hosted Forge Capacity percentage indicator.
- `2.23.1-test.48` changes the unchanged request action to `Retry`, opens the existing `SEND IT AGAIN!?` repair confirmation from that action, and removes the separate failed-item report UI. It also adds the advanced automation failure matrix and staged prompt pack; repaired results still require fresh review and approval.

## 2.23.1-test.45

- Added bounded provenance fingerprints to diagnostic evidence so provider output can be compared with the final reviewed item without exposing prompts, keys, or endpoints.
- Refreshed the tester package from the current reviewed source and kept the isolated verification harness disabled outside `dmf-test-world`.
- Updated the tester lane to use the refreshed private service release without changing tester quotas or provider credentials.

## 2.23.1-test.44

- Rebuilt the tester package from the current reviewed source with the MIT license and curated runtime contents.
- Removed tests, examples, and build helpers from the tester archive while retaining the isolated verification harness.
- Kept the public Free Forge endpoint and existing tester limits unchanged.

## 2.23.1-test.43

- Made the bottom validation status use the same deduplicated Warnings, Free Forge, and Notes totals shown in the review panel, fixing a discrepancy found during the live `test.42` browser smoke test.

## 2.23.1-test.42

- Restyled the review-notes panel with a calmer teal-and-ink color scheme and consolidated its summary into clear Warnings, Free Forge, and Notes categories.
- Kept assumptions and system references informational instead of turning the overall compile state into a warning; conflicts, unresolved mechanics, and manual intervention still require attention.
- Added a teal Free Forge notice when the hosted free path intentionally simplifies a mechanic or preserves it for manual review instead of inventing unsafe automation.
- Retained the complete `test.41` native Scene Region compatibility baseline and its 15-case Region regression sweep.
- Added planned Master Patreon support for reviewed World- and Region-Affecting items to the roadmap.

## 2.23.1-test.41

- Added an experimental, GM-only Scene Region Forge behind a disabled-by-default world setting.
- Added reviewed native Region behavior support for DND5e difficult terrain plus Foundry movement cost, darkness, weather suppression, pause, scrolling text, and Active Effects sourced from generated world items.
- Preserved non-Forge Region behaviors during reconciliation and kept scripts, macro source, teleportation, and automatic world migration outside this first release.
- Added a 15-case simple, medium, and complex Scene Region release sweep and fixed plural effect-language recognition found by that sweep.
- Rebuilt the tester from the current item-engine source so the earlier `test.40` spell-enrichment package drift is removed without overwriting an existing release artifact.

## 2.23.1-test.40

- Reissued the current tester package under a new version to avoid a version collision with an already-distributed `test.39` build.

## 2.23.1-test.39

- Recognized plain-language attunement requests such as "needs attunement" and "does not need attunement" in both the hosted service and Foundry renderer.
- Marked clearly friendly or companion summons as friendly for Midi-QOL and kept Misty Step location selection from opening an unnecessary target-confirmation dialog.
- Normalized combined spell labels so each generated activity names the specific spell it executes.

## 2.23.1-test.38

- Removed duplicated on-hit weapon rider damage from separately named activated save activities.
- Preserved a utility spell such as Detect Thoughts while recovering a distinct requested spell attack.
- Restored missing summon activities for multi-spell staffs and enchant consumables, with summon use confirmation when the item consumes a resource.

## 2.23.1-test.37

- Fixed attunement request recognition for the common “requiring attunement” phrasing, preventing hybrid artifact weapons from being created without their requested attunement requirement.
- Preserved the verified artifact passive-effect recoveries for resistance, AC, darkvision, and light toggles.

## 2.23.1-test.36

- Added a deterministic Tidal Wave spell profile with its 120-foot range, 30-by-10-foot line template, Dexterity save, 4d8 bludgeoning damage, half damage on a successful save, and 3-charge cost.
- Enriched existing named spell activities when generated mechanics are present but stale, instead of only repairing missing activities.
- Added regression coverage for exact Shatter and Tidal Wave targeting, templates, save behavior, and charge costs on multi-spell staffs.

## 2.23.1-test.35

- Enabled template placement prompts whenever a generated save activity already contains a structured area template.
- Recovered explicit per-spell costs from phrases such as "spend 3 charges to cast Tidal Wave," including when the model supplied a stale zero cost.
- Added regression coverage for multi-spell staff template prompting and charge consumption.

## 2.23.1-test.34

- Preserved every explicitly named spell in layered Forge requests so later activities such as Tidal Wave are no longer silently dropped from multi-spell items.
- Preferred exact Foundry system chassis artwork over generic or mismatched model-selected artwork during item creation.
- Added a bundled wand-art fallback when no matching system item image is available.
- Added regressions for multi-spell staff normalization and mismatched wand artwork.

## 2.23.1-test.33

- Restored the original human request as the input to legacy mechanics planning, repair, SRD spell reconciliation, attunement alignment, validation, and item creation stages.
- Kept the layered Forge brief provider-facing so structured compilation no longer erases details needed by older deterministic repair passes.
- Preserved charge recovery timing such as daily at dawn, long rest, and short rest while normalizing charge pools.
- Added regression guards for mechanics-request selection, validation and creation routing, and recovery cadence preservation.

## 2.23.1-test.32

- Preserved save ability, save DC, area template, charge cost, failed-save damage, and half-on-success clauses in the layered Forge brief.
- Prevented activated wand and rod powers from being mislabeled as passive on-hit damage before reaching the Forge AI service.
- Preserved explicit armor chassis, damage resistance, and healing formulas in structured requests.
- Added regression coverage for the reported Wand of Searing Hail layered-brief failure.

## 2.23.1-test.31

- Corrected explicit armor prompts such as "half plate, not a shield" before Foundry rendering.
- Restored explicit damage resistances and healing formulas when a remote model returns an incomplete passive or potion payload.
- Converted wand and rod save/template requests into real save activities instead of treating their damage as an on-hit weapon rider.
- Removed the failed-item-report information panel and streamlined the bottom action bar to a single `Approve` control.

## 2.23.1-test.30

- Kept unspecified magical bonuses and spell save DCs out of the remote model brief so post-compile defaults cannot be mistaken for user instructions.
- Preserved one-power staff and quarterstaff outputs as staff activity suites instead of collapsing them into save-only items.
- Promoted save-only model output back to a staff suite when the request explicitly names a staff or quarterstaff.
- Rerouted weapon-shaped flasks and grenades into consumable activity families before provider-side validation.
- Returned a specific `503 report_storage_unavailable` error when failed-item feedback cannot be persisted.
- Added regression coverage for the reported staff, consumable, grenade, and failed-report cases.

## 2.23.1-test.29

- Restored a minimized Forge window when the Items sidebar hammer is selected again.

## 2.23.1-test.28

- Moved approval and failed-item reporting controls into the actual bottom action bar, matching the compact Forge layout.

## 2.23.1-test.27

- Moved creation approval beside the failed-item report control as a compact, clearly labeled action.
- Attempting to create without approval now highlights the approval control before creation is blocked.

## 2.23.1-test.26

- Fixed multi-spell staffs so their normalized attack, utility, and save activities are all created on the final Foundry item.

## 2.23.1-test.25

- Recovered missing on-hit weapon damage riders from hybrid staff and weapon requests before rendering the base attack.
- Removed stale spell-resource and spell-DC review warnings once a real spell activity is present.
- Added an explicit review note explaining that attunement-gated item powers appear only after the item is attuned.

## 2.23.1-test.24

- Updated the baked-in Free Forge model request to `gpt-5.4-mini` so it matches the live service allowlist.

## 2.23.1-test.23

- Replaced publishable internal naming and tester manifest paths with Dungeon Master's Forge naming.
- Retained prior saved settings and generated-item compatibility without exposing the former package name in release materials.

## 2.23.1-test.22

- Made an explicitly requested grenade saving-throw ability override stale model defaults in both the AI service and Foundry repair pass.

## 2.23.1-test.21

- Added damage-aware Foundry core images for grenade-style consumable projectiles when no exact DND5e system image is available.
- Added an explicit review note when neither system art nor a safe bundled Foundry fallback can be found.
- Kept local and AI-generated consumable-projectile image selection on the same deterministic path.

## 2.23.1-test.20

- Prevented thrown consumable prompts from receiving an invented `+1` magical or attack bonus.
- Made explicit grenade and flask ranges and area templates override stale model defaults during repair.
- Added regression coverage for single-target flasks and cone/sphere grenade templates.

- Added the `2.23.1-test.19` tester build. Thrown consumables now normalize into real consumable items during hosted generation, bogus template/spell-attack noise is stripped from flask-style outputs, grenade save templates recover their thrown range and area metadata, and tester previews label those specs as consumable projectiles instead of equipment suites.
- Added the `2.23.1-test.18` tester build. Preview and review notes now drop stale spell-family warnings once a working SRD spell activity has actually been preserved on the item, reducing false manual-review noise for simple prompt hybrids.
- Added the `2.23.1-test.17` tester build. Multi-stage SRD spell activities now disambiguate their labels so split spells like Ice Knife no longer appear as duplicate identical buttons in the final item activity list.
- Added the `2.23.1-test.16` tester build. Simple weapon-plus-spell hybrids now preserve the activity chooser by blocking Midi's one-attack-plus-one-rider auto-merge path, and layered briefs now recognize explicit `Spell:` fields so SRD spell activities survive normalization.
- Added the `2.23.1-test.15` tester build. Named spell activities now clear stale legacy unmapped-spell review records once the template pipeline has preserved a real Foundry activity.
- Added the `2.23.1-test.14` tester build with the first layered item blueprint pass. It maps generic generated activities into typed Foundry activities, derives item-level resource pools before rendering charged powers, removes generic shadows of named spell activities, and preserves hybrid spell attacks in the weapon renderer.
- Added the `2.23.1-test.13` tester build for the latest hybrid repair pass, including named save activity recovery, alias-aware SRD spell reuse, improved summon fallback actors, and dual-summon recovery for Frostwave-style prompts.
- Added the `2.23.0-test.4` tester build for opt-in anonymous error reports and SRD spell auto-selection on supported charge-spell item requests.
- Added a hosted-service `/v1/forge/report-error` route and a Foundry consent toggle that uploads redacted module errors with item review notes.
- Added module-side SRD spell auto-selection for supported "spells of your choice" requests so compatible weapons and equipment can attach real save activities instead of unresolved empty slots.
- Added the `2.23.0-test.3` tester build for the current hybrid-output hardening workspace.
- Refreshed the packaged tester lane so the branch manifest matches the latest local fixes under test.
- Added the `2.23.0-test.2` live-testing repair build.
- Fixed preview fallback icons so generated items without images no longer request `/undefined`.
- Fixed armor bonus items so plate, leather, and breastplate requests are no longer created as shields.
- Normalized rod/wand/staff charged powers to valid Foundry item document types.
- Added AI-service repair for obvious missing `kind`, one-power charged items, consumed healing potions, and known weapon base damage.
- Skipped unsafe object-shaped or advantage/disadvantage save-bonus Active Effect values instead of creating roll-breaking effects.
- Added the `2.23.0-test.1` package-identity migration build.
- Changed the install identity to `dungeon-masters-forge`, migrated legacy settings, and retained read compatibility for legacy generated-item flags.
- Added the `2.22.0-test.5` tester build for service `1.6.0`.
- Displayed safe structured remote error messages, error codes, and request IDs instead of reducing service failures to a bare HTTP status.
- Removed obsolete user-facing planning-tier warnings; no launch-day feature gates are active.
- Added a disabled-by-default Free Forge release configuration for a baked HTTPS endpoint.
- Enabled private release builds to select Free Forge automatically on first launch without endpoint or token entry.
- Unified remote connection checks and compilation across Bring Your Own API and Free Forge providers.
- Kept the public source configuration disabled until a stable hosted endpoint completes launch verification.

## 2.21.12 - 2026-07-01

- Added HTTP endpoint support for Tailscale's private `100.64.0.0/10` address range.
- Kept HTTPS mandatory for addresses immediately outside the Tailscale range and for public remote providers.

## 2.21.11 - 2026-07-01

- Removed the structural collision between Foundry's standard-form notes rule and the Settings section introductions.
- Replaced the legacy three-column provider container with a settings-specific stacked container so API fields remain full width even without custom styling.

## 2.21.10 - 2026-07-01

- Replaced the cramped three-column API configuration strip with full-width endpoint, model, and token rows.
- Increased API input height so long endpoints and model names remain readable in the standard Settings window.

## 2.21.9 - 2026-07-01

- Fixed settings-form discovery when Foundry renders the form itself as the application root, covering provider drafts and explicit saves.
- Fixed the oversized blank gaps caused by Foundry's global notes layout and tightened the Settings section, field, and footer spacing.
- Bumped the module build so Foundry reloads the corrected Settings stylesheet instead of retaining its cached predecessor.

## 2.21.8 - 2026-07-01

- Restored a standard Save Settings action to Forge Settings after the cosmetic redesign removed the visible save controls.
- A successful Bring Your Own API connection check now saves the verified provider, endpoint, model, and remembered-token preference before returning to the Forge.
- Updated the local-service endpoint guidance to `http://localhost:8788/v1/forge/compile`.

## 2.21.7 - 2026-07-01

- Added compact per-item review-note badges to the Result cards so the Description and Result panes stay focused on the item preview instead of long note blocks.
- Kept the full warning, assumption, manual, unresolved, and reference text in the footer disclosure so no review detail is lost.

## 2.21.6 - 2026-06-30

- Fixed the Forge compile flow to use the live Bring Your Own API draft from the open Forge Settings window instead of silently falling back to older saved provider values.
- This removes the stale endpoint/model trap during live testing when the connection panel is already open and being edited.

## 2.21.5 - 2026-06-30

- Expanded the read-only DND5e system content resolver to explicitly prefer 2024 spell, equipment, actor, monster feature, and roll-table collections while still supporting system-owned legacy packs when needed.
- Added exact-name diagnostics and source tests for system actors, monster features, and roll tables using real DND5e-native content names.
- Let review enrichment surface system-actor provenance for summon specs when they point at an existing DND5e actor instead of a Forge-generated summon shell.

## 2.21.4 - 2026-06-30

- Fixed Forge Settings event binding when the application template root is the form itself, restoring provider switching, connection checks, utility buttons, and planning-tier saves in the live window.
- Added a regression assertion covering the root-form listener binding used by the settings application.

## 2.21.3 - 2026-06-30

- Added a reusable remote service-status preflight that checks health and capabilities together before Bring Your Own API compilation.
- Reused that shared service check in Forge Settings and the main compile flow so network generation reports version, mode, compatibility, and rate allowance before compile requests fire.
- Fixed the Forge provider summary so it reflects the latest checked remote connection instead of falling back to a generic ready state.

## 2.21.2 - 2026-06-29

- Added roadmap coverage for optional bespoke item-icon image generation.
- Synced the packaged module contents after the crash so the installed archive and roadmap match the current workspace.

## 2.21.1 - 2026-06-29

- Fixed a Foundry runtime parsing error in the Forge provider configuration defaults that prevented the module script from loading in-browser.
- Repackages the Forge Settings and cosmetic refresh work as a clean follow-up build for live verification.

## 2.21.0 - 2026-06-29

- Moved provider selection, Bring Your Own API settings, diagnostics, and the example loader into a dedicated Forge Settings panel in Foundry's configuration flow.
- Added direct Forge Settings shortcuts from the Forge window, Items directory header controls, and Items directory inline controls.
- Renamed the split panes to **Description** and **Result** and refreshed the Forge's visual styling with stronger red-accented headers and settings cards.

## 2.20.0 - 2026-06-29

- Replaced the tabbed Describe/Review workflow with a split-pane layout so prompt editing and review stay visible together.
- Widened the default Forge window and kept a stacked fallback for narrower layouts.
- Preserved the existing compile, validate, diagnostics, and create flow while updating in-dialog focus behavior to target the relevant pane.

## 2.19.1 - 2026-06-29

- Enriched Review summaries with read-only system Spell and Equipment provenance when the resolver finds compatible native DND5e matches.
- Keeps native references visible during approval without changing item creation behavior.

## 2.19.0 - 2026-06-29

- Added a read-only DND5e system content resolver for exact-name Spell and Equipment lookup.
- Returns source UUID provenance, pack label, document type, and compatibility details without importing or mutating system documents.
- Added non-destructive system-content diagnostics for Command, Flame Strike, Longsword, and Plate Armor.

## 2.18.1 - 2026-06-29

- Recognizes legacy Foundry AI bridge roots that expose `/api/compile` without a standard `/health` endpoint.
- Reports legacy-bridge connection status more clearly while preserving compile support.

## 2.18.0 - 2026-06-29

- Added a **Check Connection** action for Bring Your Own API providers.
- Distinguishes offline-ready, mock-connected, and OpenAI-connected provider states before compilation.
- Added remote health-route discovery and API helpers alongside existing capabilities checks.
- Exposed provider health normalization and health requests through `forge.providerContract`.

## 2.17.1 - 2026-06-28

- Allowed HTTP provider endpoints on RFC 1918 private IPv4 addresses for trusted LAN development setups.
- Retained mandatory HTTPS for public remote endpoints.

## 2.17.0 - 2026-06-28

- Added an explicit **Save Connection** action for provider settings.
- Added opt-in client-side API-token persistence with a trusted-device warning; session-only storage remains the default.
- Added clearer HTTP 401, 403, 404, and 429 provider errors, including server-provided retry timing.

## 2.16.0 - 2026-06-28

- Added explicit optional capabilities discovery for compatible Forge `1.0` provider endpoints.
- Validates remote schema, safety policy, and shared item-family support before an opted-in compile.
- Intersects client and provider item families without weakening normal response validation or review.
- Preserves legacy providers that omit capabilities discovery or use nonstandard endpoint paths.
- Preserves remote prompt-version provenance in compiler results.

## 2.15.0 - 2026-06-27

- Enabled the Bring Your Own API provider through the versioned Forge remote-provider contract.
- Added endpoint, model, and session-only API token controls to the Describe workflow.
- Persisted endpoint and model as client settings while keeping API tokens out of Foundry settings and diagnostics.
- Gated remote compilation on provider readiness and retained normal Foundry validation and explicit approval before creation.
- Added mocked provider-adapter coverage without making real network requests or using credentials.
- Kept Hosted Forge disabled pending authentication, rate-limit, and abuse-protection work.

## 2.14.0 - 2026-06-27

- Replaced the JSON-first review with readable per-item summaries for mechanics, uses, effects, activities, summons, and unresolved clauses.
- Moved raw JSON into an Advanced specification editor while preserving exact spec editing.
- Grouped compiler assumptions, warnings, deferred handling, and unresolved mechanics with the affected item.
- Required current-session validation before review approval can enable item creation.
- Added eighteen review-summary checks and expanded the usability contract suite to fourteen checks.

## 2.13.0 - 2026-06-27

- Fixed clipped Forge content by keeping the workflow scrollable and the status and action areas visible.
- Split footer actions by workflow step so Describe and Review each show only relevant commands.
- Disabled item creation until explicit review approval and reset approval whenever specifications are edited.
- Clarified output, replacement, specification, and approval labels without changing generation behavior.

## 2.12.0 - 2026-06-27

- Added versioned, portable provider configuration profiles.
- Profile export includes only persistable endpoint, model, and review-policy fields.
- Profile parsing rejects secret, session-only, unknown, malformed, and wrong-version data.
- Added thirteen provider profile round-trip and rejection checks.

## 2.11.0 - 2026-06-27

- Added future Bring Your Own API configuration metadata without enabling network compilation.
- Classified endpoint, model, and review policy as client-persistable configuration.
- Classified API tokens as secret, session-only configuration that cannot enter saved settings.
- Added redacted diagnostic partitions and provider readiness reports.
- Added thirteen provider configuration persistence, redaction, and readiness checks.

## 2.10.0 - 2026-06-27

- Added version-aware source labels for generated items and summon actors.
- Migrates only Forge-managed legacy source labels while preserving custom campaign labels.
- Replaced legacy `beta` provenance flags with the exact installed engine version.
- Updated the bundled example name to remove the old v0.1 label.
- Added ten build-version, source-label migration, and custom-label preservation checks.

## 2.9.0 - 2026-06-27

- Added a visible Diagnostics command to the Forge window.
- Runs six high-risk request families through both compiler checks and Foundry spec validation.
- Displays per-pattern pass/fail results and confirms that no world documents were created.
- Added asynchronous `forge.diagnosticsWithValidation()` for module integrations.

## 2.8.1 - 2026-06-27

- Added non-destructive `forge.diagnostics()` coverage for six high-risk compiler families.
- Added a 14-family supported-pattern compilation matrix.
- Added exact unresolved-clause provenance to the built-in health report.

## 2.8.0 - 2026-06-27

- Added the versioned `1.0` remote-provider request and response contract.
- Added HTTPS and loopback endpoint validation with credential-in-URL rejection.
- Added recursive provider-configuration secret redaction.
- Added timeout, HTTP failure, JSON parsing, and response-envelope safeguards.
- Exposed the disconnected contract through `forge.providerContract` for development and mocked integrations.
- Added 18 remote transport and malformed-response regression cases.

## 2.7.1 - 2026-06-27

- Fixed unresolved-mechanic provenance when a category word such as "Aura" appears in the item title.
- Added regression coverage requiring the actual mechanic clause instead of the title line.

## 2.7.0 - 2026-06-27

- Added a provider-neutral compiler registry and asynchronous `compileWithProvider` API.
- Added Local Rules, Bring Your Own API, and Hosted Forge provider definitions with honest availability states.
- Added provider selection and unresolved-mechanic policy controls to the Describe workflow.
- Added a strict policy that blocks creation while unresolved mechanics remain.
- Preserved the original synchronous `compile` API for existing macros.
- Added provider registry, configuration, unavailable-provider, and compatibility regression coverage.

## 2.6.0 - 2026-06-27

- Added structured `unresolvedMechanics` records for deferred ally auras, class resources, and unmapped spells.
- Added a dedicated unresolved-mechanics review section and per-item review counts.
- Preserved unresolved records on created item flags for later inspection or provider upgrades.
- Prevented ally-aura bonuses from being miscompiled as personal passive effects.
- Added validation and regression coverage for the unresolved-mechanic contract.

## 2.5.0 - 2026-06-27

- Added deterministic hybrid artifact compilation for the proven Stormfire Reaver family.
- Kept weapon damage, passive AC, token-light toggling, and Flame Strike as separate mechanics and activities.
- Added explicit parsing for bright and additional dim light radii.
- Added regression coverage preventing activated spell damage from leaking into normal weapon attacks.

## 2.4.0 - 2026-06-26

- Added deterministic native weapon-enchantment compilation for one-use extra-damage oils.
- Added deterministic equipment attack activities with range, ability, proficiency, damage, and optional charge consumption.
- Added regression coverage for the proven Oil of Ember Edge and psionic equipment-attack families.

## 2.3.0 - 2026-06-26

- Added deterministic multi-spell compilation for the proven Ice Storm and Cone of Cold shared-charge pattern.
- Added deterministic multi-profile fiend summoning with selectable Demon, Devil, and Yugoloth actors.
- Added per-spell charge costs, canonical save activities, shared recovery, and stable activity/profile IDs.
- Added regression coverage for both advanced request families.

## 2.2.0 - 2026-06-26

- Added multi-item natural-language compilation using `---` separator lines.
- Added automatic batching for repeated `Item name:` request blocks.
- Preserved per-item compiler decisions and prefixed batch review notes with the affected item name.
- Updated the Forge request editor and status messages for batch creation.
- Added regression coverage for separator-based and field-based batches.

## 2.1.1 - 2026-06-26

- Recognize both `cast` and `casts` when routing known spells through their dedicated activity mappings.
- Added regression coverage for the natural phrasing "it casts Command."

## 2.1.0 - 2026-06-26

- Added a natural-language Describe workflow with a deterministic local compiler.
- Added editable generated-spec review, compiler assumptions, warnings, and deferred-mechanic notes.
- Added explicit review approval before world-document creation.
- Added local mappings for common weapons, passive equipment, charged healing and save damage, cat and wolf summons, Clairvoyance, and Command.
- Added `forge.compile(request)` to the module API.
- Added request-compiler regression coverage for six confirmed workflow shapes.

## 2.0.0 - 2026-06-26

- Renamed the release and visible module to Dungeon Master's Forge V2.
- Scoped utility Item Macros to their own rolled activity.
- Allowed scripted utility activities to opt out of magic-availability filtering.
- Migrated legacy Forge settings and folder names to their V2 labels.

## 0.1.2 - 2026-06-26

- Added Item Macro commands to utility activities.
- Added Midi-QOL activity registration for scripted utility powers.
- Added support for resource-restoring item abilities such as Monk Ki or Focus recovery.

## 0.1.1 - 2026-06-26

- Renamed the visible product to Dungeon Master's Forge.
- Added a GM-only hammer button directly to the Items directory search bar.
- Preserved prior package settings and generated-item data for compatibility.

## 0.1.0 - 2026-06-26

- Packaged the confirmed beta item factories as a Foundry VTT module.
- Added a GM-only Item Directory header control.
- Added JSON spec loading, validation, preview, and world-document creation.
- Added configurable item and summon actor folders.
- Exposed `open`, `validate`, `create`, and `example` through the module API.
- Preserved the tested DND5e v5.3.3 activity, summon, enchantment, effect, Item Macro, and Midi-QOL patterns.
