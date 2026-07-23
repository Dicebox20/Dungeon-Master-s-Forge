import { createHash } from "node:crypto";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function cacheKey(payload) {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

function createCachedCompiler(compile, options = {}) {
  const ttlMs = options.ttlMs ?? 300000;
  const maxEntries = options.maxEntries ?? 100;
  const now = options.now ?? Date.now;
  const keySelector = typeof options.keySelector === "function" ? options.keySelector : value => value;
  const refreshSelector = typeof options.refreshSelector === "function" ? options.refreshSelector : () => false;
  const cache = new Map();
  const pending = new Map();

  function pruneExpired(timestamp) {
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= timestamp) cache.delete(key);
    }
  }

  function store(key, result) {
    pruneExpired(now());
    cache.set(key, { result: structuredClone(result), expiresAt: now() + ttlMs });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  }

  return async function cachedCompile(payload) {
    if (ttlMs <= 0 || maxEntries <= 0) {
      return { result: await compile(payload), cacheStatus: "BYPASS" };
    }

    const key = cacheKey(keySelector(payload));
    const timestamp = now();
    const refresh = refreshSelector(payload) === true;
    const cached = cache.get(key);
    if (!refresh && cached?.expiresAt > timestamp) {
      cache.delete(key);
      cache.set(key, cached);
      return { result: structuredClone(cached.result), cacheStatus: "HIT" };
    }
    if (cached && cached.expiresAt <= timestamp) cache.delete(key);

    if (pending.has(key)) {
      return { result: structuredClone(await pending.get(key)), cacheStatus: "COALESCED" };
    }

    const compilation = Promise.resolve().then(() => compile(payload));
    pending.set(key, compilation);
    try {
      const result = await compilation;
      store(key, result);
      return { result, cacheStatus: refresh ? "REFRESH" : "MISS" };
    } finally {
      pending.delete(key);
    }
  };
}

export { cacheKey, canonicalize, createCachedCompiler };
