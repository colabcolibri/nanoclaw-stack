/**
 * Host-side container config for direct native `deepseek` provider.
 *
 * Forwards DEEPSEEK_API_KEY and DEEPSEEK_MODEL from host environment or .env into container.
 */
import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

const PASSTHROUGH_KEYS = ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_HISTORY_LIMIT'] as const;

registerProviderContainerConfig('deepseek', (ctx) => {
  const env: Record<string, string> = {};
  const dotenv = readEnvFile([...PASSTHROUGH_KEYS]);

  for (const key of PASSTHROUGH_KEYS) {
    const value = ctx.hostEnv[key] ?? dotenv[key];
    if (value) env[key] = value;
  }

  // Ensure default base URL if not customized
  if (!env.DEEPSEEK_BASE_URL) {
    env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
  }

  return { env };
});
