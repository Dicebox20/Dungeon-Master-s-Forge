# Dungeon Master's Forge Launch-Day Runbook

Updated: 2026-07-02

This runbook promotes the verified Free Forge tester channel to the stable Foundry manifest without discarding the last known-good release.

## Current Baseline

- Stable module: `2.21.12`
- Tester module: `2.23.0-test.1`
- AI service: `1.6.0`
- Free Forge allowance: 20 generation requests per client per calendar month
- Stable manifest: `module/module.json`
- Tester manifest: `testing/module.json`

## Go Or No-Go

Do not promote the tester build unless all of these are true:

- a second computer installs from the tester manifest
- Free Forge connects without endpoint or token entry
- at least one request compiles, validates, and creates a working Foundry item
- the permanent project hostname resolves over HTTPS
- health and capabilities succeed through the permanent hostname
- the OpenAI project spending ceiling is active
- the Droplet quota backup timer and service restart checks pass
- the launch screenshots and support links are ready

## 1. Permanent Hostname

1. Point the chosen project hostname's DNS `A` record to the Droplet.
2. Replace the temporary staging hostname in Caddy with the project hostname.
3. Let Caddy obtain the TLS certificate.
4. Verify `/health`, `/v1/forge/capabilities`, CORS preflight, and one compile through the permanent hostname.
5. Keep port `8788` private; only Caddy should expose the service.

Never place the OpenAI key, quota hash secret, or private environment file in GitHub or Foundry settings.

## 2. Stable Candidate

1. Copy the verified tester module into a new stable candidate directory.
2. Replace the temporary hosted endpoint with the permanent HTTPS compile endpoint.
3. Choose the stable version, expected to be `2.22.0` unless testing requires another candidate.
4. Change the embedded manifest and download URLs from the testing branch to the stable `main` paths.
5. Run every module test from source and from an independently extracted ZIP.
6. Run capabilities and one live generation through the packaged Hosted Forge adapter.
7. Record the ZIP SHA-256 in the release status.

## 3. Final Foundry Pass

On a clean or non-development computer:

1. Install the stable candidate from its candidate manifest.
2. Enable it in a Foundry v14 / DND5e 5.3.3 world.
3. Confirm **Free Forge** is selected automatically.
4. Compile a simple weapon and one complex item.
5. Review and create both items.
6. Inspect activities, damage, effects, charges, images, and summon actors where applicable.
7. Restart Foundry and repeat **Check Connection**.

No test should delete or replace unrelated world documents.

## 4. GitHub Promotion

1. Preserve the `2.21.12` ZIP under `releases/`.
2. Add the new stable ZIP under `releases/`.
3. Update `module/module.json` to the stable version and ZIP.
4. Update README, changelog, status, tester notes, and manifest links.
5. Verify the raw manifest and ZIP return HTTP 200.
6. Merge the reviewed release pull request.
7. Install once from the final `main/module/module.json` URL.

Do not delete the testing branch while any tester installation still uses its manifest.

## 5. project Quiet Launch

Publish only the launch-day tiers:

- **Apprentice (Free):** module access plus 20 hosted generation requests per calendar month
- **early supporter:** **Thank you for your support.** No additional product gate at launch

Link project visitors to the GitHub README, stable manifest, known limitations, and bug-report template. Avoid advertising access control checks, image generation, scene transfer, or other roadmap features as available.

## First 24 Hours

Monitor:

- service health and restart count
- HTTP `429`, `502`, and timeout frequency
- global daily usage and OpenAI project spending
- quota database backup completion and disk space
- GitHub bug reports and reproducible item requests

Do not log API keys, tokens, raw client addresses, or private Foundry world data.

## Rollback

If the stable release or hosted service causes a launch-blocking problem:

1. Restore `module/module.json` to version `2.21.12` and its existing ZIP URL.
2. Keep both release ZIPs in GitHub; never overwrite or delete the known-good archive.
3. Disable Hosted Forge in the next module patch if the service itself is the problem.
4. Keep Local Rules and Bring Your Own API available as fallback providers.
5. Post a short known-issue notice with the affected version and workaround.
6. Fix and test on the tester channel before attempting another stable promotion.

The Droplet deployment has its own timestamped application, environment, and quota backups. Restore those only when the service release itself must be rolled back.
