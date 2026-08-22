import { buildLlmProviderEnvForProvider } from '../credentials/llm-provider-credentials.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('openrouter', () => ({
  env: buildLlmProviderEnvForProvider('openrouter'),
}));
