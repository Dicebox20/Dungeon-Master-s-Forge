# Dungeon Master's Forge Research Library

Last reviewed: 2026-07-23

This directory is the working knowledge base for Dungeon Master's Forge (DMF). It records the version-specific Foundry and DND5e contracts that DMF depends on, the boundaries between DMF's own layers, and the rules we use before changing a supported mechanic.

It is not a release claim. A source in this library can explain what a field or API is supposed to do; it does not prove that a generated item works in a live world.

## Contents

- [Platform and integration reference](foundry-dmf-reference.md) - Foundry, DND5e, optional modules, provider safety, packaging, policy, and test evidence.
- [DMF contract matrix](dmf-contract-matrix.md) - The hand-off points between the prompt, provider, repairs, renderer, and verification layers.
- [Audit preparation](audit-preparation.md) - What a future audit should inspect in the module, Foundry data, service, Droplet, releases, and public-facing material.
- [Audit preflight record](audit-preflight-2026-07-22.md) - The read-only baseline, safety freeze, local test results, and identity discrepancy recorded before the revised audit.
- [Testing process review](testing-process-review-2026-07-22.md) - Comparison with Foundry-adjacent projects and the more efficient focused-to-full-sweep testing loop.
- [Supplemental audit guidance](supplemental-audit-guidance.md) - Small-team checks for accessibility, logging, secrets, dependencies, release identity, and service operations.
- [Comprehensive research process](comprehensive-research-process-2026-07-22.md) - The full research method, subject coverage, evidence gates, and branching rules used for the current review.
- [Comprehensive findings](comprehensive-findings-2026-07-22.md) - The current cross-disciplinary findings and the resulting DMF design and audit recommendations.
- [Item capability and risk model](item-capability-and-risk-model-2026-07-22.md) - Expanded native and optional item capabilities, submitted error patterns, separate danger and evidence scales, and the migration beyond the 14 recipe kinds.
- [Research backlog](research-backlog-2026-07-22.md) - Open questions, priority, source, owner layer, and completion evidence for future research.
- [Machine-readable source catalog](source-catalog.json) - Searchable list of local and upstream sources, versions, ownership, and review triggers.
- [Foundry/DND5e baseline item probe](foundry-dnd5e-baseline-item-probe-2026-07-23.md) - Version-matched core item fields and configurable activity types used by the baseline prompt probe.
- [External reliability guidance](external-reliability-guidance-2026-07-23.md) - Primary-source findings that refine capability detection, activity ownership, module settings, public API boundaries, and graceful degradation.
- [Foundry automation deep research](foundry-automation-deep-research-2026-07-23.md) - Version-matched runtime inventory, optional-module compatibility, Foundry/DND5e API gaps, and the prioritized reliability architecture for advanced automation.
- [Automation language normalization research](automation-language-normalization-research-2026-07-23.md) - The evidence-based translation architecture, canonical intermediate representation, ambiguity rules, and versioned language-corpus plan.
- [DDB-Importer automation observations](ddb-importer-automation-observations-2026-07-23.md) - Local, sanitized counts and structure observations from imported spells and items used to refine DMF capability routing.

## Current Baseline

| Component | Version | Why it matters |
| --- | --- | --- |
| Foundry VTT target | 14 | DMF stable and tester manifests both declare Foundry 14 compatibility. |
| DND5e | 5.3.3 | This is the item, activity, Active Effect, and SRD-document contract DMF must create against. |
| DMF stable module | 2.23.1 | Main-branch release source. |
| DMF tester module | 2.23.1-test.62 | Current tester package candidate with the isolated harness flag; publication is a separate release action. |
| Forge AI service | 1.6.7 | HTTP compile, health, capability, quota, cache, repair, report, and automation-template endpoint implementation. |
| Midi-QOL | 14.0.11 | Capability-selected execution layer for timing, targeting, and workflow behavior when the active recipe requires it. |
| DAE | 14.0.12 | Optional Active Effect enhancement. It wraps core behavior. |
| Item Macro | 3.0.1 | Optional executable-code path. It requires especially strict review. |

The exact local system and optional-module versions above are recorded in `source-catalog.json`. Re-check them before diagnosing a difference seen in another world.

## Evidence Order

Use sources in this order when deciding whether a behavior is supported:

1. Installed Foundry and DND5e source for the active test environment.
2. Created-document export and a focused live use result in that environment.
3. Official Foundry and DND5e public documentation.
4. Installed optional-module source for an optional enhancement.
5. Project docs, historical diagnostics, and remote-model output.

The lower sources can explain intent, but they cannot overrule a live schema or document result from the installed version.

## Required Pre-Patch Check

Every engine, template, compiler, or service patch must start with this check. This is mandatory even when a failure looks obvious.

1. Name the one item family, mechanic family, and observed failure shape.
2. Inspect the current path and the previous version of every touched layer. At minimum compare the template/UI, request normalization, provider or local compiler output, feature planning, deterministic repairs, integrity sanitizer, and `forge-engine.js` renderer.
3. Write down the field owner for every changed field. A later layer must not silently erase a field a prior layer owns without an explicit, tested rule.
4. Compare local and hosted outputs for the same request before calling an issue a renderer defect or an isolated model variance.
5. Check the installed DND5e contract and an exported created document before inferring a schema field from memory.
6. Add or update a focused regression, then run the affected family coverage.
7. Record whether the evidence is structural, created-document, safe-use, or full-function. Do not promote a result beyond the evidence collected.

## Research Maintenance

- Add a source to `source-catalog.json` when a new dependency, public API, or policy becomes relevant.
- Update the baseline when Foundry, DND5e, or an optional companion module changes in the test world.
- Add a short dated note to `foundry-dmf-reference.md` when an upstream change changes a support decision.
- Put unresolved questions in the research backlog instead of filling gaps with assumptions.
- Keep policy and branding sources separate from runtime behavior. A feature can work technically and still need packaging or submission work.
