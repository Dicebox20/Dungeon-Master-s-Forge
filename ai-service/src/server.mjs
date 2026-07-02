import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { serviceCapabilities } from "./capabilities.mjs";
import { PROMPT_VERSION, SERVICE_NAME, SERVICE_VERSION } from "./constants.mjs";
import { createCompiler } from "./compiler.mjs";
import { createConcurrencyGate } from "./concurrency-gate.mjs";
import { ServiceError, publicError } from "./errors.mjs";
import { createCachedCompiler } from "./result-cache.mjs";

function tokenEqual(actual, expected) {
  const left = createHash("sha256").update(String(actual)).digest();
  const right = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(left, right);
}

function bearerToken(request) {
  const value = String(request.headers.authorization ?? "");
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function createRateLimiter(limit, now = Date.now, windowMs = 60000) {
  const clients = new Map();
  let checks = 0;
  return function check(key) {
    const timestamp = now();
    checks += 1;
    if (checks % 1024 === 0) {
      for (const [clientKey, entry] of clients) {
        if (timestamp - entry.startedAt >= windowMs) clients.delete(clientKey);
      }
    }
    const current = clients.get(key);
    if (!current || timestamp - current.startedAt >= windowMs) {
      clients.set(key, { startedAt: timestamp, count: 1 });
      return { allowed: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1000) };
    }
    current.count += 1;
    return {
      allowed: current.count <= limit,
      remaining: Math.max(0, limit - current.count),
      retryAfter: Math.max(1, Math.ceil((windowMs - (timestamp - current.startedAt)) / 1000))
    };
  };
}

function clientAddress(request, config) {
  if (config.trustProxy) {
    const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (isIP(forwarded)) return forwarded;
  }
  return String(request.socket.remoteAddress ?? "unknown");
}

function allowedOrigin(origin, configured) {
  if (!origin) return true;
  return configured.includes("*") || configured.includes(origin);
}

function applyCors(request, response, config) {
  const origin = String(request.headers.origin ?? "");
  if (!allowedOrigin(origin, config.allowedOrigins)) {
    throw new ServiceError(403, "origin_not_allowed", "This Foundry origin is not allowed by the Forge AI service.");
  }
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", config.allowedOrigins.includes("*") ? "*" : origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function readJsonBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new ServiceError(413, "body_too_large", "Request body exceeds the configured limit."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new ServiceError(400, "invalid_json", "Request body must contain valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function createForgeServer(options) {
  const { config } = options;
  const compile = options.compile ?? createCompiler(options);
  const requiresClientOpenAiKey = config.mode === "openai" && !config.openaiApiKey;
  const compilationGate = createConcurrencyGate(compile, {
    maxConcurrent: config.maxConcurrentCompilations,
    maxQueued: config.maxQueuedCompilations
  });
  const cachedCompile = createCachedCompiler(compilationGate.run, {
    ttlMs: config.cacheTtlMs,
    maxEntries: config.cacheMaxEntries,
    now: options.now,
    keySelector: input => input?.payload ?? input
  });
  const logger = options.logger ?? console;
  const rateLimit = createRateLimiter(config.rateLimitPerMinute, options.now);
  const clientDailyLimit = config.clientDailyLimit > 0
    ? createRateLimiter(config.clientDailyLimit, options.now, 86400000)
    : null;
  const globalDailyLimit = config.globalDailyLimit > 0
    ? createRateLimiter(config.globalDailyLimit, options.now, 86400000)
    : null;

  const server = createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);

    try {
      applyCors(request, response, config);
      const url = new URL(request.url ?? "/", "http://forge.local");
      if (request.method === "OPTIONS") {
        response.writeHead(204, { "Cache-Control": "no-store" });
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "ok",
          service: SERVICE_NAME,
          version: SERVICE_VERSION,
          promptVersion: PROMPT_VERSION,
          mode: config.mode,
          access: config.publicFreeTier ? "public-free-tier" : "private",
          cache: config.cacheTtlMs > 0 && config.cacheMaxEntries > 0 ? "enabled" : "disabled",
          compilation: compilationGate.status(),
          requestLimits: {
            maxCharacters: config.maxRequestChars,
            maxItems: config.maxItemsPerRequest,
            perMinute: config.rateLimitPerMinute,
            perClientDay: config.clientDailyLimit,
            globalPerDay: config.globalDailyLimit
          }
        });
        return;
      }

      if (request.method === "GET" && ["/v1/forge/capabilities", "/api/capabilities"].includes(url.pathname)) {
        sendJson(response, 200, serviceCapabilities(config));
        return;
      }

      if (request.method !== "POST" || !["/v1/forge/compile", "/api/compile"].includes(url.pathname)) {
        throw new ServiceError(404, "not_found", "Route not found.");
      }
      if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
        throw new ServiceError(415, "unsupported_media_type", "Content-Type must be application/json.");
      }
      const bearer = bearerToken(request);
      if (requiresClientOpenAiKey && !bearer) {
        throw new ServiceError(401, "missing_openai_key", "This service expects an OpenAI API key in Foundry's API token field.");
      }
      if (!requiresClientOpenAiKey && config.clientToken && !tokenEqual(bearer, config.clientToken)) {
        throw new ServiceError(401, "unauthorized", "A valid Forge service token is required.");
      }

      const client = clientAddress(request, config);
      const quota = rateLimit(client);
      response.setHeader("X-RateLimit-Limit", String(config.rateLimitPerMinute));
      response.setHeader("X-RateLimit-Remaining", String(quota.remaining));
      if (!quota.allowed) {
        response.setHeader("Retry-After", String(quota.retryAfter));
        throw new ServiceError(429, "rate_limited", "Forge AI request limit exceeded. Try again shortly.");
      }

      if (clientDailyLimit) {
        const daily = clientDailyLimit(client);
        response.setHeader("X-DailyLimit-Limit", String(config.clientDailyLimit));
        response.setHeader("X-DailyLimit-Remaining", String(daily.remaining));
        if (!daily.allowed) {
          response.setHeader("Retry-After", String(daily.retryAfter));
          throw new ServiceError(429, "daily_client_limit", "This free-tier client has reached its daily Forge AI limit.");
        }
      }
      if (globalDailyLimit) {
        const daily = globalDailyLimit("global");
        response.setHeader("X-GlobalDailyLimit-Limit", String(config.globalDailyLimit));
        response.setHeader("X-GlobalDailyLimit-Remaining", String(daily.remaining));
        if (!daily.allowed) {
          response.setHeader("Retry-After", String(daily.retryAfter));
          throw new ServiceError(429, "daily_global_limit", "The Dungeon Master's Forge free-tier daily allowance has been reached.");
        }
      }

      const payload = await readJsonBody(request, config.bodyLimitBytes);
      const { result, cacheStatus } = await cachedCompile({
        payload,
        requestApiKey: requiresClientOpenAiKey ? bearer : ""
      });
      response.setHeader("X-Forge-Cache", cacheStatus);
      sendJson(response, 200, result);
    } catch (error) {
      if (response.destroyed) return;
      const safe = publicError(error);
      if (safe.code === "service_busy") response.setHeader("Retry-After", "5");
      sendJson(response, safe.status, {
        error: { code: safe.code, message: safe.message, requestId }
      });
    } finally {
      const elapsedMs = Date.now() - startedAt;
      logger.info?.(`${request.method ?? "UNKNOWN"} ${request.url ?? "/"} ${response.statusCode} ${elapsedMs}ms ${requestId}`);
    }
  });

  return server;
}

export { allowedOrigin, clientAddress, createForgeServer, createRateLimiter, readJsonBody, tokenEqual };
