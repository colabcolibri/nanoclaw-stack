import fs from 'fs';
import path from 'path';

import { resolveAgentGroupDir } from '../runtime-paths.js';

/** Identidade / voz / persona — arquivo canônico do grupo (SOUL). */
export const SOUL_FILE = 'instructions.prepend.md';

/** Regras operacionais, módulos e comportamento estendido — separado da identidade. */
export const CONTEXT_FILE = 'instructions.context.md';

function readGroupMarkdown(cwd: string, filename: string): string {
  const groupDir = resolveAgentGroupDir(cwd);
  const filePath = path.join(groupDir, filename);

  if (!fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf-8').trim();
}

/**
 * Carrega arquivos explícitos do grupo — sem extração, truncamento ou regex.
 * compact: só SOUL (instructions.prepend.md)
 * full: SOUL + instructions.context.md (se existir)
 */
export class PersonaLoader {
  static loadSoul(cwd: string): string {
    return readGroupMarkdown(cwd, SOUL_FILE);
  }

  static loadContext(cwd: string): string {
    return readGroupMarkdown(cwd, CONTEXT_FILE);
  }

  static resolveForSender(
    cwd: string,
    injectedSoul: string | undefined,
    mode: SoulMode = 'compact',
  ): string {
    const soul = this.loadSoul(cwd) || injectedSoul?.trim() || '';
    if (!soul) return '';

    if (mode !== 'full') return soul;

    const context = this.loadContext(cwd);
    return context ? `${soul}\n\n${context}` : soul;
  }
}

export type SoulMode = 'compact' | 'full';
