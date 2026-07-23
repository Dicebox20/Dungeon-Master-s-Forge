# Dungeon Master's Forge

Dungeon Master's Forge is a reusable Foundry VTT module for creating and reviewing DND5e items.

It is tested with Foundry VTT v14 and DND5e v5.3.3. Describe an item, review the generated details, and create it in your world only after you approve the result.

Dungeon Master's Forge is an unofficial community module for Foundry VTT and is not affiliated with or endorsed by Foundry Virtual Tabletop, Wizards of the Coast, or the DND5e system team. For the Foundry package directory, it is a runtime tool that turns live user prompts into structured content; it is not a bundled content pack, rules replacement, or background generator.

## Install

1. Close Foundry VTT.
2. Copy the `dungeon-masters-forge` folder into `{Foundry user data}/Data/modules/`.
3. Start Foundry, open the world, and enable **Dungeon Master's Forge** in Manage Modules.
4. Open the Items directory as a GM.
5. Click the hammer button in the Items directory search bar.
6. Use the gear shortcut or **Game Settings > Configure Settings > Module Settings > Dungeon Master's Forge** to open Forge Settings.

The module can also be opened from a Script Macro:

```js
game.modules.get("dungeon-masters-forge").api.open();
```

The public module ID is `dungeon-masters-forge`. On first launch, it copies saved settings from the previous package namespace when the new setting has not already been configured. Existing generated items from the previous package remain readable; newly created documents use `flags.dungeon-masters-forge`.

Bring Your Own API settings are in **Forge Settings**. You can enter the endpoint and model used by your service there. API tokens stay in memory for the current Foundry session unless you explicitly check **Remember token on this device**. If you do, Foundry stores the token in that browser's local settings, so only use that option on a computer you trust. Depending on the service, the token may be a shared service token or a personal OpenAI API key. For the local reference service, use `http://localhost:8788/v1/forge/compile`.

When a supported item needs Item Macro automation, the Forge displays the exact generated code before creation and requires a separate automation acknowledgement. Review that code before approving it. External providers receive the request text and generated specifications; do not include secrets or private campaign details. If a reviewed network result needs correction, the unchanged request becomes **Retry** and opens a separate **SEND IT AGAIN!?** confirmation. That request includes the current reviewed JSON, review notes, validation findings, and your repair note; the returned result must be reviewed and approved again. Optional anonymous diagnostics remain separately opt-in and exclude prompts, raw specifications, tokens, and world documents.

Use **Check Connection** in Forge Settings before live generation. It tells you whether the remote service is reachable and whether it is running in deterministic `mock` mode or server-side `openai` mode.

Generated item sheets do not add a visible Forge credit line or source label, so GMs can present their own creations cleanly. The module still keeps private Forge flags for troubleshooting and migration.

## First Test

1. Enter `Make a rifle that does fire damage` in the left **Description** pane.
2. Click **Preview**.
3. Review the generated summary, JSON, assumptions, and warnings in the right **Result** pane.
4. Check the review approval box and click **Create Items**.
5. Confirm the generated rifle has its base piercing damage plus `1d4` fire damage.

The known-good Emberglass Dagger JSON remains available through **Forge Settings > Load Example**.

## Workflow Usability

Description and Result now share the window as split panes, so the request, preview, and JSON editor can be compared without switching tabs. On narrower layouts the panes stack vertically while keeping the same controls and status region.

Provider setup, connection checks, diagnostics, and the example loader now live in a separate Forge Settings panel so the main creation surface stays focused on writing, reviewing, and creating items.

Each generated item is shown as a readable summary of its damage, healing, uses, saves, activities, effects, summons, and unresolved mechanics. Assumptions and warnings appear beside the item they affect. The exact JSON is still available in the collapsed **Advanced specification editor**.

Creation stays disabled until the current specifications validate and you approve the review. If you edit the generated specifications, validation and approval are cleared so the changed JSON must be checked again.

## What It Can Interpret

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

The generated JSON stays editable. Missing details become visible assumptions. Class resources, ally auras, and unknown spells become structured `unresolvedMechanics` records with the original request, the automation limit, and a suggested manual next step. The Forge shows these records during review and preserves them on the created item's `flags.dungeon-masters-forge.unresolvedMechanics` data.

Forge Settings includes the generation provider selector. Local Rules compiles requests entirely offline. Bring Your Own API sends the versioned Forge request envelope to a user-configured HTTPS endpoint, with HTTP permitted for loopback, RFC 1918 LAN, and Tailscale private-network testing. The endpoint and model are saved as client settings; the API token stays in memory for the current Foundry session unless you explicitly choose to remember it, and diagnostics redact it either way. The remote service must implement the Forge `1.0` contract and allow requests from the Foundry browser origin.

The reference service supports server-key deployments, personal client-key deployments, and a bounded public Free Forge mode. For local Windows testing, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-openai-service.ps1 -Port 8788`, and leave that terminal open while you check the connection or compile an item. Compatible endpoints can expose a read-only capabilities check, but providers that do not offer discovery still work with the Forge `1.0` contract. Free Forge is configured by the release: stable builds can keep it conservative until the hosted service is re-verified, while tester builds may select it automatically with the current allowance.

Provider profiles save only settings that are safe to persist and reject secrets during import. The unresolved-mechanics setting lets you either create an item after reviewing the remaining notes or block creation until every note is resolved. When the connected service exposes `/health`, **Check Connection** also reports whether it is running in `mock` or `openai` mode. The read-only system content resolver can match modern DND5e Spells and Equipment by name, show the source UUID, and report compatibility without importing or editing the underlying compendium documents.

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
const forge = game.modules.get("dungeon-masters-forge").api;

await forge.validate(specs);
await forge.create(specs, { authorizeGeneratedAutomation: true });
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

`forge.create` refuses to create a specification that contains generated automation code unless the caller passes `authorizeGeneratedAutomation: true` after presenting and reviewing the code. The Forge window supplies that acknowledgement through its **Approve automation** checkbox. The isolated verification harness uses the same boundary only for tagged document creation and never executes an activity.

The Forge window's **Diagnostics** command runs six high-risk compiler families through Foundry validation without creating or deleting any world documents.

`forge.contentResolver.diagnostics()` runs read-only native-content checks against system-owned DND5e packs without creating or changing world documents.

The confirmed factory list and implementation notes are in `docs/supported-patterns.md`. The Bring Your Own API network envelope is documented in `docs/provider-contract.md`.

Current milestones and deferred automation are tracked in `ROADMAP.md`.

## Scope

This release includes the spec runner, Foundry integration, deterministic prompt compiler, and a provider-neutral Bring Your Own API adapter. A compatible remote service is still needed to turn prompts into Forge response envelopes. Hosted access is release-dependent: the stable package stays conservative, while an invited tester build may connect to a bounded Free Forge service.

Automated ally auras remain deferred until there is a compatible aura automation path. Existing spell powers should use their closest functional DND5e activity type rather than a utility-only reminder.
