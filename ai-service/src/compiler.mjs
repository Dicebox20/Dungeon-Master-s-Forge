import { compileWithMock } from "./adapters/mock.mjs";
import { compileWithOpenAI } from "./adapters/openai.mjs";
import { normalizeModelOutput, validateForgeRequest } from "./contract.mjs";

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
    const modelOutput = await adapters[config.mode](envelope, {
      config,
      fetchImpl: options.fetchImpl,
      requestApiKey: input?.requestApiKey ?? ""
    });
    return normalizeModelOutput(modelOutput, envelope, { makeId: options.makeId });
  };
}

export { createCompiler };
