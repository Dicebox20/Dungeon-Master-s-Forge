import { compileWithMock } from "./adapters/mock.mjs";
import { compileWithOpenAI } from "./adapters/openai.mjs";
import { normalizeModelOutput, validateForgeRequest } from "./contract.mjs";

const RETRYABLE_MODEL_OUTPUT_CODES = new Set([
  "empty_model_response",
  "invalid_model_json",
  "invalid_openai_response",
  "invalid_model_output",
  "unsupported_generated_kind",
  "unsafe_model_output"
]);

function shouldRetryModelOutput(error, mode, attempt) {
  return mode === "openai" && attempt === 0 && RETRYABLE_MODEL_OUTPUT_CODES.has(error?.code);
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const modelOutput = await adapters[config.mode](envelope, {
          config,
          fetchImpl: options.fetchImpl,
          requestApiKey: input?.requestApiKey ?? ""
        });
        return normalizeModelOutput(modelOutput, envelope, { makeId: options.makeId });
      } catch (error) {
        if (!shouldRetryModelOutput(error, config.mode, attempt)) throw error;
      }
    }
    throw new Error("Unreachable model-output retry state.");
  };
}

export { RETRYABLE_MODEL_OUTPUT_CODES, createCompiler, shouldRetryModelOutput };
