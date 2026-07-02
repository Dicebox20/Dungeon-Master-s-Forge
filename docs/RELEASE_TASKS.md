# Dungeon Master's Forge Release Tasks

Updated: 2026-07-01

## Ready Now

- `2.21.12` module candidate zip exists and is hash-verified.
- Public repo manifest and download URL targets are defined.
- Public tester quickstart and baseline GitHub issue templates are in place.
- The public repo export has been locally advanced to the `2.21.12` candidate.
- LAN-testing instructions exist for the reference AI service.
- AI service `1.3.0` passes all 73 source tests, including personal client-key mode and bounded public free-tier alpha access.

## Needed Before Wider Live Testing

1. Verify the manifest install path using the public repo layout:
   - `module/module.json`
   - `releases/dungeon-masters-forge-v2-2.21.12.zip`
2. Confirm GitHub raw URLs resolve publicly after push.
3. Install the module from the public manifest URL on a second machine.
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
6. Decide whether launch uses only Bring Your Own API or also the prepared free-tier alpha service.
7. If enabling the free-tier service, complete every requirement in [FREE_TIER_DEPLOYMENT.md](./FREE_TIER_DEPLOYMENT.md) before enabling Hosted Forge in the module.

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

- Automatic Hosted/Free Forge module access until a stable public HTTPS endpoint and durable quotas exist
- project access control enforcement
- Active ally auras without a compatible automation path
- Cauldron of Plentiful Resources integration until a compatible release exists
