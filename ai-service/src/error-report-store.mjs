import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function normalizeEntry(entry = {}) {
  return {
    receivedAt: new Date().toISOString(),
    ...entry
  };
}

function receivedAtMs(line) {
  try {
    const parsed = JSON.parse(line);
    const timestamp = Date.parse(parsed?.receivedAt ?? "");
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

function createErrorReportStore(options = {}) {
  const path = String(options.path ?? "").trim();
  const retentionDays = Number.isFinite(Number(options.retentionDays))
    ? Math.floor(Math.min(365, Math.max(1, Number(options.retentionDays))))
    : 30;
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  if (!path) {
    return {
      async append() {
        return false;
      },
      status() {
        return { enabled: false, durable: false };
      }
    };
  }

  let operation = Promise.resolve();
  let lastPrunedAt = 0;

  async function pruneExpired(now) {
    if (now - lastPrunedAt < 60 * 60 * 1000) return;
    let contents;
    try {
      contents = await readFile(path, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    const cutoff = now - retentionMs;
    const lines = contents.split(/\r?\n/).filter(Boolean);
    const retained = lines.filter(line => {
      const timestamp = receivedAtMs(line);
      return timestamp == null || timestamp >= cutoff;
    });
    if (retained.length === lines.length) {
      lastPrunedAt = now;
      return;
    }
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, retained.length ? `${retained.join("\n")}\n` : "", "utf8");
    await rename(temporaryPath, path);
    lastPrunedAt = now;
  }

  return {
    async append(entry) {
      operation = operation.catch(() => {}).then(async () => {
        const now = Date.now();
        const line = `${JSON.stringify(normalizeEntry(entry))}\n`;
        await mkdir(dirname(path), { recursive: true });
        await appendFile(path, line, "utf8");
        await pruneExpired(now);
        return true;
      });
      return operation;
    },
    status() {
      return { enabled: true, durable: true, path, retentionDays };
    }
  };
}

export { createErrorReportStore };
