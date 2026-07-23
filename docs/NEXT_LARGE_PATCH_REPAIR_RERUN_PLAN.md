# Next Large Patch: User-Confirmed Repair Rerun

## Source Patch Status

The module and private-service source paths now implement this flow. Local regression coverage is green at `51/51` module tests and `215/215` AI-service tests. Tester candidate `2.23.1-test.52` is installed locally, and both services advertise the repair capability. The public service remains unpublished, while its explicitly requested monthly allowance is `500,000` metered usage units; keys, stable release, and tester branch publication remain unchanged.

## Purpose

Add a safe way to correct a reviewed Forge result without making the GM rebuild the request from memory. The repair flow should send one new, explicitly confirmed provider request containing the original prompt, bounded user notes, the current reviewed JSON, review notes, and deterministic validation findings. It must return a fresh preview, not create or execute anything automatically.

This plan is now implemented in tester `.52`. It does not authorize a tester publication or campaign-content change.

## Current Baseline

- The user-facing failed-item report dialog is removed in tester `.48`.
- The unchanged request uses `Retry` to open the repair confirmation, which captures the original prompt, generated specs, review summaries, validation findings, provider metadata, and the user's note in the repair payload.
- The service already performs one bounded retry for malformed OpenAI output in `ai-service/src/compiler.mjs`. That retry is an internal contract-recovery mechanism, not a user repair.
- The latest tester candidate is `2.23.1-test.52`; Foundry must be hard-reloaded before live verification of the nested review-note tree, Retry repair confirmation, Advanced Specification Editor tab, capacity indicator, and malformed-aura repair behavior.

## User Flow

1. Change `Preview` to `Retry` only when the unchanged request has a retained reviewed result and a network Forge provider advertises the repair capability.
2. Open a confirmation window containing:
   - item names and count;
   - provider lane and service label;
   - an estimated new usage cost and a clear statement that cache hits do not make this a free retry;
   - the current reviewed spec JSON in a bounded, collapsible field;
   - current Review, Warning, Notice, Resolved, and deterministic validation findings;
   - a single editable repair-notes field describing what is wrong and what should change. Do not duplicate the original prompt in this dialog; it remains visible in the main Forge window for reference;
   - a required checkbox confirming that this sends one new provider request and will require fresh review before creation.
3. Cancel must close the window without network activity, quota usage, state mutation, or approval changes.
4. Confirm must atomically enter a working state, disable the confirm control, and permit exactly one repair request for that parent result. A second click, duplicate event, or close/reopen cycle must not issue another request.
5. Replace the preview only after the repaired response passes the complete provider contract, deterministic normalization, Foundry-spec validation, and review-note reconciliation.
6. Clear prior approval and automation-code approval. The repaired result must be reviewed and approved again before any document creation.
7. Preserve the original result and repair provenance for evidence. If the repair is still wrong, require a fresh preview or manual evidence capture rather than offering another repair loop.

The action is labelled `Retry`, but the confirmation window must use unmistakable copy such as `SEND IT AGAIN!?` and a distinct warning color/icon. Its primary action should say `Send repair request` so the second provider call cannot be mistaken for the normal approval window or an automatic retry.

### Next-Patch Dialog Layout

The resend dialog should be a focused writing surface rather than a second preview window:

- Keep one editable text box for repair notes, sized to occupy most of the available dialog height.
- Keep the original prompt out of the dialog because it is already readable in the main Forge window.
- Put JSON, review findings, provider details, and cost information behind compact disclosure sections or summary rows.
- Keep the confirmation checkbox and `Send repair request` / `Cancel` actions visible without competing with the notes field.
- Preserve the distinct `SEND IT AGAIN!?` title and warning treatment so this cannot be mistaken for approval.

## Retained Repair Context

The module should retain an ephemeral, bounded context object for the current Forge result. It may be included in diagnostics and reports, but it must not include credentials or world documents.

```text
repairContext {
  parentRequestId
  requestFingerprint
  originalRequest
  provider: { id, label, mode, serviceVersion }
  originalSpecsFingerprint
  currentReviewedSpecs
  reviewNotes
  deterministicFindings
  originalStatus
  createdDocumentSummary
  repairAttempted: false
}
```

Requirements:

- Bound every text field, item count, note count, and JSON size on both module and service boundaries.
- Preserve the original prompt separately from the normalized compilation request.
- Use fingerprints for correlation and before/after comparison; do not use them as a substitute for the payload sent for repair.
- Do not retain API tokens, world UUIDs, Actors, Scenes, Regions, tokens, raw console logs, macro execution state, or provider secrets.
- If the current JSON was manually edited in the preview, identify it as the reviewed input and preserve its fingerprint.

## Repair Request Contract

Use an explicit compile request mode rather than overloading the existing error-report route.

```json
{
  "requestMode": "repair-attempt",
  "parentRequestId": "bounded-client-correlation-id",
  "attempt": 1,
  "originalRequest": "bounded original prompt",
  "repairNotes": "bounded user explanation",
  "currentReviewedSpecs": [],
  "reviewNotes": [],
  "deterministicFindings": [],
  "provenance": {
    "requestFingerprint": "...",
    "specFingerprint": "...",
    "providerLane": "..."
  }
}
```

The server should accept only `attempt: 1` for a given parent request. A repeated repair attempt must return a stable, non-retryable error and leave the original result available. The repair prompt should instruct the provider to change only the identified issue, preserve all valid mechanics and explicit values, return the complete Forge envelope, and keep unsupported or unsafe behavior in review/deferred form.

Repair is a new usage-metered request. It must not bypass per-minute, daily, monthly, global, or private-service safeguards. Cache behavior must be explicit: a repair payload with a distinct mode, notes, and parent context must not silently reuse the original compilation result.

## Report Relationship

The repair payload is now the user-facing correction path. A repair completion should retain a report-compatible evidence record with `feedback.kind: "repair-attempt"`, parent and repaired fingerprints, attempt number, user notes, redacted findings, and before/after review summaries. Anonymous technical error diagnostics remain opt-in and must never include raw console data automatically. The immediate evidence snapshot process remains the first capture for user-submitted failures.

## Safety Boundaries

- Never auto-create a repaired item.
- Never execute generated macros, alter selected tokens, create or edit Actors, Scenes, Regions, doors, locks, or campaign content during repair.
- Never pass raw provider credentials, world documents, private console buffers, or unbounded user text to the provider or report store.
- Never turn a user repair into an automatic retry loop.
- Keep executable model output disabled. A repaired macro, if ever represented, remains review-only and follows the separate reviewed-macro confirmation design.
- Keep helpful defaults bounded and visible as assumptions. Omitted charges, recovery, DCs, and similar safe details may be inferred only under the shared provider policy; ambiguous targeting, aura scope, class-resource storage, teleportation, scripts, and world changes remain review/deferred.

## Implementation Slices

### Slice A: Module State and Payload Helpers

- Add a repair-context builder using existing report sanitizers and compilation snapshots.
- Add a one-shot request guard tied to the current parent fingerprint.
- Add a capability-gated `Retry` action without a separate failed-item report button.
- Add confirmation and cancel tests, including no-request-on-cancel and disabled-after-confirm behavior.

### Slice B: Service Contract and Metering

- Add request-mode validation and bounded repair payload normalization.
- Add a server-side one-repair-per-parent guard with deterministic error output.
- Keep the existing malformed-output retry unchanged and test that the two attempt counters remain independent.
- Test cache keys, refresh negotiation, usage charging, quota failures, and redaction at the HTTP boundary.

### Slice C: Fresh Preview and Approval Gate

- Run the normal compile, contract, deterministic, Foundry-spec, and review-note pipeline on the repaired response.
- Replace only the preview state after successful validation.
- Clear approval and generated-automation approval, show before/after review summaries, and require a new approval before creation.
- Preserve the original context if the repair request fails or returns an unusable result.

### Slice D: Evidence and Foundry Harness

- Capture an immediate structured snapshot when a repair is requested, when it returns, and when creation is attempted.
- Use the Codex-only Foundry harness to verify preview state, document state, activities, effects, uses/recovery, and that no extra document is created before fresh approval.
- Test the immediate evidence snapshot/manual-notes path after a canceled repair, a failed repair, and a still-broken repaired result.

## Acceptance Matrix

| Area | Required proof |
| --- | --- |
| Consent | Dialog shows bounded payload, provider lane, cost, and confirmation; cancel performs no request. |
| One-shot behavior | One confirmed action produces at most one provider request and one usage event. |
| Repair quality | Explicit correct fields survive; only identified issues change; unsafe ambiguity remains review/deferred. |
| Fresh review | Repaired preview is not approved and cannot create until reviewed again. |
| Failure recovery | Network, quota, contract, and validation failures preserve the original result. |
| Redaction | Tokens, world docs, UUIDs outside the intended prompt context, raw console, and secrets are absent. |
| Report parity | Repair evidence can be stored through the existing report schema without silently creating a second provider call. |
| Cache and quotas | Repair is a distinct usage-metered request; existing limits and capability negotiation remain intact. |
| Foundry harness | No auto-create, macro execution, Scene/Region mutation, or campaign cleanup occurs. |
| Loop prevention | A repaired result cannot open a second repair attempt; recurring failures use the immediate evidence snapshot process. |

## Suggested Staged Test Prompts

These are for the later Foundry harness test pass after the `.48` install.

1. **Single-field repair:** Create a rare charged healing torque with an explicitly stated charge count and healing formula. Repair only the recovery wording. Verify all other fields remain unchanged.
2. **Activity repair:** Create a weapon with one named on-hit rider. Repair a missing save or damage component while preserving the weapon chassis and attack activity.
3. **Review-note repair:** Create a complex item with a safe omitted numeric detail and one deliberately manual-review mechanic. Repair only the omitted detail. Verify the manual-review note remains.
4. **Hybrid repair:** Create a charged staff with two named spell activities and one area template. Repair only the incorrect area size. Verify charges, spell names, templates, and effects remain intact.
5. **Negative safety case:** Request an ambiguous aura, teleport, or world-changing behavior. Confirm repair cannot execute it, cannot create automatically, and keeps the behavior in Review or deferred findings.

## Definition Of Ready For Implementation

Begin coding only after the next patch branch has:

- a stable payload schema and parent/attempt semantics;
- confirmed provider capability and service-version behavior for repair mode;
- a decision on whether repair requires a private-service feature flag during testing;
- module and service test fixtures for the original, repaired, canceled, and repeated-attempt states;
- a Foundry harness scenario that checks fresh approval and document counts;
- explicit approval to rebuild/install a new tester package.
