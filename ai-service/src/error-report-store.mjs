import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

function normalizeEntry(entry = {}) {
  return {
    receivedAt: new Date().toISOString(),
    ...entry
  };
}

function createErrorReportStore(options = {}) {
  const path = String(options.path ?? "").trim();
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

  return {
    async append(entry) {
      const line = `${JSON.stringify(normalizeEntry(entry))}\n`;
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, line, "utf8");
      return true;
    },
    status() {
      return { enabled: true, durable: true, path };
    }
  };
}

export { createErrorReportStore };
