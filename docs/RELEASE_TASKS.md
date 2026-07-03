# Dungeon Master's Forge Release Tasks

Updated: 2026-07-02

## Ready Now

- `2.21.12` module candidate zip exists and is hash-verified.
- Public repo manifest and download URL targets are defined.
- Public tester quickstart and baseline GitHub issue templates are in place.
- The public repo export has been locally advanced to the `2.21.12` candidate.
- LAN-testing instructions exist for the reference AI service.
- AI service `1.6.0` passes all 86 source tests, including the 20-request calendar-month allowance, durable quota persistence, client pseudonymization, bounded invalid-output retry, and safe failure-code logging.
- The Tailscale endpoint-support pull request is merged into GitHub `main`.
- A local true AI compile has succeeded end to end without creating a world document during the smoke proof.
- The official Droplet service runs `1.6.0` behind HTTPS with bounded model-output retry and preserved rollback backups.
- A separate `2.23.0-test.1` manifest migrates the package identity, automatically connects invited testers to Free Forge, removes obsolete project planning gates, and displays structured service failures.
- The public manifest and `2.21.12` release ZIP URLs both return HTTP 200 from GitHub raw content.

## Needed Before Wider Live Testing

1. Install the module from the dedicated tester manifest URL on a second machine.
2. Complete one Tailscale connection and live compile from that second machine.
3. Complete one post-compile item creation and inspect the resulting activities and effects.
4. Keep the local reference service launch instructions explicit for Windows testers:
   - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\start-openai-service.ps1 -Port 8788`
   - leave the service terminal open during local testing if detached launchers do not stay alive reliably

## Needed Before project Promotion

1. Review [PROJECT_LAUNCH_CHECKLIST.md](./PROJECT_LAUNCH_CHECKLIST.md) and keep it aligned with the real release state.
2. Keep README language explicit that Hosted Forge is still deferred.
3. Keep project copy explicit that the supported live lane today is Bring Your Own API.
4. Gather at least one clean screenshot of:
   - the split Description/Result workflow
   - a successful generated item in Foundry
5. Confirm the public repo is the clean surface you want people to see first.
6. Point a permanent project-owned hostname at the official Droplet and repeat the public smoke test through that hostname.
7. Complete every remaining requirement in [FREE_TIER_DEPLOYMENT.md](./FREE_TIER_DEPLOYMENT.md) before enabling Hosted Forge in the public module.

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
