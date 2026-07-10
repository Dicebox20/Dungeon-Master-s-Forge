import assert from "node:assert/strict";
import { sanitizeForgeSpec } from "../scripts/forge-spec-integrity.js";

const result = sanitizeForgeSpec({
  name: "Malformed Bulwark",
  weight: { value: "6", units: "lb" },
  effects: [{ changes: [] }, null, "invalid"],
  passiveEffects: [{ effectId: "not-valid", name: "" }],
  utilityActivities: [{ activityId: "short", activityName: "" }, null],
  saveActivities: [{ activityName: "Save 1" }],
  toggleLight: { activityId: "bad", effectId: "also-bad" }
});

assert.equal(result.applied, true);
assert.equal(result.spec.weight, 6);
assert.equal(result.spec.effects.length, 1);
assert.equal(result.spec.effects[0].name, "Malformed Bulwark Effect");
assert.match(result.spec.effects[0].effectId, /^[A-Za-z0-9]{16}$/);
assert.equal(result.spec.utilityActivities.length, 1);
assert.equal(result.spec.utilityActivities[0].activityName, "Use Malformed Bulwark");
assert.match(result.spec.utilityActivities[0].activityId, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.saveActivities[0].activityId, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.toggleLight.activityId, /^[A-Za-z0-9]{16}$/);
assert.match(result.spec.toggleLight.effectId, /^[A-Za-z0-9]{16}$/);
assert.equal(sanitizeForgeSpec(result.spec).applied, false);

export const testedForgeSpecIntegrityCases = 10;
