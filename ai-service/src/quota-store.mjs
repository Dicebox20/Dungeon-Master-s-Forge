import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DAY_MS = 86400000;

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

export { DAY_MS, createDailyQuotaStore, dailyPeriod, monthlyPeriod, subjectDigest };
