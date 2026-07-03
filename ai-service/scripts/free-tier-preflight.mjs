import { loadConfig } from "../src/config.mjs";
import { buildFreeTierDeploymentReport } from "../src/deployment-preflight.mjs";
import { createDailyQuotaStore } from "../src/quota-store.mjs";

const config = loadConfig();
const quotaStore = createDailyQuotaStore({
  databasePath: config.quotaDatabasePath,
  hashSecret: config.quotaHashSecret
});

try {
  const report = buildFreeTierDeploymentReport(config, quotaStore.status());
  console.log(JSON.stringify(report, null, 2));
} finally {
  quotaStore.close();
}
