# Free Forge Deployment

The current testing service can become the engine for a downloader-accessible free tier, but `localhost` is reachable only from the machine running it. Public module installations need a stable HTTPS endpoint hosted behind a reverse proxy.

## Prepared Service Mode

AI service `1.6.0` provides an explicit `DMF_PUBLIC_FREE_TIER=true` mode. It:

- keeps the OpenAI key only on the server;
- accepts anonymous Forge requests without distributing a shared token;
- permits Foundry installations from arbitrary origins;
- enforces per-minute, per-client calendar-month, and global daily limits;
- persists monthly client and global daily usage in a transactional SQLite ledger;
- stores keyed client digests rather than raw client IP addresses;
- separates clients behind a trusted reverse proxy using `X-Forwarded-For`;
- retains bounded concurrency, queueing, request size, batch size, caching, model allowlisting, and declarative-output validation;
- retries malformed or contract-invalid model output once while leaving operational failures non-retryable;
- advertises public free-tier status through health and capabilities responses.

Use `ai-service/.env.free-tier.example` as the deployment template. Do not place a real key in the repository.

Before starting the public listener, copy the template to `.env`, fill the server-side values, and run `npm run preflight:free-tier`. The command does not call a model or print either secret. A ready report confirms public mode, wildcard origins, proxy trust, bounded quotas, an OpenAI server key, and durable SQLite storage.

For host-admin maintenance during tester validation, `npm run quota:admin -- summary` reports the current SQLite ledger by bucket and period, `npm run quota:admin -- reset-current-month` clears the current `client-month` rows, and `npm run quota:admin -- reset-current-day` clears the current daily client/global rows. Use those reset commands only on a trusted host when you intentionally want to reopen test allowance.

## Required Before Activation

1. Deploy the service to a persistent host with Node.js 22.13 or newer and a stable public HTTPS URL.
2. Put it behind a trusted reverse proxy and configure that proxy to replace, rather than append untrusted, forwarding headers.
3. Store `OPENAI_API_KEY` in the host's secret manager or process environment.
4. Set conservative OpenAI project spending controls independently of the service quotas.
5. Place `DMF_QUOTA_DATABASE_PATH` on persistent local storage and set a private, random `DMF_QUOTA_HASH_SECRET` of at least 32 characters.
6. Back up the quota database and monitor disk availability, service errors, quota denials, and OpenAI project spending.
7. Run health, capabilities, anonymous compile, restart-persistence, quota, and cross-origin smoke tests against the public URL.
8. Only then enable the module's Hosted/Free Forge provider and bake the public compile URL into the release.

## Deployment Boundary

Monthly client and global daily counters survive process and host restarts when the SQLite database is stored on persistent local storage. The per-minute limiter and successful-result cache remain in memory because they are short-lived safeguards rather than spending ledgers.

The SQLite ledger is intended for a single persistent host. Do not place it on an unreliable network filesystem or run independent hosts with separate copies; a horizontally scaled deployment needs a shared transactional database-backed quota adapter. Keep an independent OpenAI project spending ceiling as the final cost boundary.

Until the public HTTPS URL and its full smoke pass exist, keep Hosted Forge disabled and continue using Bring Your Own API for live tests.
