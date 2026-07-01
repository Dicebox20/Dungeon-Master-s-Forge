import assert from "node:assert/strict";
import test from "node:test";
import { createCompiler } from "../src/compiler.mjs";
import { PROMPT_VERSION } from "../src/constants.mjs";
import { ids, validSpecs } from "./fixtures/valid-specs.mjs";
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
