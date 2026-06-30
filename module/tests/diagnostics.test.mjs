import assert from "node:assert/strict";
import { DIAGNOSTIC_CASES, runLocalDiagnostics } from "../scripts/diagnostics.js";

const report = runLocalDiagnostics();
assert.equal(report.total, DIAGNOSTIC_CASES.length);
assert.equal(report.passed, DIAGNOSTIC_CASES.length);
assert.equal(report.failed, 0);
assert.equal(report.healthy, true);
assert.ok(report.results.every(result => result.message === "Passed"));

export const testedDiagnosticCount = report.total;
