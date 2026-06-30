import assert from "node:assert/strict";
import test from "node:test";
import { chooseModel, compileWithOpenAI, outputText, parseModelJson } from "../src/adapters/openai.mjs";
import { validateForgeRequest } from "../src/contract.mjs";
import { config, envelope } from "./helpers.mjs";

test("model overrides must be explicitly allowed", () => {
  const request = validateForgeRequest(envelope({ options: { model: "gpt-5.5", unresolvedPolicy: "review" } }));
  assert.throws(() => chooseModel(request, config()), /not allowed/);
});

test("OpenAI adapter uses Responses API JSON mode without leaking the key into the body", async () => {
  const request = validateForgeRequest(envelope());
  let captured;
  const result = await compileWithOpenAI(request, {
    config: config(),
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        output: [{ content: [{
          type: "output_text",
          text: JSON.stringify({ specs: [{ kind: "weaponExtraDamage", name: "AI Ember Blade" }], assumptions: [], warnings: [], deferred: [] })
        }] }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.init.headers.Authorization, "Bearer test-openai-key");
  assert.equal(captured.body.model, "gpt-5.4-mini");
  assert.deepEqual(captured.body.text, { format: { type: "json_object" } });
  assert.equal(captured.body.store, false);
  assert.ok(!captured.init.body.includes("test-openai-key"));
  assert.equal(result.specs[0].name, "AI Ember Blade");
});

test("raw output helpers support SDK and REST response shapes", () => {
  assert.equal(outputText({ output_text: "{\"ok\":true}" }), "{\"ok\":true}");
  assert.deepEqual(parseModelJson("```json\n{\"ok\":true}\n```"), { ok: true });
});

test("upstream provider bodies are not exposed in service errors", async () => {
  const request = validateForgeRequest(envelope());
  await assert.rejects(() => compileWithOpenAI(request, {
    config: config(),
    fetchImpl: async () => new Response("private provider detail", { status: 500 })
  }), error => error.code === "openai_error" && !error.message.includes("private provider detail"));
});
