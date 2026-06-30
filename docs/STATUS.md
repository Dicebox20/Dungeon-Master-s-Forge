# Dungeon Master's Forge Development Status

Updated: 2026-06-29

## Current Workspace Candidate

- Dungeon Master's Forge V2.21.2 source changes are complete in the workspace and all source tests in `module/tests` pass.
- V2.21.2 preserves the verified V2.21.1 runtime while adding early supporter roadmap coverage for optional bespoke item-icon image generation.
- The last verified archive is `outputs/dungeon-masters-forge-v2-2.21.2.zip`.
- Last verified archive SHA-256: `421A392A96C00CEF52B1395C39C19CEB16EA863F534D54F7D71C357762FB3F0A`
- The installed Foundry release now matches the verified V2.21.2 source build byte-for-byte across 31 files.
- Live in-world verification already passed for the new Items-directory gear and hammer shortcuts, the dedicated Forge Settings window, and the Forge split-pane labels Description and Result.
- V2.19.0 adds a read-only DND5e system content resolver for exact-name Spell and Equipment lookup, returning source UUID provenance and compatibility details without importing or mutating compendium documents.
- Non-destructive native-content diagnostics now cover Command, Flame Strike, Longsword, and Plate Armor through system-owned DND5e packs.
- The service workspace now includes `.env.example` for private local configuration with `npm run start:env`.

## Current Release

- Dungeon Master's Forge V2.21.2 is installed on disk in Foundry and remains runtime-equivalent to the last live-verified V2.21.1 baseline.
- Installed workspace manifest version: `2.21.2`
- Installed module file count: `31`
- Current installed archive baseline: `outputs/dungeon-masters-forge-v2-2.21.2.zip`
- Current installed archive SHA-256: `421A392A96C00CEF52B1395C39C19CEB16EA863F534D54F7D71C357762FB3F0A`
- The browser session now reaches the `DMF Test World` game successfully after the viewport correction and blank-password Gamemaster join.
- The saved endpoint, model, and remembered token survived a complete Foundry reload.
- The Items directory now shows the inline Dungeon Master's Forge hammer and gear shortcuts after the live reload.
- The dedicated Forge Settings window is visible in-world and now contains provider selection, connection checks, example loading, diagnostics, and the Open Forge action.
- The Forge window now renders the renamed Description and Result panes live, with provider controls moved out to Forge Settings.
- The live Forge window now preserves the corrected Bring Your Own API configuration and treats the active `/api/compile` bridge as an expected legacy connection shape instead of an unknown partial failure.
- The original 429 report is now distinguishable from endpoint, credential, and route failures; retry timing is displayed when the service returns a rate limit.
- `DMF Test World` is now the clean regression world. The Forge launcher is active and its built-in diagnostics pass 6/6 without creating documents.
- The DND5e system's modern Rules, Classes, Origins, Feats, Spells, Equipment, Roll Tables, Actors, and Monster Features packs are approved as runtime reference sources under the separate SRD integration plan.
- Cauldron of Plentiful Resources remains disabled and deferred because its current release is incompatible with this Foundry version.

## Current Reference Service

- Service 1.1.0 is running in mock mode on port 8787 with bearer authentication and a local testing allowance of 120 requests per minute.
- Archive: `outputs/dungeon-masters-forge-ai-service-1.1.0.zip`
- Archive SHA-256: `F0150EA2ECE8677077523EAFF161B4C7FE6E230AABD480AE37389AC14D4C9894`
- All 61 source tests and all 61 independently extracted archive tests pass.
- The service accepts canonical `/v1/forge/*` routes and compatibility `/api/*` routes, and rate-limited responses include `Retry-After`.
- The archive contains no `.env`, API token, process ID, or runtime logs.
- The current local service is authenticated but still deterministic mock generation; real AI interpretation requires a server-side provider key and OpenAI mode.

## Previous V2.16 Baseline

- V2.16.0 is installed in Foundry as the capabilities-aware Bring Your Own API build.
- All twenty-seven installed module files match the packaged workspace build byte-for-byte.
- All nine V2.16.0 source and independently extracted archive test files pass.
- Into the Feywild launched successfully on Foundry v14 build 364 / DND5e 5.3.3, the browser joined as Gamemaster, and the V2.16 Forge launcher was visible.
- The installed V2.16 adapter completed capability discovery and review-only mock compilation against live service 1.0.0 with all fourteen item families compatible.
- The browser bridge timed out while rendering/snapshotting the Forge dialog after its launcher was clicked; no Forge console errors were observed before that render timeout.
- The Items-directory Forge button opened the V2.15 interface successfully.
- Bring Your Own API exposed endpoint, model, and masked token controls; missing-endpoint blocking and ready-state enabling both passed.
- The V2.16 installed adapter completed a mock compile through `http://localhost:8787/v1/forge/compile` after successful `/v1/forge/capabilities` preflight.
- No API credential was entered, no external model was called, and no world document was created.
- Diagnostics passed 6/6 without creating world documents, and no Forge-specific console warnings or errors were recorded.
- Previous V2.13.0 live verification passed for step-specific actions, persistent status and footer regions, approval-gated creation, and approval invalidation after specification edits.
- No world documents were created during usability verification.
- The final request-editor height adjustment is installed.
- Provider selection persists across reloads.
- Strict unresolved policy blocks item creation.
- Aura title collisions preserve the actual mechanic sentence.
- The previous V2.12 Diagnostics command passed 6/6 compiler and Foundry validation checks without creating documents.
- Managed source labels track the loaded build; stable item and summon folder names are unchanged.
- Bring Your Own API is connected to the Forge `1.0` remote contract with endpoint/model controls and readiness gating.
- BYO API tokens are session-only secrets and cannot enter persisted settings, exported profiles, or diagnostic configuration.
- Hosted Forge remains disabled.

## Previous Packaged Baseline

- V2.16.0 candidate workspace: `module`
- Archive: `outputs/dungeon-masters-forge-v2-2.16.0.zip`
- Archive SHA-256: `F13F9A74956D437E6FBAEDFE05848B79A152B2F4973C0DA48B284C18D4F6E87A`
- V2.16.0 adds explicit optional capabilities discovery, schema and safety validation, shared-family intersection, and remote prompt-version provenance.
- Legacy endpoints that omit discovery remain supported; a live preflight against service 0.9.0 returned `not-supported` and then compiled successfully.
- All nine V2.16.0 source and independently extracted archive test files pass.
- V2.16.0 is installed, hash-matched, world-loaded, and verified through its installed provider adapter; V2.15.0 remains the previous fully verified visual-review baseline.

## Previous Service Baseline

- Stable service version 1.0.0 is implemented at `outputs/dungeon-masters-forge-ai-service`.
- Prompt contract version 1.0.0 is active and reported by health and compile responses.
- Archive: `outputs/dungeon-masters-forge-ai-service-1.0.0.zip`
- Archive SHA-256: `BC4BB2FB0466607D2D99DB93D8F1405832CF43AB03934BAD137474B43BD8DDBA`
- The 1.0.0 archive was extracted independently and all sixty packaged tests passed.
- Mock and OpenAI Responses adapters share Forge `1.0` request validation, output normalization, supported-kind enforcement, and 16-character Foundry ID generation.
- The service includes exact-origin CORS controls, optional client bearer authentication, loopback binding, request-size and rate limits, model allowlisting, upstream timeouts, and redacted public errors.
- Provider-side minimum structure validation now covers all fourteen remote Forge families and blocks incomplete mechanical output before it reaches Foundry.
- Remote output is now declarative-only: executable macro fields, Foundry flags, scripts, active HTML, JavaScript URLs, oversized values, and abusive nesting are rejected.
- Batch integrity requires separator and repeated-name requests to preserve item count, explicit names, and order.
- Successful compilation results now use bounded, short-lived in-memory caching with canonical request keys and concurrent duplicate coalescing to reduce accidental provider charges.
- Distinct compilations now pass through a bounded FIFO gate with configurable active and queued limits; capacity exhaustion returns a retryable `503 service_busy` response.
- Request character count and requested item count are now checked before provider invocation, with a configurable ten-item default and an absolute twenty-item ceiling.
- Request text and item names are explicitly treated as untrusted prompt data that cannot override system rules.
- All fourteen supported item families now pass the complete mocked OpenAI Responses, parsing, normalization, ID generation, remote-content policy, and factory-validation pipeline.
- The stable service exposes a read-only capabilities endpoint for schema, prompt, item-family, request-limit, and safety-policy discovery without model invocation.
- All 60 service tests pass, including capability discovery, live loopback HTTP tests, prompt-contract invariants, the fourteen-family provider matrix, batch integrity and limits, hostile provider output rejection, cache and concurrency behavior, and mocked OpenAI Responses requests.
- Foundry-to-service mock integration passed: preflight `204`, compile `200`, V2.15 validation passed, and creation remained approval-gated.
- The local reference service is running stable version 1.0.0 with prompt contract 1.0.0 in mock mode on port 8787. Health, capabilities, cache `MISS`/`HIT`, single-item, batch, and installed V2.16 adapter checks pass.
- GitHub publication remains blocked because the connector still reports zero App installations and zero accessible repositories, despite the user-side expectation that GitHub is connected.

## Automated Coverage

- 14 request-compiler cases.
- 3 provider registry entries and 25 provider configuration/adapter cases.
- 29 remote-provider contract, capabilities, and transport cases.
- 14 supported item-pattern matrix cases.
- 6 built-in non-destructive diagnostic cases.
- 10 build-version and source-label migration cases.
- 13 provider configuration persistence, redaction, and readiness cases.
- 13 secret-free provider profile round-trip and rejection cases.
- 38 workflow usability contract checks.
- 18 readable review-summary checks.
- 61 reference-service capability, configuration, contract, prompt, full provider pipeline, adapter, request-integrity and limits, factory-structure, cache, concurrency, remote-content security, compatibility-route, and HTTP checks.

## Next Safe Actions

1. Configure a server-side provider key only when the first real AI interpretation test is approved; keep provider secrets out of Foundry.
2. Add a service-status/check-connection command that reports service version, mode, compatibility, and rate allowance before compilation.
3. Replace the weak local testing token before exposing the service beyond this trusted development machine or LAN.
4. Add the planned opt-in Midi-QOL compatibility track while preserving core DND5e output as the portable baseline.
5. Keep Hosted Forge disabled until authentication, project access control, durable rate limiting, accounting, logging controls, and abuse protection are ready.
