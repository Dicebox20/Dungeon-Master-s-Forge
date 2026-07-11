import assert from "node:assert/strict";
import { applyFeaturePlanToSpec, namedSpellRequests, planItemFeatures } from "../scripts/feature-planner.js";

const request = "Create a legendary trident with 12 charges that regains 1d8 + 4 charges daily at dawn. It can cast Fog Cloud, Tidal Wave, and Ice Storm. Each spell can be upcast by spending additional charges. Once per long rest, it can summon a reef shark while in water or a wolf on land.";
const plan = await planItemFeatures(request, {
  resolveSpell: async name => ({ status: ["Fog Cloud", "Ice Storm"].includes(name) ? "compatible" : "not-found" })
});

assert.deepEqual(namedSpellRequests(request), ["Fog Cloud", "Tidal Wave", "Ice Storm"]);
assert.ok(plan.native.some(entry => entry.label === "System spell: Fog Cloud"));
assert.ok(plan.native.some(entry => entry.label === "System spell: Ice Storm"));
assert.ok(plan.manual.some(entry => entry.label === "Unavailable system spell: Tidal Wave"));
assert.ok(plan.manual.some(entry => entry.label === "Conditional summon"));
assert.ok(plan.manual.some(entry => entry.label === "Shared conditional-use limit"));

const localFallbackPlan = await planItemFeatures(
  "Create a shortbow that can cast Ray of Sickness once per day.",
  { resolveSpell: async () => ({ status: "not-found" }) }
);

assert.ok(localFallbackPlan.native.some(entry => entry.label === "Deterministic local spell: Ray of Sickness"));

const planned = applyFeaturePlanToSpec({ name: "Tidebreaker Sovereign" }, plan);
assert.equal(planned.applied, true);
assert.equal(planned.spec.unresolvedMechanics.length, 3);
assert.ok(planned.spec.unresolvedMechanics.every(entry => /^[A-Za-z0-9]{16}$/.test(entry.id)));
assert.equal(applyFeaturePlanToSpec(planned.spec, plan).applied, false);

export const testedFeaturePlannerCases = 9;
