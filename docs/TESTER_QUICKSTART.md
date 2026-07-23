# Dungeon Master's Forge Tester Quickstart

This is the quickest way for a trusted tester to install the current build and try item generation without digging through the full project documentation.

Updated: 2026-07-18

## What You Need

- Foundry VTT v14
- DND5e system 5.3.3
- The Dungeon Master's Forge tester manifest:
  - `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
- An internet connection for hosted Free Forge generation

## Recommended Companion Modules

These are the companions the current Forge workflow is designed to live beside:

- Midi-QOL
- DAE
- Item Macro

The Forge can still run its local deterministic workflow without every companion module enabled. These are the main compatibility targets when you want richer automation.

## Install The Module

1. In Foundry, open **Add-on Modules**.
2. Click **Install Module**.
3. Paste the tester manifest URL:
   - `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`
4. Install **Dungeon Master's Forge**.
5. If the legacy package is installed, disable it and enable the new **Dungeon Master's Forge** package.
6. Keep the legacy package installed through this first launch so its saved settings can migrate.

## Open The Forge

Use either:

- the hammer button in the Items directory
- the inline hammer shortcut in the Items directory controls
- **Game Settings > Configure Settings > Module Settings > Dungeon Master's Forge**

## If You Only Want Offline Testing

1. Open **Forge Settings**.
2. Set the provider to **Local Rules**.
3. Save.
4. Open the Forge and compile a simple request such as:
   - `Make a dagger that does additional fire damage`

This path does not require any external AI service.

## If You Want Live AI Testing

The tester build should select **Free Forge** automatically. You do not need to enter an endpoint, model, API token, or personal OpenAI key.

1. Open **Forge Settings**.
2. Confirm the provider is **Free Forge**.
3. Click **Check Connection**.
4. Confirm the status reports a healthy connection before compiling requests.

The hosted testing allowance is measured by usage rather than a fixed number of prompts. Simple items use less of the monthly allowance, while longer and more complicated requests use more. Temporary per-minute and global daily safeguards also apply. Fresh generation work can use allowance even when the result needs review, while cached results do not.

If you have your own compatible API access, use **Bring Your Own API** without drawing from the hosted Free Forge allowance. Your provider's own usage limits and billing still apply, and a ChatGPT subscription alone does not automatically include API credits because ChatGPT subscriptions and API access are separate.

### Optional Bring Your Own API Testing

Bring Your Own API remains available for testers who need a private service or their own usage pool. Select it in **Forge Settings**, then enter the compatible endpoint, model, and token required by that service.

For the current reference service, the intended live compile endpoint is:

- `http://localhost:8788/v1/forge/compile`

If you are running the reference service locally on Windows, the most reliable launch path during testing is:

```powershell
cd "<your Dungeon Master's Forge checkout>\ai-service"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-openai-service.ps1 -Port 8788
```

Leave that terminal window open while Foundry checks the connection and compiles requests.

Depending on the service deployment:

- in server-key mode, the Foundry **API token** should be the shared `DMF_CLIENT_TOKEN`
- in client-key mode, the Foundry **API token** should be the tester's own OpenAI API key

### Testing From Another Network With Tailscale

1. Install Tailscale on the service computer and the tester computer.
2. Sign both computers into the same tailnet.
3. Start the reference service with `DMF_HOST=0.0.0.0` and allow the tester's Foundry origin.
4. In Foundry, use `http://<service-computer-tailscale-ip>:8788/v1/forge/compile` as the endpoint.
5. Keep port `8788` private; ordinary internet router port forwarding is not required for Tailscale testing.
6. Click **Check Connection** before attempting a live compile.

The module accepts HTTP only for loopback and recognized private-network ranges, including Tailscale's `100.64.0.0/10` range. Public endpoints must use HTTPS.

## First Smoke Test

Use a small request first:

- `Make a dagger that does additional fire damage`

Then:

1. Click **Preview**.
2. Review the generated item in the **Result** pane.
3. Check the approval box.
4. Click **Create Items**.
5. Open the created item and verify the extra damage entry exists.

## Current Known Limits

- Free Forge is a temporary tester service and still uses a staging hostname.
- On some local Windows setups, the reference AI service is more reliable when left running in an open terminal window during testing.
- Ally aura automation is still deferred.
- Class-resource restoration automation is still deferred.
- Cauldron of Plentiful Resources is currently incompatible with this Foundry version and should remain optional.

## Where To Read More

- Project overview: [../README.md](../README.md)
- Module guide: [../module/README.md](../module/README.md)
- Reference service setup: [../ai-service/README.md](../ai-service/README.md)
- Release status: [./STATUS.md](./STATUS.md)
