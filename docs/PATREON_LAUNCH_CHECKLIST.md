# Dungeon Master's Forge Patreon Launch Checklist

Updated: 2026-07-01

This file is the launch-facing checklist for releasing Dungeon Master's Forge as a Patreon-supported project.

It is intentionally narrower than the long-term roadmap. The goal is to answer one practical question:

"What still needs to be true before people can install this, understand it, and support it without chaos?"

## Launch Goal

Ship a Patreon-ready release where a supporter can:

1. understand what Dungeon Master's Forge is
2. install the Foundry module from a public manifest
3. understand the supported Bring Your Own API workflow
4. understand what each Patreon tier is meant to unlock
5. use the current release without depending on unfinished Hosted Forge features

## Must Be True Before Patreon Launch

### Product clarity

- public README clearly explains the current product shape
- public README clearly separates:
  - the Foundry module
  - the reference AI service
  - future Hosted Forge plans
- public docs explain that Hosted Forge and entitlement enforcement are not live yet
- public docs explain that the current supported live lane is local or self-hosted Bring Your Own API

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
- launch page copy does not imply Hosted Forge is already live
- if public free AI generation is advertised, the HTTPS service, durable quotas, and global spending ceiling are live and verified first

### Support readiness

- users have a single place to find install steps
- users have a single place to find AI service setup steps
- known limitations are listed honestly
- deferred integrations are listed honestly:
  - Hosted Forge
  - Patreon entitlement enforcement
- compatible Active Aura path
- Cauldron of Plentiful Resources integration
- automatic Free Forge access until the public service requirements are complete

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

1. Install from the public manifest on another machine.
2. Complete one Tailscale connection, live compile, and item-creation pass from that machine.
3. Capture clean screenshots of the Forge workflow and a generated Foundry item.
4. Decide whether launch is Bring Your Own API only or waits for the separate public free-tier deployment gate.

## Suggested Launch Sequence

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
3. write "current release" language that does not overpromise Hosted Forge
4. publish support links back to GitHub docs

### Phase 4: Quiet launch

1. publish the repo
2. publish the manifest
3. test installs from a second machine
4. soft-launch Patreon
5. gather first bug reports before wider promotion
