import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const tests = readdirSync(new URL("../tests/", import.meta.url))
  .filter(name => name.endsWith(".test.mjs"))
  .sort()
  .map(name => resolve(new URL(`../tests/${name}`, import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1))));

const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
