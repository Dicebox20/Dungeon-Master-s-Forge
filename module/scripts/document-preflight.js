function clone(value, runtime = globalThis) {
  if (runtime?.foundry?.utils?.deepClone) return runtime.foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deleteProperty(target, path, runtime = globalThis) {
  if (runtime?.foundry?.utils?.deleteProperty) {
    runtime.foundry.utils.deleteProperty(target, path);
    return;
  }
  const parts = String(path).split(".");
  const key = parts.pop();
  let cursor = target;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return;
    cursor = cursor[part];
  }
  if (cursor && typeof cursor === "object") delete cursor[key];
}

function setProperty(target, path, value, runtime = globalThis) {
  if (runtime?.foundry?.utils?.setProperty) {
    runtime.foundry.utils.setProperty(target, path, value);
    return;
  }
  const parts = String(path).split(".");
  const key = parts.pop();
  let cursor = target;
  for (const part of parts) {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[key] = value;
}

function applyDocumentUpdate(source, updateData, runtime = globalThis) {
  const next = clone(source, runtime) ?? {};
  for (const [rawPath, value] of Object.entries(updateData ?? {})) {
    const path = rawPath.startsWith("-=") ? rawPath.slice(2) : rawPath;
    if (!path) continue;
    if (rawPath.startsWith("-=")) deleteProperty(next, path, runtime);
    else setProperty(next, path, clone(value, runtime), runtime);
  }
  return next;
}

function normalizeValidationFailures(failures, prefix = "") {
  if (!failures) return [];
  if (failures instanceof Map) {
    return [...failures.entries()].flatMap(([path, message]) => normalizeValidationFailures(message, joinPath(prefix, path)));
  }
  if (Array.isArray(failures)) {
    return failures.flatMap((failure, index) => normalizeValidationFailures(failure, joinPath(prefix, failure?.path ?? failure?.key ?? index)));
  }
  if (typeof failures === "object") {
    return Object.entries(failures).flatMap(([path, message]) => normalizeValidationFailures(message, joinPath(prefix, path)));
  }
  return [{ path: prefix || "document", message: String(failures) }];
}

function joinPath(prefix, path) {
  const next = String(path ?? "").trim();
  if (!prefix) return next;
  if (!next) return prefix;
  return `${prefix}.${next}`;
}

function preflightDocumentSource({ DocumentClass, source, parent = null, strict = true, runtime = globalThis } = {}) {
  if (typeof DocumentClass !== "function") return { supported: false, valid: true, failures: [], source: clone(source, runtime) };
  try {
    const document = new DocumentClass(clone(source, runtime), { parent });
    if (typeof document.validate === "function") document.validate({ strict });
    const failures = normalizeValidationFailures(document.validationFailures);
    return { supported: true, valid: failures.length === 0, failures, source: clone(document.toObject?.() ?? source, runtime) };
  } catch (error) {
    return {
      supported: true,
      valid: false,
      failures: [{ path: "document", message: String(error?.message ?? error) }],
      error
    };
  }
}

function preflightDocumentUpdate(document, updateData, { DocumentClass = document?.constructor, strict = true, runtime = globalThis } = {}) {
  if (!document?.toObject) return { supported: false, valid: true, failures: [] };
  const source = applyDocumentUpdate(document.toObject(), updateData, runtime);
  return preflightDocumentSource({ DocumentClass, source, parent: document.parent ?? null, strict, runtime });
}

function formatPreflightFailure(label, result) {
  const failures = result?.failures ?? [];
  const detail = failures.map(failure => `${failure.path}: ${failure.message}`).join("; ");
  return `Foundry document preflight failed for ${label}${detail ? `: ${detail}` : ""}`;
}

function assertPreflight(label, result) {
  if (result?.valid !== false) return result;
  throw new Error(formatPreflightFailure(label, result));
}

export { applyDocumentUpdate, assertPreflight, clone, formatPreflightFailure, normalizeValidationFailures, preflightDocumentSource, preflightDocumentUpdate };
