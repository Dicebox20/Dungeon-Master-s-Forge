# Dungeon Master's Forge Tester Quickstart

This is the shortest path for a trusted tester to install the current module build and try item generation without digging through the full project docs.

Updated: 2026-07-01

## What You Need

- Foundry VTT v14
- DND5e system 5.3.3
- The Dungeon Master's Forge module manifest:
  - `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
- For live AI generation:
  - a reachable Forge-compatible service endpoint
  - either a shared service token or a personal OpenAI API key, depending on how the service owner set it up

## Recommended Companion Modules

These are the companions the current Forge workflow is designed to live beside:

- Midi-QOL
- DAE
- Item Macro

The Forge can still run its local deterministic workflow without every companion enabled, but these are the main compatibility targets for richer automation output.

## Install The Module

1. In Foundry, open **Add-on Modules**.
2. Click **Install Module**.
3. Paste the manifest URL:
   - `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/main/module/module.json`
4. Install **Dungeon Master's Forge V2**.
5. Open your world and enable the module in **Manage Modules**.

## Open The Forge

Use either:

- the hammer button in the Items directory
- the inline hammer shortcut in the Items directory controls
- **Game Settings > Configure Settings > Module Settings > Dungeon Master's Forge V2**

## If You Only Want Offline Testing

1. Open **Forge Settings**.
2. Set the provider to **Local Rules**.
3. Save.
4. Open the Forge and compile a simple request such as:
   - `Make a dagger that does additional fire damage`

This path does not require any external AI service.

## If You Want Live AI Testing

1. Open **Forge Settings**.
2. Set the provider to **Bring Your Own API**.
3. Enter:
   - the Forge compile endpoint
   - the model name allowed by that service
   - the API token field value required by that service
4. Click **Check Connection**.
5. Confirm the status reports a healthy connection before compiling requests.

For the current reference service, the intended live compile endpoint is:

- `http://localhost:8788/v1/forge/compile`

Depending on the service deployment:

- in server-key mode, the Foundry **API token** should be the shared `DMF_CLIENT_TOKEN`
- in client-key mode, the Foundry **API token** should be the tester's own OpenAI API key

## First Smoke Test

Use a small request first:

- `Make a dagger that does additional fire damage`

Then:

1. Click **Compile Request**.
2. Review the generated item in the **Result** pane.
3. Check the approval box.
4. Click **Create Items**.
5. Open the created item and verify the extra damage entry exists.

## Current Known Limits

- Hosted Forge is not live yet.
- Patreon entitlement enforcement is not live yet.
- Ally aura automation is still deferred.
- Class-resource restoration automation is still deferred.
- Cauldron of Plentiful Resources is currently incompatible with this Foundry version and should remain optional.

## Where To Read More

- Project overview: [../README.md](../README.md)
- Module guide: [../module/README.md](../module/README.md)
- Reference service setup: [../ai-service/README.md](../ai-service/README.md)
- Release status: [./STATUS.md](./STATUS.md)
