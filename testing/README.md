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

- Version: `2.22.0-test.3`
- Archive SHA-256: `DF564FC7C1CFEFDC13071F2D5453EFEE9074F77A830BC57A0E5D55DBFE4C7E22`
- Packaged module test files: 14/14 passing
- Hosted provider capabilities and live generation: passing
