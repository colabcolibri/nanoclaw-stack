import { defineOpenAiApiProvider } from './define-openai-api-provider.js';
import { registerProvider } from './provider-registry.js';

export const DeepSeekProvider = defineOpenAiApiProvider('deepseek', 'DeepSeek');

registerProvider('deepseek', (options) => new DeepSeekProvider(options));
