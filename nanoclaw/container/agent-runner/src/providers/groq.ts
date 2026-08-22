import { defineOpenAiApiProvider } from './define-openai-api-provider.js';
import { registerProvider } from './provider-registry.js';

export const GroqProvider = defineOpenAiApiProvider('groq', 'Groq');

registerProvider('groq', (options) => new GroqProvider(options));
