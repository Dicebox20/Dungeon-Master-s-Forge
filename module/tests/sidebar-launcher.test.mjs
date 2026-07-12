import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../scripts/dungeon-masters-forge.js", import.meta.url), "utf8");

assert.match(script, /function injectItemsSidebarLauncher\(root = document\)/);
assert.match(script, /data-dm_forge-launcher="open"/);
assert.match(script, /Hooks\.on\("renderSidebarTab"/);
assert.match(script, /Hooks\.on\("changeSidebarTab"/);
assert.match(script, /Open \$\{MODULE_TITLE\}/);
assert.match(script, /if \(forgeDialog\.minimized\) await forgeDialog\.maximize\(\)/);
