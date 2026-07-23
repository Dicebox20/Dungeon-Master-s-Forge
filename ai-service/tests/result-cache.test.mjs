import assert from "node:assert/strict";
import test from "node:test";
import { createCachedCompiler } from "../src/result-cache.mjs";

test("semantically identical payloads share a cached result", async () => {
  let calls = 0;
  const compile = async payload => ({ call: ++calls, payload });
  const cached = createCachedCompiler(compile, { ttlMs: 1000, maxEntries: 5 });
  const first = await cached({ request: "one", options: { b: 2, a: 1 } });
  const second = await cached({ options: { a: 1, b: 2 }, request: "one" });
  assert.equal(first.cacheStatus, "MISS");
  assert.equal(second.cacheStatus, "HIT");
  assert.equal(second.result.call, 1);
  assert.equal(calls, 1);
});

test("concurrent duplicate compilations are coalesced", async () => {
  let calls = 0;
  let release;
  const compile = () => {
    calls += 1;
    return new Promise(resolve => { release = resolve; });
  };
  const cached = createCachedCompiler(compile, { ttlMs: 1000, maxEntries: 5 });
  const first = cached({ request: "same" });
  await Promise.resolve();
  const second = cached({ request: "same" });
  release({ ok: true });
  const [left, right] = await Promise.all([first, second]);
  assert.equal(left.cacheStatus, "MISS");
  assert.equal(right.cacheStatus, "COALESCED");
  assert.equal(calls, 1);
});

test("expired entries are compiled again", async () => {
  let timestamp = 0;
  let calls = 0;
  const cached = createCachedCompiler(async () => ({ call: ++calls }), {
    ttlMs: 10,
    maxEntries: 5,
    now: () => timestamp
  });
  await cached({ request: "one" });
  timestamp = 11;
  const result = await cached({ request: "one" });
  assert.equal(result.cacheStatus, "MISS");
  assert.equal(calls, 2);
});

test("refresh requests replace completed cache entries but still coalesce in-flight work", async () => {
  let calls = 0;
  let releaseRefresh;
  const cached = createCachedCompiler(async input => {
    calls += 1;
    if (input.hold) return new Promise(resolve => { releaseRefresh = () => resolve({ call: calls }); });
    return { call: calls };
  }, {
    ttlMs: 1000,
    maxEntries: 5,
    keySelector: input => input.payload,
    refreshSelector: input => input.refresh === true
  });

  const first = await cached({ payload: { request: "same" } });
  const refreshed = await cached({ payload: { request: "same" }, refresh: true });
  const replay = await cached({ payload: { request: "same" } });

  assert.equal(first.cacheStatus, "MISS");
  assert.equal(refreshed.cacheStatus, "REFRESH");
  assert.equal(refreshed.result.call, 2);
  assert.equal(replay.cacheStatus, "HIT");
  assert.equal(replay.result.call, 2);
  assert.equal(calls, 2);

  const refreshing = cached({ payload: { request: "held" }, refresh: true, hold: true });
  await Promise.resolve();
  const duplicate = cached({ payload: { request: "held" }, refresh: true, hold: true });
  releaseRefresh();
  const [refreshResult, duplicateResult] = await Promise.all([refreshing, duplicate]);
  assert.equal(refreshResult.cacheStatus, "REFRESH");
  assert.equal(duplicateResult.cacheStatus, "COALESCED");
  assert.equal(refreshResult.result.call, 3);
  assert.equal(duplicateResult.result.call, 3);
  assert.equal(calls, 3);
});

test("the oldest cached entry is evicted at the configured limit", async () => {
  let calls = 0;
  const cached = createCachedCompiler(async payload => ({ call: ++calls, payload }), {
    ttlMs: 1000,
    maxEntries: 2
  });
  await cached({ request: "one" });
  await cached({ request: "two" });
  await cached({ request: "three" });
  const result = await cached({ request: "one" });
  assert.equal(result.cacheStatus, "MISS");
  assert.equal(calls, 4);
});

test("failed compilations are never cached", async () => {
  let calls = 0;
  const cached = createCachedCompiler(async () => {
    calls += 1;
    throw new Error("failed");
  }, { ttlMs: 1000, maxEntries: 5 });
  await assert.rejects(cached({ request: "one" }), /failed/);
  await assert.rejects(cached({ request: "one" }), /failed/);
  assert.equal(calls, 2);
});
