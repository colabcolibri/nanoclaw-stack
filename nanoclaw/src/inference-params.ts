/** Shared inference parameter shape (OpenAI-compatible APIs). */
export interface InferenceParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export function parseInferenceParamsJson(raw: string | null | undefined): InferenceParams {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: InferenceParams = {};
    if (typeof parsed.temperature === 'number') out.temperature = parsed.temperature;
    if (typeof parsed.maxTokens === 'number') out.maxTokens = parsed.maxTokens;
    if (typeof parsed.topP === 'number') out.topP = parsed.topP;
    if (typeof parsed.topK === 'number') out.topK = parsed.topK;
    if (typeof parsed.frequencyPenalty === 'number') out.frequencyPenalty = parsed.frequencyPenalty;
    if (typeof parsed.presencePenalty === 'number') out.presencePenalty = parsed.presencePenalty;
    return out;
  } catch {
    return {};
  }
}

export function mergeInferenceParams(
  providerDefaults: InferenceParams,
  modelOverrides: InferenceParams,
): InferenceParams {
  return { ...providerDefaults, ...modelOverrides };
}

/** Map InferenceParams to OpenAI chat/completions payload fields. */
export function applyInferenceParamsToPayload(payload: Record<string, unknown>, params: InferenceParams): void {
  if (params.temperature != null) payload.temperature = params.temperature;
  if (params.maxTokens != null) payload.max_tokens = params.maxTokens;
  if (params.topP != null) payload.top_p = params.topP;
  if (params.frequencyPenalty != null) payload.frequency_penalty = params.frequencyPenalty;
  if (params.presencePenalty != null) payload.presence_penalty = params.presencePenalty;
}
