# Remote Provider Contract

Dungeon Master's Forge remote providers use schema version `1.0`. Bring Your Own API uses this contract for live compilation against a user-configured endpoint. Hosted Forge remains disabled until its authentication and entitlement workflows are complete. The contract is also available through `forge.providerContract` for local development and mocked integration tests.

## Endpoint Rules

- Production endpoints must use HTTPS.
- HTTP is accepted for loopback, RFC 1918 private IPv4, and Tailscale's `100.64.0.0/10` private-network testing endpoints.
- Credentials must never be embedded in the endpoint URL.
- URL fragments are rejected.
- Bearer tokens are supplied separately and are not included in the JSON request body.
- The remote service must allow requests from the Foundry browser origin, normally through an appropriate CORS policy.

## Optional Capabilities Discovery

Providers may expose `GET /v1/forge/capabilities` as a read-only preflight endpoint. The endpoint must not invoke a model, consume generation quota, require a request body, or create Foundry documents. Providers that do not implement discovery remain compatible with the Forge `1.0` compile contract.

```json
{
  "service": {
    "name": "Dungeon Master's Forge AI Service",
    "version": "1.0.0"
  },
  "forge": {
    "schemaVersion": "1.0",
    "promptVersion": "1.0.0",
    "supportedKinds": ["weaponExtraDamage"]
  },
  "request": {
    "maxCharacters": 20000,
    "maxItems": 10,
    "unresolvedPolicies": ["review", "block"]
  },
  "features": {
    "batch": true,
    "reviewBeforeCreation": true,
    "declarativeModelOutputOnly": true,
    "executableModelOutput": false,
    "hostedForge": false
  }
}
```

Clients must verify `forge.schemaVersion` and intersect `forge.supportedKinds` with their local supported kinds before treating discovery as compatible. Capability data is informative; normal response validation and explicit review remain mandatory.

## Request

```json
{
  "schemaVersion": "1.0",
  "request": "Create a rare fire dagger",
  "context": {
    "foundryVersion": "14",
    "systemId": "dnd5e",
    "systemVersion": "5.3.3",
    "moduleVersion": "2.8.0",
    "supportedKinds": ["weaponExtraDamage"]
  },
  "options": {
    "model": "",
    "unresolvedPolicy": "review"
  }
}
```

## Response

```json
{
  "schemaVersion": "1.0",
  "compilerVersion": "provider-version",
  "promptVersion": "provider-prompt-version",
  "request": "Create a rare fire dagger",
  "requestCount": 1,
  "specs": [
    {
      "kind": "weaponExtraDamage",
      "name": "Ember Dagger"
    }
  ],
  "decisions": [],
  "assumptions": [],
  "warnings": [],
  "deferred": [],
  "unresolvedMechanics": []
}
```

The module validates the envelope before returning it to the Forge. Item specs still pass through the normal Foundry engine validator and explicit user approval before world documents can be created.

## Module API

```js
const forge = game.modules.get("codex-item-forge").api;
const endpoint = forge.providerContract.normalizeEndpoint("https://example.test/compile");
const body = forge.providerContract.buildRequest("Create a rare fire dagger", options);
const status = await forge.providerContract.requestServiceStatus({
  endpoint,
  token,
  supportedKinds: ["weaponExtraDamage", "chargedHealing"]
});
const result = await forge.providerContract.request({
  endpoint,
  request: "Create a rare fire dagger",
  token,
  context
});
```

`redactConfiguration(value)` returns a cloned diagnostic-safe object with token, key, secret, authorization, password, and credential fields removed.

`requestServiceStatus(options)` checks the configured provider's health and capabilities together so the Forge can report service version, mode, shared item-family compatibility, and rate allowance before a compile request is sent.

## Configuration Profiles

`forge.providerConfiguration.serializeProfile(providerId, configuration)` produces a versioned JSON profile containing only persistable fields. `parseProfile(profile)` rejects API tokens, session-only values, unknown fields, malformed JSON, and incompatible profile versions. A Bring Your Own API profile becomes ready when it has an endpoint; its optional token must still be supplied separately for the current Foundry session. Hosted Forge remains disabled regardless of profile readiness.
