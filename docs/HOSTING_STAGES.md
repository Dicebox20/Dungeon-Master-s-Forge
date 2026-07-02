# Dungeon Master's Forge Hosting Stages

Updated: 2026-07-02

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
- anonymous access is bounded by durable monthly client quotas and a global daily ceiling
- basic rate limiting and concurrency limits exist
- logs are clear enough to troubleshoot failures
- the manifest install works on a second machine
- setup docs are understandable without direct hand-holding

Plain-language test:

"Can a few outside testers install, connect, and use it without chaos?"

## Stage 3: Safe For Public project Hosting

This is the bar for offering hosted generation as a real public service.

Must be true:

- the permanent project hostname and TLS certificate are active
- the stable module manifest uses the production endpoint
- project messaging does not imply access control features that are not active
- abuse protection and rate limiting are in place
- uptime expectations are realistic
- support burden is manageable
- billing or usage exposure is understood and acceptable

Plain-language test:

"Can strangers use this at scale without exposing the project to runaway cost, support overload, or fragile security?"

## Current Placement

Current project position:

- **Local use:** ready
- **Invited tester hosting:** active through `2.22.0-test.4`; still needs second-machine creation results
- **Public free hosting:** technically live, pending the permanent hostname and stable-manifest promotion gate
- **project access control hosting:** intentionally deferred; early supporter is support-only at launch

## Recommended Launch Sequence

1. Launch the module publicly.
2. Promote the verified Free Forge tester path to the stable manifest.
3. Keep Bring Your Own API as an optional independent workflow.
4. Use early supporter as a support-first thank-you tier.
5. Add hosted access and access control logic later when Stage 3 is genuinely ready.
