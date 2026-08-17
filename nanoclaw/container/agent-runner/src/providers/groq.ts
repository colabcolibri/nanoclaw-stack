import { BaseOpenAiProvider } from './base-openai.js';
import { registerProvider } from './provider-registry.js';
import type { ProviderOptions } from './types.js';

export class GroqProvider extends BaseOpenAiProvider {
  constructor(options: ProviderOptions = {}) {
    super(
      {
        providerName: 'Groq',
        defaultBaseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'openai/gpt-oss-120b',
        envKeyName: 'GROQ_API_KEY',
        envBaseUrlName: 'GROQ_BASE_URL',
        envModelName: 'GROQ_MODEL',
        logFileName: 'groq_activity.log',
      },
      options
    );
  }
}

// Auto-register provider
registerProvider('groq', (options) => new GroqProvider(options));
