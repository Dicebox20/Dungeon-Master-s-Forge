# Dungeon Master's Forge Roadmap

## Stable Baseline

- Foundry VTT v14 / DND5e v5.3.3 module integration.
- Route each mechanic by capability: use native Foundry VTT and DND5e data when it fully expresses the request and remains reliable; prefer verified Midi-QOL, DAE, Item Macro, or related layers when they provide the needed timing, targeting, reaction, condition, concentration, or workflow behavior; fall back to portable core data with a clear review note when the preferred layer is unavailable or unverified.
- JSON specification validation, preview, and item creation.
- Weapons, equipment, consumables, effects, charges, attacks, saves, healing, enchantments, summons, conditions, and scripted token-light powers.
- GM-only Items directory launcher and reusable module API.

## Implemented: Request-to-Spec V1

- Natural-language request editor in the Forge window.
- Deterministic local provider for common confirmed item patterns.
- Mechanical assumptions, automation limits, and dependency warnings.
- Editable generated specifications before creation.
- Validation and explicit approval before writing world documents.
- Provider-neutral `compile` API for future AI adapters.
- Non-destructive in-world diagnostics for high-risk compiler families. Added in the 2.9 release.
- Private Forge provenance flags with custom-label preservation. Added in the 2.10 release; new item sheets no longer show a Forge source label.

## In Progress: Request-to-Spec V2

- Support multiple item requests in one compilation. Added in the 2.2 release.
- Expand deterministic mappings for enchantments, multi-profile summons, multi-spell items, attack activities, and hybrid artifacts. Multi-profile fiends and the proven Ice Storm/Cone of Cold shared-charge pattern arrived in 2.3. Native extra-damage oils and equipment attack activities arrived in 2.4. The proven Stormfire Reaver hybrid artifact family arrived in 2.5.
- Add structured fields for unresolved mechanics instead of description-only fallback. Added in 2.6 for ally auras, class resources, and unmapped spells.
- Add a provider selector and provider configuration UI. Added in 2.7 with Local Rules active and future providers registered as unavailable.

## Planned: Native Multi-Profile Summon Breadth

- Keep explicit selectable Actor profiles as the Beta V1 baseline. Current Foundry rendering supports named profiles, per-profile counts, a selection prompt, and several summon activities inside equipment suites.
- Add CR-filtered summon pools using native `summon.mode = "cr"`, creature-type filters, CR ceilings, and reviewed count formulas instead of expanding every eligible Actor UUID.
- Add spell- or character-level profile gates through native `profiles[].level.min` and `profiles[].level.max`, with visible preview notes explaining which profiles are currently available.
- Add random profile resolution for Bag-of-Tricks-style items using native no-prompt summon activities plus a controlled random/table result; do not substitute a player choice for an explicitly random result.
- Add dynamic-profile summon activities for captured or GM-selected creatures. Empty profiles must remain a clear review state until a safe Actor UUID is supplied.
- Keep 2014 and 2024 rules implementations distinct. Check system-owned source metadata before routing a named spell to Actor summoning because newer versions may create an area or abstract effect instead.
- Use the installed DND5e summon schema as the contract for bonuses, matching, counts, CR, level gates, creature filters, prompt behavior, and temporary hit points; do not copy protected rules text into Forge fixtures.

## In Progress: System Content Resolution

- Read-only exact-name Spell and Equipment lookup from system-owned DND5e packs. Added in 2.19.
- Source UUID provenance and compatibility reporting without importing compendium documents. Added in 2.19.
- Prefer system-native SRD spell activity shapes for exact-name spellcasting items when Foundry's DND5e schema can safely support it, mirroring the useful parts of dragging a spell onto an item and then applying reviewed item-specific overrides.
- Add charge-scaled spell item support where shared-charge items default each spell's charge cost to the spell level, with extra charge spend preserved as upcast/scaling review data.
- Prefer available SRD spells before creating placeholder spell utilities when a prompt requests unnamed spells "of your choice"; surface review notes when no safe SRD match is available.
- Refine SRD-native item art reuse so previews and created items prefer valid system content images and never request `/undefined`.
- Expand native resolution to actors, monster features, and roll tables after Spell and Equipment validation is proven.

## In Progress: Release Submission Readiness

- Prepare the public package for Foundry's AI Tools category as a user-prompted runtime item creation tool, not a rules replacement or bundled content pack.
- Prepare a staff-facing submission brief that explains DMF's runtime AI usage, review-before-create safety model, hosted-vs-BYO provider lanes, and why the package belongs in the `AI Tools` category.
- Keep test manifest URLs on the dedicated tester branch for `manifest`, `download`, `readme`, and `changelog`.
- Prepare a stable release manifest and GitHub release zip before public Foundry submission.
- Confirm final package description is human-written and explains that the Dungeon Master writes the idea, reviews the result, and approves creation.
- Prepare a human-authored Foundry listing packet: short description, long description, support links, screenshots, demo prompts, known limitations, and moderation/abuse wording.
- Confirm installation from the final manifest in a clean Foundry world.
- Confirm module folder/id alignment, compatibility values, release zip structure, README links, CHANGELOG links, and package metadata.
- Use real screenshots for the official Foundry listing and avoid generated promotional board images as official package media.
- Create public demo videos that show the prompt, preview, approval, created item sheet, details, activities, effects, charges, rolls, chat output, and review notes.

## Implemented: Usability V1

- Keep status and action regions visible while the active workflow panel scrolls. Added in the 2.13 release.
- Show only relevant commands in the Describe and Review steps. Added in the 2.13 release.
- Gate item creation behind explicit approval and revoke approval after specification edits. Added in the 2.13 release.
- Preserve responsive layouts for narrow Forge windows. Added in the 2.13 release.

## Implemented: Usability V2

- Lead Review with readable per-item mechanics instead of raw JSON. Added in the 2.14 release.
- Keep the exact JSON specification available in a collapsed Advanced editor. Added in the 2.14 release.
- Place assumptions, warnings, deferred handling, and unresolved mechanics with the affected item. Added in the 2.14 release.
- Require current-session validation before approval can enable creation. Added in the 2.14 release.

## In Progress: AI Providers

- Versioned remote request/response contract, endpoint safeguards, and secret redaction. Added in the 2.8 release.
- Provider configuration persistence boundaries and session-only secret classification. Added in the 2.11 release.
- Secret-free provider configuration profile export/import contract. Added in the 2.12 release.
- Bring Your Own API adapter, configuration UI, readiness gating, and mocked transport tests. Added in the 2.15 release.
- Remote health checks and mock-vs-live connection verification. Added in the 2.18 release.
- Disabled-by-default Free Forge release configuration and automatic first-launch provider selection for private hosted builds. Implemented in workspace; public activation waits for a stable HTTPS hostname.
- Hosted generation service with production authentication and abuse protection.
- Server-side secrets, usage limits, logging controls, and abuse protection.
- Optional item-image generation after text generation is stable.
- Approved usage model: hosted allowances will be based on measured per-user Forge compute usage,
  with transport-byte telemetry for capacity planning. Free Forge keeps safe proven item families;
  future hosted tiers add capacity and convenience rather than paywalling basic mechanics. See
  `docs/research/USAGE_METERING_MODEL_2026-07-22.md`.
- Paid-capacity foundation: Supporter and Founding Patron share one bounded monthly Forge Capacity
  entitlement, selected by a server-signed session token. The temporary elevated Free Forge tester
  allowance remains separate and unchanged. Manual provisioning is the controlled first step; Patreon
  OAuth/webhook synchronization remains a follow-up after the entitlement path is tested.
- Next patch UI: show hosted usage as a player-friendly `Forge Capacity` percentage in the main DMF
  window. Count down capacity after each successful hosted generation and repair, explain that
  complex items consume more than simple items, and avoid exposing raw kilobytes, provider tokens,
  or internal usage units to ordinary players. Keep the indicator green above 25%; at 25% and below,
  turn it yellow and show the Blacksmith low-capacity messages from the usage-metering specification.
- Opt-in remote error report uploads to the hosted Droplet, with explicit GM consent, API-key redaction, prompt/item/world-data exclusion by default, request limits, and retention controls.
- Keep Bring Your Own API outside hosted Free Forge usage accounting when the request is funded with client-provided provider credentials.
- Keep rejected BYO provider credentials distinct from exhausted hosted Free Forge usage allowances when no BYO credential is present.
- Confirm health and diagnostics output clearly distinguish hosted/free-tier mode from private/BYO behavior.
- Reject or downgrade abusive or impossible requests, such as mass-casting hundreds of spells at once, instead of blindly creating unsafe item data.

## In Progress: Compatibility Route and Compositional Coverage

- Continue testing all 14 compatibility renderer routes: `weaponExtraDamage`, `chargedSaveDamage`, `passiveEffectEquipment`, `chargedHealing`, `weaponConditionOnHit`, `shieldArmorBonus`, `multiActivityStaff`, `nativeEnchant`, `nativeSummon`, `nativeMultiProfileSummon`, `casterUtilityEquipment`, `equipmentPowerSuite`, `legendaryEquipmentSuite`, and `artifactWeaponHybrid`.
- Test safe mechanics composition across those routes instead of treating the route list as the full capability ceiling.
- Rotate mixed-item tests across simple melee weapons, martial melee weapons, ranged weapons, polearms, finesse weapons, heavy weapons, shields, light armor, medium armor, heavy armor, caster gear, consumables, summons, and enchantments.
- Keep duplicate failed-test entries when they represent unresolved bugs or release blockers.

## Planned: Beta V1 Verification Harness

- Make `docs/BETA_V1_MANUAL_VERIFICATION_STANDARD.md` the required evidence process for Free Forge readiness testing.
- Add a GM-only, opt-in harness bounded to a dedicated `DMF Verification Actor` and tagged test folders; never use campaign Actors or perform broad cleanup.
- Compare approved created documents against deterministic scenario expectation cards and capture compact pass/warn/fail evidence for type, activities, effects, uses/recovery, targeting, damage, saves, conditions, summons, and attunement.
- Allow GM-triggered safe item use probes, but prohibit automatic target selection, token placement, macro/script execution, Scene/Region writes, and automatic migrations.
- Record structural, partial/safely degraded, and full-function outcomes separately; only actual document-plus-use verification advances Beta V1 readiness.

## Planned: Language Refinement

- Add and maintain a focused Free Forge language-regression pack covering common D&D shorthand, casual action phrasing, abbreviations, and player slang without treating ambiguous narrative language as guaranteed automation.
- Normalize proven item-mechanics aliases such as "once a day," "pop a charge," "bamf," "shrug off," "one-and-done," "on a hit," and informal summon wording before provider output is validated.
- Keep campaign and table jargon such as BBEG, TPK, RAW, RAI, nova, mook, and homebrew as contextual vocabulary unless a prompt gives enough mechanical detail to map it safely.

## Planned: Preview Navigation Refinement

- Move the `</> Advanced Specification Editor` control into the preview tab row beside `Visual Preview` and `Automation Code`, keeping it available as a third review surface without consuming a separate scrolling section above the item preview.
- Next patch UI copy: rename the `Advanced Specification Editor` tab and accessible label to `Edit File`; keep the existing specification editor behavior unchanged.
- Next patch repair-dialog copy: replace the long explanation with `Describe what your item was supposed to do, and how it failed` followed by `Re-review Forge Window before sending repair request`.
- Preserve the existing explicit review boundary: editing the specification must invalidate validation and approval until the changed data is validated again.

## Priority: Universal User-Confirmed Repair Rerun

Detailed implementation and acceptance plan: `docs/NEXT_LARGE_PATCH_REPAIR_RERUN_PLAN.md`.

The module and private service already implement the reviewed repair flow, but the public Free Forge service does not yet advertise it. Make this the next hosted-service priority before inviting broad public input so every supported network provider lane gives testers the same visible behavior. The separate user-facing failed-item report button and dialog remain removed.

- Keep the original prompt and compilation provenance behind the unchanged-request `Retry` action.
- Require a confirmation dialog before the second provider run. Show the item name, provider lane, expected usage cost, and the bounded payload that will be sent: original prompt, user repair notes, current reviewed spec JSON, review notes, and deterministic validation findings.
- Next patch UI refinement: remove the duplicated original-prompt field from the resend dialog. The original prompt remains readable in the main Forge window, while the resend dialog contains one editable repair-notes text box with most of the window height and minimal secondary controls.
- Preserve correct mechanics by instructing the repair pass to change only the identified issue, then run the complete contract and Foundry-spec validation again before returning a new preview.
- Never auto-create the repaired result. Require a fresh review and approval, and stop after one user-confirmed repair attempt; use the immediate evidence snapshot process for recurring or still-broken results.
- Reuse the report evidence schema with an explicit `repair-attempt` mode, including previous request/spec fingerprints, attempt number, user notes, redacted findings, and before/after review summaries. Do not transmit tokens, world documents, Actors, Scenes, Regions, raw console data, or provider secrets.
- Keep the bounded server retry for malformed model output separate from this user-confirmed repair flow. A repair is a new usage-metered provider request, not a hidden retry or quota bypass.
- Add regression coverage for confirmation/cancel behavior, one-request-only execution, redaction, spec preservation, fresh approval gating, quota/cache accounting, repair evidence parity, and loop prevention.
- Promote the capability advertisement and repair-attempt contract to the public Free Forge service only after private-service, module, quota, cache, and Foundry-harness checks pass. The temporary Dice Box Group rollout has completed that service smoke check with permissive internal ceilings; restore final public guidelines and data-based allowance metering before broader access.

## Planned: Advanced Automation Contracts

The prompt and capability matrix is recorded in `docs/research/advanced-automation-failure-matrix-2026-07-22.md`, with copy/paste prompts in `testing/BETA_V1_ADVANCED_AUTOMATION_PROMPTS_2026-07-22.txt`.

- Replace the native-only preference with capability-based routing: use native DND5e when it fully expresses the mechanic, prefer verified Midi-QOL, DAE, or Item Macro behavior when those layers provide better timing, targeting, reaction, condition, concentration, or workflow support, and fall back to portable core data with an explicit review note when the preferred layer is unavailable or unverified.
- Show the selected automation layer, required modules, settings assumptions, and fallback behavior in the preview and review notes before approval.
- Do not add a new automation-only item renderer until three passing cases prove that the existing suite/hybrid renderers cannot preserve the item chassis and reviewed automation metadata.
- Add structured, capability-gated contracts for reaction context, damage-bonus timing, overtime effects, aura membership, allowlisted document links, Region behavior plans, and trusted macro context.
- Keep provider output declarative and reject arbitrary JavaScript, scripts, flags, and invented UUIDs. Generate executable code only from trusted engine templates and show it in the existing automation review surface.
- Add harness expectation cards for reaction cancellation, hit-target filtering, once-per-turn limits, overtime expiry, aura enter/exit, self-token resolution, charge isolation, summon profile selection, and UUID validation.
- Keep Region writes, teleportation, macro execution, and linked-document mutation opt-in and separately confirmed in-world actions.

## Planned: Harness Efficiency Patch

- Expose GM-only SRD-backed fixture actor setup through the isolated harness API, using tagged subject, ally, hostile-save, second-hostile, and durable-hostile actors in `dmf-test-world`.
- Add a fixture reset operation for HP, uses, concentration, conditions, and Active Effects without touching untagged Actors or campaign content.
- Capture a capability snapshot covering Foundry, DND5e, Midi-QOL, DAE, Item Macro, relevant settings, and supported activity types before each run.
- Expand expectation cards to verify activities, damage, saves, targeting, uses, recovery, attunement, conditions, aura origin, concentration, and automation-layer metadata.
- Add a GM-selected safe activity probe that confirms a workflow opens and records resource changes without choosing targets, placing tokens, executing macros, or modifying Scenes and Regions automatically.
- Add an explicit tester-only macro probe through `game.modules.get("dungeon-masters-forge").api.verification.executeMacro({ macroId | macroName, args })`; require the enabled GM and exact `dmf-test-world`, resolve one exact Macro, and return a compact execution report without auto-running item workflows or provider output.
- Record attached `macroData` activities and `flags.midi-qol.onUseMacroName` in harness snapshots so structural automation evidence can distinguish metadata, attachment, and live execution.
- Gate trusted local macro materialization through `module/scripts/automation-execution.js`; missing settings must produce a review fallback rather than a misleading executable preview.
- Produce compact evidence bundles containing the prompt, provider, run tag, JSON summary, review categories, expectation diff, settings snapshot, and new console entries.
- Add fresh-tag replay controls to distinguish cache behavior from deterministic failures and compare Local Rules, Free Forge, and Bring Your Own API results.
- Add a repair-loop evidence mode that records the original result, repair note, returned result, fresh approval state, and one-request-only boundary.
- Validate user-supplied UUID references against document type, world, Scene, permission, and stale-reference boundaries without following model-invented UUIDs.
- Audit Forge ownership flags and provide cleanup summaries that remove only documents bearing the selected run tag.
- Keep the current macro as a fallback until the harness API fixture path is installed and proven in the dedicated Foundry world.

## Planned: Bounded Helpful Defaults

- Make hosted and Local Rules providers use the same conservative inference policy for omitted, non-dangerous numeric and timing details, while keeping every inferred choice visible in Review Notes as an assumption.
- When a reusable charged item does not specify a maximum, choose a bounded rarity-based pool: common/uncommon 3, rare 5, very rare 7, and legendary/artifact 10 charges. Default recovery is all charges daily at dawn unless the prompt specifies a rest or recovery formula.
- When an activated charged activity omits its cost, use 1 charge unless a trusted named-spell profile supplies a different standard cost. When a safe save DC is omitted, use the rarity-based default already used by the local compiler and disclose it.
- Continue inferring safe chassis details such as a standard action activation, one-hour summon duration, +1 magical bonus for an otherwise unspecified magic weapon, and one-use consumption where the prompt clearly describes a consumable.
- Do not infer ambiguous or campaign-affecting behavior: allies or aura scope, custom conditions, class-resource storage, arbitrary spell scaling, target selection, teleportation, Scene/Region changes, scripts, or executable automation remain review/deferred cases.
- Add cross-provider tests proving identical defaults, item-specific assumption notes, explicit-value precedence, bounded charge caps, and continued blocking of unsafe ambiguity.

## Release Blockers From Testing

- Fix preview image fallback so missing images use a valid fallback icon or omit the image, and never request `/undefined`.
- Fix activity creation failures caused by missing `kind` values; infer or repair obvious families before rejecting model output.
- Fix armor-vs-shield routing so plate, leather, breastplate, chain mail, scale mail, and similar armor requests are not created as shields unless the prompt explicitly says shield.
- Fix wand/rod/staff mapping so charged caster implements preserve wand, rod, or staff identity while using valid Foundry DND5e item document types.
- Fix area target mapping for cones, lines, spheres, radius effects, and cubes so activity target data is written into Foundry data instead of description-only notes.
- Fix `weaponConditionOnHit` outputs that omit base weapon damage; repair known base damage from weapon name/type before item creation.
- Fix single-use consumed healing items so potions can consume correctly without invalid recovery data.
- Recheck selective save advantage active-effect syntax for malformed save roll terms, including Constitution and Dexterity save advantage.
- Keep forced movement automation as a reviewed/manual mechanic until a reliable and safe automation path is proven.
- Improve single charged save/damage routing so one-power wands do not get misclassified as multi-activity staves requiring multiple activities.

## Planned: Capability-Based Automation Routing

- Production template contracts now live in `ai-service/src/automation-templates.mjs` and `module/scripts/automation-templates.js`; use `docs/research/automation-architecture-possibility-2026-07-23.md` and `testing/AUTOMATION_TEMPLATE_CATALOG_2026-07-23.txt` when promoting a planned capability.
- Treat natural-language automation translation as its own versioned layer. Maintain an allowlisted term map and canonical intermediate representation before strict contract validation; map unknown or ambiguous wording to review rather than expanding the validator.
- Use `docs/research/automation-capability-taxonomy-2026-07-23.md` to classify prompt mechanics independently from item families and to assign questionnaire category IDs before adding a new renderer.
- Use native DND5e activities, uses, effects, saves, damage, summons, and enchantments whenever they fully express the requested mechanic and remain reliable.
- Prefer the verified Midi-QOL, DAE, or Item Macro route when the mechanic needs workflow timing, target confirmation, reactions, condition application, concentration, or other behavior that core data cannot express reliably.
- Advertise the selected automation layer, required modules, settings assumptions, and fallback before approval. Recipes that truly need a combination, such as the current condition-on-hit hook, must list every dependency rather than silently coupling unrelated settings.
- Preserve portable core data when an advanced route is unavailable or unverified, and add a review note that names the missing layer and the remaining manual step.
- With the required layers active, supported condition riders apply standard DND5e conditions after failed saves and expire through combat-round Active Effect durations; outside combat they use elapsed seconds.
- Add optional summon-creature scaling from the summoner's character level, with the level-derived AC, hit points, attacks, and save values visible for GM review before creation.
- Generate reviewed Midi-QOL hooks for proven patterns such as post-hit conditions, post-active-effects workflows, save/damage riders, and separate Item Macro activities.
- Detect and report required companion modules such as DAE and Item Macro instead of silently creating incomplete automation.
- Keep core data valid when a module layer is absent, disabled, unsupported, or not requested; do not treat that fallback as proof that the advanced behavior was implemented.
- Add enabled/disabled compatibility fixtures, non-destructive diagnostics, and regression tests against the supported Foundry v14 / DND5e v5.3.3 / Midi-QOL version matrix.
- Add migration and validation warnings for deprecated Midi-QOL flags or hooks before generated items are written.
- Keep ally auras outside this track until a compatible aura engine is available and separately verified.

## Experimental: Native Scene Region Forge

- The first GM-only Scene Region workflow is implemented separately from the 14 Free Forge item families and uses the V2 preview/approval model.
- The experimental workflow enhances one selected Region with allowlisted native behavior types; geometry creation and linked workflows remain deferred until this phase is proven.
- Use native Region teleportation for reviewed pocket dimensions, maze transfers, stairs, elevators, portals, return zones, and fail states instead of making Monk's Active Tile Triggers the default dependency.
- Use native Active Effect, movement cost, darkness, weather suppression, scrolling text, pause, level, and toggle behaviors where they fully express the requested mechanic.
- Keep arbitrary script generation prohibited. Existing GM-selected Macro UUIDs may be referenced only through an explicit reviewed workflow.
- Keep Midi-QOL, DAE, Item Macro, and Monk's Active Tile Triggers as optional compatibility layers for mechanics that native Regions do not replace.
- The first Region implementation ships behind a disabled-by-default experimental world setting and does not automatically migrate existing worlds.
- Follow the staged contract, migration inventory, security boundaries, and test matrix in `docs/SCENE_REGION_MIGRATION_PLAN.md`.

## Planned: Master Patreon World And Region Items

- Add reviewed World- and Region-Affecting items to the Master Patreon tier after the native Scene Region workflow is stable.
- Let approved item activities apply allowlisted native Scene Region Behaviors or world-scoped effects without embedding arbitrary scripts or silently changing unrelated Regions.
- Require a clear scope preview, affected Scene/Region list, explicit GM approval, reversible provenance, and safe cleanup before any world- or region-level write.
- Keep portable item mechanics in Free Forge; reserve these broader environment-changing workflows for the Master tier because they require additional validation, reconciliation, and support.

## Planned: UUID-Linked Item And Region Behaviors

- Explore a prompt workflow that creates a reviewed item and a separate reviewed Region-behavior artifact, with optional references to user-selected Actors, Items, Regions, Doors, Locks, or other supported Foundry documents.
- Add a GM-only `Capture UUIDs` mode that lets the GM click or select supported canvas documents, including Actors/Tokens, Tiles, Walls/Doors, and Regions, then inserts a clearly marked reference block with each document's UUID, name, type, and Scene context into the prompt. Token capture must distinguish the embedded Token UUID from its linked Actor UUID, and Wall capture must identify door data without granting write access.
- Keep capture read-only and explicit: show the selected references before insertion, allow removal one at a time, reject documents outside the active world/Scene permission boundary, and never collect unrelated canvas data or follow hidden UUIDs automatically.
- Treat UUIDs as user-owned references or post-creation results, never as AI-invented identifiers. Foundry assigns the created item's final UUID only after creation, so the workflow must bind the returned item UUID to the behavior artifact after approval or use a clearly marked placeholder.
- Show every referenced UUID, resolved document name/type, permission check, affected Scene/Region, and proposed relationship in the preview before either write occurs.
- Keep item creation and Region/world mutation as separate approvals. Creating the item must remain possible without applying the Region behavior.
- Prefer the most reliable allowlisted Region capability and reviewed document links. Use native Region Behaviors when they fully express the mechanic; use a verified module route when it supplies required behavior; otherwise preserve the portable result with a review note. If a macro is necessary, generate it as a separate reviewed artifact with a distinct acknowledgement, bounded UUID inputs, no arbitrary model code, and no automatic execution.
- Present the reviewed macro in the Forge preview window with an `Execute Macro` button, a separate `Reviewed` acknowledgement checkbox, and a compact `</>` button that expands the complete macro code for inspection. Keep `Execute Macro` disabled until the GM expands or otherwise views the code, checks `Reviewed`, and confirms the target UUIDs, resolved documents, and proposed behavior in the final confirmation prompt.
- Require reversible provenance, explicit GM ownership, tagged cleanup, and a clear confirmation before adding behavior to the selected Region. Never alter unrelated campaign documents or silently follow UUIDs embedded in untrusted model output.
- Add tests for UUID validation, document-type and permission boundaries, post-creation UUID binding, selected-Region scope, separate approval, macro restrictions, rollback, and cross-world or stale-UUID failures.

## Documentation And Community Launch Tasks

- Add install instructions for test and release manifests.
- Add "Instructions to set up Bring Your Own API" with plain-language guidance.
- Document the difference between endpoint, Forge-compatible service, and provider credential.
- Explain that private provider credentials should not be shared in chats, screenshots, videos, logs, GitHub, Reddit, Discord, or other public places.
- Document that custom and local endpoints must speak the Dungeon Master's Forge compile contract; local model support is not plug-and-play unless an adapter returns the Forge format reliably.
- Document supported item families, known limitations, review notes, Foundry AI Tools policy framing, roadmap, changelog, and FAQ.
- Prepare a Foundry staff handoff packet with compliance notes, install links, smoke-test notes, and the exact hosted-service behavior expected during review.
- Track future GitHub issue conversion with labels such as `bug`, `release-blocker`, `byo-api`, `item-mapping`, `documentation`, `testing`, `foundry-policy`, and `marketing`.

## Planned: Public Feature Requests

- Choose one canonical public intake link, preferably GitHub Issues or Discussions, so requests can be searched, labeled, prioritized, and connected to releases.
- Create the public feature-request link only when publishing is authorized; do not expose the private Brain Hub organizer or its contents.
- Link the canonical intake page from the tester README, public README, and Patreon/community posts, with a short note explaining what belongs in a feature request versus a bug report.
- Decide whether new submissions need moderation or a template before opening the page to the public.

## Deferred: One-Time Forge Capacity Refill

- Consider a single-payment option that adds hosted Forge Capacity without subscribing to a tier.
- Tie the purchase to a durable account or verified entitlement, never to an anonymous IP digest.
- Refill capacity only; do not unlock item mechanics, bypass review, remove safety boundaries, or raise abuse safeguards.
- Show the purchased amount, expiration or rollover rules, refund/chargeback behavior, and current balance clearly before payment.
- Use a payment provider webhook and an idempotent entitlement ledger so retries cannot grant duplicate capacity.
- Keep Bring Your Own API and Local Rules outside the refill system because they do not consume hosted Forge Capacity.

## Deferred Automation

- Class-specific resource pools such as Monk Ki/Focus, Sorcery Points, Bardic Inspiration, and similar embedded-feature resources.
- Ally-affecting auras until a compatible and reliable aura automation path exists.
- Unsupported narrative clauses remain description or utility-reminder text.

Class-resource automation is deferred because storage differs between rules editions, imported characters, and class-feature implementations. It should return only after the request-to-spec workflow is stable and can identify the actor resource safely.
