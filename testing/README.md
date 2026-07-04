# Dungeon Master's Forge Tester Channel

This channel is for invited pre-launch testers. It uses the new `dungeon-masters-forge` package identity and automatically selects the hosted **Free Forge** provider.

## Install

Paste this URL into Foundry VTT's **Install Module** manifest field:

`https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/codex/package-id-migration/testing/module.json`

If the legacy `codex-item-forge` package is installed, disable it before enabling **Dungeon Master's Forge V2**. Keep it installed through the first launch so the new module can copy its saved settings. Existing generated-item flags remain compatible. Free Forge does not require an endpoint, API token, or personal OpenAI key.

## Testing Allowance

- 20 generation requests per client per calendar month
- Temporary burst and global daily safeguards also apply
- Failed or rejected generation attempts may count against the allowance

This is a temporary testing channel. Its hosted endpoint and update path may change before launch. Do not redistribute it as the final public release.

## Build

- Version: `2.23.0-test.3`
- Archive SHA-256: `593BF6C0DACE6FA68A6558E9FAD839B4E24B7DA70DCA94CA24FA1AC086834DCD`
- Packaged module test files: 20/20 passing
- Live service: `1.6.0` with bounded invalid-output retry and structured request-id errors
