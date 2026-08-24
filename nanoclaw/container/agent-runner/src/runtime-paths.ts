import fs from 'fs';
import path from 'path';

/** Diretório canônico do grupo no container Docker (mount do host). */
export const CONTAINER_AGENT_DIR = '/workspace/agent';

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Required environment variable missing in agent-runner: ${name}`);
  }
  return value;
}

/**
 * Resolve o diretório do grupo de agente.
 * No container: /workspace/agent (mount). Fora do container: AGENT_GROUP_DIR.
 */
export function resolveAgentGroupDir(cwd?: string): string {
  if (fs.existsSync(CONTAINER_AGENT_DIR)) {
    return CONTAINER_AGENT_DIR;
  }
  const fromEnv = process.env.AGENT_GROUP_DIR?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  if (cwd && fs.existsSync(cwd)) {
    return cwd;
  }
  throw new Error(
    'Agent group directory not found. ' +
      'In the container expect /workspace/agent; on the host set AGENT_GROUP_DIR.',
  );
}

export function resolveAgentGroupFile(filename: string, cwd?: string): string {
  const groupDir = resolveAgentGroupDir(cwd);
  const filePath = path.join(groupDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Group file not found: ${filePath}`);
  }
  return filePath;
}

/**
 * Diretório data/ do NanoClaw no host (v2-sessions, llm-models.json, etc.).
 * Injetado pelo motor via NANOCLAW_DATA_DIR no spawn do container.
 */
export function resolveNanoclawDataDir(): string {
  const fromEnv = process.env.NANOCLAW_DATA_DIR?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  throw new Error(
    'NANOCLAW_DATA_DIR is not configured or does not exist. ' +
      'The host must pass -e NANOCLAW_DATA_DIR=<path/to/data> when spawning the container.',
  );
}

export function resolveNanoclawDataFile(relativePath: string): string {
  const filePath = path.join(resolveNanoclawDataDir(), relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`NanoClaw data file not found: ${filePath}`);
  }
  return filePath;
}

export function resolveUiPublicUrl(): string {
  return requireEnv('UI_PUBLIC_URL');
}

export function resolveInboundDbPath(cwd: string): string {
  const fromEnv = process.env.SESSION_INBOUND_DB_PATH?.trim();
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) {
      throw new Error(`SESSION_INBOUND_DB_PATH points to a missing file: ${fromEnv}`);
    }
    return fromEnv;
  }

  const workspaceInbound = '/workspace/inbound.db';
  if (fs.existsSync(workspaceInbound)) {
    return workspaceInbound;
  }

  const localInbound = path.join(cwd, 'inbound.db');
  if (fs.existsSync(localInbound)) {
    return localInbound;
  }

  throw new Error(
    'inbound.db not found. Expected at SESSION_INBOUND_DB_PATH, /workspace/inbound.db, or cwd/inbound.db.',
  );
}
