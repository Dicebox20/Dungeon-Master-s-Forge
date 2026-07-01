const FEATURE_IDS = Object.freeze({
  BASIC_ITEMS: "basicItems",
  CUSTOM_PASSIVES: "customPassives",
  ACTIVE_EFFECTS_BASIC: "activeEffectsBasic",
  ACTIVE_EFFECTS_ADVANCED: "activeEffectsAdvanced",
  MULTI_ACTIVITY_ITEMS: "multiActivityItems",
  SRD_SPELLS_2: "srdSpells2",
  SRD_SPELLS_4: "srdSpells4",
  SRD_SPELLS_7: "srdSpells7",
  SRD_SPELLS_10_PLUS: "srdSpells10Plus",
  SUMMONING: "summoning",
  MIDI_QOL: "midiQol",
  ACTIVITY_MACRO: "activityMacro",
  ADVANCED_AUTOMATION: "advancedAutomation",
  REALMFORGED_ITEMS: "realmforgedItems",
  SCENE_TRANSFER_PACKAGES: "sceneTransferPackages",
  MONKS_ACTIVE_TILES: "monksActiveTiles",
  IMAGE_GENERATION: "imageGeneration"
});

const FEATURE_LABELS = Object.freeze({
  [FEATURE_IDS.BASIC_ITEMS]: "Basic Foundry-ready items",
  [FEATURE_IDS.CUSTOM_PASSIVES]: "Custom passive effects",
  [FEATURE_IDS.ACTIVE_EFFECTS_BASIC]: "Basic Active Effects",
  [FEATURE_IDS.ACTIVE_EFFECTS_ADVANCED]: "Advanced Active Effects",
  [FEATURE_IDS.MULTI_ACTIVITY_ITEMS]: "Multi-activity items",
  [FEATURE_IDS.SRD_SPELLS_2]: "Up to 2 SRD spells",
  [FEATURE_IDS.SRD_SPELLS_4]: "Up to 4 SRD spells",
  [FEATURE_IDS.SRD_SPELLS_7]: "Up to 7 SRD spells",
  [FEATURE_IDS.SRD_SPELLS_10_PLUS]: "10 or more SRD spells",
  [FEATURE_IDS.SUMMONING]: "Summoning automation",
  [FEATURE_IDS.MIDI_QOL]: "Midi-QOL compatibility",
  [FEATURE_IDS.ACTIVITY_MACRO]: "Activity Macro compatibility",
  [FEATURE_IDS.ADVANCED_AUTOMATION]: "Advanced Foundry automation",
  [FEATURE_IDS.REALMFORGED_ITEMS]: "Realmforged item packages",
  [FEATURE_IDS.SCENE_TRANSFER_PACKAGES]: "Scene transfer packages",
  [FEATURE_IDS.MONKS_ACTIVE_TILES]: "Monk's Active Tile Triggers integration",
  [FEATURE_IDS.IMAGE_GENERATION]: "Optional item icon image generation"
});

const TIER_IDS = Object.freeze([
  "apprentice",
  "adept",
  "journeyman",
  "master",
  "foundingPatron"
]);

const TIER_CATALOG = Object.freeze([
  Object.freeze({
    id: "apprentice",
    label: "Apprentice",
    priceUsdMonthly: 0,
    volume: Object.freeze({ suggestedMonthlyItems: 30 }),
    summary: "Basic Foundry-ready DMG-style items.",
    features: Object.freeze([
      FEATURE_IDS.BASIC_ITEMS,
      FEATURE_IDS.SRD_SPELLS_2
    ]),
    limits: Object.freeze([
      "No custom conditional effects",
      "No advanced Active Effects",
      "No Midi-QOL or Activity Macro automation",
      "No summoning automation",
      "No realm-transfer effects"
    ])
  }),
  Object.freeze({
    id: "adept",
    label: "Adept",
    priceUsdMonthly: 4.99,
    volume: Object.freeze({ suggestedMonthlyItemsMin: 150, suggestedMonthlyItemsMax: 200 }),
    summary: "Custom mechanical effects.",
    features: Object.freeze([
      FEATURE_IDS.BASIC_ITEMS,
      FEATURE_IDS.CUSTOM_PASSIVES,
      FEATURE_IDS.ACTIVE_EFFECTS_BASIC,
      FEATURE_IDS.SRD_SPELLS_4
    ]),
    limits: Object.freeze([
      "No complex macros",
      "No Midi-QOL automation",
      "No token movement automation",
      "No full summoning automation",
      "No generated realm scenes"
    ])
  }),
  Object.freeze({
    id: "journeyman",
    label: "Journeyman",
    priceUsdMonthly: 9.99,
    volume: Object.freeze({ suggestedMonthlyItemsMin: 500, suggestedMonthlyItemsMax: 750 }),
    summary: "Advanced item building without full automation.",
    features: Object.freeze([
      FEATURE_IDS.BASIC_ITEMS,
      FEATURE_IDS.CUSTOM_PASSIVES,
      FEATURE_IDS.ACTIVE_EFFECTS_BASIC,
      FEATURE_IDS.ACTIVE_EFFECTS_ADVANCED,
      FEATURE_IDS.MULTI_ACTIVITY_ITEMS,
      FEATURE_IDS.SRD_SPELLS_7
    ]),
    limits: Object.freeze([
      "No full Midi-QOL macro generation",
      "No Activity Macro generation",
      "No automated summoning packages",
      "No realm-transfer scene packages",
      "No Monk's Active Tile Triggers integration"
    ])
  }),
  Object.freeze({
    id: "master",
    label: "Master",
    priceUsdMonthly: 19.99,
    volume: Object.freeze({ suggestedMonthlyItemsMin: 1500, suggestedMonthlyItemsMax: 2000 }),
    summary: "Automation, macros, and advanced Foundry behavior.",
    features: Object.freeze([
      FEATURE_IDS.BASIC_ITEMS,
      FEATURE_IDS.CUSTOM_PASSIVES,
      FEATURE_IDS.ACTIVE_EFFECTS_BASIC,
      FEATURE_IDS.ACTIVE_EFFECTS_ADVANCED,
      FEATURE_IDS.MULTI_ACTIVITY_ITEMS,
      FEATURE_IDS.SRD_SPELLS_10_PLUS,
      FEATURE_IDS.SUMMONING,
      FEATURE_IDS.MIDI_QOL,
      FEATURE_IDS.ACTIVITY_MACRO,
      FEATURE_IDS.ADVANCED_AUTOMATION
    ]),
    limits: Object.freeze([
      "No Realmforged scene packages",
      "No premade item-linked map or scene integration",
      "No Monk's Active Tile Triggers scene automation",
      "No Founding Patron credits"
    ])
  }),
  Object.freeze({
    id: "foundingPatron",
    label: "Founding Patron",
    priceUsdMonthly: 49.99,
    volume: Object.freeze({ suggestedMonthlyItems: null }),
    summary: "Premium early-supporter tier with advanced item-linked scene features.",
    features: Object.freeze([
      FEATURE_IDS.BASIC_ITEMS,
      FEATURE_IDS.CUSTOM_PASSIVES,
      FEATURE_IDS.ACTIVE_EFFECTS_BASIC,
      FEATURE_IDS.ACTIVE_EFFECTS_ADVANCED,
      FEATURE_IDS.MULTI_ACTIVITY_ITEMS,
      FEATURE_IDS.SRD_SPELLS_10_PLUS,
      FEATURE_IDS.SUMMONING,
      FEATURE_IDS.MIDI_QOL,
      FEATURE_IDS.ACTIVITY_MACRO,
      FEATURE_IDS.ADVANCED_AUTOMATION,
      FEATURE_IDS.REALMFORGED_ITEMS,
      FEATURE_IDS.SCENE_TRANSFER_PACKAGES,
      FEATURE_IDS.MONKS_ACTIVE_TILES,
      FEATURE_IDS.IMAGE_GENERATION
    ]),
    limits: Object.freeze([
      "Experimental features remain opt-in and version-gated"
    ])
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listTiers() {
  return clone(TIER_CATALOG);
}

function getTier(tierId) {
  return TIER_CATALOG.find(tier => tier.id === tierId) ?? null;
}

function featureLabel(featureId) {
  return FEATURE_LABELS[featureId] ?? featureId;
}

function supportsFeature(tierId, featureId) {
  const tier = getTier(tierId);
  if (!tier) throw new Error(`Unknown Forge tier "${tierId}".`);
  return tier.features.includes(featureId);
}

function featuresForTier(tierId) {
  const tier = getTier(tierId);
  if (!tier) throw new Error(`Unknown Forge tier "${tierId}".`);
  return [...tier.features];
}

export {
  FEATURE_IDS,
  FEATURE_LABELS,
  TIER_CATALOG,
  TIER_IDS,
  featureLabel,
  featuresForTier,
  getTier,
  listTiers,
  supportsFeature
};
