# Tester Refresh Record

Date: 2026-07-22
Scope: approved tester release and hosted-service refresh after the audit overhaul patch.

## Released Tester Build

- Tester version: `2.23.1-test.45`
- Manifest: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
- Download: `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/releases/dungeon-masters-forge-v2-2.23.1-test.45.zip`
- Local ZIP SHA-256: `1D45EF0BDABBC4EE9485F7715ED61C83E9984314D1C83805ACB1F124B1202F18`
- The archive contains the isolated verification harness and keeps its exact-world/GM boundary.

## Hosted Services

- Private testing endpoint: `https://dmforge-test.137-184-103-220.sslip.io/v1/forge/compile`
- Public Free Forge endpoint: `https://dmforge.137-184-103-220.sslip.io/v1/forge/compile`
- Both Droplet services now run AI service `1.6.1` from the reviewed source.
- Authenticated private smoke passed with one `weaponExtraDamage` item.
- Public health and capabilities passed with Hosted Forge enabled and declarative model output only.
- Public limits remain `10/min`, `100/client-month`, and `50/global-day`.
- Private testing remains `100/min` with no public daily or monthly ledger.

## Preservation

- Stable module version `2.23.1` and its existing ZIP were not rebuilt or replaced.
- Provider keys and bearer tokens remain outside the repository and diagnostics.
- Quota values and quota databases were not changed.
- A timestamped backup of the testing service source was created on the Droplet before refresh.

## Verification Boundary

The local service suite passed `198/198` and the module suite passed `46/46` before packaging.
The next step is the fresh tagged tester sweep and isolated Foundry document/use verification.
This refresh does not change the strict Beta V1 readiness decision: live safe-use/export evidence
remains required, and Beta V1 is not declared ready.
