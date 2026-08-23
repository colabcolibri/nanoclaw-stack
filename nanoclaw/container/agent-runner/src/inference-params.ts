/** Inference params — mirrored from host src/inference-params.ts for container runtime. */
export interface InferenceParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

const INFERENCE_KEYS: Array<keyof InferenceParams> = [
  'temperature',
  'maxTokens',
  'topP',
  'topK',
  'frequencyPenalty',
  'presencePenalty',
];

export function parseInferenceParamsObject(raw: unknown): InferenceParams {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const out: InferenceParams = {};
  for (const key of INFERENCE_KEYS) {
    const value = parsed[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function parseInferenceParamsJson(raw: string | null | undefined): InferenceParams {
  if (!raw?.trim()) return {};
  try {
    return parseInferenceParamsObject(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Lê bloco `inference:` do frontmatter YAML do AGENT.md. */
export function parseInferenceParamsYamlBlock(rawYaml: string): InferenceParams {
  const inline = rawYaml.match(/^inference:\s*(\{[\s\S]*?\})\s*$/m);
  if (inline?.[1]) {
    return parseInferenceParamsJson(inline[1]);
  }

  const block = rawYaml.match(/^inference:\s*\n((?:[ \t]+.+\n?)+)/m);
  if (!block?.[1]) return {};

  const obj: Record<string, unknown> = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\s+([A-Za-z]+):\s*(.+)\s*$/);
    if (!m) continue;
    const num = Number(m[2].trim());
    if (Number.isFinite(num)) obj[m[1]] = num;
  }
  return parseInferenceParamsObject(obj);
}

/** Serializa params para bloco YAML indentado (ou string vazia se vazio). */
export function formatInferenceParamsYamlBlock(params: InferenceParams | null | undefined): string {
  if (!params) return '';
  const lines: string[] = [];
  for (const key of INFERENCE_KEYS) {
    const value = params[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      lines.push(`  ${key}: ${value}`);
    }
  }
  if (lines.length === 0) return '';
  return `inference:\n${lines.join('\n')}`;
}

export function mergeInferenceParams(a: InferenceParams, b: InferenceParams): InferenceParams {
  return { ...a, ...b };
}

export function applyInferenceParamsToPayload(payload: Record<string, unknown>, params: InferenceParams): void {
  if (params.temperature != null) payload.temperature = params.temperature;
  if (params.maxTokens != null) payload.max_tokens = params.maxTokens;
  if (params.topP != null) payload.top_p = params.topP;
  if (params.topK != null) payload.top_k = params.topK;
  if (params.frequencyPenalty != null) payload.frequency_penalty = params.frequencyPenalty;
  if (params.presencePenalty != null) payload.presence_penalty = params.presencePenalty;
}
