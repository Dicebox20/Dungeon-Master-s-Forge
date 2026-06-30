const REMOTE_PROVIDER_SCHEMA_VERSION = "1.0";
const DEFAULT_REMOTE_TIMEOUT_MS = 60000;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isLoopbackHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}

function isPrivateIPv4Hostname(hostname) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function normalizeRemoteEndpoint(endpoint) {
  let url;
  try {
    url = new URL(String(endpoint ?? "").trim());
  } catch {
    throw new Error("Remote provider endpoint must be a valid URL.");
  }

  const secure = url.protocol === "https:";
  const localDevelopment = url.protocol === "http:" && (isLoopbackHostname(url.hostname) || isPrivateIPv4Hostname(url.hostname));
  if (!secure && !localDevelopment) {
    throw new Error("Remote provider endpoints must use HTTPS. HTTP is allowed only for loopback or private-network testing.");
  }
  if (url.username || url.password) throw new Error("Do not place credentials in the provider endpoint URL.");
  if (url.hash) throw new Error("Remote provider endpoint URLs cannot include a fragment.");

  return url.toString();
}

function capabilitiesEndpointFor(endpoint) {
  const normalized = normalizeRemoteEndpoint(endpoint);
  const url = new URL(normalized);
  const compileRoute = ["/v1/forge/compile", "/api/compile"].find(route => url.pathname.endsWith(route));
  if (!compileRoute) return null;
  url.pathname = `${url.pathname.slice(0, -"compile".length)}capabilities`;
  url.search = "";
  return url.toString();
}

function healthEndpointFor(endpoint) {
  const normalized = normalizeRemoteEndpoint(endpoint);
  const url = new URL(normalized);
  const compileRoute = ["/v1/forge/compile", "/api/compile"].find(route => url.pathname.endsWith(route));
  if (!compileRoute) return null;
  url.pathname = "/health";
  url.search = "";
  return url.toString();
}

function rootEndpointFor(endpoint) {
  const normalized = normalizeRemoteEndpoint(endpoint);
  const url = new URL(normalized);
  url.pathname = "/";
  url.search = "";
  return url.toString();
}

function remoteHttpError(response, subject) {
  const status = Number(response?.status ?? 0);
  const retryAfter = String(response?.headers?.get?.("retry-after") ?? "").trim();
  if (status === 429) {
    const retryText = /^\d+$/.test(retryAfter)
      ? ` Retry in about ${retryAfter} second${retryAfter === "1" ? "" : "s"}.`
      : " Wait briefly before trying again.";
    return new Error(`${subject} rate limit reached (HTTP 429).${retryText}`);
  }
  if (status === 401 || status === 403) {
    return new Error(`${subject} rejected the connection credentials (HTTP ${status}).`);
  }
  if (status === 404) {
    return new Error(`${subject} route was not found (HTTP 404). Check the endpoint path.`);
  }
  return new Error(`${subject} returned HTTP ${status}.`);
}

function redactProviderConfiguration(value) {
  if (Array.isArray(value)) return value.map(redactProviderConfiguration);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const sensitive = /(?:api[-_]?key|token|secret|authorization|password|credential)/i.test(key);
    return [key, sensitive && entry ? "[redacted]" : redactProviderConfiguration(entry)];
  }));
}

function buildRemoteProviderRequest(request, options = {}) {
  const normalizedRequest = String(request ?? "").trim();
  if (!normalizedRequest) throw new Error("Describe an item before compiling.");

  return {
    schemaVersion: REMOTE_PROVIDER_SCHEMA_VERSION,
    request: normalizedRequest,
    context: {
      foundryVersion: String(options.context?.foundryVersion ?? ""),
      systemId: String(options.context?.systemId ?? "dnd5e"),
      systemVersion: String(options.context?.systemVersion ?? ""),
      moduleVersion: String(options.context?.moduleVersion ?? ""),
      supportedKinds: Array.isArray(options.context?.supportedKinds)
        ? options.context.supportedKinds.map(String)
        : []
    },
    options: {
      model: String(options.model ?? ""),
      unresolvedPolicy: options.unresolvedPolicy === "block" ? "block" : "review"
    }
  };
}

function stringArray(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(entry => typeof entry !== "string")) {
    throw new Error(`Remote provider response ${field} must be an array of strings.`);
  }
  return [...value];
}

function normalizeRemoteProviderResponse(payload, provider = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Remote provider response must be a JSON object.");
  }
  if (payload.schemaVersion !== REMOTE_PROVIDER_SCHEMA_VERSION) {
    throw new Error(`Remote provider response must use schema version ${REMOTE_PROVIDER_SCHEMA_VERSION}.`);
  }

  const specs = payload.specs ?? payload.items;
  if (!Array.isArray(specs) || !specs.length) {
    throw new Error("Remote provider response must include a non-empty specs array.");
  }
  for (const [index, spec] of specs.entries()) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new Error(`Remote provider spec ${index + 1} must be an object.`);
    }
    if (typeof spec.name !== "string" || !spec.name.trim()) {
      throw new Error(`Remote provider spec ${index + 1} is missing name.`);
    }
    if (typeof spec.kind !== "string" || !spec.kind.trim()) {
      throw new Error(`Remote provider spec ${index + 1} is missing kind.`);
    }
  }

  const decisions = payload.decisions == null
    ? specs.map(spec => ({ name: spec.name, pattern: spec.kind, unresolvedCount: spec.unresolvedMechanics?.length ?? 0 }))
    : clone(payload.decisions);
  if (!Array.isArray(decisions)) throw new Error("Remote provider response decisions must be an array.");

  return {
    compilerVersion: String(payload.compilerVersion ?? "remote"),
    promptVersion: String(payload.promptVersion ?? ""),
    provider: String(provider.id ?? "remote"),
    providerLabel: String(provider.label ?? "Remote Provider"),
    providerMode: "network",
    request: String(payload.request ?? ""),
    requestCount: Number(payload.requestCount ?? specs.length),
    specs: clone(specs),
    decisions,
    assumptions: stringArray(payload.assumptions, "assumptions"),
    warnings: stringArray(payload.warnings, "warnings"),
    deferred: stringArray(payload.deferred, "deferred"),
    unresolvedMechanics: clone(payload.unresolvedMechanics ?? specs.flatMap(spec =>
      (spec.unresolvedMechanics ?? []).map(mechanic => ({ itemName: spec.name, ...mechanic }))
    ))
  };
}

function normalizeRemoteCapabilities(payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Remote provider capabilities must be a JSON object.");
  }
  const forge = payload.forge;
  if (!forge || typeof forge !== "object" || Array.isArray(forge)) {
    throw new Error("Remote provider capabilities must include forge compatibility data.");
  }
  if (forge.schemaVersion !== REMOTE_PROVIDER_SCHEMA_VERSION) {
    throw new Error(`Remote provider capabilities require unsupported Forge schema ${String(forge.schemaVersion ?? "(missing)")}.`);
  }
  const remoteKinds = Array.isArray(forge.supportedKinds)
    ? [...new Set(forge.supportedKinds.map(String).filter(Boolean))]
    : [];
  if (!remoteKinds.length) throw new Error("Remote provider capabilities must include supported Forge item kinds.");

  const localKinds = Array.isArray(options.supportedKinds)
    ? [...new Set(options.supportedKinds.map(String).filter(Boolean))]
    : [];
  const compatibleKinds = localKinds.length
    ? localKinds.filter(kind => remoteKinds.includes(kind))
    : [...remoteKinds];
  if (!compatibleKinds.length) throw new Error("Remote provider and this Forge build do not share a supported item kind.");

  const features = payload.features && typeof payload.features === "object" && !Array.isArray(payload.features)
    ? payload.features
    : {};
  if (features.executableModelOutput === true || features.declarativeModelOutputOnly === false) {
    throw new Error("Remote provider capabilities do not satisfy the Forge declarative-output safety policy.");
  }

  return {
    available: true,
    status: "compatible",
    service: clone(payload.service ?? {}),
    forge: {
      schemaVersion: forge.schemaVersion,
      promptVersion: String(forge.promptVersion ?? ""),
      supportedKinds: remoteKinds
    },
    request: clone(payload.request ?? {}),
    features: clone(features),
    compatibleKinds
  };
}

function normalizeRemoteHealth(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Remote provider health must be a JSON object.");
  }

  const status = String(payload.status ?? "ok").trim().toLowerCase();
  if (status && status !== "ok") {
    throw new Error(`Remote provider health reported status ${String(payload.status)}.`);
  }

  const serviceName = typeof payload.service === "string"
    ? payload.service
    : String(payload.service?.name ?? "").trim();
  const serviceVersion = typeof payload.service === "object" && payload.service && !Array.isArray(payload.service)
    ? String(payload.service.version ?? payload.version ?? "").trim()
    : String(payload.version ?? "").trim();
  if (!serviceName) throw new Error("Remote provider health is missing a service name.");

  return {
    available: true,
    status: "ok",
    service: {
      name: serviceName,
      version: serviceVersion
    },
    mode: String(payload.mode ?? "").trim().toLowerCase(),
    promptVersion: String(payload.promptVersion ?? "").trim(),
    cache: String(payload.cache ?? "").trim(),
    compilation: clone(payload.compilation ?? {}),
    requestLimits: clone(payload.requestLimits ?? {})
  };
}

function normalizeRemoteBridgeDescriptor(payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Remote provider bridge descriptor must be a JSON object.");
  }

  const bridgeName = String(payload.service ?? payload.name ?? payload.message ?? "").trim();
  const advertisedEndpoint = String(payload.endpoint ?? "").trim();
  if (payload.ok !== true && !bridgeName && !advertisedEndpoint) {
    throw new Error("Remote provider bridge descriptor was not recognized.");
  }

  let compilePath = "";
  try {
    compilePath = new URL(normalizeRemoteEndpoint(options.endpoint)).pathname;
  } catch {
    compilePath = "";
  }

  if (advertisedEndpoint && compilePath && advertisedEndpoint !== compilePath) {
    throw new Error("Remote provider bridge descriptor does not match the configured compile route.");
  }

  return {
    available: true,
    status: "legacy-bridge",
    service: {
      name: bridgeName || "Foundry AI bridge",
      version: String(payload.version ?? "").trim()
    },
    mode: String(payload.mode ?? "").trim().toLowerCase(),
    promptVersion: String(payload.promptVersion ?? "").trim(),
    cache: "",
    compilation: {},
    requestLimits: {},
    bridge: {
      endpoint: advertisedEndpoint,
      message: String(payload.message ?? "").trim()
    }
  };
}

async function requestRemoteHealth(options) {
  const endpoint = healthEndpointFor(options?.endpoint);
  if (!endpoint) {
    return { available: false, status: "not-advertised", endpoint: null };
  }

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("No fetch implementation is available for provider health.");
  const headers = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REMOTE_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(endpoint, { method: "GET", headers, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Remote provider health request timed out.");
    throw new Error("Remote provider health request failed before a valid response was received.");
  } finally {
    clearTimeout(timeout);
  }

  if ([404, 405].includes(Number(response?.status))) {
    const rootEndpoint = rootEndpointFor(options?.endpoint);
    let bridgeResponse;
    const rootController = new AbortController();
    const rootTimeout = setTimeout(() => rootController.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REMOTE_TIMEOUT_MS);
    try {
      bridgeResponse = await fetchImpl(rootEndpoint, { method: "GET", headers, signal: rootController.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Remote provider health request timed out.");
      throw new Error("Remote provider health request failed before a valid response was received.");
    } finally {
      clearTimeout(rootTimeout);
    }

    if ([404, 405].includes(Number(bridgeResponse?.status))) {
      return { available: false, status: "not-supported", endpoint };
    }
    if (!bridgeResponse?.ok) throw remoteHttpError(bridgeResponse, "Remote provider bridge");

    let bridgePayload;
    try {
      bridgePayload = await bridgeResponse.json();
    } catch {
      throw new Error("Remote provider bridge returned invalid JSON.");
    }
    return {
      ...normalizeRemoteBridgeDescriptor(bridgePayload, options),
      endpoint,
      descriptorEndpoint: rootEndpoint
    };
  }
  if (!response?.ok) throw remoteHttpError(response, "Remote provider health");

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Remote provider health returned invalid JSON.");
  }
  return { ...normalizeRemoteHealth(payload), endpoint };
}

async function requestRemoteCapabilities(options) {
  const supportedKinds = Array.isArray(options?.supportedKinds) ? options.supportedKinds.map(String) : [];
  const endpoint = capabilitiesEndpointFor(options?.endpoint);
  if (!endpoint) {
    return { available: false, status: "not-advertised", endpoint: null, compatibleKinds: supportedKinds };
  }

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("No fetch implementation is available for provider capabilities.");
  const headers = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REMOTE_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(endpoint, { method: "GET", headers, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Remote provider capabilities request timed out.");
    throw new Error("Remote provider capabilities request failed before a valid response was received.");
  } finally {
    clearTimeout(timeout);
  }

  if ([404, 405].includes(Number(response?.status))) {
    return { available: false, status: "not-supported", endpoint, compatibleKinds: supportedKinds };
  }
  if (!response?.ok) throw remoteHttpError(response, "Remote provider capabilities");

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Remote provider capabilities returned invalid JSON.");
  }
  return { ...normalizeRemoteCapabilities(payload, { supportedKinds }), endpoint };
}

async function requestRemoteCompilation(options) {
  const endpoint = normalizeRemoteEndpoint(options?.endpoint);
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("No fetch implementation is available for the remote provider.");

  const requestBody = buildRemoteProviderRequest(options.request, {
    context: options.context,
    model: options.model,
    unresolvedPolicy: options.unresolvedPolicy
  });
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REMOTE_TIMEOUT_MS);

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Remote provider request timed out.");
    throw new Error("Remote provider request failed before a valid response was received.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response?.ok) {
    throw remoteHttpError(response, "Remote provider");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Remote provider returned invalid JSON.");
  }

  return normalizeRemoteProviderResponse(payload, options.provider);
}

export {
  DEFAULT_REMOTE_TIMEOUT_MS,
  REMOTE_PROVIDER_SCHEMA_VERSION,
  buildRemoteProviderRequest,
  capabilitiesEndpointFor,
  healthEndpointFor,
  normalizeRemoteEndpoint,
  normalizeRemoteBridgeDescriptor,
  normalizeRemoteCapabilities,
  normalizeRemoteHealth,
  normalizeRemoteProviderResponse,
  remoteHttpError,
  redactProviderConfiguration,
  requestRemoteHealth,
  requestRemoteCapabilities,
  requestRemoteCompilation
};
