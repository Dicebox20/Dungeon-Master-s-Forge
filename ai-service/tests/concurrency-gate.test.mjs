import assert from "node:assert/strict";
import test from "node:test";
import { createConcurrencyGate } from "../src/concurrency-gate.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

test("compilations run in FIFO order within the configured capacity", async () => {
  const controls = new Map();
  const started = [];
  const gate = createConcurrencyGate(name => {
    started.push(name);
    const control = deferred();
    controls.set(name, control);
    return control.promise;
  }, { maxConcurrent: 1, maxQueued: 2 });

  const first = gate.run("first");
  const second = gate.run("second");
  const third = gate.run("third");
  await Promise.resolve();
  assert.deepEqual(started, ["first"]);
  assert.deepEqual(gate.status(), { active: 1, queued: 2, maxConcurrent: 1, maxQueued: 2 });

  controls.get("first").resolve("one");
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ["first", "second"]);
  controls.get("second").resolve("two");
  await second;
  await new Promise(resolve => setImmediate(resolve));
  controls.get("third").resolve("three");
  assert.equal(await third, "three");
});

test("distinct requests cannot exceed the active compilation limit", async () => {
  let active = 0;
  let maximum = 0;
  const releases = [];
  const gate = createConcurrencyGate(async value => {
    active += 1;
    maximum = Math.max(maximum, active);
    const control = deferred();
    releases.push(control);
    await control.promise;
    active -= 1;
    return value;
  }, { maxConcurrent: 2, maxQueued: 2 });
  const requests = [gate.run(1), gate.run(2), gate.run(3), gate.run(4)];
  await Promise.resolve();
  releases[0].resolve();
  releases[1].resolve();
  await new Promise(resolve => setImmediate(resolve));
  releases[2].resolve();
  releases[3].resolve();
  assert.deepEqual(await Promise.all(requests), [1, 2, 3, 4]);
  assert.equal(maximum, 2);
});

test("a full queue rejects additional work with a stable public error", async () => {
  const control = deferred();
  const gate = createConcurrencyGate(() => control.promise, { maxConcurrent: 1, maxQueued: 1 });
  const active = gate.run("active");
  const queued = gate.run("queued");
  await assert.rejects(gate.run("overflow"), error => error.status === 503 && error.code === "service_busy");
  control.resolve("done");
  assert.equal(await active, "done");
  assert.equal(await queued, "done");
});

test("failed work releases capacity for the next queued request", async () => {
  let calls = 0;
  const gate = createConcurrencyGate(async () => {
    calls += 1;
    if (calls === 1) throw new Error("failed");
    return "recovered";
  }, { maxConcurrent: 1, maxQueued: 1 });
  const first = gate.run("first");
  const second = gate.run("second");
  await assert.rejects(first, /failed/);
  assert.equal(await second, "recovered");
  assert.equal(gate.status().active, 0);
});
