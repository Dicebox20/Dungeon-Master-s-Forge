# Dungeon Master's Forge Tester Channel

This channel is for invited pre-launch testers. It installs alongside the normal Dungeon Master's Forge module identity and automatically selects the hosted **Free Forge** provider.

## Install

Paste this URL into Foundry VTT's **Install Module** manifest field:

`https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/refs/heads/codex/launch-readiness-docs/testing/module.json`

Enable **Dungeon Master's Forge V2** in a Foundry v14 world using DND5e 5.3.3 or newer. Free Forge does not require an endpoint, API token, or personal OpenAI key.

## Testing Allowance

- 20 generation requests per client per calendar month
- Temporary burst and global daily safeguards also apply
- Failed or rejected generation attempts may count against the allowance

This is a temporary testing channel. Its hosted endpoint and update path may change before launch. Do not redistribute it as the final public release.

## Build

- Version: `2.22.0-test.5`
- Archive SHA-256: `2D6859B9A001FEE2D0D570C964E897C6727236A40EE700E9BEDC89B46E32F37E`
- Packaged module test files: 14/14 passing
- Live service: `1.6.0` with bounded invalid-output retry and structured request-id errors
