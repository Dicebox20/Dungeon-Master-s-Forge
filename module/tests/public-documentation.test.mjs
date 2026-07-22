import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const publicDocuments = [
  "README.md",
  "module/README.md",
  "module/ROADMAP.md",
  "module/docs/provider-contract.md",
  "module/docs/supported-patterns.md",
  "testing/README.md",
  "testing/testers.md",
  "ai-service/README.md",
  "docs/TESTER_QUICKSTART.md",
  "docs/FOUNDRY_SUBMISSION_BRIEF.md",
  "docs/LAUNCH_DAY_RUNBOOK.md"
];

const discouragedPhrases = [
  /codex/i,
  /natural[- ]language brief/i,
  /plain[- ]english/i,
  /(?:Dungeon Master's|Foundry) Forge V2/i
];

test("maintained public documents avoid internal and stale product wording", () => {
  const findings = [];

  for (const relativePath of publicDocuments) {
    const filePath = path.join(repoRoot, relativePath);
    const source = fs.readFileSync(filePath, "utf8");
    for (const pattern of discouragedPhrases) {
      if (pattern.test(source)) findings.push(`${relativePath}: ${pattern}`);
    }
  }

  assert.deepEqual(findings, []);
});
