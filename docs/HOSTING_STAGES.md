# Dungeon Master's Forge Hosting Stages

Updated: 2026-07-01

This file translates the hosting path into three practical stages so launch decisions stay grounded in what the product can actually support today.

## Stage 1: Works Locally

This is the minimum bar for a real usable product on the developer's own machine.

Must be true:

- Foundry can reach the configured Forge endpoint
- the reference AI service can call OpenAI successfully
- compile requests return valid Forge specs
- common failures such as `401`, `429`, and `502` produce readable messages
- Bring Your Own API settings save and reload correctly

Plain-language test:

"Can the developer sit down at the local setup and generate items reliably?"

## Stage 2: Safe For Invited Testers

This is the point where a few trusted outside testers can use the service without constant manual rescue.

Must be true:

- the endpoint is reachable from another intended computer
- CORS or origin handling allows the approved Foundry clients
- a simple tester token or controlled access flow exists
- basic rate limiting exists
- logs are clear enough to troubleshoot failures
- the manifest install works on a second machine
- setup docs are understandable without direct hand-holding

Plain-language test:

"Can a few outside testers install, connect, and use it without chaos?"

## Stage 3: Safe For Public project Hosting

This is the bar for offering hosted generation as a real public service.

Must be true:

- access control or account handling exists
- tier-aware access rules exist
- authentication is separated cleanly from private developer usage
- abuse protection and rate limiting are in place
- uptime expectations are realistic
- support burden is manageable
- billing or usage exposure is understood and acceptable

Plain-language test:

"Can strangers use this at scale without exposing the project to runaway cost, support overload, or fragile security?"

## Current Placement

Current project position:

- **Local use:** mostly ready
- **Invited tester hosting:** close, but still needs second-machine verification and cleaner public setup confirmation
- **Public hosted project access:** not ready yet

## Recommended Launch Sequence

1. Launch the module publicly.
2. Support the current Bring Your Own API workflow.
3. Use the free public tier as the real product access tier.
4. Use early release as a community-oriented planning milestone.
5. Add hosted access and access control logic later when Stage 3 is genuinely ready.
