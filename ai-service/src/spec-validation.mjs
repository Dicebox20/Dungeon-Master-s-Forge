import { ServiceError } from "./errors.mjs";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(spec, field, expectation) {
  throw new ServiceError(
    502,
    "invalid_model_output",
    `${spec.name} (${spec.kind}) requires ${field}${expectation ? ` ${expectation}` : ""}.`
  );
}

function requireObject(spec, value, field) {
  if (!isObject(value)) fail(spec, field, "to be an object");
  return value;
}

function requireArray(spec, value, field, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    fail(spec, field, `to contain at least ${minimum} entr${minimum === 1 ? "y" : "ies"}`);
  }
  return value;
}

function requireString(spec, value, field) {
  if (typeof value !== "string" || !value.trim()) fail(spec, field, "to be a non-empty string");
  return value;
}

function requireFinite(spec, value, field) {
  if (!Number.isFinite(Number(value))) fail(spec, field, "to be numeric");
  return Number(value);
}

function validateDamagePart(spec, part, field) {
  requireObject(spec, part, field);
  requireFinite(spec, part.denomination, `${field}.denomination`);
  requireArray(spec, part.types, `${field}.types`);
  part.types.forEach((type, index) => requireString(spec, type, `${field}.types[${index}]`));
}

function validateUses(spec) {
  const uses = requireObject(spec, spec.uses, "uses");
  if (String(uses.max ?? "").trim() === "") fail(spec, "uses.max", "to be set");
  requireArray(spec, uses.recovery, "uses.recovery");
}

function validateConsumedUses(spec) {
  const uses = requireObject(spec, spec.uses, "uses");
  if (String(uses.max ?? "").trim() === "") fail(spec, "uses.max", "to be set");
  if (uses.autoDestroy === true || String(uses.max ?? "").trim() === "1") {
    if (!Array.isArray(uses.recovery)) uses.recovery = [];
    return;
  }
  requireArray(spec, uses.recovery, "uses.recovery");
}

function validateSave(spec, save, field) {
  requireObject(spec, save, field);
  requireString(spec, save.ability, `${field}.ability`);
  requireFinite(spec, save.dc, `${field}.dc`);
}

function validateActivity(spec, activity, field) {
  requireObject(spec, activity, field);
  requireString(spec, activity.activityId, `${field}.activityId`);
  requireString(spec, activity.activityName, `${field}.activityName`);
}

function validateEffect(spec, effect, field) {
  requireObject(spec, effect, field);
  requireString(spec, effect.effectId, `${field}.effectId`);
  requireArray(spec, effect.changes, `${field}.changes`);
  effect.changes.forEach((change, index) => {
    requireObject(spec, change, `${field}.changes[${index}]`);
    requireString(spec, change.key, `${field}.changes[${index}].key`);
    if (change.value == null) fail(spec, `${field}.changes[${index}].value`, "to be set");
  });
}

function validateWeapon(spec, { requireExtraDamageParts = true } = {}) {
  const damage = requireObject(spec, spec.damage, "damage");
  validateDamagePart(spec, damage.base, "damage.base");
  requireString(spec, spec.weaponType, "weaponType");
  if (requireExtraDamageParts) requireArray(spec, spec.extraDamageParts, "extraDamageParts");
  for (const [index, part] of (spec.extraDamageParts ?? []).entries()) {
    validateDamagePart(spec, part, `extraDamageParts[${index}]`);
  }
}

function validateChargedSave(spec) {
  validateUses(spec);
  requireString(spec, spec.activityId, "activityId");
  validateSave(spec, spec.save, "save");
  requireArray(spec, spec.damageParts, "damageParts");
  spec.damageParts.forEach((part, index) => validateDamagePart(spec, part, `damageParts[${index}]`));
}

function validateSuite(spec) {
  const collections = ["effects", "utilityActivities", "saveActivities", "attackActivities", "summonProfiles"];
  if (!collections.some(field => Array.isArray(spec[field]) && spec[field].length)) {
    fail(spec, "at least one effect, attack, save, utility, or summon power");
  }

  for (const [index, effect] of (spec.effects ?? []).entries()) validateEffect(spec, effect, `effects[${index}]`);
  for (const field of ["utilityActivities", "saveActivities", "attackActivities"]) {
    for (const [index, activity] of (spec[field] ?? []).entries()) {
      validateActivity(spec, activity, `${field}[${index}]`);
      if (field === "saveActivities") validateSave(spec, activity.save, `${field}[${index}].save`);
      if (field === "attackActivities") {
        requireArray(spec, activity.damageParts, `${field}[${index}].damageParts`);
        activity.damageParts.forEach((part, partIndex) => validateDamagePart(spec, part, `${field}[${index}].damageParts[${partIndex}]`));
      }
    }
  }

  if (spec.summonProfiles?.length) {
    const summonActivity = requireObject(spec, spec.summonActivity, "summonActivity");
    validateActivity(spec, summonActivity, "summonActivity");
    validateSummonProfiles(spec, spec.summonProfiles);
  }
}

function validateActor(spec, actor, field) {
  requireObject(spec, actor, field);
  requireString(spec, actor.name, `${field}.name`);
  requireString(spec, actor.type, `${field}.type`);
  requireFinite(spec, actor.ac, `${field}.ac`);
  const hp = requireObject(spec, actor.hp, `${field}.hp`);
  requireFinite(spec, hp.max ?? hp.value, `${field}.hp.max`);
}

function validateSummonProfiles(spec, profiles) {
  requireArray(spec, profiles, "summonProfiles");
  profiles.forEach((profile, index) => {
    requireObject(spec, profile, `summonProfiles[${index}]`);
    requireString(spec, profile.profileId, `summonProfiles[${index}].profileId`);
    requireString(spec, profile.profileName, `summonProfiles[${index}].profileName`);
    validateActor(spec, profile.actor, `summonProfiles[${index}].actor`);
  });
}

const validators = {
  weaponExtraDamage(spec) {
    validateWeapon(spec);
  },
  weaponConditionOnHit(spec) {
    validateWeapon(spec, { requireExtraDamageParts: false });
    const condition = requireObject(spec, spec.conditionOnHit, "conditionOnHit");
    requireString(spec, condition.condition, "conditionOnHit.condition");
    validateSave(spec, condition.save, "conditionOnHit.save");
    requireFinite(spec, condition.durationSeconds, "conditionOnHit.durationSeconds");
  },
  passiveEffectEquipment(spec) {
    const effects = requireArray(spec, spec.effects, "effects");
    effects.forEach((effect, index) => validateEffect(spec, effect, `effects[${index}]`));
  },
  shieldArmorBonus(spec) {
    requireFinite(spec, spec.armorValue, "armorValue");
    if (String(spec.magicalBonus ?? "").trim() === "") fail(spec, "magicalBonus", "to be set");
  },
  chargedHealing(spec) {
    validateConsumedUses(spec);
    requireString(spec, spec.activityId, "activityId");
    validateDamagePart(spec, spec.healing, "healing");
  },
  chargedSaveDamage(spec) {
    validateChargedSave(spec);
  },
  multiActivityStaff(spec) {
    validateUses(spec);
    // A staff with one named power still needs to retain its base weapon
    // attack; the module adds that attack from the quarterstaff base.
    const activities = requireArray(spec, spec.activities, "activities", 1);
    activities.forEach((activity, index) => {
      validateActivity(spec, activity, `activities[${index}]`);
      validateSave(spec, activity.save, `activities[${index}].save`);
      requireArray(spec, activity.damageParts, `activities[${index}].damageParts`);
      activity.damageParts.forEach((part, partIndex) => validateDamagePart(spec, part, `activities[${index}].damageParts[${partIndex}]`));
    });
  },
  nativeEnchant(spec) {
    validateConsumedUses(spec);
    requireString(spec, spec.activityId, "activityId");
    requireString(spec, spec.effectId, "effectId");
    requireObject(spec, spec.duration, "duration");
    requireObject(spec, spec.restrictions, "restrictions");
    const changes = requireArray(spec, spec.enchantChanges, "enchantChanges");
    changes.forEach((change, index) => {
      requireObject(spec, change, `enchantChanges[${index}]`);
      requireString(spec, change.key, `enchantChanges[${index}].key`);
    });
  },
  nativeSummon(spec) {
    validateConsumedUses(spec);
    requireString(spec, spec.activityId, "activityId");
    requireString(spec, spec.profileId, "profileId");
    validateActor(spec, spec.summonActor, "summonActor");
  },
  nativeMultiProfileSummon(spec) {
    validateConsumedUses(spec);
    requireString(spec, spec.activityId, "activityId");
    validateSummonProfiles(spec, requireArray(spec, spec.summonProfiles, "summonProfiles", 2));
  },
  casterUtilityEquipment(spec) {
    validateSuite(spec);
  },
  equipmentPowerSuite(spec) {
    validateSuite(spec);
  },
  legendaryEquipmentSuite(spec) {
    validateSuite(spec);
  },
  artifactWeaponHybrid(spec) {
    validateWeapon(spec, { requireExtraDamageParts: false });
    const hybridFeatures = [spec.passiveEffects, spec.utilityActivities, spec.saveActivities]
      .some(value => Array.isArray(value) && value.length) || isObject(spec.toggleLight);
    if (!hybridFeatures) fail(spec, "at least one passive effect, utility, save power, or light toggle");
    for (const [index, effect] of (spec.passiveEffects ?? []).entries()) validateEffect(spec, effect, `passiveEffects[${index}]`);
    for (const [index, activity] of (spec.saveActivities ?? []).entries()) {
      validateActivity(spec, activity, `saveActivities[${index}]`);
      validateSave(spec, activity.save, `saveActivities[${index}].save`);
    }
    if (spec.toggleLight) {
      requireString(spec, spec.toggleLight.activityId, "toggleLight.activityId");
      requireString(spec, spec.toggleLight.effectId, "toggleLight.effectId");
      requireFinite(spec, spec.toggleLight.bright, "toggleLight.bright");
      requireFinite(spec, spec.toggleLight.dim, "toggleLight.dim");
    }
  }
};

function validateSpecStructure(spec) {
  requireString(spec, spec.description, "description");
  const validator = validators[spec.kind];
  if (!validator) fail(spec, "a registered structure validator");
  validator(spec);
  return spec;
}

export { validateSpecStructure };
