const KIND_LABELS = Object.freeze({
  artifactWeaponHybrid: "Hybrid artifact",
  casterUtilityEquipment: "Spellcasting equipment",
  chargedHealing: "Healing consumable",
  chargedSaveDamage: "Save-based power",
  equipmentPowerSuite: "Equipment power suite",
  legendaryEquipmentSuite: "Legendary equipment suite",
  multiActivityStaff: "Multi-spell item",
  nativeEnchant: "Enchanting consumable",
  nativeMultiProfileSummon: "Selectable summon",
  nativeSummon: "Summoning item",
  passiveEffectEquipment: "Passive equipment",
  shieldArmorBonus: "Magic shield",
  weaponConditionOnHit: "Condition weapon",
  weaponExtraDamage: "Extra-damage weapon"
});

const ABILITY_LABELS = Object.freeze({
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma"
});

const RECOVERY_LABELS = Object.freeze({
  dawn: "at dawn",
  lr: "after a long rest",
  sr: "after a short rest"
});

function words(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function titleCase(value) {
  return words(value).replace(/\b\w/g, letter => letter.toUpperCase());
}

function rarityLabel(value) {
  return value ? titleCase(value) : "Unspecified rarity";
}

function attunementLabel(value) {
  const normalized = words(value);
  if (!normalized) return "No attunement";
  if (/^required$/i.test(normalized)) return "Attunement required";
  if (/^required by /i.test(normalized)) return `Attunement ${normalized.toLowerCase()}`;
  return titleCase(normalized);
}

function signedBonus(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  return /^[+-]/.test(normalized) ? normalized : `+${normalized}`;
}

function dieFormula(part) {
  if (!part) return "";
  const number = Number(part.number);
  const denomination = Number(part.denomination);
  let formula = number > 0 && denomination > 0 ? `${number}d${denomination}` : "";
  const bonus = String(part.bonus ?? "").trim();
  if (bonus) {
    const formatted = bonus === "@mod" ? "modifier" : bonus;
    formula += formula ? ` + ${formatted.replace(/^\+\s*/, "")}` : formatted;
  }
  return formula;
}

function damagePartText(part) {
  const formula = dieFormula(part);
  const types = Array.isArray(part?.types) ? part.types.filter(Boolean).map(type => words(type).toLowerCase()) : [];
  if (!formula && !types.length) return "";
  if (types.includes("healing")) return `${formula} healing`.trim();
  return `${formula}${types.length ? ` ${types.join("/")}` : ""} damage`.trim();
}

function damagePartsText(parts) {
  return (parts ?? []).map(damagePartText).filter(Boolean).join(" + ");
}

function durationText(duration) {
  if (!duration?.value || !duration?.units) return "";
  const value = Number(duration.value);
  const unit = words(duration.units).toLowerCase();
  return `${value} ${unit}${value === 1 ? "" : "s"}${duration.concentration ? ", concentration" : ""}`;
}

function rangeText(range) {
  if (!range) return "";
  if (range.units === "self" || range.units === "touch") return titleCase(range.units);
  if (range.value && range.units) return `${range.value} ${range.units}`;
  return "";
}

function targetText(target) {
  const template = target?.template;
  if (template?.size && template?.type) return `${template.size}-foot ${words(template.type).toLowerCase()}`;
  const affects = target?.affects;
  if (affects?.special) return affects.special;
  if (affects?.count && affects?.type) return `${affects.count} ${words(affects.type).toLowerCase()}`;
  return "";
}

function saveText(save) {
  if (!save?.dc || !save?.ability) return "";
  return `DC ${save.dc} ${ABILITY_LABELS[save.ability] ?? titleCase(save.ability)} save`;
}

function recoveryText(uses) {
  const max = String(uses?.max ?? "").trim();
  if (!max) return "";
  const count = Number(max);
  let result = `${max} ${count === 1 ? "use" : "uses"}`;
  const recovery = uses.recovery?.[0];
  if (recovery) {
    const amount = String(recovery.formula ?? recovery.type ?? max).trim();
    const period = RECOVERY_LABELS[recovery.period] ?? (recovery.period ? `per ${words(recovery.period).toLowerCase()}` : "");
    result += `; regains ${amount}${period ? ` ${period}` : ""}`;
  }
  if (uses.autoDestroy) result += "; consumed on use";
  return result;
}

function effectChangeText(change) {
  const value = change?.value;
  switch (change?.key) {
    case "system.attributes.ac.bonus": return `${signedBonus(value)} AC`;
    case "system.bonuses.abilities.save": return `${signedBonus(value)} saving throws`;
    case "system.bonuses.msak.attack":
    case "system.bonuses.rsak.attack": return `${signedBonus(value)} spell attacks`;
    case "system.bonuses.spell.dc": return `${signedBonus(value)} spell save DC`;
    case "system.traits.dr.value": return `${titleCase(value)} resistance`;
    case "system.properties": return String(value).includes("mgc") ? "Magical" : `Property: ${words(value)}`;
    case "system.damage.parts": return value?.damage ? `Adds ${damagePartText(value.damage)}` : "Adds damage";
    default: return change?.key ? `${change.key}: ${words(value)}` : "";
  }
}

function activityText(activity) {
  const details = [];
  if (activity.chargeCost) details.push(`${activity.chargeCost} ${activity.chargeCost === 1 ? "charge" : "charges"}`);
  if (activity.attackType) {
    const ability = activity.ability && activity.ability !== "spellcasting"
      ? ABILITY_LABELS[activity.ability] ?? titleCase(activity.ability)
      : "spellcasting";
    details.push(`${titleCase(activity.attackType)} attack (${ability})`);
  }
  const save = saveText(activity.save);
  if (save) details.push(save);
  const damage = damagePartsText(activity.damageParts);
  if (damage) details.push(damage);
  const range = rangeText(activity.range);
  if (range) details.push(`range ${range}`);
  const target = targetText(activity.target);
  if (target) details.push(target);
  const duration = durationText(activity.duration);
  if (duration) details.push(duration);
  return `${activity.activityName || "Power"}${details.length ? `: ${details.join("; ")}` : ""}`;
}

function stripItemPrefix(message, itemName) {
  const prefix = `[${itemName}]`;
  return message.startsWith(prefix) ? message.slice(prefix.length).trim() : message;
}

function compilationNotes(compilation, itemName, itemCount) {
  if (!compilation) return [];
  const groups = [
    ["assumption", "Assumption", compilation.assumptions],
    ["warning", "Warning", compilation.warnings],
    ["deferred", "Manual", compilation.deferred]
  ];
  const notes = [];
  for (const [state, label, values] of groups) {
    for (const message of values ?? []) {
      const prefixed = /^\[[^\]]+\]/.test(message);
      if (prefixed && !message.startsWith(`[${itemName}]`)) continue;
      if (!prefixed && itemCount > 1) continue;
      notes.push({ state, label, message: stripItemPrefix(message, itemName) });
    }
  }
  return notes;
}

function tierReviewNotes(tierReview, itemName) {
  if (!tierReview?.items?.length) return [];
  const match = tierReview.items.find(item => item.name === itemName);
  return (match?.notes ?? []).map(note => ({
    state: note.state ?? "warning",
    label: note.label ?? "Tier planning",
    message: note.message ?? "",
    handling: note.handling ?? ""
  }));
}

function summarizeSpec(spec, context = {}) {
  const mechanics = new Set();
  const add = value => {
    if (value) mechanics.add(value);
  };
  let activityCount = 0;

  if (spec.kind === "shieldArmorBonus" && spec.armorValue) add(`Shield bonus ${signedBonus(spec.armorValue)} AC`);
  else if (spec.armorValue) add(`Base AC ${spec.armorValue}`);
  if (spec.magicalBonus) add(`${signedBonus(spec.magicalBonus)} magic bonus`);

  const baseDamage = damagePartText(spec.damage?.base);
  if (baseDamage) add(`Attack: ${baseDamage}`);
  const versatileDamage = damagePartText(spec.damage?.versatile);
  if (versatileDamage) add(`Versatile: ${versatileDamage}`);
  const extraDamage = damagePartsText(spec.extraDamageParts);
  if (extraDamage) add(`Extra damage: ${extraDamage}`);
  const healing = damagePartText(spec.healing);
  if (healing) add(`Healing: ${healing}`);

  const effects = [...(spec.effects ?? []), ...(spec.passiveEffects ?? [])];
  const changes = [...new Set(effects.flatMap(effect => effect.changes ?? []).map(effectChangeText).filter(Boolean))];
  if (changes.length) add(`Passive: ${changes.join(", ")}`);

  const uses = recoveryText(spec.uses);
  if (uses) add(`Uses: ${uses}`);

  if (spec.conditionOnHit) {
    const condition = titleCase(spec.conditionOnHit.condition);
    const save = saveText(spec.conditionOnHit.save);
    const duration = spec.conditionOnHit.durationSeconds ? `${spec.conditionOnHit.durationSeconds} seconds` : "";
    add(`${condition} on hit${save ? `; ${save}` : ""}${duration ? `; ${duration}` : ""}`);
  }

  if (spec.damageParts?.length || spec.save) {
    activityCount += 1;
    add(activityText({
      activityName: spec.activityName || `Use ${spec.name}`,
      chargeCost: spec.chargeCost,
      save: spec.save,
      damageParts: spec.damageParts,
      range: spec.range,
      target: spec.target
    }));
  }

  for (const activity of [
    ...(spec.activities ?? []),
    ...(spec.attackActivities ?? []),
    ...(spec.utilityActivities ?? []),
    ...(spec.saveActivities ?? [])
  ]) {
    activityCount += 1;
    add(activityText(activity));
  }

  if (spec.summonActor) {
    activityCount += 1;
    const duration = durationText(spec.duration);
    const range = rangeText(spec.range);
    add(`Summon ${spec.profileName || spec.summonActor.name}${range ? ` within ${range}` : ""}${duration ? ` for ${duration}` : ""}`);
  }
  if (spec.summonProfiles?.length) {
    activityCount += 1;
    add(`Summon choice: ${spec.summonProfiles.map(profile => profile.profileName).join(", ")}`);
  }

  if (spec.enchantChanges?.length) {
    const enchantments = spec.enchantChanges.map(effectChangeText).filter(Boolean);
    const target = titleCase(spec.restrictions?.type || "item");
    const duration = durationText(spec.duration);
    add(`Enchant ${target}${duration ? ` for ${duration}` : ""}: ${enchantments.join(", ")}`);
  }

  if (spec.toggleLight) add(`Toggle light: ${spec.toggleLight.bright} ft bright, ${spec.toggleLight.dim} ft dim`);

  const unresolved = (spec.unresolvedMechanics ?? []).map(mechanic => ({
    state: "unresolved",
    label: mechanic.label || "Unresolved mechanic",
    message: mechanic.requestedText || mechanic.handling || mechanic.reason || "Manual handling required.",
    handling: mechanic.handling || ""
  }));
  const references = (spec.systemReferences ?? []).map(reference => ({
    state: "reference",
    label: reference.label || "System reference",
    message: reference.message || reference.name || "Resolved system content reference.",
    handling: reference.uuid || ""
  }));
  const notes = [
    ...compilationNotes(context.compilation, spec.name, context.itemCount ?? 1),
    ...tierReviewNotes(context.tierReview, spec.name),
    ...references,
    ...unresolved
  ];

  return {
    name: spec.name,
    img: spec.img,
    kind: spec.kind,
    kindLabel: KIND_LABELS[spec.kind] ?? titleCase(spec.kind),
    rarity: rarityLabel(spec.rarity),
    attunement: attunementLabel(spec.attunement),
    subtitle: `${KIND_LABELS[spec.kind] ?? titleCase(spec.kind)}, ${rarityLabel(spec.rarity).toLowerCase()}${attunementLabel(spec.attunement) !== "No attunement" ? ` (${attunementLabel(spec.attunement)})` : ""}`,
    description: String(spec.description ?? "").trim(),
    mechanics: Array.from(mechanics),
    activityCount,
    effectCount: effects.length + (spec.enchantChanges?.length ?? 0) + (spec.toggleLight ? 1 : 0) + (spec.conditionOnHit ? 1 : 0),
    notes,
    unresolvedCount: unresolved.length
  };
}

function buildReviewSummaries(specs, compilation = null, tierReview = null) {
  const items = Array.isArray(specs) ? specs : [];
  return items.map(spec => summarizeSpec(spec, { compilation, itemCount: items.length, tierReview }));
}

export { buildReviewSummaries, summarizeSpec };
