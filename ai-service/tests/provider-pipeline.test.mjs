import assert from "node:assert/strict";
import test from "node:test";
import { createCompiler } from "../src/compiler.mjs";
import { PROMPT_VERSION } from "../src/constants.mjs";
import { ServiceError } from "../src/errors.mjs";
import { actor, damage, ids, validSpecs } from "./fixtures/valid-specs.mjs";
import { config, envelope } from "./helpers.mjs";

function responsesFetch(output, captures = []) {
  return async (url, init) => {
    captures.push({ url, body: JSON.parse(init.body), authorization: init.headers.Authorization });
    return new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

test("all fourteen Forge families survive the complete mocked provider pipeline", async () => {
  const captures = [];
  for (const spec of validSpecs) {
    const compile = createCompiler({
      config: config({ mode: "openai" }),
      fetchImpl: responsesFetch({ specs: [spec], assumptions: [], warnings: [], deferred: [] }, captures),
      makeId: ids()
    });
    const request = envelope({ request: `Item name: ${spec.name}\nCreate the requested test item.` });
    const result = await compile(request);
    assert.equal(result.specs[0].kind, spec.kind);
    assert.equal(result.specs[0].name, spec.name);
    assert.equal(result.promptVersion, PROMPT_VERSION);
    assert.equal(result.requestCount, 1);
  }

  assert.equal(captures.length, validSpecs.length);
  for (const capture of captures) {
    assert.equal(capture.url, "https://api.openai.com/v1/responses");
    assert.equal(capture.authorization, "Bearer test-openai-key");
    assert.equal(capture.body.store, false);
    assert.match(capture.body.input[0].content, new RegExp(`Prompt contract version: ${PROMPT_VERSION.replaceAll(".", "\\.")}`));
    assert.match(capture.body.input[1].content, /^Item name:/);
  }
});

test("unsafe provider output is rejected after a successful adapter response", async () => {
  const unsafe = { ...validSpecs[0], macroCommand: "return game.user;" };
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    fetchImpl: responsesFetch({ specs: [unsafe], assumptions: [], warnings: [], deferred: [] }),
    makeId: ids()
  });
  await assert.rejects(
    compile(envelope({ request: `Item name: ${unsafe.name}` })),
    error => error.status === 502 && error.code === "unsafe_model_output" && /macroCommand/.test(error.message)
  );
});

test("common live-model aliases are normalized before validation", async () => {
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    fetchImpl: responsesFetch({
      specs: [{
        name: "Alias Ember Dagger",
        type: "weaponExtraDamage",
        description: "Alias Ember Dagger description",
        weaponType: "simpleM",
        properties: ["finesse", "light", "thrown"],
        damage: {
          base: { number: 1, denomination: "d4", bonus: 0, types: ["piercing"] }
        },
        extraDamageParts: [
          { number: 1, denomination: "d4", bonus: 0, types: ["fire"] }
        ]
      }],
      assumptions: [],
      warnings: [],
      deferred: []
    }),
    makeId: ids()
  });

  const result = await compile(envelope({ request: "Item name: Alias Ember Dagger" }));
  assert.equal(result.specs[0].kind, "weaponExtraDamage");
  assert.deepEqual(result.specs[0].properties, ["fin", "lgt", "thr"]);
  assert.equal(result.specs[0].damage.base.denomination, 4);
  assert.equal(result.specs[0].extraDamageParts[0].denomination, 4);
  assert.equal(result.specs[0].damage.base.bonus, "");
});

test("malformed top-level generated IDs are replaced with service IDs", async () => {
  const spec = {
    ...validSpecs[7],
    activityId: "not-a-valid-activity-id",
    effectId: "bad-effect-id"
  };
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    fetchImpl: responsesFetch({ specs: [spec], assumptions: [], warnings: [], deferred: [] }),
    makeId: ids()
  });

  const result = await compile(envelope({ request: `Item name: ${spec.name}` }));
  assert.equal(result.specs[0].activityId, "0000000000000001");
  assert.equal(result.specs[0].effectId, "0000000000000002");
});

test("malformed nested generated IDs are replaced with service IDs", async () => {
  const spec = {
    kind: "equipmentPowerSuite",
    name: "Nested ID Suite",
    description: "Nested ID Suite description",
    effects: [{
      name: "Nested Ward",
      effectId: "effect-with-hyphen",
      changes: [{ key: "system.attributes.ac.bonus", mode: "ADD", value: "1" }]
    }],
    attackActivities: [{
      activityId: "attack with spaces",
      activityName: "Mind Lance",
      damageParts: [damage("psychic")]
    }],
    utilityActivities: [],
    saveActivities: [],
    summonActivity: {
      activityId: "summon-activity-id",
      activityName: "Summon Ally"
    },
    summonProfiles: [{
      profileId: "profile-id-too-long",
      profileName: "Wolf Ally",
      actor: actor("Wolf Ally")
    }]
  };
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    fetchImpl: responsesFetch({ specs: [spec], assumptions: [], warnings: [], deferred: [] }),
    makeId: ids()
  });

  const result = await compile(envelope({ request: `Item name: ${spec.name}` }));
  assert.equal(result.specs[0].attackActivities[0].activityId, "0000000000000001");
  assert.equal(result.specs[0].effects[0].effectId, "0000000000000002");
  assert.equal(result.specs[0].summonProfiles[0].profileId, "0000000000000003");
  assert.equal(result.specs[0].summonActivity.activityId, "0000000000000004");
});

test("artifact weapon hybrids may use activated powers without on-hit extra damage", async () => {
  const spec = {
    kind: "artifactWeaponHybrid",
    name: "Dagger that can cast fireball",
    description: "Dagger that can cast fireball description",
    weaponType: "simpleM",
    baseItem: "dagger",
    damage: {
      base: { number: 1, denomination: 4, bonus: "@mod", types: ["piercing"] }
    },
    uses: { max: "1", recovery: [{ period: "day", type: "recoverAll", formula: "" }] },
    saveActivities: [{
      activityName: "Cast Fireball",
      save: { ability: "dex", dc: 15 },
      damageParts: [{ number: 8, denomination: 6, bonus: "", types: ["fire"] }],
      target: { template: { type: "sphere", size: 20, units: "ft" } },
      range: { value: 150, units: "ft" }
    }]
  };
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    fetchImpl: responsesFetch({ specs: [spec], assumptions: [], warnings: [], deferred: [] }),
    makeId: ids()
  });

  const result = await compile(envelope({ request: `Item name: ${spec.name}` }));
  assert.equal(result.specs[0].kind, "artifactWeaponHybrid");
  assert.deepEqual(result.specs[0].extraDamageParts, undefined);
  assert.equal(result.specs[0].saveActivities[0].activityId, "0000000000000001");
});

test("contract-invalid model output receives one bounded retry", async () => {
  let attempts = 0;
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    openaiAdapter: async () => {
      attempts += 1;
      if (attempts === 1) throw new ServiceError(502, "invalid_model_output", "The first model output was incomplete.");
      return { specs: [validSpecs[0]], assumptions: [], warnings: [], deferred: [] };
    },
    makeId: ids()
  });

  const result = await compile(envelope({ request: `Item name: ${validSpecs[0].name}` }));
  assert.equal(attempts, 2);
  assert.equal(result.specs[0].name, validSpecs[0].name);
});

test("upstream service errors are not retried", async () => {
  let attempts = 0;
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    openaiAdapter: async () => {
      attempts += 1;
      throw new ServiceError(502, "openai_error", "OpenAI returned HTTP 500.");
    }
  });

  await assert.rejects(
    compile(envelope({ request: "Item name: Upstream Failure" })),
    error => error.code === "openai_error"
  );
  assert.equal(attempts, 1);
});

test("retryable model output stops after the second failed attempt", async () => {
  let attempts = 0;
  const compile = createCompiler({
    config: config({ mode: "openai" }),
    openaiAdapter: async () => {
      attempts += 1;
      throw new ServiceError(502, "invalid_model_json", "The model returned invalid JSON.");
    }
  });

  await assert.rejects(
    compile(envelope({ request: "Item name: Repeated Invalid Output" })),
    error => error.code === "invalid_model_json"
  );
  assert.equal(attempts, 2);
});