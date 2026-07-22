# Dungeon Master's Forge Roadmap

## Stable Baseline

- Foundry VTT v14 / DND5e v5.3.3 module integration.
- Prefer native Foundry VTT and DND5e documents, activities, effects, summons, and Scene Region Behaviors before optional module integrations.
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
- Opt-in remote error report uploads to the hosted Droplet, with explicit GM consent, API-key redaction, prompt/item/world-data exclusion by default, request limits, and retention controls.
- Fix Bring Your Own API so client-provided provider credentials bypass hosted public/free-tier monthly quotas and do not count against hosted free-tier limits.
- Add clear separate errors for rejected BYO provider credentials and exhausted hosted free-tier quotas when no BYO credential is present.
- Confirm health and diagnostics output clearly distinguish hosted/free-tier mode from private/BYO behavior.
- Reject or downgrade abusive or impossible requests, such as mass-casting hundreds of spells at once, instead of blindly creating unsafe item data.

## In Progress: Item Family Regression Coverage

- Continue testing all 14 Forge item families: `weaponExtraDamage`, `chargedSaveDamage`, `passiveEffectEquipment`, `chargedHealing`, `weaponConditionOnHit`, `shieldArmorBonus`, `multiActivityStaff`, `nativeEnchant`, `nativeSummon`, `nativeMultiProfileSummon`, `casterUtilityEquipment`, `equipmentPowerSuite`, `legendaryEquipmentSuite`, and `artifactWeaponHybrid`.
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

## Planned: Midi-QOL Compatibility

- Keep core DND5e activities, uses, effects, saves, damage, summons, and enchantments as the portable baseline.
- An optional world setting now enables basic Midi-QOL compatibility only when Midi-QOL is active: generated attacks and targeted saves confirm targets, while charged and summon activities confirm resource use.
- With Item Macro active, supported condition riders apply standard DND5e conditions after failed saves and expire through combat-round Active Effect durations; outside combat they use elapsed seconds.
- Add optional summon-creature scaling from the summoner's character level, with the level-derived AC, hit points, attacks, and save values visible for GM review before creation.
- Generate reviewed Midi-QOL hooks for proven patterns such as post-hit conditions, post-active-effects workflows, save/damage riders, and separate Item Macro activities.
- Detect and report required companion modules such as DAE and Item Macro instead of silently creating incomplete automation.
- Preserve clean core-DND5e items with no Midi-QOL flags when Midi-QOL is absent, disabled, unsupported, or not requested.
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

## Documentation And Community Launch Tasks

- Add install instructions for test and release manifests.
- Add "Instructions to set up Bring Your Own API" with plain-language guidance.
- Document the difference between endpoint, Forge-compatible service, and provider credential.
- Explain that private provider credentials should not be shared in chats, screenshots, videos, logs, GitHub, Reddit, Discord, or other public places.
- Document that custom and local endpoints must speak the Dungeon Master's Forge compile contract; local model support is not plug-and-play unless an adapter returns the Forge format reliably.
- Document supported item families, known limitations, review notes, Foundry AI Tools policy framing, roadmap, changelog, and FAQ.
- Prepare a Foundry staff handoff packet with compliance notes, install links, smoke-test notes, and the exact hosted-service behavior expected during review.
- Track future GitHub issue conversion with labels such as `bug`, `release-blocker`, `byo-api`, `item-mapping`, `documentation`, `testing`, `foundry-policy`, and `marketing`.

## Deferred Automation

- Class-specific resource pools such as Monk Ki/Focus, Sorcery Points, Bardic Inspiration, and similar embedded-feature resources.
- Ally-affecting auras until a compatible and reliable aura automation path exists.
- Unsupported narrative clauses remain description or utility-reminder text.

Class-resource automation is deferred because storage differs between rules editions, imported characters, and class-feature implementations. It should return only after the request-to-spec workflow is stable and can identify the actor resource safely.
