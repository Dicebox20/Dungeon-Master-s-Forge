import assert from "node:assert/strict";
import { applyFeaturePlanToSpec, namedSpellRequests, planItemFeatures } from "../scripts/feature-planner.js";

const request = "Create a legendary trident with 12 charges that regains 1d8 + 4 charges daily at dawn. It can cast Fog Cloud, Tidal Wave, and Ice Storm. Each spell can be upcast by spending additional charges. Once per long rest, it can summon a reef shark while in water or a wolf on land.";
const plan = await planItemFeatures(request, {
  resolveSpell: async name => ({ status: ["Fog Cloud", "Ice Storm"].includes(name) ? "compatible" : "not-found" })
});

assert.deepEqual(namedSpellRequests(request), ["Fog Cloud", "Tidal Wave", "Ice Storm"]);
assert.ok(plan.native.some(entry => entry.label === "System spell: Fog Cloud"));
assert.ok(plan.native.some(entry => entry.label === "System spell: Ice Storm"));
assert.ok(plan.native.some(entry => entry.label === "Deterministic local spell: Tidal Wave"));
assert.ok(plan.manual.some(entry => entry.label === "Conditional summon"));
assert.ok(plan.manual.some(entry => entry.label === "Shared conditional-use limit"));

const localFallbackPlan = await planItemFeatures(
  "Create a shortbow that can cast Ray of Sickness once per day.",
  { resolveSpell: async () => ({ status: "not-found" }) }
);

assert.ok(localFallbackPlan.native.some(entry => entry.label === "Deterministic local spell: Ray of Sickness"));

const layeredBrief = `
Complexity layer 1 - Base chassis
Base item: Dagger
Magical bonus: +1

Complexity layer 2 - Passive riders
Extra hit damage: 1d6 fire; 1d6 force

Complexity layer 3 - Resource model
Spell usage: once per day

Complexity layer 4 - Named activities
Spell: Burning Hands
Spell save DC: 15
`;

assert.deepEqual(namedSpellRequests(layeredBrief), ["Burning Hands"]);

const layeredPlan = await planItemFeatures(layeredBrief, {
  resolveSpell: async name => ({ status: name === "Burning Hands" ? "compatible" : "not-found" })
});

assert.ok(layeredPlan.native.some(entry => entry.label === "System spell: Burning Hands"));

const planned = applyFeaturePlanToSpec({ name: "Tidebreaker Sovereign" }, plan);
assert.equal(planned.applied, true);
assert.equal(planned.spec.unresolvedMechanics.length, 2);
assert.ok(planned.spec.unresolvedMechanics.every(entry => /^[A-Za-z0-9]{16}$/.test(entry.id)));
assert.equal(applyFeaturePlanToSpec(planned.spec, plan).applied, false);

export const testedFeaturePlannerCases = 12;
