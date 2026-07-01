import {
  FEATURE_IDS,
  TIER_IDS,
  featureLabel,
  getTier,
  supportsFeature
} from "./tier-catalog.js";

const KIND_FEATURES = Object.freeze({
  artifactWeaponHybrid: [FEATURE_IDS.MULTI_ACTIVITY_ITEMS, FEATURE_IDS.ACTIVITY_MACRO, FEATURE_IDS.ADVANCED_AUTOMATION],
  casterUtilityEquipment: [FEATURE_IDS.CUSTOM_PASSIVES, FEATURE_IDS.ACTIVE_EFFECTS_BASIC, FEATURE_IDS.MULTI_ACTIVITY_ITEMS],
  chargedHealing: [],
  chargedSaveDamage: [],
  equipmentPowerSuite: [FEATURE_IDS.MULTI_ACTIVITY_ITEMS, FEATURE_IDS.ADVANCED_AUTOMATION],
  legendaryEquipmentSuite: [FEATURE_IDS.MULTI_ACTIVITY_ITEMS, FEATURE_IDS.ADVANCED_AUTOMATION],
  multiActivityStaff: [FEATURE_IDS.MULTI_ACTIVITY_ITEMS],
  nativeEnchant: [FEATURE_IDS.CUSTOM_PASSIVES, FEATURE_IDS.ACTIVE_EFFECTS_ADVANCED],
  nativeMultiProfileSummon: [FEATURE_IDS.SUMMONING],
  nativeSummon: [FEATURE_IDS.SUMMONING],
  passiveEffectEquipment: [FEATURE_IDS.CUSTOM_PASSIVES, FEATURE_IDS.ACTIVE_EFFECTS_BASIC],
  shieldArmorBonus: [],
  weaponConditionOnHit: [FEATURE_IDS.MIDI_QOL, FEATURE_IDS.ACTIVITY_MACRO, FEATURE_IDS.ADVANCED_AUTOMATION],
  weaponExtraDamage: []
});

const UNRESOLVED_FEATURES = Object.freeze({
  allyAura: FEATURE_IDS.ADVANCED_AUTOMATION,
  classResource: FEATURE_IDS.ADVANCED_AUTOMATION,
  unmappedSpell: FEATURE_IDS.SRD_SPELLS_10_PLUS
});

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function spellFeatureForCount(count) {
  if (count <= 0) return null;
  if (count <= 2) return FEATURE_IDS.SRD_SPELLS_2;
  if (count <= 4) return FEATURE_IDS.SRD_SPELLS_4;
  if (count <= 7) return FEATURE_IDS.SRD_SPELLS_7;
  return FEATURE_IDS.SRD_SPELLS_10_PLUS;
}

function tierSupportsRequirement(tierId, featureId) {
  if (supportsFeature(tierId, featureId)) return true;
  if (featureId === FEATURE_IDS.SRD_SPELLS_2) {
    return supportsFeature(tierId, FEATURE_IDS.SRD_SPELLS_4)
      || supportsFeature(tierId, FEATURE_IDS.SRD_SPELLS_7)
      || supportsFeature(tierId, FEATURE_IDS.SRD_SPELLS_10_PLUS);
  }
  if (featureId === FEATURE_IDS.SRD_SPELLS_4) {
    return supportsFeature(tierId, FEATURE_IDS.SRD_SPELLS_7)
      || supportsFeature(tierId, FEATURE_IDS.SRD_SPELLS_10_PLUS);
  }
  if (featureId === FEATURE_IDS.SRD_SPELLS_7) {
    return supportsFeature(tierId, FEATURE_IDS.SRD_SPELLS_10_PLUS);
  }
  return false;
}

function requiredTierForFeature(featureId) {
  for (const tierId of TIER_IDS) {
    if (supportsFeature(tierId, featureId)) return tierId;
  }
  return null;
}

function spellNamesForSpec(spec) {
  const names = [];
  const addFromActivity = activity => {
    const name = String(activity?.activityName ?? "").trim();
    if (!name) return;
    const castMatch = name.match(/^Cast\s+(.+)$/i);
    if (castMatch) names.push(castMatch[1].trim());
    else if (/^[A-Z][A-Za-z' -]+$/.test(name) && (activity?.save || activity?.damageParts?.length)) names.push(name);
  };

  for (const activity of [
    ...(spec.activities ?? []),
    ...(spec.utilityActivities ?? []),
    ...(spec.saveActivities ?? [])
  ]) addFromActivity(activity);

  return unique(names);
}

function collectRequirements(spec) {
  const grouped = new Map();
  const add = (featureId, reason) => {
    if (!featureId) return;
    if (!grouped.has(featureId)) grouped.set(featureId, new Set());
    if (reason) grouped.get(featureId).add(reason);
  };

  add(FEATURE_IDS.BASIC_ITEMS, "All generated items rely on the core item-construction baseline.");

  for (const featureId of KIND_FEATURES[spec.kind] ?? []) {
    add(featureId, `${spec.name} uses the ${spec.kind} request family.`);
  }

  if ((spec.effects?.length ?? 0) || (spec.passiveEffects?.length ?? 0)) {
    add(FEATURE_IDS.CUSTOM_PASSIVES, `${spec.name} includes passive effect changes.`);
  }

  if (spec.summonActor || (spec.summonProfiles?.length ?? 0)) {
    add(FEATURE_IDS.SUMMONING, `${spec.name} includes summon automation.`);
  }

  if (spec.toggleLight) {
    add(FEATURE_IDS.ACTIVITY_MACRO, `${spec.name} uses a token-light toggle macro.`);
    add(FEATURE_IDS.ADVANCED_AUTOMATION, `${spec.name} changes token lighting when activated.`);
  }

  if (spec.conditionOnHit) {
    add(FEATURE_IDS.MIDI_QOL, `${spec.name} applies a hit rider that depends on combat automation hooks.`);
    add(FEATURE_IDS.ACTIVITY_MACRO, `${spec.name} uses scripted on-hit condition handling.`);
    add(FEATURE_IDS.ADVANCED_AUTOMATION, `${spec.name} applies a condition rider on hit.`);
  }

  if ((spec.utilityActivities ?? []).some(activity => activity?.macroCommand)) {
    add(FEATURE_IDS.MIDI_QOL, `${spec.name} includes a scripted utility activity.`);
    add(FEATURE_IDS.ACTIVITY_MACRO, `${spec.name} includes an Item Macro-backed utility activity.`);
    add(FEATURE_IDS.ADVANCED_AUTOMATION, `${spec.name} includes macro-driven utility automation.`);
  }

  const spellNames = spellNamesForSpec(spec);
  const spellFeature = spellFeatureForCount(spellNames.length);
  if (spellFeature) {
    add(spellFeature, `${spec.name} references ${spellNames.length} SRD spell${spellNames.length === 1 ? "" : "s"}: ${spellNames.join(", ")}.`);
  }

  for (const mechanic of spec.unresolvedMechanics ?? []) {
    const featureId = UNRESOLVED_FEATURES[mechanic.category];
    if (!featureId) continue;
    add(featureId, `${spec.name} requests ${mechanic.label?.toLowerCase() || mechanic.category}.`);
  }

  return [...grouped.entries()].map(([featureId, reasons]) => ({
    featureId,
    reasons: [...reasons]
  }));
}

function tierReviewNote(spec, selectedTier, featureId, reasons) {
  const requiredTierId = requiredTierForFeature(featureId);
  const requiredTier = requiredTierId ? getTier(requiredTierId) : null;
  const reasonText = reasons.length ? ` ${reasons[0]}` : "";
  return {
    state: "warning",
    label: "Tier planning",
    message: `${featureLabel(featureId)} is planned for ${requiredTier?.label ?? "a higher"} tier than ${selectedTier.label}.${reasonText}`,
    handling: requiredTier
      ? `Selected tier: ${selectedTier.label}. Plan for ${requiredTier.label} or simplify this mechanic before Hosted Forge entitlement checks are enforced.`
      : `Selected tier: ${selectedTier.label}. Review this mechanic before Hosted Forge entitlement checks are enforced.`,
    featureId,
    requiredTierId: requiredTier?.id ?? null,
    requiredTierLabel: requiredTier?.label ?? ""
  };
}

function reviewTierFit(specs, tierId) {
  const selectedTier = getTier(tierId);
  if (!selectedTier) throw new Error(`Unknown Forge tier "${tierId}".`);

  const items = (Array.isArray(specs) ? specs : []).map(spec => {
    const notes = collectRequirements(spec)
      .filter(requirement => !tierSupportsRequirement(selectedTier.id, requirement.featureId))
      .map(requirement => tierReviewNote(spec, selectedTier, requirement.featureId, requirement.reasons));
    return {
      name: spec.name,
      kind: spec.kind,
      notes
    };
  });

  return {
    tierId: selectedTier.id,
    tierLabel: selectedTier.label,
    noteCount: items.reduce((total, item) => total + item.notes.length, 0),
    items
  };
}

export { reviewTierFit };
