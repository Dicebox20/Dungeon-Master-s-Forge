import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { serviceCapabilities } from "./capabilities.mjs";
import { PROMPT_VERSION, SERVICE_NAME, SERVICE_VERSION } from "./constants.mjs";
import { createCompiler } from "./compiler.mjs";
import { createConcurrencyGate } from "./concurrency-gate.mjs";
import { validateForgeRequest } from "./contract.mjs";
import { ServiceError, publicError } from "./errors.mjs";
import { createErrorReportStore } from "./error-report-store.mjs";
import { createCachedCompiler } from "./result-cache.mjs";
import { createUsageMeterStore } from "./quota-store.mjs";
import { measureUsage } from "./usage.mjs";

function tokenEqual(actual, expected) {
  const left = createHash("sha256").update(String(actual)).digest();
  const right = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(left, right);
}

function bearerToken(request) {
  const value = String(request.headers.authorization ?? "");
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function requestUsesClientProviderKey(config, bearer) {
  return config.mode === "openai" && !config.clientToken && Boolean(String(bearer ?? "").trim());
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
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Cache-Control, Content-Type");
  response.setHeader("Access-Control-Expose-Headers", "X-Forge-Cache, X-Forge-Usage-Charged, X-Forge-Usage-Limit, X-Forge-Usage-Remaining");
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

function cleanText(value, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanBlockText(value, max = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeErrorReport(payload, requestId, client) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ServiceError(400, "invalid_error_report", "Error reports must be JSON objects.");
  }
  const moduleId = cleanText(payload.module?.id, 120);
  const moduleVersion = cleanText(payload.module?.version, 80);
  const stage = cleanText(payload.error?.stage, 80);
  const message = cleanText(payload.error?.message, 1000);
  if (!moduleId || !moduleVersion || !message) {
    throw new ServiceError(400, "invalid_error_report", "Error reports require module id, module version, and an error message.");
  }
  const items = Array.isArray(payload.items) ? payload.items.slice(0, 10).map(item => ({
    name: cleanText(item?.name, 160),
    kind: cleanText(item?.kind, 80),
    reviewState: cleanText(item?.reviewState, 80),
    notes: Array.isArray(item?.notes) ? item.notes.slice(0, 20).map(note => ({
      state: cleanText(note?.state, 40),
      label: cleanText(note?.label, 160),
      message: cleanText(note?.message, 500)
    })) : []
  })) : [];
  const compilation = payload.compilation && typeof payload.compilation === "object" && !Array.isArray(payload.compilation)
    ? {
        providerLabel: cleanText(payload.compilation.providerLabel, 160),
        providerMode: cleanText(payload.compilation.providerMode, 80),
        normalizedRequest: cleanBlockText(payload.compilation.normalizedRequest, 12000),
        decisions: Array.isArray(payload.compilation.decisions)
          ? payload.compilation.decisions.slice(0, 20).map(decision => ({
              name: cleanText(decision?.name, 160),
              pattern: cleanText(decision?.pattern, 120),
              unresolvedCount: Number.isFinite(Number(decision?.unresolvedCount)) ? Number(decision.unresolvedCount) : 0
            }))
          : [],
        assumptions: Array.isArray(payload.compilation.assumptions)
          ? payload.compilation.assumptions.slice(0, 40).map(entry => cleanText(entry, 400)).filter(Boolean)
          : [],
        warnings: Array.isArray(payload.compilation.warnings)
          ? payload.compilation.warnings.slice(0, 40).map(entry => cleanText(entry, 400)).filter(Boolean)
          : [],
        deferred: Array.isArray(payload.compilation.deferred)
          ? payload.compilation.deferred.slice(0, 40).map(entry => cleanText(entry, 400)).filter(Boolean)
          : [],
        unresolvedCount: Number.isFinite(Number(payload.compilation.unresolvedCount)) ? Number(payload.compilation.unresolvedCount) : 0
      }
    : null;
  const feedback = payload.feedback && typeof payload.feedback === "object" && !Array.isArray(payload.feedback)
    ? {
        kind: cleanText(payload.feedback.kind, 80),
        userNote: cleanBlockText(payload.feedback.userNote, 4000),
        desiredOutcome: cleanBlockText(payload.feedback.desiredOutcome, 4000),
        requestText: cleanBlockText(payload.feedback.requestText, 12000),
        generatedSpecsJson: cleanBlockText(payload.feedback.generatedSpecsJson, 60000),
        statusMessage: cleanText(payload.feedback.statusMessage, 500),
        includedPreviewNotes: payload.feedback.includedPreviewNotes === true
      }
    : null;
  const repair = payload.repair && typeof payload.repair === "object" && !Array.isArray(payload.repair)
    ? {
        mode: cleanText(payload.repair.mode, 40),
        parentRequestId: cleanText(payload.repair.parentRequestId, 100),
        attempted: payload.repair.attempted === true,
        requestFingerprint: cleanText(payload.repair.requestFingerprint, 120),
        originalSpecFingerprint: cleanText(payload.repair.originalSpecFingerprint, 120),
        repairNotes: cleanBlockText(payload.repair.repairNotes, 4000),
        providerLane: cleanText(payload.repair.providerLane, 100)
      }
    : null;

  return {
    schemaVersion: cleanText(payload.schemaVersion, 20) || "1.0",
    source: cleanText(payload.source, 80),
    occurredAt: cleanText(payload.occurredAt, 80),
    receivedRequestId: requestId,
    module: {
      id: moduleId,
      version: moduleVersion
    },
    environment: {
      foundryVersion: cleanText(payload.environment?.foundryVersion, 80),
      systemId: cleanText(payload.environment?.systemId, 80),
      systemVersion: cleanText(payload.environment?.systemVersion, 80),
      browserOrigin: cleanText(payload.environment?.browserOrigin, 200)
    },
    provider: {
      id: cleanText(payload.provider?.id, 80),
      endpointHost: cleanText(payload.provider?.endpointHost, 160),
      endpointPath: cleanText(payload.provider?.endpointPath, 200),
      unresolvedPolicy: cleanText(payload.provider?.unresolvedPolicy, 40)
    },
    error: {
      stage,
      name: cleanText(payload.error?.name, 120),
      message,
      code: cleanText(payload.error?.code, 80),
      requestId: cleanText(payload.error?.requestId, 120),
      stack: Array.isArray(payload.error?.stack) ? payload.error.stack.slice(0, 8).map(line => cleanText(line, 300)).filter(Boolean) : []
    },
    items,
    compilation,
    feedback,
    repair
  };
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
    keySelector: input => input?.payload ?? input,
    refreshSelector: input => input?.refreshCache === true
  });
  const logger = options.logger ?? console;
  const rateLimit = createRateLimiter(config.rateLimitPerMinute, options.now);
  const usesUsageMeter = config.clientDailyUsageLimit > 0 || config.clientMonthlyUsageLimit > 0 || config.globalDailyUsageLimit > 0;
  const usageStore = usesUsageMeter
    ? (options.usageStore ?? createUsageMeterStore({
        databasePath: config.quotaDatabasePath,
        hashSecret: config.quotaHashSecret,
        now: options.now
      }))
    : null;
  const errorReportStore = config.errorReportsEnabled
    ? (options.errorReportStore ?? createErrorReportStore({
        path: config.errorReportPath,
        retentionDays: config.errorReportRetentionDays
      }))
    : null;
  const ownsUsageStore = usesUsageMeter && !options.usageStore;
  const repairAttempts = new Map();

  function claimRepairAttempt(client, payload) {
    if (String(payload?.requestMode ?? "compile") !== "repair-attempt") return;
    const parentRequestId = String(payload?.repair?.parentRequestId ?? "").trim();
    if (!parentRequestId) return;
    if (usageStore?.claimRepairAttempt) {
      if (!usageStore.claimRepairAttempt(client, parentRequestId)) {
        throw new ServiceError(409, "repair_already_attempted", "This Forge result already has a confirmed repair attempt. Start a new preview if you need another provider evaluation.");
      }
      return;
    }
    const key = `${client}:${parentRequestId}`;
    if (repairAttempts.has(key)) {
      throw new ServiceError(409, "repair_already_attempted", "This Forge result already has a confirmed repair attempt. Start a new preview if you need another provider evaluation.");
    }
    repairAttempts.set(key, Date.now());
    while (repairAttempts.size > 4096) repairAttempts.delete(repairAttempts.keys().next().value);
  }

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
          quotaStorage: usageStore?.status?.() ?? { kind: "disabled", durable: false },
          compilation: compilationGate.status(),
          requestLimits: {
            maxCharacters: config.maxRequestChars,
            maxItems: config.maxItemsPerRequest,
            perMinute: config.rateLimitPerMinute,
            perClientDayUsage: config.clientDailyUsageLimit,
            perClientMonthUsage: config.clientMonthlyUsageLimit,
            globalPerDayUsage: config.globalDailyUsageLimit
          }
        });
        return;
      }

      if (request.method === "GET" && ["/v1/forge/capabilities", "/api/capabilities"].includes(url.pathname)) {
        sendJson(response, 200, serviceCapabilities(config));
        return;
      }

      if (request.method === "POST" && ["/v1/forge/report-error", "/api/report-error"].includes(url.pathname)) {
        if (!config.errorReportsEnabled || !errorReportStore) {
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
        const quota = rateLimit(`${client}:report-error`);
        response.setHeader("X-RateLimit-Limit", String(config.rateLimitPerMinute));
        response.setHeader("X-RateLimit-Remaining", String(quota.remaining));
        if (!quota.allowed) {
          response.setHeader("Retry-After", String(quota.retryAfter));
          throw new ServiceError(429, "rate_limited", "Forge AI request limit exceeded. Try again shortly.");
        }
        const payload = await readJsonBody(request, config.bodyLimitBytes);
        const normalized = normalizeErrorReport(payload, requestId, client);
        try {
          const stored = await errorReportStore.append(normalized);
          if (!stored) throw new ServiceError(503, "report_storage_unavailable", "Anonymous item reports are not enabled on this Forge service.");
        } catch (error) {
          if (error instanceof ServiceError) throw error;
          throw new ServiceError(503, "report_storage_unavailable", "The Forge AI service could not store this item report.", { cause: error });
        }
        sendJson(response, 202, { status: "accepted", stored: true, requestId });
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
      const usesClientProviderKey = requestUsesClientProviderKey(config, bearer);
      const quota = rateLimit(client);
      response.setHeader("X-RateLimit-Limit", String(config.rateLimitPerMinute));
      response.setHeader("X-RateLimit-Remaining", String(quota.remaining));
      if (!quota.allowed) {
        response.setHeader("Retry-After", String(quota.retryAfter));
        throw new ServiceError(429, "rate_limited", "Forge AI request limit exceeded. Try again shortly.");
      }

      if (!usesClientProviderKey && usageStore && config.clientMonthlyUsageLimit > 0) {
        const monthly = usageStore.checkMonthly("client-month", client, config.clientMonthlyUsageLimit);
        response.setHeader("X-Forge-Usage-Limit", String(monthly.limit));
        response.setHeader("X-Forge-Usage-Remaining", String(monthly.remaining));
        if (!monthly.allowed) {
          response.setHeader("Retry-After", String(monthly.retryAfter));
          throw new ServiceError(429, "monthly_client_usage_limit", "This Free Forge client has reached its monthly hosted usage allowance.");
        }
      }
      if (!usesClientProviderKey && usageStore && config.clientDailyUsageLimit > 0) {
        const daily = usageStore.check("client", client, config.clientDailyUsageLimit);
        if (!daily.allowed) {
          response.setHeader("X-Forge-Usage-Limit", String(daily.limit));
          response.setHeader("X-Forge-Usage-Remaining", String(daily.remaining));
          response.setHeader("Retry-After", String(daily.retryAfter));
          throw new ServiceError(429, "daily_client_usage_limit", "This Free Forge client has reached its daily hosted usage allowance.");
        }
      }
      if (!usesClientProviderKey && usageStore && config.globalDailyUsageLimit > 0) {
        const daily = usageStore.check("global", "global", config.globalDailyUsageLimit);
        if (!daily.allowed) {
          response.setHeader("X-Forge-Usage-Limit", String(daily.limit));
          response.setHeader("X-Forge-Usage-Remaining", String(daily.remaining));
          response.setHeader("Retry-After", String(daily.retryAfter));
          throw new ServiceError(429, "daily_global_usage_limit", "Free Forge has reached its hosted daily usage safeguard.");
        }
      }

      const payload = await readJsonBody(request, config.bodyLimitBytes);
      if (String(payload?.requestMode ?? "compile") === "repair-attempt") {
        // Validate before claiming the one-shot slot so malformed attempts do
        // not consume the user's only repair opportunity.
        validateForgeRequest(payload, {
          maxRequestChars: config.maxRequestChars,
          maxItemsPerRequest: config.maxItemsPerRequest
        });
      }
      claimRepairAttempt(client, payload);
      const { result, cacheStatus } = await cachedCompile({
        payload,
        requestApiKey: requiresClientOpenAiKey || usesClientProviderKey ? bearer : "",
        refreshCache: /(?:^|,)\s*no-cache\s*(?:,|$)/i.test(String(request.headers["cache-control"] ?? ""))
      });
      response.setHeader("X-Forge-Cache", cacheStatus);
      const cacheWasCharged = !["HIT", "COALESCED"].includes(cacheStatus);
      const measured = measureUsage(payload, result);
      const chargedUnits = !usesClientProviderKey && usageStore && cacheWasCharged ? measured.units : 0;
      let clientUsage = null;
      if (chargedUnits > 0 && config.clientMonthlyUsageLimit > 0) {
        clientUsage = usageStore.consumeMonthly("client-month", client, chargedUnits, config.clientMonthlyUsageLimit);
        response.setHeader("X-Forge-Usage-Limit", String(clientUsage.limit));
        response.setHeader("X-Forge-Usage-Remaining", String(clientUsage.remaining));
      }
      if (chargedUnits > 0 && config.clientDailyUsageLimit > 0) {
        usageStore.consume("client", client, chargedUnits, config.clientDailyUsageLimit);
      }
      if (chargedUnits > 0 && config.globalDailyUsageLimit > 0) {
        usageStore.consume("global", "global", chargedUnits, config.globalDailyUsageLimit);
      }
      response.setHeader("X-Forge-Usage-Charged", String(chargedUnits));
      sendJson(response, 200, {
        ...result,
        usage: { ...measured, chargedUnits, cacheStatus }
      });
    } catch (error) {
      if (response.destroyed) return;
      const safe = publicError(error);
      logger.warn?.(`${request.method ?? "UNKNOWN"} ${request.url ?? "/"} failed ${safe.code} ${requestId}`);
      if (safe.code === "service_busy") response.setHeader("Retry-After", "5");
      sendJson(response, safe.status, {
        error: { code: safe.code, message: safe.message, requestId }
      });
    } finally {
      const elapsedMs = Date.now() - startedAt;
      logger.info?.(`${request.method ?? "UNKNOWN"} ${request.url ?? "/"} ${response.statusCode} ${elapsedMs}ms ${requestId}`);
    }
  });

  if (ownsUsageStore) server.once("close", () => usageStore.close());

  return server;
}

export { allowedOrigin, clientAddress, createForgeServer, createRateLimiter, readJsonBody, tokenEqual };
