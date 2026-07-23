import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DAY_MS = 86400000;
const REPAIR_ATTEMPT_RETENTION_MS = 90 * DAY_MS;

function dailyPeriod(timestamp) {
  const start = Math.floor(timestamp / DAY_MS) * DAY_MS;
  return { start, end: start + DAY_MS };
}

function monthlyPeriod(timestamp) {
  const date = new Date(timestamp);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return { start, end };
}

function databaseLocation(value) {
  const configured = String(value ?? "").trim();
  if (!configured || configured === ":memory:") return ":memory:";
  const location = resolve(configured);
  mkdirSync(dirname(location), { recursive: true });
  return location;
}

function subjectDigest(secret, bucket, subject) {
  return createHmac("sha256", secret)
    .update(`${bucket}\0${subject}`)
    .digest("hex");
}

function createDailyQuotaStore(options = {}) {
  const now = options.now ?? Date.now;
  const hashSecret = String(options.hashSecret ?? "");
  if (hashSecret.length < 32) {
    throw new Error("Daily quota storage requires a hash secret of at least 32 characters.");
  }

  const location = databaseLocation(options.databasePath);
  const database = new DatabaseSync(location);
  database.exec("PRAGMA busy_timeout = 5000");
  if (location !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS daily_quota_usage (
      bucket TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      subject_hash TEXT NOT NULL,
      request_count INTEGER NOT NULL CHECK (request_count >= 0),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (bucket, period_start, subject_hash)
    ) STRICT
  `);

  const selectUsage = database.prepare(`
    SELECT request_count
    FROM daily_quota_usage
    WHERE bucket = ? AND period_start = ? AND subject_hash = ?
  `);
  const insertUsage = database.prepare(`
    INSERT INTO daily_quota_usage (bucket, period_start, subject_hash, request_count, updated_at)
    VALUES (?, ?, ?, 1, ?)
  `);
  const updateUsage = database.prepare(`
    UPDATE daily_quota_usage
    SET request_count = request_count + 1, updated_at = ?
    WHERE bucket = ? AND period_start = ? AND subject_hash = ?
  `);
  const removeExpired = database.prepare("DELETE FROM daily_quota_usage WHERE updated_at < ?");
  let checks = 0;
  let closed = false;

  function consumePeriod(bucket, subject, limit, periodFor) {
    if (closed) throw new Error("Daily quota store is closed.");
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Daily quota limit must be a positive integer.");

    const timestamp = now();
    const period = periodFor(timestamp);
    const periodStart = period.start;
    const retryAfter = Math.max(1, Math.ceil((period.end - timestamp) / 1000));
    const subjectHash = subjectDigest(hashSecret, String(bucket), String(subject));

    database.exec("BEGIN IMMEDIATE");
    try {
      const current = selectUsage.get(String(bucket), periodStart, subjectHash);
      const count = Number(current?.request_count ?? 0);
      if (count >= limit) {
        database.exec("COMMIT");
        return { allowed: false, remaining: 0, retryAfter };
      }
      if (current) {
        updateUsage.run(timestamp, String(bucket), periodStart, subjectHash);
      } else {
        insertUsage.run(String(bucket), periodStart, subjectHash, timestamp);
      }
      database.exec("COMMIT");
      checks += 1;
      if (checks % 1024 === 0) {
        try {
          removeExpired.run(timestamp - (400 * DAY_MS));
        } catch {
          // Expiry cleanup must not reject an otherwise valid quota reservation.
        }
      }
      return { allowed: true, remaining: limit - count - 1, retryAfter };
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the original storage error.
      }
      throw error;
    }
  }

  return Object.freeze({
    consume: (bucket, subject, limit) => consumePeriod(bucket, subject, limit, dailyPeriod),
    consumeMonthly: (bucket, subject, limit) => consumePeriod(bucket, subject, limit, monthlyPeriod),
    status: () => ({ kind: "sqlite", durable: location !== ":memory:" }),
    close() {
      if (closed) return;
      closed = true;
      database.close();
    }
  });
}

function createUsageMeterStore(options = {}) {
  const now = options.now ?? Date.now;
  const hashSecret = String(options.hashSecret ?? "");
  if (hashSecret.length < 32) throw new Error("Usage storage requires a hash secret of at least 32 characters.");

  const location = databaseLocation(options.databasePath);
  const database = new DatabaseSync(location);
  database.exec("PRAGMA busy_timeout = 5000");
  if (location !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS forge_usage (
      bucket TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      subject_hash TEXT NOT NULL,
      usage_units INTEGER NOT NULL CHECK (usage_units >= 0),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (bucket, period_start, subject_hash)
    ) STRICT
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS forge_repair_attempts (
      repair_key TEXT PRIMARY KEY,
      claimed_at INTEGER NOT NULL
    ) STRICT
  `);
  const selectUsage = database.prepare(`
    SELECT usage_units FROM forge_usage
    WHERE bucket = ? AND period_start = ? AND subject_hash = ?
  `);
  const upsertUsage = database.prepare(`
    INSERT INTO forge_usage (bucket, period_start, subject_hash, usage_units, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(bucket, period_start, subject_hash) DO UPDATE SET
      usage_units = usage_units + excluded.usage_units,
      updated_at = excluded.updated_at
  `);
  const claimRepair = database.prepare(`
    INSERT OR IGNORE INTO forge_repair_attempts (repair_key, claimed_at)
    VALUES (?, ?)
  `);
  const removeExpiredRepairs = database.prepare(
    "DELETE FROM forge_repair_attempts WHERE claimed_at < ?"
  );
  let closed = false;

  function periodStatus(bucket, subject, limit, periodFor, amount = 0) {
    if (closed) throw new Error("Usage store is closed.");
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Usage limit must be a positive integer.");
    if (!Number.isInteger(amount) || amount < 0) throw new Error("Usage amount must be a non-negative integer.");
    const timestamp = now();
    const period = periodFor(timestamp);
    const subjectHash = subjectDigest(hashSecret, String(bucket), String(subject));
    const retryAfter = Math.max(1, Math.ceil((period.end - timestamp) / 1000));
    database.exec("BEGIN IMMEDIATE");
    try {
      const used = Number(selectUsage.get(String(bucket), period.start, subjectHash)?.usage_units ?? 0);
      const allowed = used < limit;
      if (allowed && amount > 0) upsertUsage.run(String(bucket), period.start, subjectHash, amount, timestamp);
      database.exec("COMMIT");
      const nextUsed = used + (allowed ? amount : 0);
      return { allowed, used: nextUsed, remaining: Math.max(0, limit - nextUsed), limit, retryAfter };
    } catch (error) {
      try { database.exec("ROLLBACK"); } catch { /* Preserve the storage error. */ }
      throw error;
    }
  }

  return Object.freeze({
    check: (bucket, subject, limit) => periodStatus(bucket, subject, limit, dailyPeriod),
    checkMonthly: (bucket, subject, limit) => periodStatus(bucket, subject, limit, monthlyPeriod),
    consume: (bucket, subject, amount, limit) => periodStatus(bucket, subject, limit, dailyPeriod, amount),
    consumeMonthly: (bucket, subject, amount, limit) => periodStatus(bucket, subject, limit, monthlyPeriod, amount),
    claimRepairAttempt(client, parentRequestId) {
      if (closed) throw new Error("Usage store is closed.");
      const repairKey = subjectDigest(hashSecret, "repair-attempt", `${String(client)}\0${String(parentRequestId)}`);
      const timestamp = now();
      database.exec("BEGIN IMMEDIATE");
      try {
        const result = claimRepair.run(repairKey, timestamp);
        database.exec("COMMIT");
        try {
          removeExpiredRepairs.run(timestamp - REPAIR_ATTEMPT_RETENTION_MS);
        } catch {
          // Retention cleanup must not reject a valid one-shot claim.
        }
        return Number(result?.changes ?? 0) > 0;
      } catch (error) {
        try { database.exec("ROLLBACK"); } catch { /* Preserve the original storage error. */ }
        throw error;
      }
    },
    status: () => ({ kind: "sqlite-usage", durable: location !== ":memory:" }),
    close() { if (!closed) { closed = true; database.close(); } }
  });
}

export { DAY_MS, createDailyQuotaStore, createUsageMeterStore, dailyPeriod, monthlyPeriod, subjectDigest };
