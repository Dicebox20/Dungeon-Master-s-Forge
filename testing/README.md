# Dungeon Master's Forge Tester Guide

Welcome, and thank you for helping us test Dungeon Master's Forge. This is a temporary pre-launch channel for Foundry VTT and DND5e.

See the [public tester list](testers.md) for the people currently helping with testing.

The current public tester build is **2.23.1-test.63**. This is a review-first tool: it prepares Foundry data for you to inspect, but it does not replace your rules judgment or create anything until you approve it.

## Contents

- [Start Here](#start-here)
- [Install the Tester Build](#install-the-tester-build)
- [Run Your First Test](#run-your-first-test)
- [Prompt Guidelines](#prompt-guidelines)
- [Feature Menu](DMF_FEATURE_MENU_FOR_TESTERS.md)
- [What Free Forge Can Do](#what-free-forge-can-do)
- [Current Free Forge Limits](#current-free-forge-limits)
- [What We Need From Testers](#what-we-need-from-testers)
- [Ten-Prompt Sweep](TESTER_PROMPT_SWEEP_2026-07-23.md)
- [Repair a Result](#repair-a-result)
- [Bring Your Own API](#bring-your-own-api)
- [Keep API Keys Safe](#keep-api-keys-safe)
- [Feedback Template](#feedback-template)

## Start Here

The easiest way to help is:

1. Install the tester build.
2. Leave the provider set to **Free Forge**.
3. Try a few item prompts.
4. Review the preview and notes before creating anything.
5. Tell us what worked and what did not.

Our goal is to make Foundry item creation easier for people who are not comfortable writing JavaScript or building item data by hand.

## Install the Tester Build

1. In Foundry VTT, open **Add-on Modules**.
2. Click **Install Module**.
3. Paste this manifest URL:

   `https://raw.githubusercontent.com/Dicebox20/Dungeon-Master-s-Forge/dm_forge/tester/testing/module.json`

4. Install or update **Dungeon Master's Forge**.
5. Enable the module in your test world.
6. Open **Game Settings > Configure Settings > Module Settings > Dungeon Master's Forge**.
7. Confirm that the provider is **Free Forge**.
8. Click **Check Connection** before your first live test.

The current tester build is `2.23.1-test.63`. Free Forge does not require a personal endpoint, API token, or OpenAI key.

For a first session, run one simple item, one item with charges or healing, and one more complicated item with a mechanic you are comfortable checking in Foundry. Stop and review whenever the Forge marks a mechanic for manual review.

Use the [Dungeon Master's Forge Feature Menu](DMF_FEATURE_MENU_FOR_TESTERS.md) when you want to choose a specific item feature or automation behavior.

For a ready-made progression from simple items to the current supported automation boundary, use the [ten-prompt tester sweep](TESTER_PROMPT_SWEEP_2026-07-23.md). Each prompt has a short checklist for preview, JSON, created-document, live-behavior, and review-note checks.

## Run Your First Test

Start with a simple prompt such as:

```text
Create an uncommon dagger named "Emberglass Dagger" that deals an extra 1d4 fire damage on a hit.
```

Then:

1. Click **Preview**.
2. Read the generated item summary.
3. Read the review notes, including any warnings or Free Forge limitations.
4. If the result matches your request, check **Approve**.
5. Click **Create Items**.
6. Open the created item in Foundry and check its activities, damage, effects, charges, and targeting.

Do not approve an item just to make a test pass. If the result is wrong, keep the item unapproved and report what happened.

## Prompt Guidelines

Choose the kind of test you want before writing the prompt.

### If You Want the Best Chance of Success

Use precise language and leave as few choices as possible for the model:

1. Name the exact item type, such as longsword, wand, potion, or shield.
2. Give the item a unique name.
3. State exact bonuses, dice, damage types, save abilities, DCs, durations, ranges, and targets.
4. State the number of charges, the cost of each power, and how the charges recover.
5. Name the spell or SRD creature exactly when you want one specific supported entry.
6. Say whether attunement is required or not required.
7. Keep unrelated mechanics in separate prompts when possible.

Example:

```text
Create a rare longsword named "Ashfang". It requires attunement, gives a +1 magical bonus, and deals an extra 1d6 fire damage on every hit. On a hit, the target makes a DC 13 Constitution save; on a failure, it is poisoned for 1 minute. It has 6 charges, all charges recover on a long rest, and it can cast Burning Hands for 2 charges.
```

### If You Want to Test the Language Model

Speak plainly, the way you would normally describe an item to another person. Try ordinary wording, typos, slang, incomplete details, and different sentence structures. Do not rewrite the prompt to make it easier after a failure; the wording itself is the test.

When testing everyday language, pay attention to whether the Forge:

- understands the item you meant
- preserves the important mechanics
- makes a reasonable assumption and labels it clearly
- leaves an unsupported detail for manual review instead of inventing a working effect
- explains any Free Forge limitation honestly

Both styles are useful. Precise prompts test whether a supported mechanic works, while plain-language prompts test the quality of the model interpretation and review process.

## What Free Forge Can Do

Free Forge can combine safe, supported DND5e item mechanics instead of limiting each request to one fixed item family. Current capabilities include:

- weapons with magical bonuses and extra damage
- on-hit saving throws, conditions, and passive effects
- staffs, wands, and other charged items
- healing items and consumables
- armor, shields, and enchantments
- supported summons using exact DND5e SRD creatures
- items with several supported activities or powers

It creates structured Foundry data and shows review notes before creation. It does not mean that every possible DND5e rule or every creative request runs without manual review.

## Current Free Forge Limits

Free Forge uses a monthly hosted-usage allowance instead of counting every prompt equally. Small, straightforward items use less of the allowance. Large prompts and complicated items use more. This lets testers choose between several ambitious items or a larger number of simple ones while we continue paying for the service out of pocket.

The service also has temporary safety limits:

- a short-term per-minute safeguard to prevent accidental bursts and abuse
- a monthly per-tester usage allowance and a global daily cost ceiling
- fresh model work can use allowance even when the result needs review; cached results do not
- complex, unsupported, or ambiguous mechanics may be preserved as a warning, Free Forge limitation, or manual-review note
- exact SRD summons require an installed DND5e SRD actor with the expected name
- the service does not create macros, scripts, automatic migrations, campaign content, or unsafe executable data; supported trusted automation is materialized locally only when the current world has the required modules and settings

If you have your own compatible API setup, **Bring Your Own API** does not use the hosted Free Forge allowance. Your provider's own billing, usage limits, and terms still apply. A ChatGPT or Claude subscription does not automatically become API credit.

## What We Need From Testers

Please try both straightforward prompts and prompts with unusual wording, typos, slang, or different levels of detail. We especially need:

- simple weapons with extra damage
- weapons with on-hit saving throws and conditions
- charged spells and long-rest recovery
- healing formulas and one-creature targeting
- armor, shields, consumables, and enchantments
- summons and supported hybrid items
- prompts that leave one detail open so you can review our assumptions

For each test, please look at the preview before creation. When possible, open the created item and try the relevant activity safely. We are especially interested in whether the item looks right in Foundry and whether the activity behaves as expected.

## Automation Questionnaires

For focused automation testing, use the [one-at-a-time automation sweep and questionnaires](AUTOMATION_ONE_AT_A_TIME_SWEEP_2026-07-23.md). Run one prompt at a time with a fresh item name and run tag. Answer every question with `PASS`, `PARTIAL`, `MANUAL`, `FAIL`, or `NOT TESTED` so results can be compared across testers.

The questionnaires check four stages separately:

- Preview: item name, item type, activities, effects, review notes, selected automation layer, and required modules.
- Foundry document: imported fields, resources, targeting, saving throws, effects, and other stored data.
- Live behavior: what the activity actually does when used safely in Foundry.
- Review quality: whether the Forge accurately identifies supported behavior, assumptions, fallbacks, and real blockers.

Do not mark an item `PASS` because it imported successfully. Use `PARTIAL` when the base item works but an automation is missing or manual, and use `FAIL` when the result is unusable or contradicts the prompt.

## Repair a Result

Use **Retry** when the reviewed result is close to the original request but one or more mechanics are wrong, missing, or mapped incorrectly. Retry is not approval, it is not an automatic hidden retry, and it is not for starting a different item.

1. Leave the original prompt unchanged. If you want a completely different item, use **Preview** with a new prompt instead.
2. Review the item, JSON, review notes, and validation findings in the main Forge window.
3. Click **Retry**. The clearly marked **SEND IT AGAIN!?** window opens.
4. In **What should it have done?**, describe only the correction in plain language. Be specific about what was missing or wrong. For example: `Keep the original wand and five charges, but make the saving throw Dexterity DC 15 and preserve the 4d6 cold damage.`
5. Do not paste the original prompt or JSON into the repair field. The Forge sends the displayed original prompt, reviewed JSON, review findings, and your repair note together.
6. Check **I understand**. Its tooltip explains that this sends one new provider request and that the result must be reviewed again before creation.
7. Click **Send repair request** once and wait for the result. Do not click it again while the request is processing.
8. When the repaired result returns to preview, read its review notes and validation findings again. Check **Approve** only after the repaired result is correct, then click **Create Items** if you want to create it.

The repair request uses the hosted allowance like other fresh model work. A failed repair does not create or execute anything automatically. If the dialog reports an error, record the visible message and request ID, take the immediate structured snapshot, and do not keep resending the same repair for that preview. Never include passwords, API keys, or private campaign details in repair notes.

### Retry Questionnaire

Complete this after a result is wrong or incomplete, before and after sending one repair request:

```text
Item name and run tag:

Original requested behavior:

What the preview or Foundry document did:

What should it have done:

Which stage failed? Preview / Foundry document / Live behavior / Review notes

Did the original item name remain unchanged? PASS / PARTIAL / FAIL / NOT TESTED
Did the base item import or create successfully? PASS / PARTIAL / FAIL / NOT TESTED
Did the affected activity, effect, resource, target, or trigger appear? PASS / PARTIAL / FAIL / NOT TESTED
Did the affected behavior work in Foundry? PASS / PARTIAL / FAIL / NOT TESTED
Did the preview identify the correct automation layer and required modules? PASS / PARTIAL / FAIL / NOT TESTED
Did the review notes describe the actual problem without unrelated blockers? PASS / PARTIAL / FAIL / NOT TESTED

Repair note sent:

Did the repaired result return for fresh review? PASS / FAIL / NOT TESTED
Did the repaired result preserve the correct name and base item? PASS / PARTIAL / FAIL / NOT TESTED
Did the repaired behavior work after fresh review? PASS / PARTIAL / MANUAL / FAIL / NOT TESTED
Was a new error, mismatch, or regression introduced? YES / NO
Request ID or visible error:

Final status: PASS / PARTIAL / MANUAL / FAIL / NOT TESTED
Evidence or failure details:
```

Send only one repair request for a reviewed result. If it still fails, stop and report the result rather than repeatedly resending the same prompt.

### Anonymous Error Reports

If you are comfortable helping with technical diagnostics:

1. Open **Forge Settings**.
2. Turn on **Anonymous Error Reports**.
3. Save the settings.
4. Reproduce the problem once.
5. Send us the request ID or a short description of what happened.

Reports are intended to contain redacted technical summaries. Never send passwords, API keys, private campaign content, or personal information.

## Bring Your Own API

Use this section if you want to use your own provider account instead of the shared Free Forge allowance.

### Important Compatibility Note

DMF does **not** send its request directly to a normal OpenAI or Claude chat endpoint. The endpoint in Forge Settings must be a **Forge-compatible compile endpoint** that accepts the DMF request format and returns the structured Forge response format.

That usually means one of these:

- a DMF-compatible service you run locally or on your own server
- a trusted Forge-compatible service provided by a team or host
- a compatible adapter that translates the DMF request into your provider's API format

Do not paste `https://api.openai.com/v1` or a normal Claude API URL into the DMF endpoint field unless the service in front of it explicitly supports the Forge contract.

### Get an API Key

API billing is separate from ChatGPT or Claude subscriptions. You may need to add billing details or prepaid credit with the provider. These third-party guides explain the general setup process:

- [TechRadar: How to use the ChatGPT API to make your own apps](https://www.techradar.com/how-to/how-to-use-chatgpt-api-to-make-your-own-apps)
- [Zapier: How to get started with ChatGPT/OpenAI](https://help.zapier.com/hc/en-us/articles/14860148802829-How-to-get-started-with-ChatGPT-OpenAI-on-Zapier)
- [Puter: How to get an Anthropic Claude API key](https://developer.puter.com/tutorials/how-to-get-anthropic-api-key/)

Provider dashboards and prices change, so check the provider's current billing screen before adding funds. The linked tutorials are third-party guides, not endorsements by Dungeon Master's Forge.

### Configure DMF

1. Open **Forge Settings**.
2. Set **Generation provider** to **Bring Your Own API**.
3. Enter the full URL of your Forge-compatible compile endpoint.
4. Enter the model name allowed by that service.
5. Paste the service token or personal provider key required by that service into **API token**.
6. Leave **Remember token on this device** off unless this is a trusted computer.
7. Click **Check Connection**.
8. Save the settings and run a small test prompt first.

For the local reference service, the compile endpoint is:

`http://localhost:8788/v1/forge/compile`

The current reference model is:

`gpt-5.4-mini`

The local service must be running and configured as a Forge-compatible service before Foundry can use that endpoint.

## Keep API Keys Safe

- Never post an API key in a Discord message, email, screenshot, issue, or public document.
- Use a separate key for testing and set a small provider spending limit.
- Do not use someone else's key.
- Delete or rotate a key immediately if it may have been exposed.
- Only enable **Remember token on this device** on a computer you control.
- Do not use personal campaign documents as test payloads.

## Feedback Template

Copy and fill this out when something needs attention:

```text
DMF tester feedback

Prompt:

Item name:

Provider:

Expected result:

Actual result:

Foundry/DND5e versions:

Console error or screenshot:

Exported item JSON attached: yes/no
```

For a successful test, a short note about what you tried and what worked is enough.
