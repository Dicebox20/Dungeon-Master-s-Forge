import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DAY_MS, createDailyQuotaStore, subjectDigest } from "../src/quota-store.mjs";

const secret = "test-quota-hash-secret-at-least-32-characters";

test("daily quota counts persist across service restarts", t => {
  const directory = mkdtempSync(join(tmpdir(), "dmf-quota-"));
  const databasePath = join(directory, "quota.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let timestamp = Date.UTC(2026, 6, 1, 12);

  const first = createDailyQuotaStore({ databasePath, hashSecret: secret, now: () => timestamp });
  assert.deepEqual(first.consume("client", "203.0.113.9", 2), { allowed: true, remaining: 1, retryAfter: 43200 });
  first.close();

  const restarted = createDailyQuotaStore({ databasePath, hashSecret: secret, now: () => timestamp });
  assert.equal(restarted.consume("client", "203.0.113.9", 2).remaining, 0);
  assert.equal(restarted.consume("client", "203.0.113.9", 2).allowed, false);
  restarted.close();
});

test("daily quota resets at the UTC day boundary", () => {
  let timestamp = Date.UTC(2026, 6, 1, 23, 59, 59);
  const store = createDailyQuotaStore({ databasePath: ":memory:", hashSecret: secret, now: () => timestamp });
  assert.equal(store.consume("global", "global", 1).allowed, true);
  assert.equal(store.consume("global", "global", 1).allowed, false);
  timestamp += 2000;
  assert.equal(store.consume("global", "global", 1).allowed, true);
  store.close();
});

test("two store instances share one transactional ceiling", t => {
  const directory = mkdtempSync(join(tmpdir(), "dmf-quota-"));
  const databasePath = join(directory, "quota.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = createDailyQuotaStore({ databasePath, hashSecret: secret });
  const second = createDailyQuotaStore({ databasePath, hashSecret: secret });
  assert.equal(first.consume("global", "global", 1).allowed, true);
  assert.equal(second.consume("global", "global", 1).allowed, false);
  first.close();
  second.close();
});

test("stored client identifiers use a keyed digest", t => {
  const directory = mkdtempSync(join(tmpdir(), "dmf-quota-"));
  const databasePath = join(directory, "quota.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = createDailyQuotaStore({ databasePath, hashSecret: secret });
  store.consume("client", "203.0.113.42", 2);
  store.close();
  const bytes = readFileSync(databasePath);
  assert.equal(bytes.includes(Buffer.from("203.0.113.42")), false);
  assert.match(subjectDigest(secret, "client", "203.0.113.42"), /^[a-f0-9]{64}$/);
});

test("quota store reports durable and in-memory modes", () => {
  const memory = createDailyQuotaStore({ databasePath: ":memory:", hashSecret: secret });
  assert.deepEqual(memory.status(), { kind: "sqlite", durable: false });
  memory.close();
  assert.equal(DAY_MS, 86400000);
});
