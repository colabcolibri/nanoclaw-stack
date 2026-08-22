import fs from 'fs';
import path from 'path';

/** Identidade / voz / persona — arquivo canônico do grupo (SOUL). */
export const SOUL_FILE = 'instructions.prepend.md';

/** Regras operacionais, módulos e comportamento estendido — separado da identidade. */
export const CONTEXT_FILE = 'instructions.context.md';

export type SoulMode = 'compact' | 'full';

function readGroupMarkdown(cwd: string, filename: string): string {
  const candidates = [
    path.join(cwd, filename),
    path.join('/workspace/group', filename),
    ...(process.env.AGENT_GROUP_DIR ? [path.join(process.env.AGENT_GROUP_DIR, filename)] : []),
    path.join('/opt/nanoclaw-stack/nanoclaw/groups/barao', filename),
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8').trim();
        if (content) return content;
      }
    } catch {}
  }

  return '';
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
