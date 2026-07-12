const MODULE_ID = "dungeon-masters-forge";
// Retain the previous package namespace only for one-way settings and flag migration.
const PREVIOUS_PACKAGE_ID = ["co", "dex-item-forge"].join("");

const SETTING_SCOPES = Object.freeze({
  itemFolderName: "world",
  actorFolderName: "world",
  sourceLabel: "world",
  replaceExisting: "world",
  lastSpecs: "client",
  lastRequest: "client",
  providerId: "client",
  hostedDefaultApplied: "client",
  unresolvedPolicy: "client",
  providerEndpoint: "client",
  providerModel: "client",
  rememberProviderApiToken: "client",
  providerApiToken: "client"
});

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function readForgeFlags(flags = {}) {
  const legacy = isObject(flags?.[PREVIOUS_PACKAGE_ID]) ? flags[PREVIOUS_PACKAGE_ID] : {};
  const current = isObject(flags?.[MODULE_ID]) ? flags[MODULE_ID] : {};
  return { ...legacy, ...current };
}

function hasStoredSetting(settings, scope, id) {
  const storage = settings.storage.get(scope);
  if (!storage) return false;
  if (scope === "client") return storage.getItem(id) !== null;
  return Boolean(storage.getSetting(id, null));
}

async function migrateLegacySettings({ settings = game.settings, isGM = game.user?.isGM } = {}) {
  const migrated = [];

  for (const [key, scope] of Object.entries(SETTING_SCOPES)) {
    if (scope === "world" && !isGM) continue;

    const currentId = `${MODULE_ID}.${key}`;
    const legacyId = `${PREVIOUS_PACKAGE_ID}.${key}`;
    if (hasStoredSetting(settings, scope, currentId)) continue;
    if (!hasStoredSetting(settings, scope, legacyId)) continue;

    await settings.set(MODULE_ID, key, settings.get(PREVIOUS_PACKAGE_ID, key));
    migrated.push(key);
  }

  return migrated;
}

export {
  MODULE_ID,
  PREVIOUS_PACKAGE_ID,
  SETTING_SCOPES,
  migrateLegacySettings,
  readForgeFlags
};
