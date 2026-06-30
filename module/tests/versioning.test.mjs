import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BUILD_VERSION, PRODUCT_TITLE, isManagedSourceLabel, sourceLabelForVersion } from "../scripts/versioning.js";

const moduleManifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
assert.equal(BUILD_VERSION, moduleManifest.version);

assert.equal(PRODUCT_TITLE, "Dungeon Master's Forge V2");
assert.equal(sourceLabelForVersion("2.10.0"), "Dungeon Master's Forge V2 v2.10.0");
assert.equal(sourceLabelForVersion(""), "Dungeon Master's Forge V2");

for (const label of [
  "Codex Item Forge v0.1",
  "Codex Item Forge Beta",
  "Dungeon Master's Forge v0.1",
  "Dungeon Master's Forge V2",
  "Dungeon Master's Forge V2.9.0"
]) {
  assert.equal(isManagedSourceLabel(label), true, `${label} should migrate`);
}

assert.equal(isManagedSourceLabel("Into the Feywilds"), false);
assert.equal(isManagedSourceLabel("My Campaign Forge"), false);

export const testedVersionLabelCount = 10;
