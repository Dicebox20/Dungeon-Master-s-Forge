import { ServiceError } from "./errors.mjs";

const FORBIDDEN_KEYS = new Set([
  "__proto__",
  "constructor",
  "eval",
  "flags",
  "macroCommand",
  "macroData",
  "onUseMacroName",
  "prototype",
  "script",
  "scripts"
]);

const ACTIVE_MARKUP = /<\s*script\b|\bjavascript\s*:|\bon[a-z]+\s*=/i;
const MAX_DEPTH = 24;
const MAX_NODES = 20000;
const MAX_OBJECT_KEYS = 200;
const MAX_ARRAY_ENTRIES = 500;
const MAX_STRING_LENGTH = 50000;

function reject(path, message) {
  throw new ServiceError(502, "unsafe_model_output", `Generated content at ${path} ${message}.`);
}

function validateRemoteContent(value, options = {}) {
  const state = { nodes: 0 };
  const root = options.path ?? "$";

  function visit(entry, path, depth) {
    state.nodes += 1;
    if (state.nodes > MAX_NODES) reject(path, "exceeds the node limit");
    if (depth > MAX_DEPTH) reject(path, "exceeds the nesting limit");

    if (typeof entry === "string") {
      if (entry.length > MAX_STRING_LENGTH) reject(path, "exceeds the string length limit");
      if (ACTIVE_MARKUP.test(entry)) reject(path, "contains active script or event-handler markup");
      return;
    }
    if (entry == null || typeof entry !== "object") return;

    if (Array.isArray(entry)) {
      if (entry.length > MAX_ARRAY_ENTRIES) reject(path, "exceeds the array length limit");
      entry.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }

    const entries = Object.entries(entry);
    if (entries.length > MAX_OBJECT_KEYS) reject(path, "exceeds the object key limit");
    for (const [key, item] of entries) {
      if (FORBIDDEN_KEYS.has(key)) reject(`${path}.${key}`, "uses a forbidden executable or document-control field");
      visit(item, `${path}.${key}`, depth + 1);
    }
  }

  visit(value, root, 0);
  return value;
}

export {
  ACTIVE_MARKUP,
  FORBIDDEN_KEYS,
  MAX_ARRAY_ENTRIES,
  MAX_DEPTH,
  MAX_NODES,
  MAX_OBJECT_KEYS,
  MAX_STRING_LENGTH,
  validateRemoteContent
};
