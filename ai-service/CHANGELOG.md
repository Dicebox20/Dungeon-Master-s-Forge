# Changelog

## 1.6.0 - 2026-07-02

- Added one bounded retry for malformed, unsafe, or contract-invalid model output.
- Replaced malformed model-generated activity, effect, profile, and unresolved-mechanic IDs with trusted service-generated IDs before validation.
- Allowed artifact weapon hybrids to use separate activated powers without requiring an on-hit extra-damage rider.
- Replaced obvious prompt-copy generated names with concise service-generated item names when no explicit `Item name:` field was supplied.
- Kept authentication, quota, network, timeout, and generic upstream failures non-retryable.
- Added safe service error-code and request-id logging without request text or credentials.

## 1.5.0 - 2026-07-02

- Added a persistent per-client calendar-month quota for the official Free Forge allowance.
- Added `DMF_CLIENT_MONTHLY_LIMIT`, monthly health and preflight reporting, and stable monthly-limit response headers.
- Kept per-minute and global daily safeguards independently configurable.
- Added calendar rollover, restart persistence, and HTTP enforcement coverage for monthly quotas.

## 1.4.0 - 2026-07-01

- Added a transactional SQLite ledger for durable per-client and global daily free-tier quotas.
- Pseudonymized stored client identifiers with a server-held HMAC secret instead of retaining raw IP addresses.
- Required durable storage and a 32-character quota hash secret before public free-tier mode can start.
- Added restart persistence, UTC rollover, privacy, and storage-mode regression coverage.
- Raised the standalone service runtime requirement to Node.js 22.13 or newer for built-in SQLite support.
- Updated the Windows launcher to recognize anonymous public free-tier mode without requesting a shared client token.

## 1.3.0 - 2026-07-01

- Added bounded anonymous public free-tier mode with origin, proxy, concurrency, request, and daily-limit safeguards.
- Added public deployment guidance and a conservative free-tier environment template.

## 1.2.0 - 2026-06-30

- Added personal client-key OpenAI mode so a trusted Foundry browser can supply its own upstream API key through the Forge token field.
- Kept cache keys free of transient request secrets while preserving duplicate-request coalescing and result reuse.
- Updated the launcher script so `.env` can omit `OPENAI_API_KEY` and optional port overrides work without rewriting the file.

## 1.1.0 - 2026-06-28

- Added compatibility routes for `/api/compile` and `/api/capabilities`; `/v1/forge/*` remains canonical.
- Added `Retry-After` to rate-limit responses and exposed the per-minute allowance in health diagnostics.
- Kept the Forge schema and prompt contract at stable version `1.0` and `1.0.0`.

## 1.0.0 - 2026-06-28

- Declared the reference AI service compatibility boundary stable for Forge schema `1.0` and prompt contract `1.0.0`.
- Added a read-only capabilities endpoint for service, schema, prompt, item-family, request-limit, and safety-policy discovery.
- Explicitly advertises that executable model output and Hosted Forge are disabled.
- Added capability unit, HTTP, and smoke verification without model invocation.

## 0.9.0 - 2026-06-28

- Added a full mocked-provider integration matrix for all fourteen supported Forge item families.
- Proved each family survives OpenAI Responses parsing, normalization, ID generation, remote-content policy, and factory validation.
- Added a full-path hostile provider fixture proving successful transport cannot bypass executable-content rejection.
- Moved known-good family fixtures into shared reusable test data.

## 0.8.0 - 2026-06-28

- Added versioned prompt contract `1.0.0` and exposed it in health and compile responses.
- Marked request text and item names as untrusted data that cannot override system rules.
- Added prompt-contract coverage for batches, names, supported kinds, executable-output prohibitions, target versions, and unresolved policy.

## 0.7.0 - 2026-06-28

- Added configurable request-character and requested-item limits before provider invocation.
- Added separator and repeated-name batch-size validation before any model call.
- Aligned the absolute request ceiling with the existing twenty-spec output ceiling.
- Added active request limits to the health response.

## 0.6.0 - 2026-06-28

- Added a bounded FIFO compilation gate to cap simultaneous provider calls and queued work.
- Added configurable active and queued compilation limits.
- Added live compilation load and capacity to the health response.
- Added a stable retryable `503 service_busy` response when capacity is exhausted.
- Kept duplicate coalescing outside the gate so repeated requests do not consume extra capacity.

## 0.5.0 - 2026-06-28

- Added bounded, short-lived in-memory caching for successful Forge compilations.
- Canonicalized request objects so harmless JSON key-order differences share a cache entry.
- Coalesced concurrent duplicate requests to prevent duplicate model calls.
- Added configurable TTL and entry limits plus an `X-Forge-Cache` diagnostic header.
- Kept failed compilations out of the cache and added cache behavior coverage.

## 0.4.0 - 2026-06-28

- Added server-side request intent analysis for separator batches and repeated `Item name:` blocks.
- Requires remote responses to preserve requested item count, explicit names, and order.
- Extended mock mode to return one known-good fixture per requested item.
- Added a reusable two-item batch smoke client.
- Expanded the automated suite from twenty-seven to thirty-two passing checks.

## 0.3.0 - 2026-06-28

- Added a declarative-only policy for remote model output.
- Rejects Item Macro source, macro registration data, Foundry flags, scripts, prototype-control keys, active HTML, and JavaScript URLs.
- Added string, array, object, node-count, and nesting limits for generated content.
- Updated the model prompt to forbid executable output and rely on trusted engine-generated condition and light behavior.
- Expanded the automated suite from twenty-two to twenty-seven passing checks.

## 0.2.0 - 2026-06-28

- Added factory-specific minimum structure validation for all fourteen remote Forge item families.
- Rejects incomplete damage, healing, effects, charges, saves, activities, enchantments, summons, complex suites, and hybrid artifacts before returning them to Foundry.
- Added missing top-level activity ID generation for charged, enchantment, and summon families.
- Expanded the automated suite from eighteen to twenty-two passing checks.

## 0.1.0 - 2026-06-27

- Added Forge `1.0` request and response handling.
- Added mock and OpenAI Responses adapters.
- Added supported-kind enforcement, ID normalization, CORS allowlisting, optional bearer authentication, body limits, rate limiting, model allowlisting, and redacted errors.
- Added a smoke client and eighteen automated configuration, contract, adapter, security, and HTTP tests.
