# Free Forge Deployment

The current testing service can become the engine for a downloader-accessible free tier, but `localhost` is reachable only from the machine running it. Public module installations need a stable HTTPS endpoint hosted behind a reverse proxy.

## Prepared Service Mode

AI service `1.3.0` adds an explicit `DMF_PUBLIC_FREE_TIER=true` mode. It:

- keeps the OpenAI key only on the server;
- accepts anonymous Forge requests without distributing a shared token;
- permits Foundry installations from arbitrary origins;
- enforces per-minute, per-client daily, and global daily limits;
- separates clients behind a trusted reverse proxy using `X-Forwarded-For`;
- retains bounded concurrency, queueing, request size, batch size, caching, model allowlisting, and declarative-output validation;
- advertises public free-tier status through health and capabilities responses.

Use `ai-service/.env.free-tier.example` as the deployment template. Do not place a real key in the repository.

## Required Before Activation

1. Deploy the service to a host with a stable public HTTPS URL.
2. Put it behind a trusted reverse proxy and configure that proxy to replace, rather than append untrusted, forwarding headers.
3. Store `OPENAI_API_KEY` in the host's secret manager or process environment.
4. Set conservative OpenAI project spending controls independently of the service quotas.
5. Run health, capabilities, anonymous compile, quota, and cross-origin smoke tests against the public URL.
6. Add durable quota/accounting storage before treating the free tier as a permanent launch service.
7. Only then enable the module's Hosted/Free Forge provider and bake the public compile URL into the release.

## Current Limitation

The new daily counters are in memory. A process restart resets them, and multiple service instances do not share their totals. This is suitable for a controlled alpha with an independent provider spending ceiling, but not yet for an unrestricted production launch.

Until the public HTTPS URL and durable accounting exist, keep Hosted Forge disabled and continue using Bring Your Own API for live tests.
