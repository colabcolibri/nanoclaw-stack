/**
 * Host-side container config for direct native `groq` provider.
 *
 * Forwards GROQ_API_KEY, GROQ_MODEL, and GROQ_BASE_URL from host environment or .env into container.
 */
import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

const PASSTHROUGH_KEYS = ['GROQ_API_KEY', 'GROQ_MODEL', 'GROQ_BASE_URL', 'GROQ_HISTORY_LIMIT'] as const;

registerProviderContainerConfig('groq', (ctx) => {
  const env: Record<string, string> = {};
  const dotenv = readEnvFile([...PASSTHROUGH_KEYS]);

  for (const key of PASSTHROUGH_KEYS) {
    const value = ctx.hostEnv[key] ?? dotenv[key];
    if (value) env[key] = value;
  }

  // Ensure default base URL if not customized
  if (!env.GROQ_BASE_URL) {
    env.GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
  }

  return { env };
});
