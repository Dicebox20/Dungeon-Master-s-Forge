# Dungeon Master's Forge Roadmap

## Stable Baseline: V2

- Foundry VTT v14 / DND5e v5.3.3 module integration.
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
- Non-destructive in-world diagnostics for high-risk compiler families. Implemented in V2.9.
- Version-aware generated-document provenance with custom-label preservation. Implemented in V2.10.

## In Progress: Request-to-Spec V2

- Support multiple item requests in one compilation. Implemented in V2.2.
- Expand deterministic mappings for enchantments, multi-profile summons, multi-spell items, attack activities, and hybrid artifacts. Multi-profile fiends and the proven Ice Storm/Cone of Cold shared-charge pattern were implemented in V2.3. Native extra-damage oils and equipment attack activities were implemented in V2.4. The proven Stormfire Reaver hybrid artifact family was implemented in V2.5.
- Add structured fields for unresolved mechanics instead of description-only fallback. Implemented in V2.6 for ally auras, class resources, and unmapped spells.
- Add a provider selector and provider configuration UI. Implemented in V2.7 with Local Rules active and future providers registered as unavailable.

## In Progress: System Content Resolution

- Read-only exact-name Spell and Equipment lookup from system-owned DND5e packs. Implemented in V2.19.
- Source UUID provenance and compatibility reporting without importing compendium documents. Implemented in V2.19.
- Expand native resolution to actors, monster features, and roll tables after Spell and Equipment validation is proven.

## Implemented: Usability V1

- Keep status and action regions visible while the active workflow panel scrolls. Implemented in V2.13.
- Show only relevant commands in the Describe and Review steps. Implemented in V2.13.
- Gate item creation behind explicit approval and revoke approval after specification edits. Implemented in V2.13.
- Preserve responsive layouts for narrow Forge windows. Implemented in V2.13.

## Implemented: Usability V2

- Lead Review with readable per-item mechanics instead of raw JSON. Implemented in V2.14.
- Keep the exact JSON specification available in a collapsed Advanced editor. Implemented in V2.14.
- Place assumptions, warnings, deferred handling, and unresolved mechanics with the affected item. Implemented in V2.14.
- Require current-session validation before approval can enable creation. Implemented in V2.14.

## In Progress: AI Providers

- Versioned remote request/response contract, endpoint safeguards, and secret redaction. Implemented in V2.8.
- Provider configuration persistence boundaries and session-only secret classification. Implemented in V2.11.
- Secret-free provider configuration profile export/import contract. Implemented in V2.12.
- Bring Your Own API adapter, configuration UI, readiness gating, and mocked transport tests. Implemented in V2.15.
- Remote health checks and mock-vs-live connection verification. Implemented in V2.18.
- Hosted generation service with project access control checks.
- Server-side secrets, usage limits, logging controls, and abuse protection.
- Optional item-image generation after text generation is stable.

## Planned: Midi-QOL Compatibility

- Keep core DND5e activities, uses, effects, saves, damage, summons, and enchantments as the portable baseline.
- Add an optional Midi-QOL compatibility mode that is enabled only when a supported Midi-QOL version is detected and the GM opts in.
- Generate reviewed Midi-QOL hooks for proven patterns such as post-hit conditions, post-active-effects workflows, save/damage riders, and separate Item Macro activities.
- Detect and report required companion modules such as DAE and Item Macro instead of silently creating incomplete automation.
- Preserve clean core-DND5e items with no Midi-QOL flags when Midi-QOL is absent, disabled, unsupported, or not requested.
- Add enabled/disabled compatibility fixtures, non-destructive diagnostics, and regression tests against the supported Foundry v14 / DND5e v5.3.3 / Midi-QOL version matrix.
- Add migration and validation warnings for deprecated Midi-QOL flags or hooks before generated items are written.
- Keep ally auras outside this track until a compatible aura engine is available and separately verified.

## Planned: Founding Tier Scene Mechanics

- Add a Founding Tier track for item-linked and spell-linked scene transfer mechanics that build on the stable V2 item engine instead of replacing it.
- Support reviewed pocket-dimension and maze-style transfers through premade, configurable scene templates rather than unrestricted map generation.
- Add optional Monk's Active Tile Triggers integration for supported transfer, return, exit, and fail-state flows when a compatible version is detected.
- Add early supporter item-icon image generation as an optional premium pass that can create bespoke item icons for generated items without changing the portable mechanical output.
- Generate safe transfer/return utilities for mechanics such as pocket dimensions, cursed keys, Maze variants, banishment-style realm effects, and similar isolated-scene powers.
- Keep all realm-transfer features opt-in, clearly labeled as advanced automation, and separate from the portable baseline item output.

## Deferred Automation

- Class-specific resource pools such as Monk Ki/Focus, Sorcery Points, Bardic Inspiration, and similar embedded-feature resources.
- Ally-affecting auras until a compatible and reliable aura automation path exists.
- Unsupported narrative clauses remain description or utility-reminder text.

Class-resource automation is deferred because storage differs between rules editions, imported characters, and class-feature implementations. It should return only after the request-to-spec workflow is stable and can identify the actor resource safely.
