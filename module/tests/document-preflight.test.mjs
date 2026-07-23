import assert from "node:assert/strict";
import test from "node:test";
import { applyDocumentUpdate, assertPreflight, normalizeValidationFailures, preflightDocumentSource } from "../scripts/document-preflight.js";

class FakeDocument {
  constructor(source) {
    this.source = source;
    this.validationFailures = new Map();
  }

  validate() {
    if (!this.source.name) this.validationFailures.set("name", "Name is required");
    if (this.source.system?.activities?.broken?.save && typeof this.source.system.activities.broken.save !== "object") {
      this.validationFailures.set("system.activities.broken.save", "Save must be an object");
    }
  }

  toObject() {
    return this.source;
  }
}

test("document updates apply dotted paths and Foundry-style deletion without mutating the source", () => {
  const source = { name: "Test", system: { activities: { attack: { name: "Attack" }, old: {} } } };
  const updated = applyDocumentUpdate(source, {
    "system.activities.attack.name": "Repaired attack",
    "-=system.activities.old": null,
    "system.activities.save": { save: { ability: "con" } }
  });
  assert.equal(updated.system.activities.attack.name, "Repaired attack");
  assert.equal(updated.system.activities.old, undefined);
  assert.deepEqual(updated.system.activities.save, { save: { ability: "con" } });
  assert.equal(source.system.activities.attack.name, "Attack");
  assert.notEqual(updated, source);
});

test("preflight reports DataModel validation failures before persistence", () => {
  const result = preflightDocumentSource({
    DocumentClass: FakeDocument,
    source: { name: "Broken", system: { activities: { broken: { save: "invalid" } } } }
  });
  assert.equal(result.supported, true);
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures, [{ path: "system.activities.broken.save", message: "Save must be an object" }]);
  assert.throws(() => assertPreflight("Broken", result), /Foundry document preflight failed for Broken/);
});

test("preflight accepts valid documents and normalizes failure shapes", () => {
  const result = preflightDocumentSource({ DocumentClass: FakeDocument, source: { name: "Valid" } });
  assert.equal(result.supported, true);
  assert.equal(result.valid, true);
  assert.deepEqual(normalizeValidationFailures({ "system.name": "Invalid" }), [{ path: "system.name", message: "Invalid" }]);
});
