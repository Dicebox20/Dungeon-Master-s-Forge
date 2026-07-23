import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DAY_MS, createDailyQuotaStore, createUsageMeterStore, monthlyPeriod, subjectDigest } from "../src/quota-store.mjs";

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

test("monthly quota persists and resets at the UTC calendar-month boundary", t => {
  const directory = mkdtempSync(join(tmpdir(), "dmf-monthly-quota-"));
  const databasePath = join(directory, "quota.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let timestamp = Date.UTC(2026, 6, 31, 23, 59, 59);

  const first = createDailyQuotaStore({ databasePath, hashSecret: secret, now: () => timestamp });
  assert.equal(first.consumeMonthly("client-month", "203.0.113.9", 1).allowed, true);
  first.close();

  const restarted = createDailyQuotaStore({ databasePath, hashSecret: secret, now: () => timestamp });
  assert.equal(restarted.consumeMonthly("client-month", "203.0.113.9", 1).allowed, false);
  timestamp += 2000;
  assert.equal(restarted.consumeMonthly("client-month", "203.0.113.9", 1).allowed, true);
  restarted.close();
  assert.equal(monthlyPeriod(Date.UTC(2026, 6, 15)).start, Date.UTC(2026, 6, 1));
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

test("usage meter stores amounts rather than request counts", () => {
  const store = createUsageMeterStore({ databasePath: ":memory:", hashSecret: secret, now: () => 1000 });
  assert.deepEqual(store.checkMonthly("client-month", "client-a", 100), {
    allowed: true, used: 0, remaining: 100, limit: 100, retryAfter: 2678399
  });
  const first = store.consumeMonthly("client-month", "client-a", 35, 100);
  assert.equal(first.used, 35);
  assert.equal(first.remaining, 65);
  const second = store.consumeMonthly("client-month", "client-a", 50, 100);
  assert.equal(second.used, 85);
  assert.equal(second.remaining, 15);
  store.close();
});

test("repair-attempt claims persist without storing client or parent identifiers", t => {
  const directory = mkdtempSync(join(tmpdir(), "dmf-repair-claims-"));
  const databasePath = join(directory, "quota.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const first = createUsageMeterStore({ databasePath, hashSecret: secret });
  assert.equal(first.claimRepairAttempt("203.0.113.50", "repair-parent-persisted"), true);
  assert.equal(first.claimRepairAttempt("203.0.113.50", "repair-parent-persisted"), false);
  assert.equal(first.claimRepairAttempt("203.0.113.51", "repair-parent-persisted"), true);
  first.close();

  const restarted = createUsageMeterStore({ databasePath, hashSecret: secret });
  assert.equal(restarted.claimRepairAttempt("203.0.113.50", "repair-parent-persisted"), false);
  restarted.close();

  const bytes = readFileSync(databasePath);
  assert.equal(bytes.includes(Buffer.from("203.0.113.50")), false);
  assert.equal(bytes.includes(Buffer.from("repair-parent-persisted")), false);
});
