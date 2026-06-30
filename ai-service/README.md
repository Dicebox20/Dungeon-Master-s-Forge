# Dungeon Master's Forge AI Service

This is the stable reference server for Dungeon Master's Forge V2.17. Foundry sends the versioned Forge `1.0` request envelope to this service; the service compiles it with either a deterministic mock or OpenAI and returns reviewed Forge item specs.

The service requires Node.js 20 or newer and has no package dependencies.

## Architecture

- Foundry stores the service endpoint and optional model name.
- The Foundry API token field carries an optional `DMF_CLIENT_TOKEN` used to authorize this service.
- `OPENAI_API_KEY` exists only in the service process environment. It is never entered into Foundry or returned to the browser.
- The service allows only configured browser origins, binds to loopback by default, limits request size and rate, enforces a model allowlist, rejects unsupported Forge kinds, and validates each supported factory's minimum mechanical structure.
- Remote output is declarative-only. Executable macro fields, Foundry flags, scripts, active HTML, JavaScript URLs, oversized values, and abusive nesting are rejected before normalization.
- Batch integrity is enforced. Separator-based and repeated `Item name:` requests must return the same item count, order, and explicit names.
- Successful compilations are cached briefly by canonical request content. Duplicate and concurrent submissions reuse the same result, reducing accidental model charges without storing data on disk.
- Distinct compilations pass through a bounded FIFO queue, preventing request bursts from creating unlimited simultaneous model calls.
- Request length and requested item count are checked before model invocation, bounding prompt cost and batch output size.
- The system prompt has an explicit version and treats all request text and item names as untrusted data that cannot override compiler rules.
- Foundry still validates every returned spec and requires explicit review before creating world documents.

## Mock Mode

Mock mode proves the entire Foundry-to-service workflow without credentials, spending money, or making an external network request.

```powershell
cd "C:\Users\rujie\Documents\Codex\2026-06-25\can\outputs\dungeon-masters-forge-ai-service"
$env:DMF_AI_MODE = "mock"
$env:DMF_ALLOWED_ORIGINS = "http://10.0.0.26:30000"
node src/cli.mjs
```

Configure the Forge Describe view:

- **Generation provider:** Bring Your Own API
- **Endpoint:** `http://localhost:8787/v1/forge/compile`
- **Model:** leave blank in mock mode
- **API token:** leave blank unless `DMF_CLIENT_TOKEN` was set on the service

The legacy `/api/compile` path is also accepted for compatibility, but the versioned endpoint above is preferred.

Mock mode always returns a known-good longsword with `1d4` extra fire damage. It verifies transport, CORS, review, validation, and creation boundaries; it does not interpret the request.

## OpenAI Mode

Set the key only in the server process. Do not paste the OpenAI key into Foundry.

```powershell
cd "C:\Users\rujie\Documents\Codex\2026-06-25\can\outputs\dungeon-masters-forge-ai-service"
$env:DMF_AI_MODE = "openai"
$env:DMF_ALLOWED_ORIGINS = "http://10.0.0.26:30000"
$env:DMF_CLIENT_TOKEN = "choose-a-long-random-service-token"
$env:OPENAI_API_KEY = "your-openai-api-key"
$env:OPENAI_MODEL = "gpt-5.4-mini"
$env:DMF_ALLOWED_MODELS = "gpt-5.4-mini"
node src/cli.mjs
```

Enter the same `DMF_CLIENT_TOKEN` in Foundry's **API token** field. The default `gpt-5.4-mini` favors lower cost and latency; the server owner controls the allowlist and can change the default. OpenAI currently recommends the Responses API for model calls and supports JSON-formatted or schema-constrained output through `text.format`: [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Models](https://developers.openai.com/api/docs/models).

In Foundry V2.18 and newer, use **Check Connection** after the service starts. A healthy live setup should report `openai` mode; if it reports `mock`, the Forge is still using deterministic test output.

## Environment

Copy `.env.example` to `.env` and run `npm run start:env`, or set variables directly in the process environment. Keep the OpenAI key only in the service environment or `.env`; never paste it into the Foundry UI.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DMF_HOST` | `127.0.0.1` | Bind address. Keep loopback for personal use. |
| `DMF_PORT` | `8787` | HTTP port. |
| `DMF_AI_MODE` | `mock` | `mock` or `openai`. |
| `DMF_ALLOWED_ORIGINS` | localhost Foundry origins | Comma-separated exact Foundry origins. |
| `DMF_CLIENT_TOKEN` | empty | Optional bearer token shared with the Foundry client. |
| `DMF_RATE_LIMIT_PER_MINUTE` | `20` | Per-client in-memory limit. |
| `DMF_MAX_CONCURRENT_COMPILATIONS` | `2` | Maximum simultaneous compiler or model calls. |
| `DMF_MAX_QUEUED_COMPILATIONS` | `20` | Waiting compilation limit; `0` rejects when all active slots are occupied. |
| `DMF_CACHE_TTL_MS` | `300000` | Successful-result lifetime in milliseconds; `0` disables caching. |
| `DMF_CACHE_MAX_ENTRIES` | `100` | Maximum in-memory results; `0` disables caching. |
| `DMF_MAX_REQUEST_CHARS` | `20000` | Maximum natural-language request length. |
| `DMF_MAX_ITEMS_PER_REQUEST` | `10` | Maximum requested batch size; absolute ceiling is `20`. |
| `OPENAI_API_KEY` | empty | Required only in OpenAI mode. |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Server default model. |
| `DMF_ALLOWED_MODELS` | default model | Comma-separated model allowlist. |
| `OPENAI_BASE_URL` | OpenAI API | Responses-compatible API base URL. |
| `DMF_OPENAI_TIMEOUT_MS` | `90000` | Upstream timeout. |
| `DMF_MAX_OUTPUT_TOKENS` | `12000` | Maximum model output tokens. |

## Verification

```powershell
npm run check
npm test
npm run smoke
npm run smoke:batch
npm run smoke:capabilities
```

The smoke commands expect the service to already be running. They print only contract versions and generated item names, never credentials or full requests. The batch smoke proves two explicitly named items survive the complete request/response path. The automated suite drives all fourteen supported Forge families through a mocked OpenAI Responses call and the complete compiler pipeline, then rejects incomplete or unsafe weapons, effects, charged powers, enchantments, summons, suites, and hybrid artifacts before they can reach Foundry.

## HTTP Contract

- `GET /health` returns service version, prompt version, active mode, load, and request limits.
- `GET /v1/forge/capabilities` advertises the Forge schema, prompt contract, supported item families, request limits, and safety features without invoking a model.
- `POST /v1/forge/compile` accepts and returns Forge schema `1.0`.
- Compile responses include `X-Forge-Cache: MISS`, `HIT`, `COALESCED`, or `BYPASS` for diagnostics.
- `OPTIONS` supports Foundry browser preflight requests.
- Errors use `{ "error": { "code", "message", "requestId" } }` and do not expose upstream response bodies.
- Capacity errors return HTTP `503`, code `service_busy`, and `Retry-After: 5`.
- Oversized prompts or batches return HTTP `413` before an adapter or model is called.
- Successful compile responses include the prompt contract version used for generation.

## Production Boundary

This is a reference and personal-use service, not the future Hosted Forge. Its rate limiter and result cache are in memory, it has no Patreon entitlement store, and it does not provide multi-tenant accounting or durable audit controls. Keep Hosted Forge disabled until those systems are implemented.
