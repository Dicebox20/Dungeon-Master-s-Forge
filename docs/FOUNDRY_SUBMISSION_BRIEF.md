# Dungeon Master's Forge Foundry Submission Brief

Updated: 2026-07-18

This is the short staff-facing summary for Foundry package review and launch prep.

It gives us a clear way to describe the module, answer common AI-policy questions, and keep the public listing accurate.

## One-Sentence Summary

Dungeon Master's Forge is a Foundry VTT module that turns GM-written natural-language DND5e item requests into reviewable item specifications and, after explicit approval, creates Foundry-ready world items.

## Current Public Links

- Repository: [github.com/Dicebox20/Dungeon-Master-s-Forge](https://github.com/Dicebox20/Dungeon-Master-s-Forge)
- Stable manifest: [main/module/module.json](https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json)
- Stable download: [main/releases/dungeon-masters-forge-v2-2.23.1.zip](https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/releases/dungeon-masters-forge-v2-2.23.1.zip)
- Tester manifest: [dm_forge/tester/testing/module.json](https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json)

## What the Module Does

- opens a GM-only Forge window from the Items directory
- accepts a plain-language item request
- compiles the request into a structured Forge spec
- shows a split **Description** and **Result** review workflow
- highlights assumptions, unresolved mechanics, references, and warnings before creation
- requires explicit approval before writing any world item or summon actor
- supports offline Local Rules, Bring Your Own API, and hosted Free Forge service lanes depending on the release configuration

## Why This Fits Foundry's `AI Tools` Category

Dungeon Master's Forge is a runtime tool, not a bundled content pack.

- It does not ship a prepared AI-authored adventure, compendium, art pack, or rules replacement.
- It does not silently generate content in the background.
- It creates improvised output only after a user prompt.
- It keeps the GM in the loop with review-before-create approval.
- It writes generated items into the user's own world only after that approval.

Official policy references:

- Foundry AI policy: [foundryvtt.com/article/ai-policy](https://foundryvtt.com/article/ai-policy/)
- Package management: [foundryvtt.com/article/package-management](https://foundryvtt.com/article/package-management/)
- Package listing/submission: [foundryvtt.com/packages](https://foundryvtt.com/packages/)

## Human-Authored Package Surface

The public package surface should remain human-authored and curated:

- package description
- README copy
- changelog notes
- screenshots
- demo video narration
- Foundry listing copy

The copy in this worktree is a draft for the Dice Box Group to review and personally approve or rewrite before submission. It is not, by itself, proof of human authorship.

Generated runtime items are user-created world content, not packaged release assets.

## Safety And Review Model

- GM-only launcher
- explicit validation before item creation
- explicit approval before write operations
- unresolved mechanics preserved as review notes instead of being hidden
- structured remote errors instead of opaque crashes
- hosted lane can reject abusive or impossible requests instead of blindly producing unsafe data
- BYO credentials remain client-side unless the user explicitly chooses a hosted server-key lane

## Hosted And BYO Clarification

Dungeon Master's Forge supports more than one generation path:

- **Local Rules:** deterministic offline compiler for proven patterns
- **Bring Your Own API:** the GM connects a compatible Forge endpoint
- **Free Forge:** hosted service lane for bounded public access when enabled in the release

This matters for staff review because the module itself is not hard-wired to a single paid AI backend.

## Review Talking Points

If Foundry staff ask what to test first, this is the most useful smoke pass:

1. install from the manifest
2. enable the module in a DND5e 5.3.3 world
3. open the Forge from the Items directory
4. enter a simple prompt
5. click **Preview**
6. confirm the preview shows assumptions and references
7. approve creation
8. verify the created item appears in the Items directory with activities/effects as expected

## Known Honest Limits

- hybrid requests can still surface manual-review notes when multiple mechanics collide
- unsupported or underspecified mechanics should degrade into readable review notes instead of silent automation
- advanced scene-transfer features, aura automation, and premium image generation remain roadmap items

## Submission Packet Checklist

Before submitting to Foundry staff, make sure all of these exist and are current:

- stable manifest URL
- stable ZIP download URL
- public README
- public changelog
- at least two real screenshots
- one short workflow demo video
- clean module metadata in `module/module.json`
- chosen software license, matching `LICENSE` notice, and the manifest `license` path
- one-paragraph explanation of the hosted lane and monthly allowance
- one-paragraph explanation that the package belongs in `AI Tools`
- prepared-content provenance for every screenshot, icon, font, video, and other listing asset
- external-provider, token-storage, error-report consent, and report-retention disclosures
- a short explanation of the readable generated-code preview and explicit approval boundary

## Staff FAQ Draft

### Does the package bundle AI-generated creative assets?

No. The package itself should ship only human-authored release copy, code, and curated media. AI generation happens at runtime in response to the user's prompt.

### Does it overwrite core rules content?

No. The module creates world items after review. It uses read-only system-native lookups where useful, but it does not mutate locked DND5e compendia.

### Does it require a paid key?

Not necessarily. The module supports local rules, BYO endpoints, and a hosted Free Forge lane when enabled for a release.

### What prevents unsafe or low-quality output?

The main protections are validation, review notes, unresolved-mechanics preservation, explicit approval, bounded hosted quotas, and request rejection or downgrade for abusive or impossible prompts.

## Before We Submit

Do not submit until the public manifest, ZIP, README, screenshots, support links, license notice, asset provenance, and privacy disclosures all tell the same release story. See `docs/FOUNDRY_SUBMISSION_COMPLIANCE.md` for the full gate and Dice Box Group attestations.
