# Changelog

## Unreleased

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
- Removed the obsolete user-facing project planning phase and planning-review warnings; launch-day release plans do not gate module features.
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

- Fixed Forge Settings event binding when the application template root is the form itself, restoring provider switching, connection checks, utility buttons, and planning saves in the live window.
- Added a regression assertion covering the root-form listener binding used by the settings application.

## 2.21.3 - 2026-06-30

- Added a reusable remote service-status preflight that checks health and capabilities together before Bring Your Own API compilation.
- Reused that shared service check in Forge Settings and the main compile flow so network generation reports version, mode, compatibility, and rate allowance before compile requests fire.
- Fixed the Forge provider summary so it reflects the latest checked remote connection instead of falling back to a generic ready state.

## 2.21.2 - 2026-06-29

- Added early release roadmap coverage for optional bespoke item-icon image generation.
- Synced the packaged module contents after the crash so the installed archive, roadmap, and project tier notes match the current workspace.

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
- Kept Hosted Forge disabled pending authentication, access control, rate-limit, and abuse-protection work.

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
- Kept the existing `codex-item-forge` module ID and API path for compatibility.

## 0.1.0 - 2026-06-26

- Packaged the confirmed beta item factories as a Foundry VTT module.
- Added a GM-only Item Directory header control.
- Added JSON spec loading, validation, preview, and world-document creation.
- Added configurable item and summon actor folders.
- Exposed `open`, `validate`, `create`, and `example` through the module API.
- Preserved the tested DND5e v5.3.3 activity, summon, enchantment, effect, Item Macro, and Midi-QOL patterns.
