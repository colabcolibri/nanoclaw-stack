import { ALL_TOOLS } from '../tools/index.js';

export interface RescuedCompletion {
  content: string;
  tool_calls: unknown[] | undefined;
}

interface FailedGenerationPayload {
  name?: unknown;
  arguments?: unknown;
  content?: unknown;
}

/**
 * Recuperação determinística para o formato `error.failed_generation` usado por
 * providers OpenAI-compatible (Groq, vLLM, etc.) quando a geração falha no parse
 * do tool call. Em vez de descartar a resposta, reconstrói o tool call com nome
 * normalizado (ex.: `web-research` → `web_search`) ou extrai texto utilizável.
 *
 * Retorna null quando não há nada recuperável.
 */
export function rescueFailedGeneration(errText: string): RescuedCompletion | null {
  let errJson: { error?: { failed_generation?: string } };
  try {
    errJson = JSON.parse(errText);
  } catch {
    return null;
  }

  const failedGen = errJson.error?.failed_generation;
  if (!failedGen) return null;

  try {
    const parsedGen = JSON.parse(failedGen) as FailedGenerationPayload | string;

    // Tentativa de tool call com nome em alias (ex.: web-research -> web_search)
    if (parsedGen && typeof parsedGen === 'object' && parsedGen.name) {
      const normalized = String(parsedGen.name).toLowerCase().replace(/-/g, '_');
      const targetName = normalized === 'web_research' ? 'web_search' : normalized;
      const targetTool = ALL_TOOLS[String(parsedGen.name)] || ALL_TOOLS[normalized] || ALL_TOOLS[targetName];
      if (targetTool) {
        return {
          content: '',
          tool_calls: [
            {
              id: `call_${Date.now()}`,
              type: 'function',
              function: {
                name: targetTool.definition.function.name,
                arguments:
                  typeof parsedGen.arguments === 'string'
                    ? parsedGen.arguments
                    : JSON.stringify(parsedGen.arguments || {}),
              },
            },
          ],
        };
      }
    }

    const extractedText =
      typeof parsedGen === 'string'
        ? parsedGen
        : typeof parsedGen.content === 'string'
          ? parsedGen.content
          : typeof parsedGen.arguments === 'string'
            ? parsedGen.arguments
            : '';
    if (extractedText && extractedText.trim().length > 5) {
      return { content: extractedText.trim(), tool_calls: undefined };
    }
  } catch {}

  return null;
}

/**
 * Detecta falhas causadas pelo próprio payload de tools (400 / tool_use_failed),
 * habilitando retry sem tools.
 */
export function isToolPayloadFailure(errText: string, status: number): boolean {
  try {
    const errJson = JSON.parse(errText) as { error?: { code?: string } };
    return errJson.error?.code === 'tool_use_failed' || status === 400;
  } catch {
    return false;
  }
}
