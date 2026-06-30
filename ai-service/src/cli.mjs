import { loadConfig } from "./config.mjs";
import { createForgeServer } from "./server.mjs";

const config = loadConfig();
const server = createForgeServer({ config });

server.listen(config.port, config.host, () => {
  const address = server.address();
  const host = typeof address === "object" && address ? address.address : config.host;
  const port = typeof address === "object" && address ? address.port : config.port;
  console.log(`Dungeon Master's Forge AI Service listening on http://${host}:${port}/v1/forge/compile (${config.mode} mode)`);
});

function shutdown(signal) {
  console.log(`${signal} received; stopping Forge AI service.`);
  server.close(error => {
    if (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
