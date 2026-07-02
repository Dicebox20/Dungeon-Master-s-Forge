# Dungeon Master's Forge V2

Dungeon Master's Forge V2 packages the tested Foundry VTT v14 / DND5e v5.3.3 item factory engine as a reusable local module.

## Install

1. Close Foundry VTT.
2. Copy the `codex-item-forge` folder into `{Foundry user data}/Data/modules/`.
3. Start Foundry, open the world, and enable **Dungeon Master's Forge V2** in Manage Modules.
4. Open the Items directory as a GM.
5. Click the hammer button in the Items directory search bar.
6. Use the gear shortcut or **Game Settings > Configure Settings > Module Settings > Dungeon Master's Forge V2** to open Forge Settings.

The module can also be opened from a Script Macro:

```js
game.modules.get("codex-item-forge").api.open();
```

The internal module ID remains `codex-item-forge` so existing macros, settings, and generated-item flags remain compatible.

Bring Your Own API connection details now live in **Forge Settings**. Endpoints and model names are client settings. API tokens remain session-only unless **Remember token on this device** is explicitly checked; remembered tokens are stored in that browser's local Foundry settings and should be used only on a trusted computer. Depending on the service deployment, that token can be either a shared service token or a personal OpenAI API key for client-key mode. For the current local reference service, the canonical endpoint is `http://localhost:8788/v1/forge/compile`.

Use **Check Connection** in Forge Settings before live generation when you want to verify whether the remote service is still in deterministic `mock` mode or has been switched to server-side `openai` mode.

Forge-managed source labels track the installed build version. Custom campaign source labels are preserved during upgrades.

## First Test

1. Enter `Make a rifle that does fire damage` in the left **Description** pane.
2. Click **Compile Request**.
3. Review the generated summary, JSON, assumptions, and warnings in the right **Result** pane.
4. Check the review approval box and click **Create Items**.
5. Confirm the generated rifle has its base piercing damage plus `1d4` fire damage.

The known-good Emberglass Dagger JSON remains available through **Forge Settings > Load Example**.

## Workflow Usability

Description and Result now share the window as split panes, so the request, preview, and JSON editor can be compared without switching tabs. On narrower layouts the panes stack vertically while keeping the same controls and status region.

Provider setup, connection checks, diagnostics, and the example loader now live in a separate Forge Settings panel so the main creation surface stays focused on writing, reviewing, and creating items.

Review presents each generated item as a readable summary of its damage, healing, uses, saves, activities, effects, summons, and unresolved mechanics. Compiler assumptions and warnings appear with the affected item. The exact JSON remains available in the collapsed **Advanced specification editor**.

Creation remains disabled until the current specifications validate and the review approval is checked. Editing the generated specifications immediately clears validation and approval so changed JSON must be checked again.

## Request-To-Spec

The Local Rules provider recognizes a conservative set of confirmed patterns:

- common melee weapons and rifles with bonuses, base damage, and extra damage
- poisoned weapon riders with a Constitution save and timed condition
- passive AC, saving throw, spell attack, spell DC, and damage resistance effects
- charged healing consumables and charged save/damage items
- friendly cat and wolf summons
- Clairvoyance utility casting and Command saving-throw activities
- shared-charge Ice Storm and Cone of Cold staves or wands
- selectable Demon, Devil, and Yugoloth fiend summons
- one-use weapon oils that apply a native extra-damage enchantment
- equipment-based ranged or melee attack activities
- hybrid artifact weapons combining extra attack damage, passive AC, a scripted light toggle, and Flame Strike

Multiple requests can be compiled together. Separate free-form requests with a line containing `---`, or paste multiple detailed blocks that each begin with `Item name:`. The Forge validates and previews the resulting batch before its single approval step.

Generated JSON always remains editable. Missing details become visible assumptions. Class resources, ally auras, and unknown spells become structured `unresolvedMechanics` records with the original requested text, the automation limit, and a recommended manual handling step. The Forge displays these records during review and preserves them on the created item's `flags.codex-item-forge.unresolvedMechanics` data.

Forge Settings includes the generation provider selector. Local Rules compiles requests entirely offline. Bring Your Own API sends the versioned Forge request envelope to a user-configured HTTPS endpoint, with HTTP permitted only for loopback development. Its endpoint and model are client-persisted; its API token is held only in memory for the current Foundry session unless the user explicitly remembers it, and diagnostics redact it either way. The remote service must implement the Forge `1.0` contract and permit requests from the Foundry origin. The reference service now supports both server-key deployments and personal client-key deployments where the Foundry token field supplies the upstream OpenAI key on a trusted device. For local Windows testing, the current recommended launch path is `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-openai-service.ps1 -Port 8788`, with that terminal left open during connection checks and compiles. V2.16 adds explicit optional capabilities preflight for compatible endpoints while preserving providers that omit discovery. Hosted Forge remains disabled until its authentication and access control service is implemented. Portable provider profiles include only persistable fields and reject secrets during import. The unresolved-mechanics policy can allow creation after explicit review or block creation until every record is resolved.

V2.18 adds an explicit connection check for Bring Your Own API. When the remote service exposes the reference `/health` route, the Forge reports whether that service is in `mock` or `openai` mode before any compile request is sent.

V2.19 adds a read-only system-native DND5e content resolver. It can exact-match modern system Spells and Equipment by name, return source UUID provenance, and report compatibility without importing or editing the underlying compendium documents.

## Accepted Input

The editor accepts either a JSON array of item specs:

```json
[
  {
    "kind": "weaponExtraDamage",
    "name": "Example Weapon"
  }
]
```

Or an object containing an `items` array:

```json
{
  "items": [
    {
      "kind": "weaponExtraDamage",
      "name": "Example Weapon"
    }
  ]
}
```

## Module API

```js
const forge = game.modules.get("codex-item-forge").api;

await forge.validate(specs);
await forge.create(specs);
forge.open();
const draft = forge.compile("Make a rifle that does fire damage");
const providerDraft = await forge.compileWithProvider("Make a rifle that does fire damage", {
  providerId: "local-rules",
  configuration: { unresolvedPolicy: "review" }
});
const providers = forge.providers();
const readiness = forge.providerConfiguration.readiness("bring-your-own", configuration);
const safeConfiguration = forge.providerConfiguration.partition("bring-your-own", configuration);
const profile = forge.providerConfiguration.serializeProfile("bring-your-own", configuration);
const imported = forge.providerConfiguration.parseProfile(profile);
const remoteSchema = forge.providerContract.schemaVersion;
const remoteHealth = await forge.providerContract.requestHealth(configuration);
const remoteStatus = await forge.providerContract.requestServiceStatus({
  endpoint: configuration.endpoint,
  token: configuration.apiToken,
  supportedKinds: ["weaponExtraDamage", "chargedHealing"]
});
const health = forge.diagnostics();
const foundryHealth = await forge.diagnosticsWithValidation();
const command = await forge.contentResolver.resolveSpellByName("Command");
const plate = await forge.contentResolver.resolveEquipmentByName("Plate Armor");
```

`forge.example()` returns a cloned known-good example spec.

The Forge window's **Diagnostics** command runs six high-risk compiler families through Foundry validation without creating or deleting any world documents.

`forge.contentResolver.diagnostics()` runs read-only native-content checks against system-owned DND5e packs without creating or changing world documents.

The confirmed factory list and implementation notes are in `docs/supported-patterns.md`. The Bring Your Own API network envelope is documented in `docs/provider-contract.md`.

Current milestones and deferred automation are tracked in `ROADMAP.md`. Tier planning and early access control scaffolding live in `docs/project-tiers.md` and `docs/tier-gating-plan.md`, with an offline planning-tier review pass now available in the Forge settings workflow.

## Scope

This release includes the spec runner, Foundry integration, deterministic natural-language compiler, and a provider-neutral Bring Your Own API adapter. A compatible remote AI service is still required to turn requests into Forge response envelopes. The managed Hosted Forge service remains planned for a later release.

Automated ally auras remain deferred until there is a compatible aura automation path. Existing spell powers should use their closest functional DND5e activity type rather than a utility-only reminder.
