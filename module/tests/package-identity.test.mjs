import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PREVIOUS_PACKAGE_ID,
  MODULE_ID,
  migrateLegacySettings,
  readForgeFlags
} from "../scripts/package-identity.js";

const moduleManifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
let testingManifest = null;
try {
  testingManifest = JSON.parse(await readFile(new URL("../../testing/module.json", import.meta.url), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function settingsHarness({ current = [], legacy = {}, world = [] } = {}) {
  const clientKeys = new Set([...current, ...Object.keys(legacy).map(key => `${PREVIOUS_PACKAGE_ID}.${key}`)]);
  const worldKeys = new Set(world);
  const writes = [];
  const clientStorage = {
    getItem: key => clientKeys.has(key) ? "stored" : null
  };
  const worldStorage = {
    getSetting: key => worldKeys.has(key) ? { id: key } : null
  };
  const settings = {
    storage: new Map([["client", clientStorage], ["world", worldStorage]]),
    get: (namespace, key) => {
      assert.equal(namespace, PREVIOUS_PACKAGE_ID);
      return legacy[key];
    },
    set: async (namespace, key, value) => {
      writes.push({ namespace, key, value });
      clientKeys.add(`${namespace}.${key}`);
      worldKeys.add(`${namespace}.${key}`);
    }
  };
  return { settings, writes };
}

test("the public package identity uses only the Dungeon Master's Forge ID", () => {
  assert.equal(MODULE_ID, "dungeon-masters-forge");
  assert.equal(PREVIOUS_PACKAGE_ID, ["co", "dex-item-forge"].join(""));
  assert.equal(moduleManifest.id, MODULE_ID);
  if (testingManifest) {
    assert.equal(testingManifest.id, MODULE_ID);
  }
});

test("legacy flags remain readable while current flags take precedence", () => {
  assert.deepEqual(readForgeFlags({
    [PREVIOUS_PACKAGE_ID]: { engine: "2.21.12", kind: "weaponExtraDamage" },
    [MODULE_ID]: { engine: "2.23.0", createdAt: "now" }
  }), {
    engine: "2.23.0",
    kind: "weaponExtraDamage",
    createdAt: "now"
  });
});

test("missing settings migrate without overwriting current values", async () => {
  const { settings, writes } = settingsHarness({
    current: [`${MODULE_ID}.providerId`],
    legacy: {
      providerId: "bring-your-own",
      lastRequest: "Create a fire dagger",
      itemFolderName: "Legacy Items"
    },
    world: [`${PREVIOUS_PACKAGE_ID}.itemFolderName`]
  });

  const migrated = await migrateLegacySettings({ settings, isGM: true });
  assert.deepEqual(migrated.sort(), ["itemFolderName", "lastRequest"]);
  assert.deepEqual(writes, [
    { namespace: MODULE_ID, key: "itemFolderName", value: "Legacy Items" },
    { namespace: MODULE_ID, key: "lastRequest", value: "Create a fire dagger" }
  ]);
});

test("non-GM clients migrate client settings but leave world settings to a GM", async () => {
  const { settings, writes } = settingsHarness({
    legacy: {
      providerModel: "gpt-4.1-mini",
      sourceLabel: "Legacy Source"
    },
    world: [`${PREVIOUS_PACKAGE_ID}.sourceLabel`]
  });

  const migrated = await migrateLegacySettings({ settings, isGM: false });
  assert.deepEqual(migrated, ["providerModel"]);
  assert.deepEqual(writes, [
    { namespace: MODULE_ID, key: "providerModel", value: "gpt-4.1-mini" }
  ]);
});
