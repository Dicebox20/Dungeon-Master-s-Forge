# Public Repair Rerun Rollout

## Scope

The public Forge service was moved to the locally verified repair-capable `1.6.1`
service source for internal Dice Box Group testing. The module manifest, package
archives, stable release, private testing service, provider keys, and quota data
were not replaced or published by this rollout.

## Temporary Internal Policy

- Daily client usage metering is disabled temporarily.
- Monthly client usage is capped at `500,000` metered units, calibrated to roughly
  50 prompts from the previous prompt-count baseline. The separate global daily
  ceiling remains `1,000,000,000` units, so the existing ledger continues to
  record aggregate usage without blocking the small tester group.
- The `10 requests/minute` limiter remains as temporary abuse protection.
- Request limits are aligned to the current service defaults: 20,000 characters
  and 10 items per request.
- This policy is for the Dice Box Group only and must be replaced with deliberate
  public guidelines before any broader tester or public launch.

## Verified

- Public `/health`: service `1.6.1`, OpenAI mode, durable SQLite usage storage.
- Public capabilities advertise `features.repairRerun`.
- Public capabilities advertise `request.cacheControlRefresh`.
- CORS preflight accepts `Authorization, Cache-Control, Content-Type`.
- A live repair request returned `200` with `requestMode: repair-attempt`.
- Repeating the identical repair request returned `409 repair_already_attempted`.
- Private testing service remained active throughout the public restart.
- Local tests pass: `215/215` AI-service and `51/51` module tests.

## Metering Decision For The Next Policy Patch

The service currently records provider-token usage when the provider supplies it,
with a deterministic data-size fallback. For the next public-guideline patch,
make the user-facing allowance explicitly data-based:

`usageUnits = max(1, ceil((UTF-8 request bytes + UTF-8 response bytes) / 1024))`

Keep provider input/output tokens as separate aggregate cost telemetry. Do not
store raw prompts, generated documents, keys, or world data in the usage ledger.
This makes the allowance understandable as data usage while retaining the cost
signal needed for internal OpenAI spending controls.

## Backup

The pre-rollout public source, environment file, systemd unit, quota SQLite files,
and error-report file are preserved on the Droplet under:

`/var/backups/dmforge-ai/public-rollout-20260723T050339Z`
