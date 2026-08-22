import { buildLlmProviderEnvForProvider } from '../credentials/llm-provider-credentials.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('deepseek', () => ({
  env: buildLlmProviderEnvForProvider('deepseek'),
}));
