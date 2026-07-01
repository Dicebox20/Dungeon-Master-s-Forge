# Dungeon Master's Forge Release Tasks

Updated: 2026-07-01

## Ready Now

- `2.21.7` module candidate zip exists and is hash-verified.
- Public repo manifest and download URL targets are defined.
- Public tester quickstart and baseline GitHub issue templates are in place.
- The public repo export has been locally advanced to the `2.21.7` candidate.
- LAN-testing instructions exist for the reference AI service.
- The updated AI service passes all 68 source tests, including personal client-key OpenAI mode.

## Needed Before Wider Live Testing

1. Repoint Foundry BYO testing to `http://localhost:8788/v1/forge/compile`, verify the updated live draft-provider handoff, and complete one live AI compile-and-validate smoke pass in `DMF Test World`.
2. Re-run that smoke pass against the patched AI service build that now accepts `pattern` as a live-model alias for Forge `kind`.
3. Verify the manifest install path using the public repo layout:
   - `module/module.json`
   - `releases/dungeon-masters-forge-v2-2.21.7.zip`
4. Confirm GitHub raw URLs resolve publicly after push.
5. Install the module from the public manifest URL on a second machine.
6. Keep the local reference service launch instructions explicit for Windows testers:
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

- Hosted Forge and managed cloud generation
- project access control enforcement
- Active ally auras without a compatible automation path
- Cauldron of Plentiful Resources integration until a compatible release exists
