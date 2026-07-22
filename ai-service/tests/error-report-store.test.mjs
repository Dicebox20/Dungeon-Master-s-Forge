import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createErrorReportStore } from "../src/error-report-store.mjs";

test("error report store removes entries older than its retention window", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dmf-report-store-"));
  const path = join(directory, "reports.jsonl");
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const recent = new Date(Date.now() - 60 * 1000).toISOString();
  await writeFile(path, [
    JSON.stringify({ receivedAt: old, message: "old" }),
    JSON.stringify({ receivedAt: recent, message: "recent" }),
    ""
  ].join("\n"), "utf8");

  const store = createErrorReportStore({ path, retentionDays: 1 });
  await store.append({ message: "new" });
  const lines = (await readFile(path, "utf8")).trim().split(/\r?\n/).map(line => JSON.parse(line));

  assert.deepEqual(lines.map(entry => entry.message), ["recent", "new"]);
  assert.equal(store.status().retentionDays, 1);
});
