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