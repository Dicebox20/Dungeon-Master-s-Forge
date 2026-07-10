# Dungeon Master's Forge Release Tasks

Updated: 2026-07-03

## Ready Now

- `2.23.0` workspace stable-manifest candidate zip exists and is hash-verified.
- Public repo manifest and download URL targets are defined.
- Public tester quickstart and baseline GitHub issue templates are in place.
- The public repo export has been locally advanced to the `2.23.0` candidate.
- LAN-testing instructions exist for the reference AI service.
- AI service `1.6.0` now passes all 117 source tests, including the 20-request calendar-month allowance, durable quota persistence, client pseudonymization, bounded invalid-output retry, safe failure-code logging, tester-output recovery, and the July 3 hybrid-shape normalization regressions.
- The Tailscale endpoint-support pull request is merged into GitHub `main`.
- A local true AI compile has succeeded end to end without creating a world document during the smoke proof.
- The official Droplet service runs `1.6.0` behind HTTPS with bounded model-output retry and preserved rollback backups.
- The official Droplet service now has a documented quota-maintenance path for trusted tester resets via `npm run quota:admin`.
- A separate `2.23.0-test.2` manifest migrates the package identity, automatically connects invited testers to Free Forge, removes obsolete project planning gates, and includes the current live-tester normalization repairs.
- The public manifest and stable release ZIP target now agree on `2.23.0` in the workspace, and the module suite will fail fast if that archive goes missing locally.
- A live Foundry pass on the current machine now succeeds through hosted Free Forge compile, review, approval, and item creation for a simple `weaponExtraDamage` item.

## Needed Before Wider Live Testing

1. Install the module from the dedicated tester manifest URL on a second machine.
2. Complete one Tailscale connection and live compile from that second machine.
3. Complete one post-compile item creation and inspect the resulting activities and effects on a second machine.
4. Capture one clean screenshot of the repaired `2.23.0-test.2` split Description/Result workflow during a successful live-generated item review.
5. Keep the local reference service launch instructions explicit for Windows testers:
   - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\start-openai-service.ps1 -Port 8788`
   - leave the service terminal open during local testing if detached launchers do not stay alive reliably
6. Repeat one Foundry-side hosted Free Forge live compile on a second machine, specifically using one mixed-family prompt from the `hybrid` regression pack.

## Needed Before project Promotion

1. Review [PROJECT_LAUNCH_CHECKLIST.md](./PROJECT_LAUNCH_CHECKLIST.md) and keep it aligned with the real release state.
2. Review [FOUNDRY_SUBMISSION_BRIEF.md](./FOUNDRY_SUBMISSION_BRIEF.md) and keep the staff-facing answers aligned with the real release state.
3. Keep README language explicit about the difference between the hosted Free Forge tester lane and the stable public release.
4. Keep project copy explicit about the real hosted limits, current staging/launch status, and fallback Bring Your Own API support.
5. Gather at least one clean screenshot of:
   - the split Description/Result workflow
   - a successful generated item in Foundry
6. Confirm the public repo is the clean surface you want people to see first.
7. Point a permanent project-owned hostname at the official Droplet and repeat the public smoke test through that hostname.
8. Complete every remaining requirement in [FREE_TIER_DEPLOYMENT.md](./FREE_TIER_DEPLOYMENT.md) before enabling Hosted Forge in the public module.

## Optional Hosted Support Improvements

- Add opt-in error report submission from the Foundry module to the official Droplet.
- Error reports must be disabled by default, require clear GM consent, and redact API keys, bearer tokens, prompts, generated item text, actor data, item data, and world content.
- Safe payload candidates: module version, Foundry version, DND5e version, provider id, endpoint host, HTTP status, Forge error code, request id, browser user-agent family, and a short sanitized stack trace.
- The Droplet should store reports separately from the compile quota ledger, enforce request limits, and include retention/deletion guidance before public launch.

## Needed Before Multi-Computer AI Testing

1. Run the AI service with:
   - `DMF_HOST=0.0.0.0`
   - `DMF_ALLOWED_ORIGINS` containing each Foundry origin that will connect
2. Keep the service on a trusted LAN only, or place it behind your own HTTPS proxy.
3. Decide whether the lane is:
   - server-key mode with `OPENAI_API_KEY` on the service host, or
   - client-key mode with the OpenAI key stored only in each trusted Foundry browser
4. Use a nontrivial `DMF_CLIENT_TOKEN` if more than one browser will connect in server-key mode.
5. Validate `Check Connection` from at least one remote Foundry browser before live compilation.

## Still Deferred

- Automatic Hosted/Free Forge access in the stable manifest until the project-owned hostname and final public-module smoke pass exist
- project access control enforcement
- Active ally auras without a compatible automation path
- Cauldron of Plentiful Resources integration until a compatible release exists
