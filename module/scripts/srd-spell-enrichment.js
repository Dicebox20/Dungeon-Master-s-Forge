function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stableId(label) {
  const base = String(label).replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "Forge";
  let hash = 2166136261;
  for (const character of String(label)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36).padStart(5, "0").slice(-5);
  return `${base}${suffix}`.padEnd(16, "0").slice(0, 16);
}

const SPELL_LIBRARY = Object.freeze([
  Object.freeze({
    name: "Thunderwave",
    level: 1,
    tags: Object.freeze(["thunder"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{ number: 2, denomination: 8, bonus: "", types: Object.freeze(["thunder"]) }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cube", size: 15, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 15-foot cube" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Shatter",
    level: 2,
    tags: Object.freeze(["thunder"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{ number: 3, denomination: 8, bonus: "", types: Object.freeze(["thunder"]) }]),
    range: { value: 60, units: "ft" },
    target: {
      template: { count: "1", type: "sphere", size: 10, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 10-foot-radius sphere" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Burning Hands",
    level: 1,
    tags: Object.freeze(["fire"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([{ number: 3, denomination: 6, bonus: "", types: Object.freeze(["fire"]) }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cone", size: 15, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 15-foot cone" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Fireball",
    level: 3,
    tags: Object.freeze(["fire"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([{ number: 8, denomination: 6, bonus: "", types: Object.freeze(["fire"]) }]),
    range: { value: 150, units: "ft" },
    target: {
      template: { count: "1", type: "sphere", size: 20, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius sphere" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Lightning Bolt",
    level: 3,
    tags: Object.freeze(["lightning"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([{ number: 8, denomination: 6, bonus: "", types: Object.freeze(["lightning"]) }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "line", size: 100, width: 5, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 100-foot line" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Ice Storm",
    level: 4,
    tags: Object.freeze(["cold", "bludgeoning"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([
      { number: 2, denomination: 8, bonus: "", types: Object.freeze(["bludgeoning"]) },
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["cold"]) }
    ]),
    range: { value: 300, units: "ft" },
    target: {
      template: { count: "1", type: "cylinder", size: 20, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 20-foot-radius, 40-foot-high cylinder" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Cone of Cold",
    level: 5,
    tags: Object.freeze(["cold"]),
    save: { ability: "con" },
    damageParts: Object.freeze([{ number: 8, denomination: 8, bonus: "", types: Object.freeze(["cold"]) }]),
    range: { units: "self" },
    target: {
      template: { count: "1", type: "cone", size: 60, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 60-foot cone" },
      prompt: true
    }
  }),
  Object.freeze({
    name: "Flame Strike",
    level: 5,
    tags: Object.freeze(["fire", "radiant"]),
    save: { ability: "dex" },
    damageParts: Object.freeze([
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["fire"]) },
      { number: 4, denomination: 6, bonus: "", types: Object.freeze(["radiant"]) }
    ]),
    range: { value: 60, units: "ft" },
    target: {
      template: { count: "1", type: "cylinder", size: 10, height: 40, units: "ft" },
      affects: { type: "creature", special: "Creatures in the 10-foot-radius, 40-foot-high cylinder" },
      prompt: true
    }
  })
]);

const ACTIVITY_CAPABLE_KINDS = new Set([
  "weaponExtraDamage",
  "artifactWeaponHybrid",
  "casterUtilityEquipment",
  "equipmentPowerSuite",
  "legendaryEquipmentSuite",
  "multiActivityStaff"
]);

function requestedSpellChoiceCount(request) {
  const text = compactText(request);
  const direct = text.match(/\b(\d+)\s+spells?\s+of\s+(?:your|their|the wielder'?s?)\s+choice\b/i)?.[1];
  if (direct) return Number(direct);
  const choose = text.match(/\bchoose\s+(\d+)\s+spells?\b/i)?.[1];
  if (choose) return Number(choose);
  return 0;
}

function parseChargeMax(request) {
  const match = compactText(request).match(/\b(\d+)\s+charges?\b/i)?.[1];
  return match ? String(Number(match)) : "";
}

function inferDamageTags(request, spec = {}) {
  const tags = new Set();
  const source = `${compactText(request)} ${compactText(spec.description)}`.toLowerCase();
  for (const tag of ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "slashing", "thunder"]) {
    if (source.includes(tag)) tags.add(tag);
  }
  for (const part of spec.extraDamageParts ?? []) {
    for (const type of part?.types ?? []) tags.add(String(type).toLowerCase());
  }
  for (const part of spec.damageParts ?? []) {
    for (const type of part?.types ?? []) tags.add(String(type).toLowerCase());
  }
  for (const activity of [...(spec.saveActivities ?? []), ...(spec.activities ?? [])]) {
    for (const part of activity?.damageParts ?? []) {
      for (const type of part?.types ?? []) tags.add(String(type).toLowerCase());
    }
  }
  return tags;
}

function rankedSpellProfiles(tags) {
  const preferred = [];
  const add = name => {
    const profile = SPELL_LIBRARY.find(entry => entry.name === name);
    if (profile && !preferred.includes(profile)) preferred.push(profile);
  };

  if (tags.has("thunder")) {
    add("Thunderwave");
    add("Shatter");
  }
  if (tags.has("fire")) {
    add("Fireball");
    add("Burning Hands");
    add("Flame Strike");
  }
  if (tags.has("lightning")) add("Lightning Bolt");
  if (tags.has("cold")) {
    add("Ice Storm");
    add("Cone of Cold");
  }

  for (const profile of SPELL_LIBRARY) {
    if (!preferred.includes(profile)) preferred.push(profile);
  }
  return preferred;
}

function hasExplicitSpellActivities(spec) {
  const namedActivities = [
    ...(spec.activities ?? []),
    ...(spec.saveActivities ?? []),
    ...(spec.utilityActivities ?? []),
    ...(spec.attackActivities ?? [])
  ];
  return namedActivities.some(activity => /^cast\s+/i.test(compactText(activity.activityName)));
}

function isSpellChoiceMechanic(mechanic) {
  const text = [
    compactText(mechanic?.label),
    compactText(mechanic?.requestedText),
    compactText(mechanic?.reason),
    compactText(mechanic?.handling)
  ].join(" ").toLowerCase();
  return /\bspell/.test(text) && (/\bchoice\b/.test(text) || /\bcharges?\b/.test(text));
}

function buildSaveActivity(itemName, spellProfile) {
  return {
    activityId: stableId(`${itemName} ${spellProfile.name}`),
    activityName: `Cast ${spellProfile.name}`,
    activationType: "action",
    chargeCost: spellProfile.level,
    chatFlavor: `Cast ${spellProfile.name} using this item's charges.`,
    range: clone(spellProfile.range),
    target: clone(spellProfile.target),
    save: clone(spellProfile.save),
    damageOnSave: "half",
    damageParts: clone(spellProfile.damageParts)
  };
}

async function autoSelectSrdChoiceSpells(spec, request, options = {}) {
  const requestedCount = requestedSpellChoiceCount(request);
  if (requestedCount < 1) return { applied: false, spec };
  if (!ACTIVITY_CAPABLE_KINDS.has(spec?.kind)) return { applied: false, spec };
  if (hasExplicitSpellActivities(spec)) return { applied: false, spec };

  const tags = inferDamageTags(request, spec);
  const resolveSpell = options.resolveSpell;
  if (typeof resolveSpell !== "function") throw new Error("autoSelectSrdChoiceSpells requires a resolveSpell function.");

  const chosen = [];
  for (const profile of rankedSpellProfiles(tags)) {
    const resolution = await resolveSpell(profile.name);
    if (resolution?.status !== "compatible") continue;
    chosen.push({ profile, resolution });
    if (chosen.length >= requestedCount) break;
  }

  if (chosen.length !== requestedCount) {
    return {
      applied: false,
      spec,
      warning: `Unable to find ${requestedCount} compatible SRD spell${requestedCount === 1 ? "" : "s"} for automatic selection.`
    };
  }

  const next = clone(spec);
  next.uses = next.uses ?? { max: parseChargeMax(request), recovery: [], autoDestroy: false };
  if (!String(next.uses?.max ?? "").trim()) next.uses.max = parseChargeMax(request);
  next.saveActivities = [
    ...(Array.isArray(next.saveActivities) ? next.saveActivities : []),
    ...chosen.map(({ profile }) => buildSaveActivity(next.name, profile))
  ];
  next.systemReferences = [
    ...(Array.isArray(next.systemReferences) ? next.systemReferences : []),
    ...chosen.map(({ profile, resolution }) => ({
      kind: "spell",
      name: profile.name,
      label: "System spell",
      uuid: resolution.match.uuid,
      packLabel: resolution.match.pack.label,
      documentType: resolution.match.documentType,
      message: `${profile.name} from ${resolution.match.pack.label}`
    }))
  ];
  if (Array.isArray(next.unresolvedMechanics)) {
    next.unresolvedMechanics = next.unresolvedMechanics.filter(mechanic => !isSpellChoiceMechanic(mechanic));
    if (!next.unresolvedMechanics.length) delete next.unresolvedMechanics;
  }

  return {
    applied: true,
    spec: next,
    chosenSpells: chosen.map(({ profile }) => profile.name),
    assumption: `Selected compatible SRD spells automatically: ${chosen.map(({ profile }) => profile.name).join(", ")}.`
  };
}

export {
  SPELL_LIBRARY,
  autoSelectSrdChoiceSpells,
  inferDamageTags,
  parseChargeMax,
  requestedSpellChoiceCount
};
