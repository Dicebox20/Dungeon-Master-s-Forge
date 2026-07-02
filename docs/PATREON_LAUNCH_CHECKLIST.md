# Dungeon Master's Forge Patreon Launch Checklist

Updated: 2026-07-02

This file is the launch-facing checklist for releasing Dungeon Master's Forge as a Patreon-supported project.

It is intentionally narrower than the long-term roadmap. The goal is to answer one practical question:

"What still needs to be true before people can install this, understand it, and support it without chaos?"

## Launch Goal

Ship a Patreon-ready release where a supporter can:

1. understand what Dungeon Master's Forge is
2. install the Foundry module from a public manifest
3. use the hosted Free Forge allowance without entering an API key
4. understand what each Patreon tier is meant to unlock
5. understand that Founding Patron is support-only and Patreon entitlements are not active

## Must Be True Before Patreon Launch

### Product clarity

- public README clearly explains the current product shape
- public README clearly separates:
  - the Foundry module
  - the reference AI service
  - the hosted Free Forge service and its limits
- public docs distinguish the stable release from the temporary Free Forge tester channel
- public docs explain that Patreon entitlement enforcement is not live
- public docs explain the 20-request calendar-month hosted allowance and optional Bring Your Own API path

### Installability

- public manifest URL resolves
- public ZIP download URL resolves
- latest tested module ZIP is present under `releases/`
- module installs cleanly from manifest on at least one non-dev machine
- module opens without invalid backup folders or stale duplicate module directories

### Live generation readiness

- reference AI service starts cleanly from the packaged public export
- Foundry Forge Settings can connect to the reference service at the intended endpoint
- at least one true live AI compile succeeds end-to-end in `DMF Test World`
- at least one compile is validated and created successfully after the live compile
- live compile failure modes produce readable messages instead of opaque crashes

### Patreon messaging

- public tier structure is written in plain language
- tiers emphasize complexity and automation limits rather than creativity limits
- launch messaging clearly states that the free public tier is the real product access tier
- Founding Patron is framed as a support-first thank-you tier, not a required gameplay unlock
- launch page copy distinguishes the active tester service from the pending stable-channel promotion
- public free AI generation is advertised only while HTTPS, durable quotas, and the global spending ceiling remain live and verified

### Support readiness

- users have a single place to find install steps
- users have a single place to find AI service setup steps
- known limitations are listed honestly
- deferred integrations are listed honestly, including Patreon entitlement enforcement, compatible ally-aura automation, and Cauldron of Plentiful Resources
- stable-channel Free Forge promotion remains blocked until the permanent hostname and final smoke pass are complete

## Recommended Before Public Promotion

These are not absolute blockers for quietly publishing the repo, but they should be done before actively pushing people toward Patreon.

### Documentation polish

- add a short "What works right now" section for non-technical GMs
- add a short "What still requires self-hosting" section
- add a short "Who this is for" section
- add a short "Not yet included" section

### Testing confidence

- install the manifest on a second machine
- run one remote browser connection check against the AI service
- confirm LAN instructions are correct for a second computer
- verify one full live generation flow after a cold restart

### Launch materials

- Patreon page headline
- Patreon tier descriptions for the launch-day Free and Founding Patron tiers
- short feature list for the repo and manifest page
- one or two screenshots of the split Description/Result workflow
- one or two screenshots of successful generated items inside Foundry

## Not Launch Blockers

These can ship later without preventing the first Patreon launch.

- Hosted Forge authentication
- Patreon entitlement enforcement
- automatic image generation for item icons
- Monk's Active Tile Triggers scene packages
- realm-transfer item packages
- aura automation beyond currently compatible Foundry-native or supported-module paths
- Cauldron of Plentiful Resources integration

## Current Highest-Priority Open Tasks

1. Install from the tester manifest on another machine.
2. Complete one Free Forge connection, live compile, and item-creation pass from that machine.
3. Capture clean screenshots of the Forge workflow and a generated Foundry item.
4. Point a permanent project hostname at the Droplet and repeat the hosted smoke pass.
5. Promote the verified tester package to the stable manifest using the launch-day runbook.

## Suggested Launch Sequence

Use [LAUNCH_DAY_RUNBOOK.md](./LAUNCH_DAY_RUNBOOK.md) for the exact promotion, verification, and rollback procedure.

### Phase 1: Technical readiness

1. Verify live compile in the clean test world.
2. Verify packaged manifest install path.
3. Verify the public release archive.

### Phase 2: Public surface cleanup

1. tighten README
2. tighten module README
3. tighten AI service README
4. keep deferred features explicit

### Phase 3: Patreon page prep

1. finalize tier copy
2. choose screenshots
3. write "current release" language that does not overpromise Patreon entitlement features
4. publish support links back to GitHub docs

### Phase 4: Quiet launch

1. publish the repo
2. publish the promoted stable manifest
3. test installs from a second machine
4. soft-launch Patreon
5. gather first bug reports before wider promotion
