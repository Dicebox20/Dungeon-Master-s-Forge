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

- Version: `2.22.0-test.4`
- Archive SHA-256: `41D662976A6AF724C519E7BC8AC5E441EF963BC0E42EFDB1B9ADFCB7E83C80DD`
- Packaged module test files: 14/14 passing
- Hosted provider capabilities and live generation: inherited unchanged from the passing `test.3` smoke
