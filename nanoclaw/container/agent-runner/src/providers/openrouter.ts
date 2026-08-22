import { defineOpenAiApiProvider } from './define-openai-api-provider.js';
import { registerProvider } from './provider-registry.js';

export const OpenRouterProvider = defineOpenAiApiProvider('openrouter', 'OpenRouter');

registerProvider('openrouter', (options) => new OpenRouterProvider(options));
