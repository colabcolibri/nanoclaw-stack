import { BaseOpenAiProvider } from './base-openai.js';
import type { ProviderOptions } from './types.js';

/**
 * Factory interna para providers HTTP OpenAI-style.
 * Cada vendor tem seu próprio arquivo (groq.ts, deepseek.ts, …) que chama isto.
 * Não é registrado como provider em runtime.
 */
export function defineOpenAiApiProvider(providerId: string, providerLabel: string) {
  return class extends BaseOpenAiProvider {
    readonly catalogProviderId = providerId;

    constructor(options: ProviderOptions = {}) {
      super(
        {
          providerName: providerLabel,
          defaultBaseUrl: '',
          defaultModel: '',
          envKeyName: 'NANOCLAW_LLM_PLACEHOLDER',
          logFileName: `${providerId}_activity.log`,
        },
        options,
      );
    }
  };
}
