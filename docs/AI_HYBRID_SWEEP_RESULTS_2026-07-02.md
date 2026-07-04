# Dungeon Master's Forge AI Hybrid Sweep Results

Date: 2026-07-02

Updated: 2026-07-03

Provider used:

- `Bring Your Own API`
- local private reference service at `http://localhost:8788/v1/forge/compile`
- model `gpt-4.1-mini`

This sweep intentionally mixed multiple supported Forge families in single requests to identify routing and normalization failures that do not appear in single-pattern prompts.

## 2026-07-03 Follow-up Result

After the July 3 contract hardening pass, the same `hybrid` regression pack was rerun live against the OpenAI-backed reference service and finished:

- `14/14` scenarios passing
- `0` compile failures
- remaining hybrid compromises surfaced as valid dominant-family routing or `unresolvedMechanics`, not invalid-model-output crashes

Additional recovery paths added after the original July 2 failure sweep:

- missing shared `uses` recovery for mixed staff outputs
- single-activity staff guard when summon profiles are also present
- text-valued `toggleLight` bright/dim radii recovery
- merge support for numbered activity arrays such as `utilityActivities2` and `utilityActivities3`
- tuple-style damage-part normalization such as `["3d8", "thunder"]`
- broader activity/effect alias normalization for live model output
- greataxe base-damage recovery for artifact and legendary weapon hybrids
- single-summon hybrid rescue for mixed staff outputs that otherwise collapsed into invalid `multiActivityStaff`
- missing-kind fallback for shared-activity summon/healing staff outputs
- suite conversion for inferred `equipmentPowerSuite` results that still arrived with legacy shared `activities`

## 2026-07-03 Hosted Free Forge Follow-up

After deploying the latest contract hardening to the public free-tier Droplet, targeted hosted regressions also passed against:

- `hybrid-staff-healing-summon` -> `equipmentPowerSuite`, HTTP `200`, `1` unresolved mechanic preserved instead of a `502`
- `hybrid-weapon-summon` -> `artifactWeaponHybrid`, HTTP `200`
- `hybrid-staff-fiend-summon` -> `equipmentPowerSuite`, HTTP `200`
- `hybrid-shield-caster` -> `shieldArmorBonus`, HTTP `200`

The July 2 table below is kept as the original failure snapshot because it still explains why these recovery layers were added.

## Result Summary

| Prompt | Outcome | Routed Kind | Notes |
| --- | --- | --- | --- |
| `1. Weapon + Summon` | Created | `weaponExtraDamage` | The summon survived only as unresolved or partially coerced summon support inside a weapon-centered result. |
| `2. Weapon + Condition + Charged Blast` | Compile failed | `weaponConditionOnHit` | Missing `conditionOnHit.condition` string. |
| `3. Passive Gear + Healing Charges` | Compile failed | `chargedHealing` | Healing denomination emitted in an invalid non-numeric shape. |
| `4. Shield + Enchant` | Created | `shieldArmorBonus` | Enchant mechanic downgraded into unresolved/manual adjudication guidance. |
| `5. Caster Gear + Healing Charges` | Compile failed | missing | Model omitted `kind`. |
| `6. Passive Gear + Charged Blast` | Compile failed | missing | Model omitted `kind`. |
| `7. Multi-Spell Staff + Multi-Profile Summon` | Compile failed | `multiActivityStaff` | Activity array collapsed below the minimum required count. |
| `8. Enchant Consumable + Summon` | Compile failed | `nativeMultiProfileSummon` | Recovery array missing on generated uses block. |
| `9. Legendary Gear + Multi-Profile Summon` | Compile failed | `legendaryEquipmentSuite` | `saveActivities[0].activityName` missing. |
| `10. Shield + Caster Utility` | Created | `shieldArmorBonus` | Secondary caster utility mechanics were absorbed successfully. |
| `11. Power Suite + Weapon Condition` | Compile failed | — | Generated forbidden `flags` payload in nested effect content. |
| `12. Legendary Gear + Weapon Hybrid` | Created | `weaponExtraDamage` | Legendary defensive and command traits were absorbed into a weapon-centered output. |
| `13. Artifact Weapon + Enchant` | Compile failed | — | Model split one request into two returned items. |
| `14. Staff + Healing + Summon` | Compile failed | missing | Model omitted `kind`. |

## Observed Failure Buckets

## 1. Missing or unsupported `kind`

Seen in:

- `5. Caster Gear + Healing Charges`
- `6. Passive Gear + Charged Blast`
- `14. Staff + Healing + Summon`

Interpretation:

- Mixed prompts that start from equipment or staff utility language are sometimes returning otherwise plausible specs without a declared Forge family.

## 2. Incomplete required substructures

Seen in:

- `2. Weapon + Condition + Charged Blast`
- `3. Passive Gear + Healing Charges`
- `7. Multi-Spell Staff + Multi-Profile Summon`
- `8. Enchant Consumable + Summon`
- `9. Legendary Gear + Multi-Profile Summon`

Interpretation:

- The model often chooses a reasonable top-level family but emits an incomplete nested block when a second mechanic competes for attention.

## 3. Unsafe generated payloads

Seen in:

- `11. Power Suite + Weapon Condition`

Interpretation:

- When asked to combine offensive powers with condition application, the model can drift into forbidden executable or document-control fields.

## 4. Batch integrity failures

Seen in:

- `13. Artifact Weapon + Enchant`

Interpretation:

- The model split one hybrid request into multiple returned documents instead of keeping the extra mechanic on the requested item.

## 5. Successful coercion with secondary-mechanic downgrade

Seen in:

- `1. Weapon + Summon`
- `4. Shield + Enchant`
- `10. Shield + Caster Utility`
- `12. Legendary Gear + Weapon Hybrid`

Interpretation:

- Some hybrids are already survivable when the model picks a dominant family and either:
  - maps the secondary mechanic into supported item fields, or
  - pushes the unsupported remainder into `unresolvedMechanics`.

## Patch Priorities

## 1. Prompt hardening

- Force the model to always emit exactly one supported `kind`.
- Instruct the model to prefer a dominant family when hybrid mechanics compete.
- Instruct the model to push unsupported secondary mechanics into `unresolvedMechanics` instead of inventing partial nested structures.

## 2. Server-side recovery before hard failure

- Recover obvious condition defaults when the prose clearly names the condition.
- Recover obvious healing dice shapes when the dice expression is present in prose but malformed in structure.
- Recover missing `activityName` and basic recovery blocks when the surrounding activity is otherwise valid.

## 3. Hybrid coercion policy

- Add explicit normalization rules for:
  - weapon + summon
  - shield + enchant
  - shield + caster utility
  - legendary weapon + defensive equipment suite

## 4. Response safety guardrails

- Reject or strip forbidden `flags` and executable fields earlier, then allow one bounded regeneration or targeted repair path before returning `unsafe_model_output`.
