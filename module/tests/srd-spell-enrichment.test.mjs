import assert from "node:assert/strict";
import { applyDefaultLeveledSpellCharges, applyForgeSpecDefaults, autoSelectSrdChoiceSpells, dedupeRecognizedSpellActivities, reconcilePlannedSrdSpellActivities, repairNamedSrdSpellActivities, requestedSpellChoiceCount } from "../scripts/srd-spell-enrichment.js";

assert.equal(requestedSpellChoiceCount("It has 10 charges with 3 spells of your choice."), 3);

const compatibleSpell = name => ({
  status: "compatible",
  match: {
    uuid: `Compendium.dnd5e.spells.${name.toLowerCase().replace(/\s+/g, "-")}`,
    pack: { label: "Spells" },
    documentType: "Item",
    spellLevel: name === "Command"
      ? 1
      : name === "Clairvoyance"
        ? 3
        : name === "Sleet Storm"
          ? 3
          : name === "Invisibility"
            ? 2
            : name === "Cure Wounds"
              ? 1
        : name === "Fireball" || name === "Lightning Bolt"
          ? 3
          : 1
  }
});

const fakeSpellDocuments = {
  Thunderwave: {
    name: "Thunderwave",
    img: "systems/dnd5e/icons/svg/spells/thunderwave.webp",
    system: {
      level: 1,
      activities: [{
        type: "save",
        range: { units: "self" },
        target: {
          template: { count: "1", type: "cube", size: 15, units: "ft" },
          affects: { type: "creature", special: "Creatures in the 15-foot cube" },
          prompt: true
        },
        save: { ability: ["con"], dc: { formula: "" } },
        damage: {
          onSave: "half",
          parts: [{ number: 2, denomination: 8, bonus: "", types: ["thunder"], scaling: { mode: "whole", number: 1, formula: "" } }]
        }
      }]
    }
  },
  Shatter: {
    name: "Shatter",
    img: "systems/dnd5e/icons/svg/spells/shatter.webp",
    system: {
      level: 2,
      activities: [{
        type: "save",
        range: { value: 60, units: "ft" },
        target: {
          template: { count: "1", type: "sphere", size: 10, units: "ft" },
          affects: { type: "creature", special: "Creatures in the 10-foot-radius sphere" },
          prompt: true
        },
        save: { ability: ["con"], dc: { formula: "" } },
        damage: {
          onSave: "half",
          parts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"], scaling: { mode: "whole", number: 1, formula: "" } }]
        }
      }]
    }
  },
  Fireball: {
    name: "Fireball",
    img: "systems/dnd5e/icons/svg/spells/fireball.webp",
    system: {
      level: 3,
      activities: [{
        type: "save",
        range: {},
        target: { affects: { choice: false } },
        save: { ability: ["dex"], dc: { formula: "" } },
        damage: {
          onSave: "half",
          parts: [{ number: 8, denomination: 6, bonus: "", types: ["fire"], scaling: { mode: "whole", number: 1, formula: "" } }]
        }
      }]
    }
  },
  "Sleet Storm": {
    name: "Sleet Storm",
    img: "systems/dnd5e/icons/svg/spells/sleet-storm.webp",
    system: {
      level: 3,
      activities: [{
        type: "utility",
        range: { value: 150, units: "ft" },
        target: {
          template: { count: "1", type: "cylinder", size: 40, height: 20, units: "ft" },
          affects: { type: "space", special: "A 40-foot-radius, 20-foot-high cylinder of sleet and freezing rain" },
          prompt: true
        },
        duration: { value: 1, units: "minute", concentration: true }
      }]
    }
  },
  "Invisibility": {
    name: "Invisibility",
    img: "systems/dnd5e/icons/svg/spells/invisibility.webp",
    system: {
      level: 2,
      activities: [{
        type: "utility",
        range: { units: "touch" },
        target: {
          affects: { count: "1", type: "creature", special: "A creature you touch" },
          prompt: true
        },
        duration: { value: 1, units: "hour", concentration: true }
      }]
    }
  },
  "Cure Wounds": {
    name: "Cure Wounds",
    img: "systems/dnd5e/icons/svg/spells/cure-wounds.webp",
    system: {
      level: 1,
      activities: [{
        type: "heal",
        range: { units: "touch" },
        target: {
          affects: { count: "1", type: "creature", special: "A creature you touch" },
          prompt: true
        },
        healing: {
          number: 1,
          denomination: 8,
          bonus: "@mod",
          types: ["healing"],
          scaling: { mode: "whole", number: 1, formula: "" }
        }
      }]
    }
  },
  "Lightning Bolt": {
    name: "Lightning Bolt",
    img: "systems/dnd5e/icons/svg/spells/lightning-bolt.webp",
    system: {
      level: 3,
      activities: [{
        type: "save",
        range: {},
        target: { affects: { choice: false } },
        save: { ability: ["dex"], dc: { formula: "" } },
        damage: {
          onSave: "half",
          parts: [{ number: 8, denomination: 6, bonus: "", types: ["lightning"], scaling: { mode: "whole", number: 1, formula: "" } }]
        }
      }]
    }
  },
  Clairvoyance: {
    name: "Clairvoyance",
    img: "systems/dnd5e/icons/svg/spells/clairvoyance.webp",
    system: {
      level: 3,
      activities: [{
        type: "utility",
        range: { value: 1, units: "mi" },
        target: { affects: { count: "1", type: "space", special: "A location within range" }, prompt: true },
        duration: { value: 10, units: "minute", concentration: true }
      }]
    }
  },
  Command: {
    name: "Command",
    img: "systems/dnd5e/icons/svg/spells/command.webp",
    system: {
      level: 1,
      activities: [{
        type: "save",
        range: { value: 60, units: "ft" },
        target: { affects: { count: "1", type: "creature", special: "One creature within range" }, prompt: true },
        save: { ability: ["wis"], dc: { formula: "" } },
        damage: { onSave: "none", parts: [] }
      }]
    }
  },
  "Ray Of Sickness": {
    name: "Ray of Sickness",
    img: "systems/dnd5e/icons/svg/spells/ray-of-sickness.webp",
    system: {
      level: 1,
      activities: [{
        type: "attack",
        range: { value: 60, units: "ft" },
        target: {
          affects: { count: "1", type: "creature", special: "One creature within range" },
          prompt: true
        },
        attack: { type: { value: "ranged", classification: "spell" } },
        damage: {
          parts: [{ number: 2, denomination: 8, bonus: "", types: ["poison"], scaling: { mode: "whole", number: 1, formula: "" } }]
        }
      }]
    }
  },
  "Ice Knife": {
    name: "Ice Knife",
    img: "systems/dnd5e/icons/svg/spells/ice-knife.webp",
    system: {
      level: 1,
      activities: [{
        type: "attack",
        range: { value: 60, units: "ft" },
        target: {
          affects: { count: "1", type: "creature", special: "One creature within range" },
          prompt: true
        },
        attack: { type: { value: "ranged", classification: "spell" } },
        damage: {
          parts: [
            { number: 1, denomination: 10, bonus: "", types: ["piercing"], scaling: { mode: "", number: 1, formula: "" } },
            { number: 2, denomination: 6, bonus: "", types: ["cold"], scaling: { mode: "whole", number: 1, formula: "" } }
          ]
        }
      }]
    }
  },
  "Fog Cloud": {
    name: "Fog Cloud",
    img: "systems/dnd5e/icons/svg/spells/fog-cloud.webp",
    system: {
      level: 1,
      activities: [{
        type: "utility",
        range: { value: 120, units: "ft" },
        target: {
          template: { count: "1", type: "sphere", size: 20, units: "ft" },
          affects: { type: "space", special: "A 20-foot-radius sphere of fog" },
          prompt: true
        },
        duration: { value: 1, units: "hour", concentration: true }
      }]
    }
  },
  Moonbeam: {
    name: "Moonbeam",
    img: "systems/dnd5e/icons/svg/spells/moonbeam.webp",
    system: {
      level: 2,
      activities: [{
        type: "save",
        range: { value: 120, units: "ft" },
        target: {
          template: { count: "1", type: "cylinder", size: 5, height: 40, units: "ft" },
          affects: { type: "creature", special: "Creatures in the moonbeam's area" },
          prompt: true
        },
        save: { ability: ["con"], dc: { formula: "" } },
        duration: { value: 1, units: "minute", concentration: true },
        damage: {
          onSave: "half",
          parts: [{ number: 2, denomination: 10, bonus: "", types: ["radiant"], scaling: { mode: "whole", number: 1, formula: "" } }]
        }
      }]
    }
  }
};

const resolveSpellDocument = async resolution => fakeSpellDocuments[resolution.match.uuid.split(".").at(-1).replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase())]
  ?? fakeSpellDocuments[resolution.match.uuid.split(".").at(-1) === "flame-strike" ? "Flame Strike" : ""]
  ?? null;

const result = await autoSelectSrdChoiceSpells({
  kind: "weaponExtraDamage",
  name: "Flame-Thunder Greatsword",
  description: "A very rare greatsword with 10 charges and 3 spells of your choice.",
  extraDamageParts: [
    { number: 1, denomination: 6, bonus: "", types: ["fire"] },
    { number: 1, denomination: 6, bonus: "", types: ["thunder"] }
  ]
}, "Greatsword that is very rare quality. It has +2. It deals additional fire damage and thunder damage. It has 10 charges with 3 spells of your choice.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(result.applied, true);
assert.deepEqual(result.chosenSpells, ["Thunderwave", "Shatter", "Fireball"]);
assert.equal(result.spec.saveActivities.length, 3);
assert.equal(result.spec.saveActivities[0].chargeCost, 1);
assert.equal(result.spec.saveActivities[0].target.template.type, "cube");
assert.equal(result.spec.saveActivities[1].chargeCost, 2);
assert.equal(result.spec.saveActivities[1].range.value, 60);
assert.equal(result.spec.saveActivities[2].chargeCost, 3);
assert.equal(result.spec.saveActivities[2].range.value, 150);
assert.equal(result.spec.systemReferences.length, 3);
assert.equal(result.spec.uses.max, "10");

const unresolvedResult = await autoSelectSrdChoiceSpells({
  kind: "weaponExtraDamage",
  name: "Already Explicit Blade",
  saveActivities: [{ activityName: "Cast Fireball" }]
}, "It has 3 spells of your choice.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(unresolvedResult.applied, false);

const repairedTemplate = await repairNamedSrdSpellActivities({
  kind: "equipmentPowerSuite",
  name: "Volcanic Bracers",
  saveActivities: [{
    activityId: "FireballOldAct1",
    activityName: "Cast Fireball",
    damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["fire"] }],
    save: { ability: "dex", dc: 15 }
  }]
}, "Create bracers that cast Fireball.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(repairedTemplate.applied, true);
assert.equal(repairedTemplate.spec.saveActivities[0].target.template.type, "sphere");
assert.equal(repairedTemplate.spec.saveActivities[0].target.template.size, 20);
assert.equal(repairedTemplate.spec.saveActivities[0].range.value, 150);

const plannedGenericSpellActivities = await reconcilePlannedSrdSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Tidebreaker Sovereign",
  utilityActivities: [
    { activityId: "GenericUtility001", activityName: "Utility 1" },
    { activityId: "GenericUtility002", activityName: "Utility 2" }
  ]
}, {
  native: [
    { type: "spell", label: "System spell: Fog Cloud" },
    { type: "spell", label: "System spell: Fireball" }
  ]
}, "A trident that can cast Fog Cloud and Fireball from its charges.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(plannedGenericSpellActivities.applied, true);
assert.equal(plannedGenericSpellActivities.spec.utilityActivities.length, 1);
assert.equal(plannedGenericSpellActivities.spec.utilityActivities[0].activityName, "Cast Fog Cloud");
assert.equal(plannedGenericSpellActivities.spec.saveActivities.length, 1);
assert.equal(plannedGenericSpellActivities.spec.saveActivities[0].activityName, "Cast Fireball");
assert.equal(plannedGenericSpellActivities.spec.saveActivities[0].target.template.type, "sphere");
assert.equal(plannedGenericSpellActivities.spec.systemReferences.length, 2);

const plannedAttackSpellActivity = await reconcilePlannedSrdSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Shortbow of Shadow and Venom",
  utilityActivities: [
    { activityId: "GenericUtility001", activityName: "Utility 1" }
  ]
}, {
  native: [
    { type: "spell", label: "Deterministic local spell: Ray of Sickness" }
  ]
}, "A shortbow that can cast Ray of Sickness once per day.", {
  resolveSpell: async () => ({ status: "not-found" }),
  resolveSpellDocument
});

assert.equal(plannedAttackSpellActivity.applied, true);
assert.equal(plannedAttackSpellActivity.spec.utilityActivities.length, 0);
assert.equal(plannedAttackSpellActivity.spec.attackActivities.length, 1);
assert.equal(plannedAttackSpellActivity.spec.attackActivities[0].activityName, "Cast Ray of Sickness");
assert.equal(plannedAttackSpellActivity.spec.attackActivities[0].attackType, "ranged");
assert.equal(plannedAttackSpellActivity.spec.attackActivities[0].damageParts[0].types[0], "poison");

const layeredBriefPlannedSpell = await reconcilePlannedSrdSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Flameforce Dagger",
  attackActivities: [],
  saveActivities: [],
  utilityActivities: []
}, {
  native: [
    { type: "spell", label: "System spell: Burning Hands" }
  ]
}, `Complexity layer 1 - Base chassis
Base item: Dagger
Magical bonus: +1

Complexity layer 2 - Passive riders
Extra hit damage: 1d6 fire; 1d6 force

Complexity layer 3 - Resource model
Spell usage: once per day

Complexity layer 4 - Named activities
Spell: Burning Hands
Spell save DC: 15`, {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(layeredBriefPlannedSpell.applied, true);
assert.equal(layeredBriefPlannedSpell.spec.saveActivities.length, 1);
assert.equal(layeredBriefPlannedSpell.spec.saveActivities[0].activityName, "Cast Burning Hands");
assert.equal(layeredBriefPlannedSpell.spec.saveActivities[0].target.template.type, "cone");
assert.equal(layeredBriefPlannedSpell.spec.saveActivities[0].save.dc, 15);

const repairedStaffActivity = await repairNamedSrdSpellActivities({
  kind: "multiActivityStaff",
  name: "Staff of Elemental Fury",
  activities: [{
    activityId: "StaffFireball001",
    activityName: "Cast Fireball",
    damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["fire"] }],
    save: { ability: "dex", dc: 15 }
  }]
}, "Create a staff that casts Fireball.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(repairedStaffActivity.applied, true);
assert.equal(repairedStaffActivity.spec.activities[0].target.template.type, "sphere");
assert.equal(repairedStaffActivity.spec.activities[0].target.template.size, 20);
assert.equal(repairedStaffActivity.spec.activities[0].range.value, 150);
assert.equal(repairedStaffActivity.spec.activities[0].range.units, "ft");
assert.equal(repairedStaffActivity.spec.activities[0].target.affects.type, "creature");

const repairedLightningStaffActivity = await repairNamedSrdSpellActivities({
  kind: "multiActivityStaff",
  name: "Staff of Tempests",
  activities: [{
    activityId: "StaffLightning01",
    activityName: "Cast Lightning Bolt",
    damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["lightning"] }],
    save: { ability: "dex", dc: 15 },
    target: { affects: { choice: false } },
    range: {}
  }]
}, "Create a staff that casts Lightning Bolt.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(repairedLightningStaffActivity.applied, true);
assert.equal(repairedLightningStaffActivity.spec.activities[0].target.template.type, "line");
assert.equal(repairedLightningStaffActivity.spec.activities[0].target.template.size, 100);
assert.equal(repairedLightningStaffActivity.spec.activities[0].target.template.width, 5);
assert.equal(repairedLightningStaffActivity.spec.activities[0].target.override, true);

const promotedUtilitySpell = await repairNamedSrdSpellActivities({
  kind: "legendaryEquipmentSuite",
  name: "Legendary Thunder Rapier",
  utilityActivities: [{
    activityId: "RapierLightBolt01",
    activityName: "Cast Lightning Bolt",
    chargeCost: 3
  }]
}, "Create a rapier that casts Lightning Bolt from charges.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(promotedUtilitySpell.applied, true);
assert.equal(promotedUtilitySpell.spec.utilityActivities.length, 0);
assert.equal(promotedUtilitySpell.spec.saveActivities.length, 1);
assert.equal(promotedUtilitySpell.spec.saveActivities[0].target.template.type, "line");
assert.equal(promotedUtilitySpell.spec.saveActivities[0].range.units, "self");

const promotedAttackSpell = await repairNamedSrdSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Staff of Frostlight",
  utilityActivities: [{
    activityId: "StaffIceKnife001",
    activityName: "Cast Ice Knife",
    chargeCost: 1
  }]
}, "Create a quarterstaff that can cast Ice Knife once per day.", {
  resolveSpell: async () => ({ status: "not-found" }),
  resolveSpellDocument
});

assert.equal(promotedAttackSpell.applied, true);
assert.equal(promotedAttackSpell.spec.utilityActivities.length, 0);
assert.equal(promotedAttackSpell.spec.attackActivities.length, 1);
assert.equal(promotedAttackSpell.spec.attackActivities[0].activityName, "Cast Ice Knife");
assert.equal(promotedAttackSpell.spec.attackActivities[0].attackClassification, "spell");

const enrichedFogCloudUtility = await repairNamedSrdSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Frostwave Trident",
  utilityActivities: [{
    activityId: "TridentFogCloud",
    activityName: "Fog Cloud",
    chargeCost: 1
  }]
}, "Create a trident that can cast Fog Cloud.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(enrichedFogCloudUtility.applied, true);
assert.equal(enrichedFogCloudUtility.spec.utilityActivities[0].target.template.type, "sphere");
assert.equal(enrichedFogCloudUtility.spec.utilityActivities[0].target.template.size, 20);
assert.equal(enrichedFogCloudUtility.spec.utilityActivities[0].range.value, 120);

const repeatedFireball = await repairNamedSrdSpellActivities({
  kind: "equipmentPowerSuite",
  name: "Twin Comet Bracers",
  saveActivities: [{
    activityId: "TwinFireballAct",
    activityName: "Cast Fireball",
    damageParts: [{ number: 16, denomination: 6, bonus: "", types: ["fire"] }],
    save: { ability: "dex", dc: 15 }
  }]
}, "Create gauntlets that cast 2 fireballs at once.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(repeatedFireball.applied, true);
assert.equal(repeatedFireball.spec.saveActivities.length, 2);
assert.equal(repeatedFireball.spec.saveActivities[0].damageParts[0].number, 8);
assert.equal(repeatedFireball.spec.saveActivities[1].damageParts[0].number, 8);
assert.equal(repeatedFireball.spec.saveActivities[0].target.template.type, "sphere");
assert.match(repeatedFireball.assumptions[0], /2 consecutive casts/i);
assert.equal(repeatedFireball.spec.saveActivities[0].range.override, true);
assert.equal(repeatedFireball.spec.saveActivities[0].target.override, true);

const defaultCharges = await applyDefaultLeveledSpellCharges({
  kind: "legendaryEquipmentSuite",
  name: "Archivist Rod",
  uses: { max: "10", recovery: [] },
  utilityActivities: [{
    activityId: "ArchivistClairvy",
    activityName: "Cast Clairvoyance",
    chargeCost: 1
  }],
  saveActivities: [{
    activityId: "ArchivistFirebl1",
    activityName: "Cast Fireball",
    chargeCost: 1,
    damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["fire"] }],
    save: { ability: "dex", dc: 15 }
  }]
}, "A rod with 10 charges that casts Clairvoyance and Fireball.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(defaultCharges.applied, true);
assert.equal(defaultCharges.spec.utilityActivities[0].chargeCost, 3);
assert.equal(defaultCharges.spec.saveActivities[0].chargeCost, 3);
assert.equal(defaultCharges.spec.saveActivities[0].chargeScaling.allowed, true);
assert.equal(defaultCharges.spec.saveActivities[0].chargeScaling.max, "@item.uses.value");

const defaultAttackSpellCharges = await applyDefaultLeveledSpellCharges({
  kind: "artifactWeaponHybrid",
  name: "Venom Bow",
  uses: { max: "5", recovery: [] },
  attackActivities: [{
    activityId: "VenomBowRay0001",
    activityName: "Cast Ray of Sickness",
    chargeCost: 0,
    damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["poison"] }]
  }]
}, "A bow with 5 charges that casts Ray of Sickness.", {
  resolveSpell: async () => ({ status: "not-found" }),
  resolveSpellDocument
});

assert.equal(defaultAttackSpellCharges.applied, true);
assert.equal(defaultAttackSpellCharges.spec.attackActivities[0].chargeCost, 1);

const duplicateCommand = dedupeRecognizedSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Verdict Chain",
  saveActivities: [
    {
      activityId: "VerdictCmd000001",
      activityName: "Cast Command (1 charge)",
      range: { value: 60, units: "ft" },
      target: { affects: { count: "1", type: "creature" }, prompt: true },
      save: { ability: "wis", dc: 15 },
      damageParts: []
    },
    {
      activityId: "VerdictCmd000002",
      activityName: "Cast Command",
      range: { value: 60, units: "ft" },
      target: { affects: { count: "1", type: "creature" }, prompt: true },
      save: { ability: "wis", dc: 15 },
      damageParts: []
    }
  ]
}, "The weapon can spend 1 charge to cast Command.");

assert.equal(duplicateCommand.applied, true);
assert.equal(duplicateCommand.spec.saveActivities.length, 1);
assert.equal(duplicateCommand.spec.saveActivities[0].activityName, "Cast Command");

const defaultedSpec = applyForgeSpecDefaults({
  kind: "artifactWeaponHybrid",
  name: "Stormglass Glaive",
  magicalBonus: "0",
  weaponType: "martialM",
  damage: { base: { number: 1, denomination: 10, bonus: "", types: ["slashing"] } },
  saveActivities: [{
    activityId: "StormglassCone01",
    activityName: "Unleash Thunder Cone",
    save: { ability: "con" }
  }]
});

assert.equal(defaultedSpec.applied, true);
assert.equal(defaultedSpec.spec.magicalBonus, "1");
assert.equal(defaultedSpec.spec.saveActivities[0].save.dc, 15);

const sanitizedArmorBonus = applyForgeSpecDefaults({
  kind: "shieldArmorBonus",
  name: "Bastion of Cinders",
  magicalBonus: true,
  armorValue: 2
});

assert.equal(sanitizedArmorBonus.applied, true);
assert.equal(sanitizedArmorBonus.spec.magicalBonus, "1");

const aliasedMistyStep = await repairNamedSrdSpellActivities({
  kind: "equipmentPowerSuite",
  name: "Stormwarden Breastplate",
  utilityActivities: [
    { activityId: "StormwardWind01", activityName: "Wind Step" },
    { activityId: "StormwardMisty1", activityName: "Cast Misty Step" }
  ],
  saveActivities: []
}, "Create Stormwarden Breastplate. 2 charges: Wind Step. Cast Misty Step from the breastplate.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(aliasedMistyStep.applied, true);
assert.equal(aliasedMistyStep.spec.utilityActivities.length, 2);
assert.equal(aliasedMistyStep.spec.utilityActivities.every(activity => activity.activityName === "Cast Misty Step"), true);
assert.equal(aliasedMistyStep.spec.utilityActivities.every(activity => activity.range.value === 30), true);

const dedupedAliasedMistyStep = dedupeRecognizedSpellActivities(aliasedMistyStep.spec, "Create Stormwarden Breastplate. 2 charges: Wind Step. Cast Misty Step from the breastplate.");
assert.equal(dedupedAliasedMistyStep.applied, true);
assert.equal(dedupedAliasedMistyStep.spec.utilityActivities.length, 1);
assert.equal(dedupedAliasedMistyStep.spec.utilityActivities[0].activityName, "Wind Step");

const repairedHealingAndUtility = await repairNamedSrdSpellActivities({
  kind: "artifactWeaponHybrid",
  name: "Eclipse Sovereign",
  utilityActivities: [
    { activityId: "EclipseInv000001", activityName: "Cast Invisibility", healing: { number: 1, denomination: 4, bonus: "", types: ["healing"] } },
    { activityId: "EclipseHeal00001", activityName: "Cast Cure Wounds" }
  ],
  saveActivities: []
}, "Once per day, the wielder can cast Invisibility from the sword without material components. Once per day, the wielder can cast Cure Wounds at 3rd level from the sword.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(repairedHealingAndUtility.applied, true);
assert.equal(repairedHealingAndUtility.spec.utilityActivities.find(activity => activity.activityName === "Cast Invisibility").healing, undefined);
assert.equal(repairedHealingAndUtility.spec.utilityActivities.find(activity => activity.activityName === "Cast Cure Wounds").healing.number, 1);
assert.equal(repairedHealingAndUtility.spec.utilityActivities.find(activity => activity.activityName === "Cast Cure Wounds").range.units, "touch");

const repairedSleetStorm = await repairNamedSrdSpellActivities({
  kind: "legendaryEquipmentSuite",
  name: "Frostwave Sovereign",
  utilityActivities: [
    { activityId: "FrostwaveSleet01", activityName: "Cast Sleet Storm", target: { affects: { count: "1", type: "creature" }, prompt: true } }
  ],
  saveActivities: []
}, "Spend 3 charges to cast Sleet Storm from the trident.", {
  resolveSpell: async name => compatibleSpell(name),
  resolveSpellDocument
});

assert.equal(repairedSleetStorm.applied, true);
assert.equal(repairedSleetStorm.spec.utilityActivities[0].target.template.type, "cylinder");
assert.equal(repairedSleetStorm.spec.utilityActivities[0].range.value, 150);

export const testedSrdSpellEnrichmentCases = 33;
