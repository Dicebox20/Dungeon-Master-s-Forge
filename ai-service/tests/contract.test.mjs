import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelOutput, validateForgeRequest } from "../src/contract.mjs";
import { actor } from "./fixtures/valid-specs.mjs";
import { envelope } from "./helpers.mjs";
import { applyAutomationCapabilityRoute, normalizeAutomationCapabilities, normalizeAutomationContract } from "../src/automation-contract.mjs";
import { AUTOMATION_PRODUCTION_TEMPLATES, AUTOMATION_TEMPLATES } from "../src/automation-templates.mjs";

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

test("automation capability context is bounded and declarative", () => {
  const result = validateForgeRequest(envelope({
    context: {
      ...envelope().context,
      automationCapabilities: {
        version: "1.0",
        supportedRecipes: ["conditionOnHit", "selfTargetLight"],
        activeModules: ["midi-qol", "itemacro"],
        settings: { midiQolAutomation: true, itemMacroAutomation: true },
        routes: [{
          recipe: "conditionOnHit",
          layer: "Midi-QOL + Item Macro",
          selectedLayer: "Midi-QOL + Item Macro",
          dependencies: ["midi-qol", "itemacro"],
          available: true,
          status: "available",
          fallback: "DND5e core attack and review note"
        }]
      }
    }
  }));
  assert.deepEqual(result.context.automationCapabilities.supportedRecipes, ["conditionOnHit", "selfTargetLight"]);
  assert.equal(result.context.automationCapabilities.routes[0].selectedLayer, "Midi-QOL + Item Macro");
  assert.deepEqual(normalizeAutomationContract({ recipe: "selfTargetLight", targetSource: "self" }).targetSource, "self");
  assert.throws(() => normalizeAutomationContract({ recipe: "selfTargetLight", script: "return 1" }), /unsupported field/);
  assert.throws(() => normalizeAutomationCapabilities({ version: "1.0", supportedRecipes: ["arbitraryMacro"] }), /unknown recipe/);
});

test("automation output receives the negotiated dependency route and rejects unavailable routes", () => {
  const available = normalizeAutomationCapabilities({
    version: "1.0",
    supportedRecipes: ["selfTargetLight"],
    activeModules: ["itemacro"],
    settings: { itemMacroAutomation: true },
    routes: [{
      recipe: "selfTargetLight",
      layer: "Item Macro",
      selectedLayer: "Item Macro",
      dependencies: ["itemacro"],
      available: true,
      status: "available",
      fallback: "DND5e core item and manual light review"
    }]
  });
  const normalized = applyAutomationCapabilityRoute(
    normalizeAutomationContract({ recipe: "selfTargetLight" }),
    available,
    "specs[0].automation"
  );
  assert.deepEqual(normalized.requires, ["itemacro"]);

  const unavailable = normalizeAutomationCapabilities({
    version: "1.0",
    supportedRecipes: [],
    activeModules: [],
    settings: {},
    routes: [{
      recipe: "selfTargetLight",
      layer: "Item Macro",
      selectedLayer: "DND5e core (fallback)",
      dependencies: ["itemacro"],
      available: false,
      status: "fallback",
      fallback: "DND5e core item and manual light review"
    }]
  });
  assert.throws(
    () => applyAutomationCapabilityRoute(normalizeAutomationContract({ recipe: "selfTargetLight" }), unavailable, "specs[0].automation"),
    /was not advertised|unavailable/
  );
});

test("model automation metadata survives normalization without executable payloads", () => {
  const request = "Create a rare longsword called Gravebell. On a hit, undead targets must make a DC 13 Constitution save or be poisoned for 1 minute.";
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Gravebell",
      description: request,
      weaponType: "martialM",
      baseItem: "longsword",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
      extraDamageParts: [],
      conditionOnHit: { condition: "poisoned", save: { ability: "con", dc: 13 }, durationSeconds: 60, targetCreatureType: "undead" },
      automation: { recipe: "conditionOnHit", targetFilter: { creatureType: "undead" }, requires: ["midi-qol", "itemacro"] }
    }]
  }, validateForgeRequest(envelope({ request })), { makeId: ids() });
  assert.equal(result.specs[0].automation.recipe, "conditionOnHit");
  assert.equal(result.specs[0].automation.targetFilter.creatureType, "undead");
  assert.equal(result.specs[0].automation.script, undefined);
});

test("legacy condition and light payloads receive negotiated automation metadata", () => {
  const request = "Create an artifact longsword called Ashen Mercy. On a hit, the target makes a DC 13 Constitution save or is stunned for 1 round. As a bonus action, it sheds bright light for 20 feet and dim light for 40 feet.";
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Ashen Mercy",
      description: request,
      weaponType: "martialM",
      baseItem: "longsword",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
      passiveEffects: [],
      utilityActivities: [],
      saveActivities: [],
      conditionOnHit: { condition: "stunned", save: { ability: "con", dc: 13 }, durationSeconds: 6 },
      toggleLight: { bright: 20, dim: 40 }
    }]
  }, validateForgeRequest(envelope({
    request,
    context: {
      ...envelope().context,
      automationCapabilities: {
        version: "1.0",
        supportedRecipes: ["conditionOnHit", "selfTargetLight"],
        supportedTemplates: ["workflow-condition-rider", "self-token-light-toggle"],
        activeModules: ["midi-qol", "itemacro"],
        settings: { midiQolAutomation: true, itemMacroAutomation: true },
        routes: [
          { recipe: "conditionOnHit", layer: "Midi-QOL + Item Macro", selectedLayer: "Midi-QOL + Item Macro", dependencies: ["midi-qol", "itemacro"], available: true, status: "available", fallback: "Core attack workflow with review" },
          { recipe: "selfTargetLight", layer: "Item Macro", selectedLayer: "Item Macro", dependencies: ["itemacro"], available: true, status: "available", fallback: "Portable light metadata with review" }
        ]
      }
    }
  })), { makeId: ids() });
  assert.deepEqual(result.specs[0].automationRoutes.map(route => route.recipe), ["conditionOnHit", "selfTargetLight"]);
  assert.equal(result.specs[0].automationRoutes[0].targetSource, "hitTargets");
  assert.equal(result.specs[0].automationRoutes[1].targetSource, "self");
});

test("automation templates are production-gated and must match their recipe", () => {
  assert.equal(normalizeAutomationContract({ templateId: "workflow-condition-rider", recipe: "conditionOnHit" }).templateId, "workflow-condition-rider");
  assert.throws(
    () => normalizeAutomationContract({ templateId: "actor-sourced-concentration-aura", recipe: "conditionOnHit" }),
    /not a production template/
  );
  assert.throws(
    () => normalizeAutomationContract({ templateId: "self-token-light-toggle", recipe: "conditionOnHit" }),
    /does not match recipe/
  );
});

test("model automation labels normalize to the canonical production contract", () => {
  const normalized = normalizeAutomationContract({
    recipe: "workflow-condition-rider",
    workflowPass: "on-hit",
    authority: "trusted-local",
    fallback: "Use the core attack workflow if the trusted automation layer is unavailable."
  });
  assert.equal(normalized.templateId, "workflow-condition-rider");
  assert.equal(normalized.recipe, "conditionOnHit");
  assert.equal(normalized.workflowPass, "postActiveEffects");
  assert.equal(normalized.authority, "local-trusted-engine");
  assert.equal(normalized.fallback, "core-only");
});

test("template description fields are bounded metadata and do not enter the runtime contract", () => {
  const normalized = normalizeAutomationContract({
    recipe: "conditionOnHit",
    fields: ["condition", "save", "duration", "targetFilter"]
  });
  assert.equal(normalized.fields, undefined);
  assert.throws(
    () => normalizeAutomationContract({ recipe: "conditionOnHit", fields: ["x".repeat(61)] }),
    /metadata array|short printable string/
  );
});

for (const template of AUTOMATION_PRODUCTION_TEMPLATES) {
  test(`every production automation template normalizes its model labels: ${template.id}`, () => {
    const recipe = template.recipes[0];
    const normalized = normalizeAutomationContract({
      recipe: template.id,
      trigger: template.trigger.replaceAll("-", " "),
      targetSource: recipe === "conditionOnHit" ? "hit targets" : "self target",
      workflowPass: recipe === "conditionOnHit" ? "on-hit" : "activity",
      authority: "trusted-local",
      fallback: "Use the core route with manual review if needed.",
      fields: template.fields,
      ...(template.requiredModules.length ? { requires: template.requiredModules } : {})
    });

    assert.equal(normalized.templateId, template.id);
    assert.equal(normalized.recipe, recipe);
    assert.equal(normalized.trigger, template.trigger);
    assert.equal(normalized.targetSource, recipe === "conditionOnHit" ? "hitTargets" : "self");
    assert.equal(normalized.workflowPass, recipe === "conditionOnHit" ? "postActiveEffects" : "activity");
    assert.equal(normalized.authority, "local-trusted-engine");
    assert.equal(normalized.fallback, "core-only");
    assert.deepEqual(normalized.requires, template.requiredModules.length ? template.requiredModules : undefined);
    assert.equal(normalized.fields, undefined);
  });
}

for (const template of AUTOMATION_TEMPLATES.filter(candidate => candidate.status === "planned")) {
  test(`planned automation remains deferred: ${template.id}`, () => {
    assert.throws(
      () => normalizeAutomationContract({ recipe: template.id }),
      /not a production template/
    );
  });
}

test("advertised automation templates are required before a template can be applied", () => {
  const contract = normalizeAutomationContract({ templateId: "workflow-condition-rider", recipe: "conditionOnHit" });
  const capabilities = normalizeAutomationCapabilities({
    version: "1.0",
    supportedRecipes: ["conditionOnHit"],
    supportedTemplates: ["workflow-condition-rider"],
    activeModules: ["midi-qol", "itemacro"],
    settings: { midiQolAutomation: true, itemMacroAutomation: true },
    routes: [{
      recipe: "conditionOnHit",
      layer: "Midi-QOL + Item Macro",
      selectedLayer: "Midi-QOL + Item Macro",
      dependencies: ["midi-qol", "itemacro"],
      available: true,
      status: "available",
      fallback: "DND5e core attack and review note"
    }]
  });
  assert.equal(applyAutomationCapabilityRoute(contract, capabilities).templateId, "workflow-condition-rider");
  assert.throws(
    () => applyAutomationCapabilityRoute(contract, { ...capabilities, supportedTemplates: [] }),
    /templateId .* was not advertised/
  );
});

test("repair attempts preserve reviewed context and strip executable fields", () => {
  const request = "Create a rare torch called Ashen Mercy with a toggleable 20-foot bright light.";
  const result = validateForgeRequest(envelope({
    request,
    requestMode: "repair-attempt",
    repair: {
      parentRequestId: "repair-parent-01",
      attempt: 1,
      originalRequest: request,
      repairNotes: "Correct the stale light review note without changing the item.",
      currentReviewedSpecs: [{
        kind: "equipmentPowerSuite",
        name: "Ashen Mercy",
        flags: { "midi-qol": { command: "do-not-run" } },
        macroCommand: "do-not-run"
      }],
      reviewNotes: [{ state: "notice", label: "Notice", message: "The light note is stale.", handling: "Review it." }],
      deterministicFindings: ["toggleLight is present."],
      provenance: { providerLane: "bring-your-own" }
    }
  }));
  assert.equal(result.requestMode, "repair-attempt");
  assert.equal(result.repair.attempt, 1);
  assert.equal(result.repair.parentRequestId, "repair-parent-01");
  assert.equal(result.repair.currentReviewedSpecs[0].flags, undefined);
  assert.equal(result.repair.currentReviewedSpecs[0].macroCommand, undefined);
  assert.equal(result.repair.reviewNotes[0].message, "The light note is stale.");
});

test("repair attempts reject repeated or mismatched source context", () => {
  const base = {
    parentRequestId: "repair-parent-01",
    attempt: 1,
    originalRequest: envelope().request,
    repairNotes: "Correct the reviewed issue.",
    currentReviewedSpecs: [{ kind: "weaponExtraDamage", name: "Repair Blade" }]
  };
  assert.throws(
    () => validateForgeRequest(envelope({ requestMode: "repair-attempt", repair: { ...base, attempt: 2 } })),
    error => error.code === "invalid_repair_attempt"
  );
  assert.throws(
    () => validateForgeRequest(envelope({ requestMode: "repair-attempt", repair: { ...base, originalRequest: "Different request" } })),
    error => error.code === "invalid_repair_context"
  );
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

test("empty named poison spell activities are recovered without a stale unresolved note", () => {
  const request = "Create a Longsword named \"Giant's Toothpick\" that gives a +2 magical bonus and does an additional 2d4 in poison damage. On a successful hit the target must make a DC 13 constitution saving throw or be poisoned for one minute. It has 12 charges that can be used to cast the spells poison spray, ray of sickness, and cloudkill with charges used based on spell level.";
  const requestEnvelope = validateForgeRequest(envelope({ request }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Giant's Toothpick",
      description: request,
      weaponType: "martialM",
      baseItem: "longsword",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["slashing"] } },
      extraDamageParts: [{ number: 2, denomination: 4, bonus: "", types: ["poison"] }],
      uses: { max: "12", recovery: [] },
      saveActivities: [],
      attackActivities: [],
      utilityActivities: [],
      unresolvedMechanics: [{
        category: "unmappedSpell",
        label: "Spellcasting activities",
        requestedText: "It has 12 charges that can be used to cast the spells poison spray, ray of sickness, and cloudkill with charges used based on spell level.",
        reason: "The spell activities were not fully specified.",
        handling: "Review and add separate activities if needed."
      }]
    }]
  }, requestEnvelope, { makeId: ids() });

  const spec = result.specs[0];
  assert.deepEqual(spec.saveActivities.map(activity => [activity.activityName, activity.chargeCost]), [["Cast Poison Spray", 1], ["Cast Cloudkill", 5]]);
  assert.deepEqual(spec.attackActivities.map(activity => [activity.activityName, activity.chargeCost]), [["Cast Ray of Sickness", 1]]);
  assert.deepEqual(spec.uses.recovery, [{ period: "lr", type: "recoverAll", formula: "" }]);
  assert.equal(spec.unresolvedMechanics, undefined);
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
  assert.equal(result.promptVersion, "1.1.0");
  assert.equal(result.requestCount, 1);
  assert.equal(result.specs[0].attackActivities[0].activityId, "0000000000000001");
  assert.equal(result.specs[0].effects[0].effectId, "0000000000000002");
  assert.equal(result.specs[0].unresolvedMechanics[0].id, "0000000000000003");
  assert.equal(result.specs[0].unresolvedMechanics[0].resolved, false);
  assert.equal(result.unresolvedMechanics[0].itemName, "Mind Crown");
  assert.match(result.preparedSpecFingerprint, /^sha256:[0-9a-f]{64}$/);
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

test("attunement phrasing is normalized before the Forge response is returned", () => {
  const required = normalizeModelOutput({
    specs: [{
      kind: "weaponExtraDamage",
      name: "Needful Rapier",
      description: "A rapier for a spellcaster.",
      attunement: "",
      weaponType: "martialM",
      baseItem: "rapier",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } },
      extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["acid"] }]
    }]
  }, validateForgeRequest(envelope({
    request: "Create a rare rapier called Needful Rapier. It needs attunement by a spellcaster."
  })), { makeId: ids() });
  assert.equal(required.specs[0].attunement, "required");

  const optional = normalizeModelOutput({
    specs: [{
      kind: "weaponExtraDamage",
      name: "Unbound Rapier",
      description: "A simple rapier.",
      attunement: "required",
      weaponType: "martialM",
      baseItem: "rapier",
      damage: { base: { number: 1, denomination: 8, bonus: "@mod", types: ["piercing"] } },
      extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["acid"] }]
    }]
  }, validateForgeRequest(envelope({
    request: "Create a rare rapier called Unbound Rapier. It does not need attunement."
  })), { makeId: ids() });
  assert.equal(optional.specs[0].attunement, "");
});

test("multi-property magical items default to required attunement", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare longsword called Emberfang. It is a +2 longsword that deals an extra 1d6 fire damage on hit and has a DC 13 poison rider."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Emberfang",
      description: "A fiery poisoned longsword.",
      attunement: "",
      magicalBonus: "2",
      weaponType: "martialM",
      baseItem: "longsword",
      extraDamageParts: [{ number: 1, denomination: 6, bonus: "", types: ["fire"] }],
      conditionOnHit: { condition: "poisoned", save: { ability: "con", dc: 13 }, durationSeconds: 60 }
    }]
  }, request, { makeId: ids() });
  assert.equal(result.specs[0].attunement, "required");
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

test("single-activity quarterstaff output remains a staff suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare quarterstaff called Ashen Pilgrim Staff. It has 7 charges. As an action, spend 1 charge to cast Burning Hands."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Ashen Pilgrim Staff",
      description: "A quarterstaff with one charged spell.",
      uses: { max: "7", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 1" }] },
      activities: [{
        activityName: "Burning Hands",
        activityId: "BurningHands00001",
        chargeCost: 1,
        save: { ability: "dex", dc: 15 },
        damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]
      }]
    }]
  }, request, { makeId: ids() });
  assert.equal(result.specs[0].kind, "multiActivityStaff");
});

test("charged save output for an explicit staff is promoted back to a staff suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Staff of Tides and Thunder. It has 8 charges and can cast Shatter for 2 charges."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Staff of Tides and Thunder",
      description: "A staff with a charged Shatter power.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
      activityId: "ShatterPower0001",
      activityName: "Shatter",
      chargeCost: 2,
      save: { ability: "con", dc: 15 },
      damageOnSave: "half",
      damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
    }]
  }, request, { makeId: ids() });
  assert.equal(result.specs[0].kind, "multiActivityStaff");
  assert.equal(result.specs[0].activities[0].activityName, "Shatter");
  assert.equal(result.specs[0].itemType, "equipment");
});

test("nested charged save output for an explicit staff is promoted back to a staff suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Staff of Tides and Thunder. It has 8 charges and can cast Shatter for 2 charges."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Staff of Tides and Thunder",
      description: "A staff with a nested charged Shatter power.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
      activities: [{
        activityId: "ShatterPower0001",
        activityName: "Shatter",
        chargeCost: 2,
        save: { ability: "con", dc: 15 },
        damageOnSave: "half",
        damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
      }]
    }]
  }, request, { makeId: ids() });
  assert.equal(result.specs[0].kind, "multiActivityStaff");
  assert.equal(result.specs[0].activities[0].activityName, "Shatter");
  assert.equal(result.specs[0].itemType, "equipment");
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

test("sling weapons recover the native simple ranged base damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon +1 sling called Twinbolt Sling. Every hit deals an extra 1d4 force damage."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponExtraDamage",
      name: "Twinbolt Sling",
      description: "A force-charged sling.",
      magicalBonus: "1",
      baseItem: "sling",
      damage: { base: { number: 1, denomination: "bad", bonus: "@mod", types: [] } },
      extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["force"] }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].weaponType, "simpleR");
  assert.equal(result.specs[0].damage.base.denomination, 4);
  assert.deepEqual(result.specs[0].damage.base.types, ["bludgeoning"]);
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

test("condition riders recover numeric duration from a malformed next-turn value", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon dagger called Needle of Alarms. Once per turn when you hit a creature that has not acted yet, it takes an extra 1d4 psychic damage and cannot benefit from being hidden until the start of your next turn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Needle of Alarms",
      description: "A watchful dagger.",
      conditionOnHit: {
        condition: "hidden",
        save: { ability: "wis", dc: 12 },
        durationSeconds: "until the start of your next turn"
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "weaponConditionOnHit");
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

test("healing activity values and recovery are corrected from the request", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a Wand named \"Dawnmender's Spark [VIDEO-FF-02]\" with 6 charges. As an action, it can expend 1 charge to restore 2d8+3 hit points to one creature within 60 feet. All expended charges recover at long rest."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "casterUtilityEquipment",
      name: "Dawnmender's Spark [VIDEO-FF-02]",
      description: "A restorative wand.",
      uses: { max: "6", recovery: [{ period: "longRest", type: "formula", formula: "1" }] },
      utilityActivities: [{
        activityName: "Restore Vitality",
        chargeCost: 6,
        healing: { number: 1, denomination: 6, bonus: "", types: ["healing"] }
      }]
    }]
  }, request, { makeId: ids() });

  const activity = result.specs[0].utilityActivities[0];
  assert.deepEqual(activity.healing, { number: 2, denomination: 8, bonus: "+3", types: ["healing"] });
  assert.equal(activity.chargeCost, 1);
  assert.deepEqual(result.specs[0].uses.recovery, [{ period: "lr", type: "recoverAll", formula: "" }]);
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

test("rest-recharging summon items remain reusable", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon whistle called Kennel Whistle. Once per long rest, summon a friendly Mastiff for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Kennel Whistle",
      uses: { max: "1", recovery: [{ period: "longRest", type: "longRest" }], autoDestroy: true },
      summonActor: { name: "Friendly Mastiff", srdActorName: "Mastiff", type: "beast", ac: 12, hp: { value: 5, max: 5 } }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].uses.autoDestroy, false);
  assert.equal(result.specs[0].uses.recovery.length, 1);
});

test("charge recovery formulas repair incomplete model recovery entries", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare brooch with 5 charges that regains 1d4 + 1 charges at dawn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "casterUtilityEquipment",
      name: "Highwire Brooch",
      uses: { max: 5, recovery: [{ period: "dawn", type: "spec" }] },
      utilityActivities: [{ activityName: "Cast Light", activationType: "action" }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].uses.recovery[0].formula, "1d4 + 1");
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
  assert.deepEqual(
    result.specs[0].enchantChanges.find(change => change.key === "system.damage.parts")?.value,
    { number: 1, denomination: 4, bonus: "", types: ["lightning"] }
  );
});

test("plural no-attunement wording, skill advantage, and darkvision use DND5e 5.x fields", () => {
  const request = validateForgeRequest(envelope({
    request: "Create uncommon goggles called Owlglass Lenses. While worn, they grant 60-foot darkvision and advantage on Wisdom (Perception) checks. They do not require attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "passiveEffectEquipment",
      name: "Owlglass Lenses",
      description: "Goggles that sharpen the wearer's sight.",
      attunement: "required",
      effects: [{
        name: "Owlglass Sight",
        changes: [
          { key: "system.attributes.senses.darkvision", mode: "OVERRIDE", value: "60" },
          { key: "system.skills.prc.bonuses.check", mode: "CUSTOM", value: "advantage on Wisdom (Perception) checks" }
        ]
      }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.attunement, "");
  assert.equal(spec.effects[0].changes.some(change => change.key === "system.skills.prc.bonuses.check"), false);
  assert.deepEqual(
    spec.effects[0].changes.find(change => change.key === "system.skills.prc.roll.mode"),
    { key: "system.skills.prc.roll.mode", mode: "ADD", value: "1" }
  );
  assert.deepEqual(
    spec.effects[0].changes.find(change => change.key === "system.attributes.senses.ranges.darkvision"),
    { key: "system.attributes.senses.ranges.darkvision", mode: "ADD", value: "60" }
  );
});

test("Investigation advantage repairs malformed model keys", () => {
  const request = validateForgeRequest(envelope({
    request: "Create uncommon spectacles called Surveyor Spectacles. They grant advantage on Intelligence (Investigation) checks and darkvision out to 60 feet."
  }));
  const result = normalizeModelOutput({ specs: [{
    kind: "passiveEffectEquipment",
    name: "Surveyor Spectacles",
    effects: [{ name: "Surveyor Sight", changes: [
      { key: "system.skills.ith.prc", mode: "CUSTOM", value: "advantage" },
      { key: "system.attributes.darkvision.distance", mode: "OVERRIDE", value: "60" }
    ] }]
  }] }, request, { makeId: ids() });

  const changes = result.specs[0].effects[0].changes;
  assert.deepEqual(changes.find(change => change.key === "system.skills.inv.roll.mode"), {
    key: "system.skills.inv.roll.mode", mode: "ADD", value: "1"
  });
  assert.deepEqual(changes.find(change => change.key === "system.attributes.senses.ranges.darkvision"), {
    key: "system.attributes.senses.ranges.darkvision", mode: "ADD", value: "60"
  });
  assert.equal(changes.some(change => change.key === "system.skills.ith.prc"), false);
});

test("multi-profile summons preserve each explicitly named SRD actor", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon horn. Pick one friendly beast: Giant Toad, Giant Scorpion, or Rhinoceros."
  }));
  const result = normalizeModelOutput({ specs: [{
    kind: "nativeMultiProfileSummon",
    name: "Menagerie Horn",
    summonProfiles: ["Giant Toad", "Giant Scorpion", "Rhinoceros"].map(profileName => ({
      profileName,
      actor: { name: "Friendly One Friendly Beast", srdActorName: "One Friendly Beast", type: "beast" }
    }))
  }] }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].summonProfiles.map(profile => profile.actor.srdActorName), [
    "Giant Toad", "Giant Scorpion", "Rhinoceros"
  ]);
  assert.deepEqual(result.specs[0].summonProfiles.map(profile => profile.actor.name), [
    "Friendly Giant Toad", "Friendly Giant Scorpion", "Friendly Rhinoceros"
  ]);
});

test("explicit summon choices recover multi-profile structure from a collapsed single actor", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon horn. Pick one friendly beast: Giant Toad, Giant Scorpion, or Rhinoceros when it shows up."
  }));
  const result = normalizeModelOutput({ specs: [{
    kind: "nativeSummon",
    name: "Menagerie Horn",
    summonActor: { name: "Chosen Beast", srdActorName: "Chosen Beast", type: "beast" },
    unresolvedMechanics: [{ category: "beastChoice", reason: "Choose the beast at the table." }]
  }] }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "nativeMultiProfileSummon");
  assert.deepEqual(result.specs[0].summonProfiles.map(profile => profile.profileName), [
    "Giant Toad", "Giant Scorpion", "Rhinoceros"
  ]);
  assert.equal(result.specs[0].unresolvedMechanics, undefined);
});

test("compound friendly summon placeholders recover exact SRD profiles", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare seal. As an action, summon one friendly Skeleton or Zombie for 1 hour."
  }));
  const result = normalizeModelOutput({ specs: [{
    kind: "nativeMultiProfileSummon",
    name: "Skeletal Menagerie",
    summonProfiles: ["Skeleton", "Zombie"].map(profileName => ({
      profileName,
      actor: {
        name: "Friendly One Friendly Skeleton Or Zombie",
        srdActorName: "One Friendly Skeleton Or Zombie",
        type: "undead"
      }
    }))
  }] }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].summonProfiles.map(profile => profile.actor.srdActorName), ["Skeleton", "Zombie"]);
  assert.deepEqual(result.specs[0].summonProfiles.map(profile => profile.actor.name), ["Friendly Skeleton", "Friendly Zombie"]);
});

test("single friendly SRD summon strips leading request filler from malformed model identity", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare seal. As an action, summon one friendly Giant Scorpion for 1 hour using the exact D&D5e SRD actor profile."
  }));
  const result = normalizeModelOutput({ specs: [{
    kind: "nativeSummon",
    name: "Scorpioncall Seal",
    summonProfiles: [{
      profileName: "Profile Separate",
      actor: { name: "Friendly Profile Separate", srdActorName: "Profile Separate", requireSrdActor: true }
    }]
  }] }, request, { makeId: ids() });

  assert.equal(result.specs[0].summonActor.srdActorName, "Giant Scorpion");
  assert.equal(result.specs[0].summonActor.name, "Friendly Giant Scorpion");
});

test("nested spell objects provide activity names", () => {
  const request = validateForgeRequest(envelope({ request: "Create a shield that can cast Greater Invisibility once per long rest." }));
  const result = normalizeModelOutput({ specs: [{
    kind: "equipmentPowerSuite",
    name: "Veiled Aegis",
    utilityActivities: [{ activityName: "Utility 1", spell: { name: "Greater Invisibility" } }]
  }] }, request, { makeId: ids() });

  assert.equal(result.specs[0].utilityActivities[0].activityName, "Greater Invisibility");
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
  assert.equal(result.specs[0].summonActor.srdActorName, "Wolf");
  assert.equal(result.specs[0].summonActor.requireSrdActor, false);
  assert.equal(result.specs[0].summonActor.ac, 12);
});

test("call in summon slang recovers a named SRD actor suggestion", () => {
  const request = validateForgeRequest(envelope({
    request: "Create very rare plate armor. Burn 5 charges to call in a friendly Lion for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Gatecrash Harness",
      description: "Very rare plate armor with a charged ally call.",
      summonActivity: { activityName: "Call Lion", chargeCost: 5 }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].summonProfiles[0].profileName, "Lion");
  assert.equal(result.specs[0].summonProfiles[0].actor.srdActorName, "Lion");
  assert.equal(result.specs[0].summonProfiles[0].actor.requireSrdActor, false);
});

test("summon suggestions prefer an SRD actor while retaining a safe fallback", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary book called The Dragonomicon. As an action, summon a friendly pseudodragon that serves the user for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "The Dragonomicon",
      description: "A dragon lore tome.",
      uses: { max: "1" },
      summonActor: {
        name: "Fabricated Dragon",
        type: "dragon",
        ac: 99,
        hp: { value: 999, max: 999 }
      }
    }]
  }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].summonActor, {
    name: "Friendly Pseudodragon",
    srdActorName: "Pseudodragon",
    requireSrdActor: false,
    type: "dragon",
    ac: 99,
    hp: { value: 999, max: 999 },
    movement: { walk: 30, units: "ft" },
    size: "med"
  });
});

test("generic summon suggestions receive a reviewed fallback actor", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare whistle called Companion Call. As an action, summon a friendly companion for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Companion Call",
      description: "A vague whistle.",
      uses: { max: "1" },
      summonActor: actor("Invented Companion")
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].summonActor.name, "Invented Companion");
  assert.equal(result.specs[0].summonActor.requireSrdActor, false);
  assert.equal(result.specs[0].summonActor.type, "beast");
});

test("generic companion requests suggest a Wolf before using the fallback actor", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare whistle called Companion Call. As an action, summon a friendly companion for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Companion Call",
      description: "A companion whistle.",
      uses: { max: "1" }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].summonActor.name, "Friendly Wolf");
  assert.equal(result.specs[0].summonActor.srdActorName, "Wolf");
  assert.equal(result.specs[0].summonActor.requireSrdActor, false);
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

test("explicit summon charge costs override stale model activity costs", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare quarterstaff called Staff of the Bonebound Pact. It has 10 charges and regains 1d6 + 4 charges daily at dawn. As an action, spend 4 charges to summon one friendly Skeleton or Zombie for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Staff of the Bonebound Pact",
      description: "A staff with a selectable undead ally.",
      uses: { max: "10", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 4" }] },
      activities: [{
        activityName: "Summon Chosen Ally",
        type: "summon",
        chargeCost: 3
      }],
      summonProfiles: [
        { profileName: "Skeleton", actor: actor("Skeleton") },
        { profileName: "Zombie", actor: actor("Zombie") }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].utilityActivities[0].chargeCost, 4);
  assert.equal(result.specs[0].summonActivity.chargeCost, 4);
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
  assert.equal(unresolvedCategories.has("summon"), false);
  assert.equal(unresolvedCategories.has("lightToggle"), true);
  assert.equal(unresolvedCategories.has("namedSpell"), true);
  assert.equal(result.specs[0].summonProfiles[0].actor.srdActorName, "Wolf");
  assert.equal(result.warnings.includes("A requested summon was not preserved in the generated Foundry structure."), false);
  assert.equal(result.warnings.includes("Specific named spells were reduced to generic utility placeholders."), true);
});

test("malformed no-save aura damage is rerouted to anchored manual review", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare halberd called Stunning Halberd. It has a first-attack Constitution save and a radiant aura that deals damage to hostile creatures starting their turn inside it. The aura originates from the wielder's actor token."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Stunning Halberd",
      description: "A halberd with a stunning strike and radiant aura.",
      weaponType: "martialM",
      baseItem: "halberd",
      damage: { base: { number: 1, denomination: 10, bonus: "@mod", types: ["slashing"] } },
      extraDamageParts: [{ number: 1, denomination: 4, bonus: "", types: ["cold"] }],
      saveActivities: [
        {
          activityId: "StunSave00000001",
          activityName: "Stunning Strike",
          save: { ability: "con", dc: 13 },
          target: { affects: { type: "creature", count: "1" }, prompt: true }
        },
        {
          activityId: "AuraDamage000001",
          activityName: "Radiant Aura",
          save: "none",
          damageParts: [{ number: 2, denomination: 6, bonus: "", types: ["radiant"] }],
          target: { template: { type: "sphere", size: 20, units: "ft" }, prompt: true }
        }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.saveActivities.length, 1);
  assert.equal(spec.saveActivities[0].activityName, "Stunning Strike");
  assert.equal(spec.utilityActivities.length, 1);
  assert.equal(spec.utilityActivities[0].activityName, "Radiant Aura");
  assert.equal(spec.utilityActivities[0].damageParts, undefined);
  assert.deepEqual(spec.utilityActivities[0].range, { value: null, units: "self" });
  assert.deepEqual(spec.utilityActivities[0].target.affects, { type: "self", count: "1", special: "Wielder's actor token" });
  assert.equal(spec.utilityActivities[0].target.prompt, false);
  assert.equal(new Set(spec.unresolvedMechanics.map(mechanic => mechanic.category)).has("allyAura"), true);
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

test("shared activity save payloads do not receive a stale save-damage review note", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Cinderfrost Staff. It has 8 charges. Spend 2 charges to cast Burning Hands in a 15-foot cone for 3d6 fire damage, or 3 charges to cast Shatter for 3d8 thunder damage."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Cinderfrost Staff",
      description: "A staff with two charged save activities.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "recoverAll", formula: "" }] },
      activities: [
        {
          activityName: "Burning Hands",
          chargeCost: 2,
          save: { ability: "dex", dc: 15 },
          damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]
        },
        {
          activityName: "Shatter",
          chargeCost: 3,
          save: { ability: "con", dc: 15 },
          damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]
        }
      ]
    }]
  }, request, { makeId: ids() });

  assert.equal((result.specs[0].unresolvedMechanics ?? []).some(mechanic => mechanic.category === "saveDamage"), false);
});

test("named Burning Hands recovers its concrete save and cone damage payload", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Cinderfrost Staff. It has 8 charges. Spend 2 charges to cast Burning Hands in a 15-foot cone for 3d6 fire damage, or 3 charges to cast Shatter for 3d8 thunder damage."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Cinderfrost Staff",
      description: "A staff with two named spell activities.",
      utilityActivities: [
        { activityName: "Burning Hands", save: { ability: "dex", dc: 15 } },
        { activityName: "Shatter", save: { ability: "con", dc: 15 } }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.saveActivities.length, 2);
  assert.deepEqual(spec.saveActivities.map(activity => activity.activityName).sort(), ["Cast Burning Hands", "Cast Shatter"]);
  const burningHands = spec.saveActivities.find(activity => activity.activityName === "Cast Burning Hands");
  assert.deepEqual(burningHands.damageParts, [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]);
  assert.equal((spec.unresolvedMechanics ?? []).some(mechanic => mechanic.category === "saveDamage"), false);
});

test("nested hybrid automation payloads are promoted to trusted canonical routes", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an artifact halberd called Winter's Mercy. On a hit, the target must make a DC 17 Constitution save or be restrained for 1 round. As a bonus action, it emits 20 feet of bright light and 20 feet of dim light.",
    context: {
      ...envelope().context,
      automationCapabilities: {
        version: "1.0",
        supportedRecipes: ["conditionOnHit", "selfTargetLight"],
        supportedTemplates: ["workflow-condition-rider", "self-token-light-toggle"],
        activeModules: ["midi-qol", "itemacro"],
        settings: { midiQolAutomation: true, itemMacroAutomation: true },
        routes: []
      }
    }
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Winter's Mercy",
      description: "A halberd with a condition rider and self-sourced light.",
      utilityActivities: [
        {
          activityName: "Ignite or Extinguish",
          automation: { recipe: "selfTargetLight" },
          toggleLight: { brightLight: 20, dimLight: 20, toggleState: "toggle" }
        },
        {
          activityName: "Freezing Sweep",
          onHitRiders: [{
            recipe: "conditionOnHit",
            condition: "restrained",
            save: { ability: "con", dc: 17 },
            durationSeconds: 6
          }]
        }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.conditionOnHit.condition, "restrained");
  assert.equal(spec.conditionOnHit.save.ability, "con");
  assert.equal(spec.toggleLight.bright, 20);
  assert.equal(spec.toggleLight.dim, 20);
  assert.deepEqual(
    [...new Set([spec.automation, ...(spec.automationRoutes ?? [])].map(route => route.recipe))],
    ["conditionOnHit", "selfTargetLight"]
  );
  assert.equal((spec.unresolvedMechanics ?? []).some(mechanic => ["lightToggle", "saveDamage"].includes(mechanic.category)), false);
});

test("explicit hybrid hit riders are recovered when the model omits the rider payload", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an artifact halberd called Winter's Mercy. It is a +3 halberd. When it hits a creature, the target must make a DC 17 Constitution saving throw or become restrained until the end of the wielder's next turn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Winter's Mercy",
      description: "A frozen halberd.",
      utilityActivities: [{ activityName: "Condition Rider" }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.deepEqual(spec.conditionOnHit, {
    condition: "restrained",
    save: { ability: "con", dc: 17 },
    durationSeconds: 6
  });
  assert.equal((spec.unresolvedMechanics ?? []).some(mechanic => mechanic.category === "conditionOnHit"), false);
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
  assert.deepEqual(spec.uses.recovery, []);
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

test("weapon-shaped flask output is rerouted to a consumable attack suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon acid flask. As an action, throw it at one creature within 20 feet. On a hit, the target takes 2d6 acid damage. The flask is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponExtraDamage",
      name: "Acid Flask",
      description: "A thrown flask.",
      weaponType: "simpleR",
      baseItem: "flask",
      damage: { base: { number: 1, denomination: 4, bonus: "@mod", types: ["bludgeoning"] } },
      extraDamageParts: [{ number: 2, denomination: 6, bonus: "", types: ["acid"] }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "equipmentPowerSuite");
  assert.equal(spec.itemType, "consumable");
  assert.equal(spec.uses.autoDestroy, true);
  assert.equal(spec.attackActivities.length, 1);
  assert.equal(spec.attackActivities[0].range.value, 20);
  assert.equal(spec.attackActivities[0].target.prompt, true);
  assert.equal(spec.magicalBonus, "");
});

test("weapon-shaped grenade save output is rerouted to charged save damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare grenade. As an action, throw it to a point within 60 feet. Each creature in a 10-foot-radius sphere must make a DC 15 Dexterity saving throw, taking 4d6 fire damage on a failed save, or half as much on a success. The grenade is consumed after one use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Pyre Grenade",
      description: "A thrown explosive.",
      weaponType: "simpleR",
      baseItem: "grenade",
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "chargedSaveDamage");
  assert.equal(spec.itemType, "consumable");
  assert.equal(spec.range.value, 60);
  assert.equal(spec.target.template.size, 10);
  assert.equal(spec.target.prompt, true);
});

test("explicit armor chassis overrides a contradictory shield model output", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare suit of half plate called Ashen Bulwark. It is +1 half plate armor, not a shield, and grants resistance to fire damage while equipped. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "shieldArmorBonus",
      name: "Ashen Bulwark",
      description: "A magic shield.",
      armorValue: 2,
      magicalBonus: "1",
      baseItem: "shield",
      equipmentType: "shield"
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.baseItem, "halfplate");
  assert.equal(spec.equipmentType, "medium");
  assert.equal(spec.armorValue, 15);
  assert.equal(spec.effects[0].changes.some(change => change.key === "system.traits.dr.value" && change.value === "fire"), true);
});

test("legendary armor with spell and summon powers remains an equipment suite", () => {
  const request = validateForgeRequest(envelope({
    request: "Create legendary +2 plate armor called Bastion of the Quiet World. It has 18 charges and regains 1d10 + 8 charges at dawn. While attuned, it grants resistance to force and psychic damage. Spend 8 charges to cast Antimagic Field, 8 charges to cast Power Word Stun, or 5 charges to summon a friendly Elephant for 1 hour."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeSummon",
      name: "Bastion of the Quiet World",
      description: "Legendary plate armor with spells and a summoned ally.",
      baseItem: "plate",
      rarity: "legendary",
      magicalBonus: "2",
      uses: { max: "18", recovery: [{ period: "dawn", type: "formula", formula: "1d10 + 8" }] },
      effects: [{
        name: "Quiet World Ward",
        changes: [{ key: "system.traits.dr.value", mode: "CUSTOM", value: "force,psychic" }]
      }],
      saveActivities: [
        { activityName: "Antimagic Field", chargeCost: 8 },
        { activityName: "Power Word Stun", chargeCost: 8 }
      ],
      summonActivity: { activityName: "Summon Elephant", chargeCost: 5 },
      summonActor: {
        name: "Friendly Elephant",
        type: "npc",
        ac: 12,
        hp: { value: 76, max: 76 },
        srdActorName: "Elephant",
        requireSrdActor: false
      }
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "legendaryEquipmentSuite");
  assert.equal(spec.baseItem, "plate");
  assert.equal(spec.equipmentType, "heavy");
  assert.equal(spec.armorValue, 18);
  assert.equal(spec.magicalBonus, "2");
  assert.deepEqual(spec.utilityActivities.map(activity => activity.activityName), ["Antimagic Field", "Power Word Stun"]);
  assert.equal(spec.summonActivity.activityName, "Summon Elephant");
  assert.equal(spec.summonProfiles[0].actor.srdActorName, "Elephant");
});

test("explicit passive resistance is restored when the model only returns AC", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare cloak called Cloak of the Stormwatch. While worn, it grants +1 AC and resistance to lightning damage. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "passiveEffectEquipment",
      name: "Cloak of the Stormwatch",
      description: "A protective cloak.",
      effects: [{ name: "Stormwatch Guard", changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }] }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].effects[0].changes.some(change => change.key === "system.traits.dr.value" && change.value === "lightning"), true);
});

test("attack-and-damage trinkets cannot be normalized into AC shields", () => {
  const request = validateForgeRequest(envelope({
    request: "Make a trinket that gives +3 to attack and damage rolls when attuned."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "shieldArmorBonus",
      name: "Aegis of Guarding",
      description: "A mistaken shield result.",
      armorValue: 2,
      magicalBonus: "3"
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "passiveEffectEquipment");
  assert.equal(result.specs[0].equipmentType, "wondrous");
  assert.equal(result.specs[0].attunement, "required");
  assert.deepEqual(result.specs[0].effects[0].changes, [
    { key: "system.bonuses.mwak.attack", mode: "ADD", value: "3" },
    { key: "system.bonuses.rwak.attack", mode: "ADD", value: "3" },
    { key: "system.bonuses.mwak.damage", mode: "ADD", value: "3" },
    { key: "system.bonuses.rwak.damage", mode: "ADD", value: "3" }
  ]);
});

test("explicit healing formula replaces a generic healing consumable payload", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon potion called Bloomdraught. As an action, a creature can drink it to regain 3d4 + 3 hit points. It has 1 use and is consumed after drinking."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Bloomdraught",
      description: "A healing potion.",
      uses: { max: "1", recovery: [], autoDestroy: true },
      healing: { number: 1, denomination: 4, bonus: "", types: ["healing"] }
    }]
  }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].healing, { number: 3, denomination: 4, bonus: "+3", types: ["healing"] });
});

test("non-healing spell tonics recover from charged healing model drift", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon one-use tonic called Clearblood Tonic. Drinking it takes an action and casts Lesser Restoration on the drinker. The tonic is consumed after use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Clearblood Tonic",
      description: "A cleansing tonic.",
      uses: { max: "1", recovery: [], autoDestroy: true },
      healing: { number: null, denomination: null, bonus: "", types: ["healing"] }
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "casterUtilityEquipment");
  assert.equal(spec.itemType, "consumable");
  assert.equal(spec.uses.autoDestroy, true);
  assert.equal(spec.utilityActivities[0].activityName, "Cast Lesser Restoration");
  assert.equal(spec.utilityActivities[0].target.affects.type, "self");
  assert.equal("healing" in spec, false);
});

test("spell consumable recovery does not reroute explicit hit-point healing", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a one-use potion called Restoring Draught. It casts a restoring charm and heals 2d4 + 2 hit points."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedHealing",
      name: "Restoring Draught",
      description: "A healing potion.",
      uses: { max: "1", recovery: [], autoDestroy: true },
      healing: { number: 2, denomination: 4, bonus: "2", types: ["healing"] }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "chargedHealing");
  assert.equal(result.specs[0].healing.denomination, 4);
});

test("charge recovery is not recorded as a missing healing payload", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a wand with 6 charges. Spend 3 charges to cast Fireball at DC 15. Regain 1d6 charges at dawn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Wand of Fireball",
      description: "A wand of flame.",
      uses: { max: "6", recovery: [{ period: "dawn", type: "formula", formula: "1d6" }] },
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["fire"] }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].unresolvedMechanics?.some(mechanic => mechanic.category === "healing") ?? false, false);
});

test("wand save-and-template request becomes a save activity instead of on-hit weapon damage", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare wand called Wand of Searing Hail. It has 6 charges and regains 1d6 charges daily at dawn. As an action, the wielder can force creatures in a 15-foot cone to make a DC 14 Dexterity saving throw, taking 4d6 fire damage on a failed save or half as much on a success."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Wand of Searing Hail",
      description: "A wand that deals extra fire damage.",
      uses: { max: "6", recovery: [{ period: "dawn", type: "formula", formula: "1d6" }] },
      extraDamageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "chargedSaveDamage");
  assert.equal(spec.equipmentType, "wand");
  assert.equal(spec.save.ability, "dex");
  assert.equal(spec.save.dc, 14);
  assert.equal(spec.target.template.type, "cone");
  assert.equal(spec.target.template.size, 15);
  assert.equal(spec.damageParts[0].types[0], "fire");
});

test("wand save activity survives the layered Forge brief", () => {
  const request = validateForgeRequest(envelope({
    request: `Item name: Wand of Searing Hail

Complexity layer 1 - Base chassis
Base item: Wand
Rarity: Rare

Complexity layer 3 - Resource model
Spell usage: uses charges
Charges: 6 charges; regains 1d6

Complexity layer 4 - Named activities
Activation: Action
Saving throw: Dexterity DC 14
Damage on failed save: 4d6 fire; half damage on success
Charge cost: 1
Area: 15-foot cone`
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "artifactWeaponHybrid",
      name: "Wand of Searing Hail",
      description: "A wand that deals extra fire damage.",
      uses: { max: "6", recovery: [{ period: "dawn", type: "formula", formula: "1d6" }] },
      extraDamageParts: [{ number: 4, denomination: 6, bonus: "", types: ["fire"] }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "chargedSaveDamage");
  assert.equal(spec.save.ability, "dex");
  assert.equal(spec.save.dc, 14);
  assert.equal(spec.target.template.type, "cone");
  assert.equal(spec.target.template.size, 15);
});

test("explicit spellcaster utility prompts promote passive model output and recover Detect Thoughts", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare circlet called Circlet of Quiet Sight. While worn, it grants +1 to spell attack rolls and spell save DC. It also lets the wearer cast Detect Thoughts once per long rest. It requires attunement by a spellcaster."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "passiveEffectEquipment",
      name: "Circlet of Quiet Sight",
      description: "A circlet that sharpens magical perception.",
      effects: [{ name: "Quiet Sight", changes: [{ key: "system.bonuses.rsak.attack", mode: "ADD", value: "1" }] }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "casterUtilityEquipment");
  assert.equal(spec.uses.max, "1");
  assert.equal(spec.uses.recovery[0].period, "lr");
  assert.equal(spec.utilityActivities[0].activityName, "Cast Detect Thoughts");
  assert.equal(spec.utilityActivities[0].duration.concentration, true);
});

test("mixed staff spell payloads are rerouted before malformed shared saves reach validation", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare quarterstaff called Shepherd's Reliquary. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, the wielder can spend 1 charge to restore 2d8 + 2 hit points to a creature they touch, spend 2 charges to cast Shatter at DC 14, or spend 3 charges to summon a friendly wolf for 1 hour. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Shepherd's Reliquary",
      description: "A staff of restorative and summoning magic.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
      activities: [
        { activityName: "Restore Vitality" },
        { activityName: "Cast Shatter", save: null },
        { activityName: "Summon Friendly Wolf" }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "equipmentPowerSuite");
  assert.equal(spec.saveActivities[0].activityName, "Cast Shatter");
  assert.deepEqual(spec.saveActivities[0].save, { ability: "con", dc: 14 });
  assert.deepEqual(spec.saveActivities[0].damageParts, [{ number: 3, denomination: 8, bonus: "", types: ["thunder"] }]);
  assert.equal(spec.utilityActivities.some(activity => activity.healing?.denomination === 8), true);
  assert.equal(spec.summonProfiles[0].actor.name, "Friendly Wolf");
});

test("mixed utility and save spell staff activities are rerouted before validation", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare scepter called Winter's Verdict. It requires attunement by a spellcaster and has 12 charges, regaining 1d6 + 6 at dawn. As an action, spend 3 charges to cast Sleet Storm, 4 charges to cast Ice Storm at DC 16, or 5 charges to cast Cone of Cold at DC 16."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Winter's Verdict",
      description: "A scepter that holds the violence of a winter storm.",
      uses: { max: "12", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 6" }] },
      activities: [
        { activityName: "Cast Sleet Storm", chargeCost: 3 },
        {
          activityName: "Cast Ice Storm",
          chargeCost: 4,
          save: { ability: "dex", dc: 16 },
          damageParts: [
            { number: 2, denomination: 8, bonus: "", types: ["bludgeoning"] },
            { number: 4, denomination: 6, bonus: "", types: ["cold"] }
          ]
        },
        {
          activityName: "Cast Cone of Cold",
          chargeCost: 5,
          save: { ability: "con", dc: 16 },
          damageParts: [{ number: 8, denomination: 8, bonus: "", types: ["cold"] }]
        }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "equipmentPowerSuite");
  assert.equal(spec.utilityActivities[0].activityName, "Cast Sleet Storm");
  assert.deepEqual(spec.saveActivities.map(activity => activity.activityName), ["Cast Ice Storm", "Cast Cone of Cold"]);
});

test("explicit named spell charge costs override model drift", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare rod called Cinderweb Rod. Spend 2 charges to cast Web at DC 15 or 3 charges to cast Scorching Ray."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "casterUtilityEquipment",
      name: "Cinderweb Rod",
      description: "A charged spell rod.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
      saveActivities: [{
        activityName: "Cast Web",
        chargeCost: 1,
        save: { ability: "dex", dc: 15 },
        damageParts: []
      }],
      utilityActivities: [{ activityName: "Cast Scorching Ray", chargeCost: 2 }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.saveActivities[0].chargeCost, 2);
  assert.equal(spec.utilityActivities[0].chargeCost, 3);
});

test("malformed non-damaging save activities are rerouted to utility activities", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a legendary staff called Meridian Breaker. Spend 4 charges to cast Wall of Fire, 6 charges to cast Disintegrate, or 7 charges to cast Teleport."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Meridian Breaker",
      description: "A staff with three charged spells.",
      uses: { max: "15", recovery: [{ period: "dawn", type: "formula", formula: "1d8 + 4" }] },
      saveActivities: [
        {
          activityName: "Cast Wall of Fire",
          save: { ability: "dex", dc: 17 },
          damageParts: [{ number: 5, denomination: 8, bonus: "", types: ["fire"] }]
        },
        {
          activityName: "Cast Disintegrate",
          save: { ability: "dex", dc: 17 },
          damageParts: [{ number: 10, denomination: 6, bonus: "40", types: ["force"] }]
        },
        { activityName: "Cast Teleport", save: {} }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.deepEqual(spec.saveActivities.map(activity => activity.activityName), ["Cast Wall of Fire", "Cast Disintegrate"]);
  assert.equal(spec.utilityActivities[0].activityName, "Cast Teleport");
  assert.equal("save" in spec.utilityActivities[0], false);
});

test("malformed non-damaging attack activities are rerouted to save or utility activities", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare weapon called Ashen Mercy. On a hit the target must succeed on a DC 14 Constitution saving throw or be blinded until the end of its next turn. It can also restore 2d8 hit points to one creature you touch."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Ashen Mercy",
      description: "A weapon with a rider and a healing touch.",
      attackActivities: [
        {
          activityName: "Blinding Strike",
          save: { ability: "con", dc: 14 },
          damageParts: []
        },
        {
          activityName: "Healing Touch",
          healing: { number: 2, denomination: 8, bonus: "", types: ["healing"] },
          target: { affects: { count: "1", type: "creature" }, prompt: true },
          damageParts: []
        }
      ]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.deepEqual(spec.attackActivities ?? [], []);
  assert.deepEqual(spec.saveActivities.map(activity => activity.activityName), ["Blinding Strike"]);
  assert.equal(spec.utilityActivities[0].activityName, "Healing Touch");
  assert.deepEqual(spec.utilityActivities[0].healing, { number: 2, denomination: 8, bonus: "", types: ["healing"] });
});

test("malformed damaging save activities still fail closed", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare rod called Unsafe Rod that deals 3d8 force damage on a failed save."
  }));

  assert.throws(() => normalizeModelOutput({
    specs: [{
      kind: "equipmentPowerSuite",
      name: "Unsafe Rod",
      description: "A malformed damaging power.",
      saveActivities: [{
        activityName: "Force Burst",
        save: {},
        damageParts: [{ number: 3, denomination: 8, bonus: "", types: ["force"] }]
      }]
    }]
  }, request, { makeId: ids() }), /saveActivities\[0\]\.save\.ability/);
});

test("incomplete explicit fiend profile choices recover the supported SRD trio", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare idol called Gatekeeper's Token. It can summon a friendly fiend for 1 hour; choose Demon, Devil, or Yugoloth. It is consumed after use."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeMultiProfileSummon",
      name: "Gatekeeper's Token",
      description: "An idol that opens a brief fiendish gate.",
      uses: { max: "1", recovery: [] },
      summonProfiles: [{ profileName: "Demon" }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "nativeMultiProfileSummon");
  assert.deepEqual(spec.summonProfiles.map(profile => profile.profileName), ["Demon", "Devil", "Yugoloth"]);
  assert.deepEqual(spec.summonProfiles.map(profile => profile.actor.srdActorName), ["Quasit", "Imp", "Mezzoloth"]);
});

test("explicit fiend choices replace generic model actors in complete profile output", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a censer that can call in a friendly fiend for 1 hour; choose Demon, Devil, or Yugoloth."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "nativeMultiProfileSummon",
      name: "Fiend Censer",
      description: "A censer with three selectable fiend profiles.",
      uses: { max: "1", recovery: [{ type: "longRest" }] },
      summonProfiles: [
        { profileName: "Demon", actor: { name: "Demon", srdActorName: "Demon" } },
        { profileName: "Devil", actor: { name: "Devil", srdActorName: "Devil" } },
        { profileName: "Yugoloth", actor: { name: "Fiend", srdActorName: "Fiend" } }
      ]
    }]
  }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].summonProfiles.map(profile => profile.actor.srdActorName), ["Quasit", "Imp", "Mezzoloth"]);
});

test("pure fiend profile summons recover from generic equipment suite routing", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare censer called Back-Alley Pact Burner. Pop it once per long rest with an action to call in a friendly fiend for 1 hour. Pick demon, devil, or yugoloth when it shows up. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "legendaryEquipmentSuite",
      name: "Back-Alley Pact Burner",
      description: "A censer that summons one of three friendly fiends.",
      uses: { max: "1", recovery: [{ type: "longRest" }] },
      utilityActivities: [{
        activityName: "Summon Friendly Fiend",
        activationType: "action",
        duration: { seconds: 3600 }
      }],
      summonProfiles: [
        { profileName: "Demon", actor: { name: "Friendly Demon", srdActorName: "Quasit" } },
        { profileName: "Devil", actor: { name: "Friendly Devil", srdActorName: "Imp" } },
        { profileName: "Yugoloth", actor: { name: "Friendly Yugoloth", srdActorName: "Mezzoloth" } }
      ],
      summonActivity: { activityName: "Summon Ally" }
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "nativeMultiProfileSummon");
  assert.equal(spec.activationType, "action");
  assert.equal(spec.duration, 3600);
  assert.equal(spec.utilityActivities, undefined);
  assert.deepEqual(spec.summonProfiles.map(profile => profile.actor.srdActorName), ["Quasit", "Imp", "Mezzoloth"]);
});

test("explicit charged spell attacks recover an empty suite response", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a very rare mask called Mask of the Soul Lance. It has 5 charges and regains 1d4 + 1 charges daily at dawn. As an action, the wearer can spend 1 charge to make a ranged spell attack against one creature within 90 feet, dealing 4d8 psychic damage on a hit. It requires attunement."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "legendaryEquipmentSuite",
      name: "Mask of the Soul Lance",
      description: "A mask containing a focused psychic power."
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "equipmentPowerSuite");
  assert.equal(spec.uses.max, "5");
  assert.equal(spec.uses.recovery[0].period, "dawn");
  assert.equal(spec.attackActivities[0].attackType, "ranged");
  assert.equal(spec.attackActivities[0].attackClassification, "spell");
  assert.equal(spec.attackActivities[0].chargeCost, 1);
  assert.deepEqual(spec.attackActivities[0].damageParts, [{ number: 4, denomination: 8, bonus: "", types: ["psychic"] }]);
  assert.deepEqual(spec.attackActivities[0].range, { value: 90, units: "ft" });
});

test("named utility spells recover an empty multi-activity rod response", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare rod called Stillwater Rod. It has 6 charges and regains 1d4 + 2 charges daily at dawn. As an action, spend 3 charges to cast Slow at DC 15. It requires attunement by a spellcaster."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Stillwater Rod",
      description: "A charged rod that casts Slow.",
      uses: { max: "6", recovery: [{ period: "dawn", type: "formula", formula: "1d4 + 2" }] }
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "casterUtilityEquipment");
  assert.equal(spec.saveActivities[0].activityName, "Cast Slow");
  assert.equal(spec.saveActivities[0].chargeCost, 3);
  assert.equal(spec.saveActivities[0].save.dc, 15);
});

test("named damaging save spells recover an empty multi-activity wand response", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare wand called Icevein Wand. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, spend 4 charges to cast Ice Storm at DC 16. It requires attunement by a spellcaster."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Icevein Wand",
      description: "A charged wand that casts Ice Storm.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] }
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "casterUtilityEquipment");
  assert.equal(spec.saveActivities[0].activityName, "Cast Ice Storm");
  assert.equal(spec.saveActivities[0].chargeCost, 4);
  assert.deepEqual(spec.saveActivities[0].save, { ability: "dex", dc: 16 });
  assert.deepEqual(spec.saveActivities[0].damageParts, [
    { number: 2, denomination: 8, bonus: "", types: ["bludgeoning"] },
    { number: 4, denomination: 6, bonus: "", types: ["cold"] }
  ]);
  assert.deepEqual(spec.saveActivities[0].range, { value: 300, units: "ft" });
});

test("named damaging wand spells reroute when a staff response omits shared activities", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare wand called Icevein Wand. It has 8 charges and regains 1d6 + 2 charges daily at dawn. As an action, spend 4 charges to cast Ice Storm at DC 16. It requires attunement by a spellcaster."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Icevein Wand",
      description: "A charged wand that casts Ice Storm.",
      uses: { max: "8", recovery: [{ period: "dawn", type: "formula", formula: "1d6 + 2" }] },
      saveActivities: [{
        activityName: "Cast Ice Storm",
        activationType: "action",
        chargeCost: 4,
        save: { ability: "dex", dc: 16 },
        damageParts: [
          { number: 2, denomination: 8, bonus: "", types: ["bludgeoning"] },
          { number: 4, denomination: 6, bonus: "", types: ["cold"] }
        ]
      }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.kind, "casterUtilityEquipment");
  assert.equal(spec.saveActivities.length, 1);
  assert.equal(spec.saveActivities[0].activityName, "Cast Ice Storm");
  assert.equal(spec.saveActivities[0].chargeCost, 4);
});

test("named non-damaging save spells are canonicalized from utility model drift", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare rod called Stillwater Rod. It has 6 charges and regains 1d4 + 2 charges daily at dawn. As an action, spend 3 charges to cast Slow at DC 15. It requires attunement by a spellcaster."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "casterUtilityEquipment",
      name: "Stillwater Rod",
      description: "A charged rod that casts Slow.",
      uses: { max: "6", recovery: [{ period: "dawn", type: "formula", formula: "1d4 + 2" }] },
      utilityActivities: [{
        activityName: "Slow",
        activationType: "action",
        chargeCost: 3,
        save: { ability: "dex", dc: 15 },
        spell: "slow"
      }]
    }]
  }, request, { makeId: ids() });

  const spec = result.specs[0];
  assert.equal(spec.utilityActivities.length, 0);
  assert.equal(spec.saveActivities[0].activityName, "Cast Slow");
  assert.deepEqual(spec.saveActivities[0].save, { ability: "wis", dc: 15 });
  assert.deepEqual(spec.saveActivities[0].damageParts, []);
  assert.deepEqual(spec.saveActivities[0].range, { value: 120, units: "ft" });
  assert.equal(spec.saveActivities[0].duration.concentration, true);
});

test("condition riders preserve an explicit creature-type filter", () => {
  const request = validateForgeRequest(envelope({
    request: "Create an uncommon +1 mace called Gravebell. On a hit against an undead creature, the target makes a DC 13 Wisdom save. On a failure it is frightened for 1 minute."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponConditionOnHit",
      name: "Gravebell",
      conditionOnHit: {
        condition: "frightened",
        save: { ability: "wis", dc: 13 },
        durationSeconds: 60
      }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].conditionOnHit.targetCreatureType, "undead");
});

test("recovery formulas are translated before they reach the Foundry schema", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Winter's Mercy. It has 12 charges and regains 1 d6 + 6 charges daily at dawn."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "chargedSaveDamage",
      name: "Winter's Mercy",
      description: request.request,
      itemType: "equipment",
      equipmentType: "wand",
      baseItem: "wand",
      save: { ability: "dex", dc: 14 },
      damageParts: [{ number: 1, denomination: 6, bonus: "", types: ["cold"] }],
      uses: { max: "12", recovery: [{ period: "dawn", type: "formula", formula: "1 d6 + 6 charges" }] }
    }]
  }, request, { makeId: ids() });

  assert.deepEqual(result.specs[0].uses.recovery, [{ period: "dawn", type: "formula", formula: "1d6 + 6" }]);
});

test("light-bearing weapon output is promoted to the hybrid renderer", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a +3 greatsword called Dawncoil Oathblade. It deals an extra 1d8 radiant damage on every hit. As a bonus action, ignite or extinguish it; the wielder's actor token emits 20 feet of bright light and 20 additional feet of dim light."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponExtraDamage",
      name: "Dawncoil Oathblade",
      baseItem: "greatsword",
      weaponType: "martialM",
      magicalBonus: 3,
      damage: { base: { number: 2, denomination: 6, bonus: "", types: ["slashing"] } },
      extraDamageParts: [{ number: 1, denomination: 8, bonus: "", types: ["radiant"] }],
      utilityActivities: [{
        activityName: "Ignite or Extinguish Blade",
        automation: { recipe: "selfTargetLight" },
        toggleLight: { brightLight: 20, dimLight: 40, duration: "toggle", toggleState: "reversible" }
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "artifactWeaponHybrid");
});

test("nested lightToggle aliases are promoted to canonical self-light metadata", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a +3 greatsword called Dawncoil Oathblade. It deals extra radiant damage and can ignite or extinguish, emitting bright and dim light from the wielder's actor token."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "weaponExtraDamage",
      name: "Dawncoil Oathblade",
      baseItem: "greatsword",
      damage: { base: { number: 2, denomination: 6, bonus: "", types: ["slashing"] } },
      extraDamageParts: [{ number: 1, denomination: 8, bonus: "", types: ["radiant"] }],
      utilityActivities: [{
        activityName: "Ignite or Extinguish",
        templateId: "self-token-light-toggle",
        lightToggle: { brightLight: 20, dimLight: 40, duration: "special", toggleState: "toggle" }
      }]
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].kind, "artifactWeaponHybrid");
  assert.equal(result.specs[0].toggleLight.brightLight, 20);
});

test("object-wrapped automation recipe labels are translated before validation", () => {
  const request = validateForgeRequest(envelope({
    request: "Create a rare staff called Cinderfrost Staff. It has 8 charges and can cast Burning Hands."
  }));
  const result = normalizeModelOutput({
    specs: [{
      kind: "multiActivityStaff",
      name: "Cinderfrost Staff",
      baseItem: "staff",
      uses: { max: "8", recovery: [{ period: "lr", type: "recoverAll", formula: "" }] },
      activities: [{
        activityName: "Cast Burning Hands",
        chargeCost: 2,
        save: { ability: "dex", dc: 15 },
        damageParts: [{ number: 3, denomination: 6, bonus: "", types: ["fire"] }]
      }],
      automation: { recipe: { recipe: "multiActivityResource" } }
    }]
  }, request, { makeId: ids() });

  assert.equal(result.specs[0].automation.recipe, "multiActivityResource");
});
