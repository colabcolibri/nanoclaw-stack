import { BaseOpenAiProvider } from './base-openai.js';
import { registerProvider } from './provider-registry.js';
import type { ProviderOptions } from './types.js';

export class DeepSeekProvider extends BaseOpenAiProvider {
  constructor(options: ProviderOptions = {}) {
    super(
      {
        providerName: 'DeepSeek',
        defaultBaseUrl: 'https://api.deepseek.com',
        defaultModel: 'deepseek-v4-flash',
        envKeyName: 'DEEPSEEK_API_KEY',
        envBaseUrlName: 'DEEPSEEK_BASE_URL',
        envModelName: 'DEEPSEEK_MODEL',
        logFileName: 'deepseek_activity.log',
      },
      options
    );
  }
}

// Auto-register provider
registerProvider('deepseek', (options) => new DeepSeekProvider(options));
