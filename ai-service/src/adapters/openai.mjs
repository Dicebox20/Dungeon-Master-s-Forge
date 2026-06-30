import { ServiceError } from "../errors.mjs";
import { buildSystemPrompt } from "../prompt.mjs";

function chooseModel(envelope, config) {
  const requested = envelope.options.model || config.defaultModel;
  if (!config.allowedModels.includes(requested)) {
    throw new ServiceError(400, "model_not_allowed", `Model ${requested} is not allowed by this service.`);
  }
  return requested;
}

function outputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text;
  const text = (response?.output ?? []).flatMap(item => item?.content ?? [])
    .filter(content => content?.type === "output_text" && typeof content.text === "string")
    .map(content => content.text)
    .join("");
  if (text.trim()) return text;

  const refusal = (response?.output ?? []).flatMap(item => item?.content ?? [])
    .find(content => content?.type === "refusal")?.refusal;
  if (refusal) throw new ServiceError(422, "model_refusal", "The model declined to compile this item request.");
  throw new ServiceError(502, "empty_model_response", "OpenAI returned no item specification text.");
}

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        // Fall through to the stable public error below.
      }
    }
    throw new ServiceError(502, "invalid_model_json", "OpenAI returned text that was not valid JSON.");
  }
}

async function compileWithOpenAI(envelope, options) {
  const { config } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new ServiceError(500, "missing_fetch", "No fetch implementation is available.");

  const model = chooseModel(envelope, config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.openaiTimeoutMs);
  let response;
  try {
    response = await fetchImpl(`${config.openaiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: "system", content: buildSystemPrompt(envelope) },
          { role: "user", content: envelope.request }
        ],
        max_output_tokens: config.maxOutputTokens,
        text: { format: { type: "json_object" } }
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new ServiceError(504, "openai_timeout", "OpenAI did not respond before the service timeout.");
    throw new ServiceError(502, "openai_unreachable", "The service could not reach OpenAI.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let providerCode = "";
    try {
      providerCode = String((await response.json())?.error?.code ?? "");
    } catch {
      // Do not expose untrusted upstream bodies.
    }
    const suffix = providerCode ? ` (${providerCode})` : "";
    throw new ServiceError(502, "openai_error", `OpenAI returned HTTP ${response.status}${suffix}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ServiceError(502, "invalid_openai_response", "OpenAI returned invalid JSON.");
  }
  return parseModelJson(outputText(payload));
}

export { chooseModel, compileWithOpenAI, outputText, parseModelJson };
