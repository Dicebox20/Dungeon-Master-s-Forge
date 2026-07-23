import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function usage() {
  console.log([
    "Usage:",
    "  node scripts/quota-admin.mjs summary",
    "  node scripts/quota-admin.mjs reset-current-month",
    "  node scripts/quota-admin.mjs reset-current-day",
    "  node scripts/quota-admin.mjs reset-all",
    "",
    "Environment:",
    "  DMF_QUOTA_DATABASE_PATH  Optional path to the SQLite usage ledger.",
    "                           Defaults to ./data/free-tier-quota.sqlite"
  ].join("\n"));
}

function databaseLocation(value) {
  const configured = String(value ?? "").trim() || "./data/free-tier-quota.sqlite";
  const location = resolve(configured);
  mkdirSync(dirname(location), { recursive: true });
  return location;
}

function dayStart(timestamp) {
  const DAY_MS = 86400000;
  return Math.floor(timestamp / DAY_MS) * DAY_MS;
}

function monthStart(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

const command = String(process.argv[2] ?? "summary").trim().toLowerCase();
if (["-h", "--help", "help"].includes(command)) {
  usage();
  process.exit(0);
}

const location = databaseLocation(process.env.DMF_QUOTA_DATABASE_PATH);
const database = new DatabaseSync(location);
database.exec("PRAGMA busy_timeout = 5000");
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

const listStmt = database.prepare(`
  SELECT bucket, period_start, COUNT(*) AS subject_count, SUM(usage_units) AS usage_units, MAX(updated_at) AS updated_at
  FROM forge_usage
  GROUP BY bucket, period_start
  ORDER BY period_start DESC, bucket ASC
`);

const deleteBucketPeriodStmt = database.prepare(`
  DELETE FROM forge_usage
  WHERE bucket = ? AND period_start = ?
`);

const deleteAllStmt = database.prepare("DELETE FROM forge_usage");

try {
  if (command === "summary") {
    const rows = listStmt.all().map(row => ({
      bucket: row.bucket,
      periodStartUtc: new Date(Number(row.period_start)).toISOString(),
      subjectCount: Number(row.subject_count ?? 0),
      usageUnits: Number(row.usage_units ?? 0),
      updatedAtUtc: new Date(Number(row.updated_at ?? 0)).toISOString()
    }));
    console.log(JSON.stringify({
      databasePath: location,
      rows
    }, null, 2));
    process.exit(0);
  }

  if (command === "reset-current-month") {
    const deleted = deleteBucketPeriodStmt.run("client-month", monthStart(Date.now())).changes;
    console.log(JSON.stringify({
      databasePath: location,
      command,
      deletedRows: deleted
    }, null, 2));
    process.exit(0);
  }

  if (command === "reset-current-day") {
    const currentDay = dayStart(Date.now());
    const deletedClient = deleteBucketPeriodStmt.run("client", currentDay).changes;
    const deletedGlobal = deleteBucketPeriodStmt.run("global", currentDay).changes;
    console.log(JSON.stringify({
      databasePath: location,
      command,
      deletedRows: deletedClient + deletedGlobal,
      deletedBuckets: {
        client: deletedClient,
        global: deletedGlobal
      }
    }, null, 2));
    process.exit(0);
  }

  if (command === "reset-all") {
    const deleted = deleteAllStmt.run().changes;
    console.log(JSON.stringify({
      databasePath: location,
      command,
      deletedRows: deleted
    }, null, 2));
    process.exit(0);
  }

  console.error(`Unknown quota-admin command "${command}".`);
  usage();
  process.exit(1);
} finally {
  database.close();
}
