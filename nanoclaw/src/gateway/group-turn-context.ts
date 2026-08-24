import fs from 'fs';
import path from 'path';

import { readGroupPersona } from '../group-persona.js';

/** Regras operacionais do grupo — mesmo arquivo que o agent-runner (`instructions.context.md`). */
export const INSTRUCTIONS_CONTEXT_FILE = 'instructions.context.md';

export interface GroupTurnContext {
  personaInstructions: string;
  systemInstructions: string;
  coreMemory: string;
}

function readGroupContextInstructions(groupDir: string): string {
  const filePath = path.join(groupDir, INSTRUCTIONS_CONTEXT_FILE);
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT') return '';
    throw err;
  }
}

function readGroupCoreMemory(groupDir: string): string {
  const memPath = path.join(groupDir, 'memory', 'index.md');
  try {
    if (!fs.existsSync(memPath)) return '';
    const content = fs.readFileSync(memPath, 'utf-8').trim();
    if (!content) return '';
    return `### Long-term memory\n${content}`;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT') return '';
    throw err;
  }
}

/** Carrega persona, contexto operacional e memória do disco do grupo (host Node). */
export function loadGroupTurnContext(groupDir: string): GroupTurnContext {
  return {
    personaInstructions: readGroupPersona(groupDir) ?? '',
    systemInstructions: readGroupContextInstructions(groupDir),
    coreMemory: readGroupCoreMemory(groupDir),
  };
}
