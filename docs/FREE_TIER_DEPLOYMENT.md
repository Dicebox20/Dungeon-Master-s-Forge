# Free Forge Deployment

The current testing service can become the engine for a downloader-accessible free tier, but `localhost` is reachable only from the machine running it. Public module installations need a stable HTTPS endpoint hosted behind a reverse proxy.

## Prepared Service Mode

AI service `1.6.1` provides an explicit `DMF_PUBLIC_FREE_TIER=true` mode. It:

- keeps the OpenAI key only on the server;
- accepts tokenless public Forge requests without distributing a shared token;
- permits Foundry installations from arbitrary origins;
- keeps a per-minute abuse limiter and enforces configured client and global usage allowances;
- measures provider tokens when available and otherwise uses a deterministic request-and-response size estimate;
- persists monthly client and daily client/global usage in a transactional SQLite ledger;
- does not charge cache hits, coalesced duplicate requests, or requests funded with a client-provided provider key;
- stores keyed client digests rather than raw client IP addresses;
- separates clients behind a trusted reverse proxy using `X-Forwarded-For`;
- retains bounded concurrency, queueing, request size, batch size, caching, model allowlisting, and declarative-output validation;
- retries malformed or contract-invalid model output once while leaving operational failures non-retryable;
- advertises public free-tier status through health and capabilities responses.

## Summon Content Boundary

Free Forge treats the requested creature or role as a suggestion. The service prefers a matching actor supplied by the installed DND5e system's SRD content and the module clones that actor into the world with Forge ownership and friendly-token defaults. When no matching SRD actor is installed, the item keeps a reviewed declarative fallback actor with a basic type, AC, hit points, and movement so the summon remains usable. Free Forge never accepts model-generated macros, scripts, or executable actor behavior.

Use `ai-service/.env.free-tier.example` as the deployment template. Do not place a real key in the repository.

Before starting the public listener, copy the template to `.env`, fill the server-side values, and run `npm run preflight:free-tier`. The command does not call a model or print either secret. A ready report confirms public mode, wildcard origins, proxy trust, bounded usage, an OpenAI server key, and durable SQLite storage.

For host-admin maintenance during tester validation, `npm run quota:admin -- summary` reports usage units by bucket and period, `npm run quota:admin -- reset-current-month` clears the current `client-month` rows, and `npm run quota:admin -- reset-current-day` clears the current daily client/global rows. Use those reset commands only on a trusted host when you intentionally want to reopen test allowance.

## Required Before Activation

1. Deploy the service to a persistent host with Node.js 22.13 or newer and a stable public HTTPS URL.
2. Put it behind a trusted reverse proxy and configure that proxy to replace, rather than append untrusted, forwarding headers.
3. Store `OPENAI_API_KEY` in the host's secret manager or process environment.
4. Set conservative OpenAI project spending controls independently of DMF usage allowances.
5. Place `DMF_QUOTA_DATABASE_PATH` on persistent local storage and set a private, random `DMF_QUOTA_HASH_SECRET` of at least 32 characters.
6. Back up the quota database and monitor disk availability, service errors, quota denials, and OpenAI project spending.
7. Run health, capabilities, tokenless compile, restart-persistence, usage-limit, cache-accounting, and cross-origin smoke tests against the public URL.
8. Only then enable the module's Hosted/Free Forge provider and bake the public compile URL into the release.

## Deployment Boundary

Monthly client and daily client/global usage totals survive process and host restarts when the SQLite database is stored on persistent local storage. The per-minute limiter and successful-result cache remain in memory because they are short-lived safeguards rather than spending ledgers.

The SQLite ledger is intended for a single persistent host. Do not place it on an unreliable network filesystem or run independent hosts with separate copies; a horizontally scaled deployment needs a shared transactional database-backed quota adapter. Keep an independent OpenAI project spending ceiling as the final cost boundary.

Until the public HTTPS URL and its full smoke pass exist, keep Hosted Forge disabled and continue using Bring Your Own API for live tests.
