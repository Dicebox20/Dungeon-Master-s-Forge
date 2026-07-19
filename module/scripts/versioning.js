const PRODUCT_TITLE = "Dungeon Master's Forge";
const BUILD_VERSION = "2.23.1";

function sourceLabelForVersion(version) {
  const normalized = String(version ?? "").trim();
  return normalized ? `${PRODUCT_TITLE} v${normalized}` : PRODUCT_TITLE;
}

function isManagedSourceLabel(label) {
  const value = String(label ?? "").trim();
  const priorProductLabel = ["Co", "dex Item Forge"].join("");
  const priorPattern = priorProductLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(?:${priorPattern}(?:\\s+(?:v?[\\d.]+|Beta))?|Dungeon Master's Forge(?:\\s+(?:v?[\\d.]+|Beta|V2))?)$`, "i").test(value);
}

export { BUILD_VERSION, PRODUCT_TITLE, isManagedSourceLabel, sourceLabelForVersion };
