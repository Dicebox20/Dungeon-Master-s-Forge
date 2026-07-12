import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelOutput, validateForgeRequest } from "../src/contract.mjs";
import { envelope } from "./helpers.mjs";

function ids() {
  let value = 0;
  return () => String(++value).padStart(16, "0");
}

test("valid Forge 1.0 requests are normalized", () => {
  const result = validateForgeRequest(envelope());
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.context.systemId, "dnd5e");
  assert.equal(result.options.unresolvedPolicy, "review");
});

test("unknown client-supported kinds are rejected", () => {
  const payload = envelope();
  payload.context.supportedKinds.push("inventedFactory");
  assert.throws(() => validateForgeRequest(payload), /unknown or duplicate/);
});

test("request character limits are enforced before compilation", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "x".repeat(101) }), { maxRequestChars: 100 }),
    error => error.status === 413 && error.code === "request_too_large" && /100 character limit/.test(error.message)
  );
});

test("separator batches are rejected above the configured item limit", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "First item\n---\nSecond item\n---\nThird item" }), { maxItemsPerRequest: 2 }),
    error => error.status === 413 && error.code === "item_batch_too_large" && /contains 3 items/.test(error.message)
  );
});

test("repeated item-name batches are rejected above the configured item limit", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "Item name: One\n\nItem name: Two" }), { maxItemsPerRequest: 1 }),
    error => error.status === 413 && error.code === "item_batch_too_large" && /at most 1/.test(error.message)
  );
});

test("absurd simultaneous spell-volume requests are rejected before compilation", () => {
  assert.throws(
    () => validateForgeRequest(envelope({ request: "Create a pair of gauntlets that can cast 500 fireballs at once." })),
    error => error.status === 400 && error.code === "unsupported_scale" && /500 simultaneous fireballs/i.test(error.message)
  );
});

test("normal charged multi-spell items remain allowed", () => {
  const result = validateForgeRequest(envelope({
    request: "Create a rare staff with 10 charges. It can cast Fireball for 3 charges or Lightning Bolt for 3 charges."
  }));
  assert.equal(result.request.includes("10 charges"), true);
});

test("model output becomes the exact Forge response envelope", () => {
  const request = validateForgeRequest(envelope());
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Mind Crown",
      description: "A psionic crown.",
      attackActivities: [{
        activityName: "Mind Lance",
        damageParts: [{ number: 2, denomination: 8, bonus: "", types: ["psychic"] }]
      }],
      effects: [{
        name: "Mental Ward",
        changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }]
      }],
      unresolvedMechanics: [{
        category: "tableAdjudication",
        label: "Echoing thought",
        requestedText: "Nearby thoughts echo.",
        reason: "Requires table judgment.",
        handling: "Resolve manually.",
        resolved: true
      }]
    }],
    assumptions: ["Uses Intelligence."],
    warnings: [],
    deferred: ["Echoing thought is manual."]
  }, request, { makeId: ids() });

  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.promptVersion, "1.0.0");
  assert.equal(result.requestCount, 1);
  assert.equal(result.specs[0].attackActivities[0].activityId, "0000000000000001");
  assert.equal(result.specs[0].effects[0].effectId, "0000000000000002");
  assert.equal(result.specs[0].unresolvedMechanics[0].id, "0000000000000003");
  assert.equal(result.specs[0].unresolvedMechanics[0].resolved, false);
  assert.equal(result.unresolvedMechanics[0].itemName, "Mind Crown");
});

test("empty model-generated effects are pruned before suite validation", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary crown called Crown of Shared Dawn. It grants +1 AC and resistance to radiant damage. It emits a 30-foot aura granting allies +1 AC. It has 3 charges and can cast Command for 1 charge."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Crown of Shared Dawn",
      description: "A radiant crown with an ally aura.",
      uses: { max: "3", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] },
      effects: [
        {
          name: "Radiant Guard",
          changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }]
        },
        {
          name: "Radiant Resistance",
          changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "radiant" }]
        },
        {
          name: "Aura Placeholder",
          changes: [{ key: "", mode: "ADD", value: "" }]
        }
      ],
      saveActivities: [{
        activityName: "Cast Command",
        save: { ability: "wis", dc: 17 },
        damageParts: []
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].effects.length, 2);
  assert.equal(result.specs[0].effects.some(effect => effect.name === "Aura Placeholder"), false);
  assert.equal(result.specs[0].unresolvedMechanics.some(mechanic => mechanic.category === "allyAura"), true);
});

test("pattern aliases normalize into Forge kinds", () => {
  const request = validateForgeRequest(envelope());
  const result = normalizeModelOutput({
    specs: [{
      pattern: "weaponExtraDamage",
      name: "Alias Blade",
      description: "A test weapon.",
      rarity: "uncommon",
      attunement: "",
      weaponType: "simpleM",
      baseItem: "dagger",
      properties: ["finesse", "light", "thrown", "magical"],
      damage: {
        base: { number: 1, denomination: "d4", bonus: "@mod", types: ["piercing"] },
        versatile: { number: null, denomination: null, bonus: "", types: [] }
      },
      range: { value: 20, long: 60, reach: 5, units: "ft" },
      mastery: "nick",
      extraDamageParts: [{ number: 1, denomination: "d4", bonus: "", types: ["fire"] }],
      attackName: "Alias Strike"
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "weaponExtraDamage");
  assert.deepEqual(result.specs[0].properties, ["fin", "lgt", "thr", "mgc"]);
  assert.equal(result.specs[0].damage.base.denomination, 4);
  assert.equal(result.specs[0].extraDamageParts[0].denomination, 4);
});

test("unsupported generated kinds cannot reach Foundry", () => {
  const request = validateForgeRequest(envelope());
  assert.throws(() => normalizeModelOutput({
    specs: [{ kind: "inventedFactory", name: "Bad Item" }]
  }, request), /unsupported Forge kind/);
});

test("malformed model IDs are replaced with trusted service IDs", () => {
  const request = validateForgeRequest(envelope());
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Bad Wand",
      description: "A wand with a malformed model-generated ID.",
      activityId: "short",
      uses: { max: "3", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] },
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 1, denomination: 6, bonus: "", types: ["fire"] }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].activityId, "0000000000000001");
});

test("single-activity staff output is normalized to charged save damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare wand called Wand of Shattering Ice. It has 7 charges. As an action, spend 1 charge for a DC 15 Dexterity save or 4d6 cold damage."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Wand of Shattering Ice",
      description: "A wand with one charged cone power.",
      uses: { max: "7", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 1" }] },
      activities: [{
        activityName: "Freezing Shards",
        save: { ability: "dex", dc: 15 },
        damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["cold"] }]
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "chargedSaveDamage");
  assert.equal(result.specs[0].activityId, "0000000000000001");
  assert.equal(result.specs[0].damageParts[0].types[0], "cold");
});

test("multi-activity staff specs recover missing shared uses from request text", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare quarterstaff called Shepherd's Reliquary. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Shepherd's Reliquary",
      description: "A reliquary staff with healing and thunder.",
      activities: [
        {
          activityName: "Shatter",
          chargeCost: 2,
          save: { ability: "con", dc: 14 },
          damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
        },
        {
          activityName: "Echo Burst",
          chargeCost: 1,
          save: { ability: "dex", dc: 14 },
          damageParts: [{ number: 2, denomination: 8, bonus: "+2", types: ["force"] }]
        }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "multiActivityStaff");
  assert.equal(result.specs[0].uses.max, "8");
  assert.equal(result.specs[0].uses.recovery[0].period, "dawn");
  assert.equal(result.specs[0].uses.recovery[0].formula, "1d6 + 2");
});

test("consumed healing potions do not require recovery", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon potion called Potion of Verdant Renewal. Drink it to heal 4d4+4 hit points. It is consumed after use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Potion of Verdant Renewal",
      description: "A consumed healing potion.",
      uses: { max: "1" },
      healing: { number: 4, denomination: 4, bonus: "4", types: ["healing"] }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].uses.autoDestroy, true);
  assert.deepEqual(result.specs[0].uses.recovery, []);
  assert.equal(result.specs[0].activityId, "0000000000000001");
});

test("condition weapons recover known base weapon damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare mace called Mace of Stunning. It is a +1 mace. On a hit, the target must make a DC 15 Wisdom saving throw or be stunned for 1 round."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Mace of Stunning",
      description: "A stunning mace.",
      rarity: "rare",
      magicalBonus: "1",
      extraDamageParts: [],
      conditionOnHit: {
        condition: "stunned",
        save: { ability: "wis", dc: 15 },
        durationSeconds: 6
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].baseItem, "mace");
  assert.equal(result.specs[0].weaponType, "simpleM");
  assert.deepEqual(result.specs[0].damage.base, { number: 1, denomination: 6, bonus: "@mod", types: ["bludgeoning"] });
});

test("glaive hybrids recover known base weapon damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary glaive called Dawncourt Halberd. It is a +2 glaive that deals an extra 1d6 fire damage and 1d6 lightning damage on every hit."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Dawncourt Halberd",
      description: "A blazing glaive.",
      magicalBonus: "2",
      baseItem: "glaive",
      damage: { base: { number: 1, denomination: 10, bonus: "@mod", types: [] } },
      toggleLight: { bright: 20, dim: 20 },
      extraDamageParts: [
        { number: 1, denomination: 6, bonus: "", types: ["fire"] },
        { number: 1, denomination: 6, bonus: "", types: ["lightning"] }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].weaponType, "martialM");
  assert.deepEqual(result.specs[0].damage.base.types, ["slashing"]);
});

test("longbow hybrids recover known base weapon damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare longbow called Stormglass Longbow. It is a +2 longbow that deals an extra 1d6 lightning damage on every hit."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Stormglass Longbow",
      description: "A crackling longbow.",
      magicalBonus: "2",
      baseItem: "longbow",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: [] } },
      utilityActivities: [{ activityName: "Cast Lightning Arrow" }],
      extraDamageParts: [
        { number: 1, denomination: 6, bonus: "", types: ["lightning"] }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].weaponType, "martialR");
  assert.deepEqual(result.specs[0].damage.base.types, ["piercing"]);
});

test("trident hybrids recover martial piercing base damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare trident called Frostwave Trident. It can cast Fog Cloud from its charges and summon friendly sea beasts."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Frostwave Trident",
      description: "A tidebound trident.",
      baseItem: "trident",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: [] } },
      utilityActivities: [{ activityName: "Cast Fog Cloud" }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].weaponType, "martialM");
  assert.equal(result.specs[0].baseItem, "trident");
  assert.deepEqual(result.specs[0].damage.base.types, ["piercing"]);
  assert.deepEqual(result.specs[0].damage.versatile.types, ["piercing"]);
});

test("missing kind is inferred for obvious weapon and staff outputs", () => {
  const weaponRequest = validateForgeRequest(envelope({
    request: "Create an uncommon shortsword called Venomkiss Shortsword. It is a +1 shortsword that deals an extra 1d4 poison damage on a hit."
  }));
  const weapon = normalizeModelOutput({
    specs: [{
      name: "Venomkiss Shortsword",
      description: "A venomous shortsword.",
      rarity: "uncommon",
      magicalBonus: "1",
      damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: ["piercing"] } },
      extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["poison"] }]
    }]
  }, weaponRequest, { makeId: ids() });
  assert.equal(weapon.specs[0].kind, "weaponExtraDamage");

  const staffRequest = validateForgeRequest(envelope({
    request: "Create a rare staff called Staff of Ember and Frost. It has 10 charges. As an action spend 1 charge for Burning Hands. As an action spend 2 charges for Ice Knife."
  }));
  const staff = normalizeModelOutput({
    specs: [{
      name: "Staff of Ember and Frost",
      description: "A staff with two powers.",
      uses: { max: "10", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
      activities: [
        { activityName: "Burning Hands", save: { ability: "dex", dc: 15 }, damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }] },
        { activityName: "Ice Knife", save: { ability: "dex", dc: 15 }, damageParts: [{ number: 2, denomination: 6, bonus: "", types: ["cold"] }] }
      ]
    }]
  }, staffRequest, { makeId: ids() });
  assert.equal(staff.specs[0].kind, "multiActivityStaff");
});

test("condition riders recover aliases and short duration phrases", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare mace called Mace of Dazing Stars. It is a +1 mace. On a hit, the target must make a DC 15 Wisdom saving throw or be stunned until the end of the wielder's next turn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Mace of Dazing Stars",
      description: "A radiant mace.",
      magicalBonus: "1",
      conditionOnHit: {
        conditionName: "stunned",
        save: { saveAbility: "wis", saveDc: 15 }
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].conditionOnHit.condition, "stunned");
  assert.equal(result.specs[0].conditionOnHit.save.ability, "wis");
  assert.equal(result.specs[0].conditionOnHit.save.dc, 15);
  assert.equal(result.specs[0].conditionOnHit.durationSeconds, 6);
});

test("healing and activity damage formulas are normalized from dice expressions", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare amulet called Heartglass Pendant. It has 3 charges and heals 2d8 + 2 hit points."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Heartglass Pendant",
      description: "A healing pendant.",
      uses: { max: "3", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] },
      healing: { formula: "2d8 + 2", damageType: "healing" }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].healing.number, 2);
  assert.equal(result.specs[0].healing.denomination, 8);
  assert.equal(result.specs[0].healing.bonus, "+2");
  assert.deepEqual(result.specs[0].healing.types, ["healing"]);
});

test("healing recovers when the dice expression lands in denomination", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon potion called Potion of Verdant Renewal. When a creature drinks it as an action, they regain 4d4+4 hit points."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Potion of Verdant Renewal",
      description: "A healing potion.",
      uses: { max: "1" },
      healing: { number: "", denomination: "4d4+4", types: ["healing"] }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].healing.number, 4);
  assert.equal(result.specs[0].healing.denomination, 4);
  assert.equal(result.specs[0].healing.bonus, "+4");
});

test("charged healing can recover from request text when healing data is incomplete", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon potion called Potion of Verdant Renewal. When a creature drinks it as an action, they regain 4d4+4 hit points and end one disease affecting them. The potion is consumed after use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Potion of Verdant Renewal",
      description: "A restorative potion.",
      uses: { max: "1" },
      healing: { number: "", denomination: "", bonus: "", types: [] }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].healing.number, 4);
  assert.equal(result.specs[0].healing.denomination, 4);
  assert.equal(result.specs[0].healing.bonus, "+4");
  assert.deepEqual(result.specs[0].healing.types, ["healing"]);
});

test("weapon base recovery fills missing damage types from known weapon data", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare mace called Mace of Stunning. It is a +1 mace. On a hit, the target must make a DC 15 Wisdom saving throw or be stunned for 1 round."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Mace of Stunning",
      description: "A stunning mace.",
      magicalBonus: "1",
      damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: [] } },
      conditionOnHit: {
        condition: "stunned",
        save: { ability: "wis", dc: 15 },
        durationSeconds: 6
      }
    }]
  }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].damage.base.types, ["bludgeoning"]);
});

test("single-use summon and enchant items may omit recovery", () => {
  const summonRequest = validateForgeRequest(envelope({
    request: "Create a rare whistle called Whistle of the Lone Wolf. It is consumed after one use and summons a friendly wolf."
  }));
  const summon = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Whistle of the Lone Wolf",
      description: "A consumed whistle.",
      uses: { max: "1" },
      summonActor: { name: "Friendly Wolf", type: "beast", ac: 13, hp: { value: 11, max: 11 } }
    }]
  }, summonRequest, { makeId: ids() });
  assert.deepEqual(summon.specs[0].uses.recovery, []);
  assert.equal(summon.specs[0].uses.autoDestroy, true);

  const enchantRequest = validateForgeRequest(envelope({
    request: "Create a rare oil called Mooncall Unguent. The oil is consumed after one use."
  }));
  const enchant = normalizeModelOutput({
    specs: [{
      kind: "nativeEnchant",
      name: "Mooncall Unguent",
      description: "A consumed oil.",
      uses: { max: "1" },
      duration: { seconds: 3600 },
      restrictions: { type: "weapon" },
      enchantChanges: [{ key: "system.properties", mode: "ADD", value: "mgc" }]
    }]
  }, enchantRequest, { makeId: ids() });
  assert.deepEqual(enchant.specs[0].uses.recovery, []);
  assert.equal(enchant.specs[0].uses.autoDestroy, true);
});

test("enchant oils recover from save-damage model drift", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare oil called Oil of Stormforging. Apply it to a weapon. For 1 hour that weapon becomes magical and deals an extra 1d4 lightning damage. The oil is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Oil of Stormforging",
      description: "A storm-forged oil.",
      uses: { max: "1" },
      save: { ability: "dex", dc: 13 },
      damageParts: [{ number: 1, denomination: 4, bonus: "", types: ["lightning"] }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "nativeEnchant");
  assert.equal(result.specs[0].itemType, "consumable");
  assert.equal(result.specs[0].uses.autoDestroy, true);
  assert.deepEqual(result.specs[0].uses.recovery, []);
  assert.equal(result.specs[0].restrictions.type, "weapon");
  assert.ok(result.specs[0].enchantChanges.some(change => change.key === "system.properties"));
  assert.ok(result.specs[0].enchantChanges.some(change => change.key === "system.damage.parts"));
});

test("nativeEnchant specs synthesize missing duration from the request text", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare oil called Oil of Stormforging. Apply it to a weapon. For 1 hour that weapon becomes magical and deals an extra 1d4 lightning damage. The oil is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeEnchant",
      name: "Oil of Stormforging",
      description: "A storm-forged oil.",
      uses: { max: "1" },
      enchantChanges: [{ key: "system.properties", mode: "ADD", value: "mgc" }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "nativeEnchant");
  assert.deepEqual(result.specs[0].duration, { seconds: 3600 });
  assert.equal(result.specs[0].restrictions.type, "weapon");
});

test("single summon actor aliases normalize into summonActor", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare bell called Bell of the Pale Hunt. As an action, summon a friendly wolf for 1 hour. The bell is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Bell of the Pale Hunt",
      description: "A summoning bell.",
      uses: { max: "1" },
      actor: {
        name: "Friendly Wolf",
        type: "beast",
        ac: 13,
        hp: { value: 11, max: 11 }
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "nativeSummon");
  assert.equal(result.specs[0].summonActor.name, "Friendly Wolf");
  assert.equal(result.specs[0].profileName, "Friendly Wolf");
  assert.equal(result.specs[0].profileId, "0000000000000002");
});

test("nativeSummon specs can infer a simple companion actor from the request", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare bell called Bell of the Pale Hunt. As an action, summon a friendly wolf for 1 hour. The bell is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Bell of the Pale Hunt",
      description: "A summoning bell.",
      uses: { max: "1" }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "nativeSummon");
  assert.equal(result.specs[0].summonActor.name, "Friendly Wolf");
  assert.equal(result.specs[0].summonActor.type, "beast");
  assert.equal(result.specs[0].summonActor.ac, 13);
  assert.equal(result.specs[0].summonActor.hp.max, 11);
});

test("missing activity names are backfilled for suite outputs", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary idol called Throne of the Ninth Gate. It can cast Command and summon a fiend."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "legendaryEquipmentSuite",
      name: "Throne of the Ninth Gate",
      description: "A fiendish idol.",
      saveActivities: [{ save: { ability: "wis", dc: 17 }, damageParts: [] }],
      summonActivity: {},
      summonProfiles: [
        { profileName: "Demon", actor: { name: "Demon Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } },
        { profileName: "Devil", actor: { name: "Devil Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].saveActivities[0].activityName, "Save 1");
  assert.equal(result.specs[0].summonActivity.activityName, "Summon Ally");
});

test("missing kind is inferred for obvious suite-style equipment outputs", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare helm called Helm of the Venom Ray. It has charges and can make a ranged poison attack."
  }));
  const result = normalizeModelOutput({
    specs: [{
      name: "Helm of the Venom Ray",
      description: "A charged battle helm.",
      attackActivities: [{
        damageParts: [{ formula: "4d8", damageType: "poison" }]
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
  assert.equal(result.specs[0].attackActivities[0].activityName, "Attack 1");
  assert.equal(result.specs[0].attackActivities[0].damageParts[0].denomination, 8);
});

test("missing kind prefers a reusable suite over pure summon routing for hybrid staff outputs", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare staff called Staff of the Three Tempests. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, the wielder can spend 3 charges to cast Shatter at DC 15 or 5 charges to cast Ice Storm at DC 15. It can also spend 4 charges to summon a friendly fiend for 1 hour, and the wielder chooses whether the spirit appears as a Demon, Devil, or Yugoloth. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      name: "Staff of the Three Tempests",
      description: "A storm staff with a fiendish calling power.",
      utilityActivities: [{
        name: "Cast Shatter",
        save: { ability: "con", dc: 15 },
        damageParts: [["3d8", "thunder"]]
      }],
      utilityActivities2: [{
        name: "Cast Ice Storm",
        save: { ability: "dex", dc: 15 },
        damageParts: [["2d8", "bludgeoning"], ["4d6", "cold"]]
      }],
      summonProfiles: [
        { profileName: "Demon", actor: { name: "Demon Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } },
        { profileName: "Devil", actor: { name: "Devil Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } },
        { profileName: "Yugoloth", actor: { name: "Yugoloth Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
});

test("missing kind prefers a reusable suite for single-summon hybrid staff outputs", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare quarterstaff called Shepherd's Reliquary. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      name: "Shepherd's Reliquary",
      description: "A reliquary staff with restorative and summoning magic.",
      activities: [{
        activityName: "Cast Shatter",
        chargeCost: 2,
        save: { ability: "con", dc: 14 },
        damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
      }],
      healing: { number: 2, denomination: 8, bonus: "2", types: ["healing"] },
      summonActor: {
        name: "Forge Summon - Wolf",
        type: "beast",
        ac: 13,
        hp: { value: 11, max: 11 }
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
});

test("missing kind prefers a condition rider over plain extra weapon damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare mace called Mace of Dazing Stars. It is a +1 mace that deals an extra 1d6 radiant damage on hit. When it hits a creature, the target must succeed on a DC 15 Wisdom saving throw or be stunned until the end of the wielder's next turn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      name: "Mace of Dazing Stars",
      description: "A radiant mace with a stunning rider.",
      magicalBonus: "1",
      extraDamageParts: [{ formula: "1d6", damageType: "radiant" }],
      conditionOnHit: {
        save: { ability: "wis", dc: 15 },
        durationSeconds: 6
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "weaponConditionOnHit");
});

test("unsafe flags are stripped before contract validation", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare suit of plate armor called Frostguard Plate. It is +2 plate armor that grants resistance to fire damage while equipped."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "shieldArmorBonus",
      name: "Frostguard Plate",
      description: "A suit of enchanted plate.",
      armorValue: 18,
      magicalBonus: "2",
      effects: [{
        name: "Fire Ward",
        flags: { dae: { transfer: true } },
        changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "fire" }]
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "shieldArmorBonus");
});

test("weapon condition outputs recover malformed extra damage from request text", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare mace called Mace of Dazing Stars. It is a +1 mace that deals an extra 1d6 radiant damage on hit. When it hits a creature, the target must succeed on a DC 15 Wisdom saving throw or be stunned until the end of the wielder's next turn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Mace of Dazing Stars",
      description: "A radiant mace.",
      magicalBonus: "1",
      extraDamageParts: ["bad-part"],
      conditionOnHit: {
        condition: "stunned",
        save: { ability: "wis", dc: 15 },
        durationSeconds: 6
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].extraDamageParts[0].denomination, 6);
  assert.deepEqual(result.specs[0].extraDamageParts[0].types, ["radiant"]);
});

test("mixed attack and save staff output falls back to equipment power suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Staff of Ember and Frost. It has 10 charges and regains 1d6+4 charges daily at dawn. As an action, the wielder can spend 1 charge to cast Burning Hands at DC 15, dealing 3d6 fire damage in a 15-foot cone. As an action, the wielder can spend 2 charges to cast Ice Knife at +7 to hit, dealing 1d10 piercing damage and 2d6 cold damage."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Staff of Ember and Frost",
      description: "A staff with fire and ice powers.",
      uses: { max: "10", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
      saveActivities: [{
        activityName: "Burning Hands",
        save: { ability: "dex", dc: 15 },
        damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]
      }],
      attackActivities: [{
        activityName: "Ice Knife",
        damageParts: [
          { number: 1, denomination: 10, bonus: "", types: ["piercing"] },
          { number: 2, denomination: 6, bonus: "", types: ["cold"] }
        ]
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
  assert.equal(result.specs[0].saveActivities.length, 1);
  assert.equal(result.specs[0].attackActivities.length, 1);
});

test("staff output with summon profiles falls back to equipment power suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare staff called Staff of the Three Tempests. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, the wielder can spend 3 charges to cast Shatter at DC 15 or 5 charges to cast Ice Storm at DC 15. It can also spend 4 charges to summon a friendly fiend for 1 hour, and the wielder chooses whether the spirit appears as a Demon, Devil, or Yugoloth. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Staff of the Three Tempests",
      description: "A staff of storm and fiendish power.",
      uses: { max: "10", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
      activities: [{
        activityName: "Shatter",
        save: { ability: "con", dc: 15 },
        damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
      }],
      summonProfiles: [
        { profileName: "Demon", actor: { name: "Demon Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } },
        { profileName: "Devil", actor: { name: "Devil Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } },
        { profileName: "Yugoloth", actor: { name: "Yugoloth Spirit", type: "fiend", ac: 13, hp: { value: 30, max: 30 } } }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
  assert.equal(result.specs[0].saveActivities.length, 1);
  assert.equal(result.specs[0].summonProfiles.length, 3);
  assert.equal(result.specs[0].summonActivity.activityName, "Summon Ally");
});

test("staff output with a single summon actor and healing falls back to a suite without hard failure", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare quarterstaff called Shepherd's Reliquary. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Shepherd's Reliquary",
      description: "A reliquary staff with restorative and summoning magic.",
      uses: { max: 8, recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
      activities: [{
        activityName: "Cast Shatter",
        chargeCost: 2,
        save: { ability: "con", dc: 14 },
        damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
      }],
      healing: { number: 2, denomination: 8, bonus: "2", types: ["healing"] },
      summonActor: {
        name: "Forge Summon - Wolf",
        type: "beast",
        ac: 13,
        hp: { value: 11, max: 11 }
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
  assert.equal(result.specs[0].saveActivities.length, 1);
  assert.equal(result.specs[0].summonProfiles.length, 1);
  assert.equal(result.specs[0].summonActivity.activityName, "Summon Ally");
  assert.equal(result.specs[0].unresolvedMechanics[0].label, "Healing power needs manual review");
});

test("artifact weapon light radii are recovered from request text", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an artifact longsword called Dawnforger. It is a +3 longsword that deals an extra 1d6 radiant damage and 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC. As a bonus action, the blade can ignite, shedding 20 feet of bright light and another 20 feet of dim light. Once per dawn, it can cast Flame Strike at DC 18."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Dawnforger",
      description: "An ancient blazing sword.",
      magicalBonus: "3",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
      toggleLight: { bright: "20 ft.", dim: "another 20 ft." }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].toggleLight.bright, 20);
  assert.equal(result.specs[0].toggleLight.dim, 20);
  assert.equal(result.specs[0].toggleLight.activityName, "Ignite the Flame");
});

test("indexed utility activity arrays are merged and normalized", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare staff called Staff of the Three Tempests. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, the wielder can spend 3 charges to cast Shatter at DC 15 or 5 charges to cast Ice Storm at DC 15. It can also spend 4 charges to summon a friendly fiend for 1 hour, and the wielder chooses whether the spirit appears as a Demon, Devil, or Yugoloth. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Staff of the Three Tempests",
      description: "A staff of storm and fiendish power.",
      uses: { max: 10, recovery: [{ period: "daily", type: "dawn", formula: "1d6 + 4" }] },
      utilityActivities: [{
        id: "utilshatter000000",
        name: "Cast Shatter",
        chargeCost: 3,
        save: { ability: "con", dc: 15 },
        damageParts: [["3d8", "thunder"]]
      }],
      utilityActivities2: [{
        id: "utilicestorm0001",
        name: "Cast Ice Storm",
        chargeCost: 5,
        save: { ability: "dex", dc: 15 },
        damageParts: [["2d8", "bludgeoning"], ["4d6", "cold"]]
      }],
      utilityActivities3: [{
        id: "summonfiends0001",
        name: "Summon Friendly Fiend",
        chargeCost: 4
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "equipmentPowerSuite");
  assert.equal(result.specs[0].saveActivities.length, 2);
  assert.equal(result.specs[0].saveActivities[0].damageParts[0].denomination, 8);
  assert.equal(result.specs[0].utilityActivities.length, 1);
});

test("artifact greataxe aliases recover base damage and passive effect ids", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary greataxe called Ashlord's Divide. It is a +3 greataxe that deals an extra 1d6 fire damage on every hit. While attuned, the wielder gains +1 AC and resistance to necrotic damage. It has 1 daily use of Command at DC 17. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      name: "Ashlord's Divide",
      kind: "artifactWeaponHybrid",
      baseItem: "greataxe",
      weaponType: "martialMelee",
      magicalBonus: 3,
      damage: { base: "1d12", versatile: null },
      extraDamageParts: [{ number: 1, denomination: "d6", bonus: 0, types: ["fire"] }],
      passiveEffects: [{
        id: "effect001234567890",
        label: "Ashlord's Divide: AC and Necrotic Resistance Bonus",
        changes: [
          { key: "system.attributes.ac.bonus", mode: "ADD", value: 1 },
          { key: "system.traits.dr.value", mode: "CUSTOM", value: "necrotic" }
        ]
      }],
      utilityActivities: [{
        activityId: "cmdact0000000017",
        save: { ability: "wis", dc: 17 },
        damageParts: [],
        description: "Cast the spell Command (DC 17) once per day."
      }]
    }]
  }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].damage.base.types, ["slashing"]);
  assert.match(result.specs[0].passiveEffects[0].effectId, /^[A-Za-z0-9]{16}$/);
  assert.equal(result.specs[0].utilityActivities[0].activityName, "Utility 1");
});

test("missing hybrid mechanics are surfaced in unresolved review notes", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary glaive called Beaconrend. It is a +2 glaive that deals an extra 1d6 fire damage and 1d6 lightning damage on every hit. It has 4 charges and regains 1d4 charges daily at dawn. The wielder can spend 1 charge to cast Command at DC 16, or 2 charges to summon a friendly wolf for 1 hour. As a bonus action, the blade can ignite, shedding 20 feet of bright light and 20 feet of dim light."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Beaconrend",
      description: "A blazing glaive with command magic.",
      weaponType: "martialM",
      damage: { base: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } },
      extraDamageParts: [
        { number: 1, denomination: 6, bonus: "", types: ["fire"] },
        { number: 1, denomination: 6, bonus: "", types: ["lightning"] }
      ],
      uses: { max: "4", recovery: [{ type: "dawn", formula: "1d4" }] },
      utilityActivities: [
        { activityName: "Utility 1" },
        { activityName: "Utility 2" }
      ]
    }]
  }, request, { makeId: ids() });

  const unresolvedCategories = new Set((result.specs[0].unresolvedMechanics ?? []).map(mechanic => mechanic.category));
  assert.equal(unresolvedCategories.has("summon"), true);
  assert.equal(unresolvedCategories.has("lightToggle"), true);
  assert.equal(unresolvedCategories.has("namedSpell"), true);
  assert.equal(result.warnings.includes("A requested summon was not preserved in the generated Foundry structure."), true);
  assert.equal(result.warnings.includes("Specific named spells were reduced to generic utility placeholders."), true);
});

test("condition riders and named light utilities do not trigger false unresolved flags", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare rapier called Zephyr Thorn. It is a +2 rapier that deals an extra 1d6 lightning damage on every hit. Any creature struck must succeed on a DC 15 Constitution saving throw or be poisoned for 1 minute. Once per day, the wielder can cast Fly, and as a bonus action the blade sheds 20 feet of bright light and 20 feet of dim light."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Zephyr Thorn",
      description: "A brilliant lightning rapier.",
      weaponType: "martialM",
      baseItem: "rapier",
      magicalBonus: 2,
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } },
      extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["lightning"] }],
      conditionOnHit: {
        condition: "poisoned",
        save: { ability: "con", dc: 15 },
        durationSeconds: 60
      },
      utilityActivities: [
        { activityName: "Cast Fly", description: "Cast Fly once per day." },
        { activityName: "Blade Shedding Light", description: "As a bonus action, the blade sheds 20 feet of bright light and 20 feet of dim light." }
      ]
    }]
  }, request, { makeId: ids() });

  const unresolvedCategories = new Set((result.specs[0].unresolvedMechanics ?? []).map(mechanic => mechanic.category));
  assert.equal(unresolvedCategories.has("saveDamage"), false);
  assert.equal(unresolvedCategories.has("lightToggle"), false);
});

test("named spell aliases in utility fields are preserved for review logic", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare breastplate called Hearthwarden Breastplate. It can heal allies in a 15-foot burst for 2d8+3 and cast Beacon of Hope once per dawn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Hearthwarden Breastplate",
      description: "A breastplate with healing and hope magic.",
      utilityActivities: [
        {
          activityName: "Healing Burst",
          healing: { parts: [{ number: 2, denomination: 8, bonus: 3, types: ["healing"] }] }
        },
        {
          activityName: "Utility 2",
          utilityName: "Beacon of Hope",
          description: "Cast Beacon of Hope once per dawn."
        }
      ]
    }]
  }, request, { makeId: ids() });

  const utilityNames = result.specs[0].utilityActivities.map(activity => activity.activityName);
  const unresolvedCategories = new Set((result.specs[0].unresolvedMechanics ?? []).map(mechanic => mechanic.category));
  assert.deepEqual(utilityNames, ["Healing Burst", "Beacon of Hope"]);
  assert.equal(unresolvedCategories.has("namedSpell"), false);
});

test("utility activities with save and damage satisfy save-effect preservation", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare breastplate called Hearthwarden Breastplate. While worn, it grants +1 AC and resistance to fire damage. It has 3 charges and regains all charges at dawn. The wearer can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, or 2 charges to exhale a 15-foot cone of fire that deals 4d6 fire damage with a DC 14 Dexterity save for half."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "passiveEffectEquipment",
      name: "Hearthwarden Breastplate",
      description: "Protective fire-touched armor.",
      effects: [{
        changes: [
          { key: "system.attributes.ac.bonus", mode: "ADD", value: 1 },
          { key: "system.traits.dr.value", mode: "ADD", value: "fire" }
        ]
      }],
      utilityActivities: [
        {
          activityName: "Heal Touch",
          description: "Restore 2d8 + 2 hit points to a creature you touch."
        },
        {
          activityName: "Fire Cone",
          description: "Exhale a 15-foot cone dealing 4d6 fire damage (Dexterity save DC 14 for half).",
          save: { ability: "dex", dc: 14 },
          damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }]
        }
      ]
    }]
  }, request, { makeId: ids() });

  const unresolvedCategories = new Set((result.specs[0].unresolvedMechanics ?? []).map(mechanic => mechanic.category));
  assert.equal(unresolvedCategories.has("saveDamage"), false);
});

test("suite utility enchantments do not trigger false unresolved enchant review notes", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare shield called Cinderwake Aegis. It grants resistance to fire damage while equipped. Once per long rest, the bearer can use an action to enchant one nonmagical weapon for 1 hour so it becomes magical and deals an extra 1d4 radiant damage."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Cinderwake Aegis",
      description: "A shield that blesses a weapon with flame.",
      effects: [{
        name: "Cinderwake Guard",
        changes: [{ key: "system.traits.dr.value", mode: "ADD", value: "fire" }]
      }],
      utilityActivities: [{
        activityName: "Bless a Weapon",
        effectId: "EnchantFx0000001",
        enchantChanges: [
          { key: "system.properties", mode: "ADD", value: "mgc" },
          { key: "system.damage.parts", mode: "ADD", value: { number: 1, denomination: 4, bonus: "", types: ["radiant"] } }
        ]
      }]
    }]
  }, request, { makeId: ids() });

  const unresolvedCategories = new Set((result.specs[0].unresolvedMechanics ?? []).map(mechanic => mechanic.category));
  assert.equal(unresolvedCategories.has("enchant"), false);
  assert.equal(result.warnings.includes("A requested enchantment rider was not preserved in the generated Foundry structure."), false);
});

test("thrown consumable suites are normalized into one-use consumables without bogus template or spell-attack effects", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon flask of Alchemist Fire. As an action, throw it at a creature within 20 feet. On a hit, the target takes 1d4 fire damage at the start of each of its turns until a creature uses an action to extinguish the flames. The flask is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Flame Flask",
      description: "A volatile flask.",
      attackActivities: [{
        activityName: "Throw Flame Flask",
        damageParts: [{ number: 1, denomination: 4, bonus: "", types: ["fire"] }],
        target: { template: { type: "cone", size: 5, units: "ft" } }
      }],
      effects: [{
        name: "Flame Flask Template",
        changes: [{ key: "system.bonuses.msak.attack", mode: "ADD", value: "1" }]
      }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.name, "Alchemist Fire");
  assert.equal(spec.itemType, "consumable");
  assert.equal(spec.uses.autoDestroy, true);
  assert.equal(spec.attackActivities[0].range.value, 20);
  assert.equal(spec.attackActivities[0].range.units, "ft");
  assert.equal(spec.attackActivities[0].target.template.type, "");
  assert.equal(spec.attackActivities[0].target.affects.count, "1");
  assert.equal(spec.attackActivities[0].target.affects.type, "creature");
  assert.equal(spec.attackActivities[0].target.prompt, true);
  assert.equal(spec.effects.length, 0);
  assert.equal(spec.magicalBonus, "");
});

test("grenade save activities recover missing template and thrown range from request text", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare grenade. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere must make a DC 15 Dexterity saving throw, taking 4d6 fire damage on a failed save, or half as much on a success. The grenade is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Pyre Grenade",
      description: "A volatile explosive.",
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }],
      range: { units: "self" },
      target: {}
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.itemType, "consumable");
  assert.equal(spec.uses.autoDestroy, true);
  assert.equal(spec.range.value, 60);
  assert.equal(spec.range.units, "ft");
  assert.equal(spec.target.template.type, "sphere");
  assert.equal(spec.target.template.size, 10);
  assert.equal(spec.target.affects.type, "creature");
  assert.equal(spec.target.prompt, true);
});

test("grenade normalization prefers explicit request range over stale model defaults", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare grenade. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere must make a DC 15 Dexterity saving throw, taking 4d6 fire damage on a failed save, or half as much on a success. The grenade is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Fiery Grenade",
      description: "A volatile explosive.",
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }],
      range: { value: 20, units: "ft" },
      target: {
        template: { type: "sphere", size: 5, units: "ft" },
        prompt: false
      }
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.range.value, 60);
  assert.equal(spec.range.units, "ft");
  assert.equal(spec.target.template.type, "sphere");
  assert.equal(spec.target.template.size, 10);
  assert.equal(spec.target.prompt, true);
});

test("grenade normalization prefers an explicit request save ability over model defaults", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a Thunderclap Grenade. Throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere must make a DC 15 Constitution saving throw, taking 3d6 thunder damage on a failure."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Thunderclap Grenade",
      description: "A concussive grenade.",
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["thunder"] }],
      range: { value: 60, units: "ft" },
      target: {
        template: { type: "sphere", size: 10, units: "ft" },
        prompt: true
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].save.ability, "con");
});

test("grenade normalization also preserves thrown range from layered Forge brief text", () => {
  const request = validateForgeRequest(envelope({
    request: [
      "Item name: Incendiary Grenade",
      "",
      "Complexity layer 1 - Base chassis",
      "Base item: Grenade",
      "Rarity: Rare",
      "Item type: Consumable projectile",
      "",
      "Complexity layer 3 - Resource model",
      "Use model: Consumed after one use",
      "",
      "Complexity layer 4 - Named activities",
      "Activation: Throw as an action",
      "Range: 60 feet",
      "Area: 10-foot-radius sphere",
      "Spell save DC: 15"
    ].join("\n")
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Incendiary Grenade",
      description: "Layered grenade brief.",
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }],
      range: { units: "self" },
      target: {}
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.range.value, 60);
  assert.equal(spec.range.units, "ft");
  assert.equal(spec.target.template.type, "sphere");
  assert.equal(spec.target.template.size, 10);
});

test("throwable consumable attack activities prefer explicit request range over stale model defaults", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon flask of Alchemist Fire. As an action, throw it at a creature within 20 feet. On a hit, the target takes 1d4 fire damage at the start of each of its turns until a creature uses an action to extinguish the flames. The flask is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Flame Flask",
      description: "A volatile flask.",
      attackActivities: [{
        activityName: "Throw Flame Flask",
        damageParts: [{ number: 1, denomination: 4, bonus: "", types: ["fire"] }],
        range: { value: 5, units: "ft" },
        target: {
          template: { type: "cone", size: 5, units: "ft" },
          prompt: false
        }
      }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.attackActivities[0].range.value, 20);
  assert.equal(spec.attackActivities[0].range.units, "ft");
  assert.equal(spec.attackActivities[0].target.template.type, "");
  assert.equal(spec.attackActivities[0].target.affects.count, "1");
  assert.equal(spec.attackActivities[0].target.affects.type, "creature");
  assert.equal(spec.attackActivities[0].target.prompt, true);
});

test("throwable consumables discard model-invented attack bonuses but keep explicit bonuses", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon acid flask. As an action, throw it at one creature within 20 feet. On a hit, the target takes 2d6 acid damage. The flask is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Acid Flask",
      description: "A flask.",
      magicalBonus: "1",
      attackActivities: [{
        activityName: "Throw",
        attackBonus: "1",
        damageParts: [{ number: 0, denomination: 0, bonus: "", types: ["acid"] }, { number: 2, denomination: 6, bonus: "", types: ["acid"] }]
      }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.magicalBonus, "");
  assert.equal(spec.attackActivities[0].attackBonus, "");
  assert.deepEqual(spec.attackActivities[0].damageParts.map(part => `${part.number}d${part.denomination}`), ["2d6"]);

  const explicit = validateForgeRequest(envelope({
    request: "Create an uncommon +1 acid flask. As an action, throw it at one creature within 20 feet. On a hit, the target takes 2d6 acid damage. The flask is consumed after one use."
  }));
  const explicitResult = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Acid Flask",
      description: "A flask.",
      attackActivities: [{
        activityName: "Throw",
        attackBonus: "",
        damageParts: [{ number: 2, denomination: 6, bonus: "", types: ["acid"] }]
      }]
    }]
  }, explicit, { makeId: ids() });
  assert.equal(explicitResult.specs[0].magicalBonus, "1");
  assert.equal(explicitResult.specs[0].attackActivities[0].attackBonus, "");
});
