import { ServiceError } from "./errors.mjs";

function createConcurrencyGate(task, options = {}) {
  const maxConcurrent = options.maxConcurrent ?? 2;
  const maxQueued = options.maxQueued ?? 20;
  let active = 0;
  const queue = [];

  function finish(settle, value) {
    active -= 1;
    const next = queue.shift();
    if (next) start(next);
    settle(value);
  }

  function start(job) {
    active += 1;
    Promise.resolve()
      .then(() => task(job.input))
      .then(
        result => finish(job.resolve, result),
        error => finish(job.reject, error)
      );
  }

  function run(input) {
    return new Promise((resolve, reject) => {
      const job = { input, resolve, reject };
      if (active < maxConcurrent) {
        start(job);
        return;
      }
      if (queue.length >= maxQueued) {
        reject(new ServiceError(503, "service_busy", "The Forge AI service is at capacity. Try again shortly."));
        return;
      }
      queue.push(job);
    });
  }

  function status() {
    return { active, queued: queue.length, maxConcurrent, maxQueued };
  }

  return { run, status };
}

export { createConcurrencyGate };
