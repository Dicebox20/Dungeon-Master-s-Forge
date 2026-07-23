# Dual Free Forge Deployment

Updated: 2026-07-16

The hosted service now runs as two isolated processes from the same verified service source:

| Surface | Endpoint | Host process | Access | Limits |
| --- | --- | --- | --- | --- |
| Public Free Forge | `https://dmforge.137-184-103-220.sslip.io/v1/forge/compile` | `dmforge-ai.service`, port `8788` | Anonymous public mode | `10/min`, `500,000 usage units/client-month`, `1,000,000,000 usage units/global-day` |
| Testing Free Forge | `https://dmforge-test.137-184-103-220.sslip.io/v1/forge/compile` | `dmforge-ai-testing.service`, port `8789` | Bearer-authenticated private mode | `100/min`, no public daily/monthly ledger |

The test process has its own environment file, quota path, error-report path, systemd unit, and
Caddy host. The bearer token remains on the Droplet and is not stored in this repository, module
manifest, diagnostics, or chat. The public endpoint and its existing quota ledger were preserved;
only the elevated limits were restored.

## Verification

- Public `/health`: HTTP 200, service `1.6.1`, public-free-tier access, SQLite quota storage.
- Public `/v1/forge/capabilities`: HTTP 200, Hosted Forge enabled, executable model output disabled.
- Testing unauthenticated compile: HTTP 401.
- Testing authenticated compile: HTTP 200, service `1.6.1`, one `weaponExtraDamage` item.
- Both systemd services and Caddy: active.
- The testing hostname received a valid TLS certificate through Caddy.

## Operations

Use the test endpoint only with the bearer token held in the trusted tester environment. Do not
copy that token into a Foundry package, manifest, public documentation, or regression artifact.
Backups of the public environment, service unit, and Caddy configuration were created on the
Droplet before the split. If either process must be rolled back, stop only the affected unit and
restore its corresponding timestamped backup; do not delete the public quota ledger.
