import { compileWithMock } from "./adapters/mock.mjs";
import { compileWithOpenAI } from "./adapters/openai.mjs";
import { normalizeModelOutput, validateForgeRequest } from "./contract.mjs";

const RETRYABLE_MODEL_OUTPUT_CODES = new Set([
  "empty_model_response",
  "invalid_model_json",
  "invalid_openai_response",
  "invalid_model_output",
  "item_count_mismatch",
  "unsupported_generated_kind",
  "unsafe_model_output"
]);

function shouldRetryModelOutput(error, mode, attempt) {
  return mode === "openai" && attempt === 0 && RETRYABLE_MODEL_OUTPUT_CODES.has(error?.code);
}

function buildRetryHint(error) {
  const code = String(error?.code ?? "invalid_model_output").trim() || "invalid_model_output";
  const message = String(error?.message ?? "The previous output failed validation.").trim();
  return [
    "Repair the previous response and return the complete JSON object again.",
    `Previous validation error [${code}]: ${message}`,
    "Keep the same item count and explicit item names.",
    "Preserve any valid mechanics.",
    "Use a suite or hybrid compatibility renderer to preserve every safely representable mechanic on the same item.",
    "Move a mechanic into unresolvedMechanics only when no advertised declarative capability or trusted engine recipe can represent it safely.",
    "For ally auras, class-resource restoration, and similar unsupported automation, record the clause in unresolvedMechanics instead of encoding it through effect flags or scripts.",
    "Do not emit flags, macroCommand, scripts, executable code, unsupported kinds, or malformed IDs."
  ].join(" ");
}

function createCompiler(options) {
  const { config } = options;
  const adapters = {
    mock: options.mockAdapter ?? compileWithMock,
    openai: options.openaiAdapter ?? compileWithOpenAI
  };

  return async function compile(input) {
    const payload = input?.payload ?? input;
    const envelope = validateForgeRequest(payload, {
      maxRequestChars: config.maxRequestChars,
      maxItemsPerRequest: config.maxItemsPerRequest
    });
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const modelOutput = await adapters[config.mode](envelope, {
          config,
          fetchImpl: options.fetchImpl,
          requestApiKey: input?.requestApiKey ?? "",
          compileAttempt: attempt,
          retryHint: attempt > 0 ? buildRetryHint(lastError) : ""
        });
        return {
          ...normalizeModelOutput(modelOutput, envelope, { makeId: options.makeId }),
          providerUsage: modelOutput?.providerUsage ?? {}
        };
      } catch (error) {
        lastError = error;
        if (!shouldRetryModelOutput(error, config.mode, attempt)) throw error;
      }
    }
    throw new Error("Unreachable model-output retry state.");
  };
}

export { RETRYABLE_MODEL_OUTPUT_CODES, createCompiler, shouldRetryModelOutput };
