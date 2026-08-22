import fs from 'fs';
import path from 'path';

import { resolveAgentGroupDir } from '../runtime-paths.js';

export interface MemoryFact {
  category: string;
  fact: string;
  timestamp?: string;
}

export class MemoryManager {
  private static findMemoryPath(cwd: string): string | null {
    const groupDir = resolveAgentGroupDir(cwd);
    const memPath = path.join(groupDir, 'memory', 'index.md');
    if (fs.existsSync(memPath)) {
      return memPath;
    }
    const agentMem = path.join('/workspace/agent', 'memory', 'index.md');
    if (fs.existsSync(agentMem)) {
      return agentMem;
    }
    return null;
  }

  /**
   * Índice compacto da memória — só bullets curtos, para o sender quando o orquestrador pedir.
   */
  static loadMemoryIndex(cwd: string, maxLines = 20, maxLineChars = 120): string {
    const memPath = this.findMemoryPath(cwd);
    if (!memPath) return '';

    try {
      const content = fs.readFileSync(memPath, 'utf-8');
      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-') || line.startsWith('*'))
        .slice(0, maxLines)
        .map((line) => (line.length <= maxLineChars ? line : `${line.slice(0, maxLineChars - 3)}...`));

      return lines.join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Loads core long-term memories to be injected into system instructions.
   */
  static loadCoreMemory(cwd: string): string {
    const memPath = this.findMemoryPath(cwd);
    if (!memPath) return '';

    try {
      const content = fs.readFileSync(memPath, 'utf-8').trim();
      if (!content) return '';
      return `### 🧠 Memória Persistente de Longo Prazo:\n${content}`;
    } catch {
      return '';
    }
  }

  /**
   * Appends or updates a long-term memory fact.
   */
  static remember(cwd: string, fact: string, category = 'Geral'): { success: boolean; message: string } {
    let memPath = this.findMemoryPath(cwd);
    if (!memPath) {
      const groupDir = resolveAgentGroupDir(cwd);
      memPath = path.join(groupDir, 'memory', 'index.md');
      const dir = path.dirname(memPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    try {
      let content = fs.existsSync(memPath) ? fs.readFileSync(memPath, 'utf-8') : '# Memory Index\n\n## Core Memory\n';
      const cleanFact = fact.trim().replace(/^[-*]\s*/, '');
      const entry = `- **[${category}]** ${cleanFact} *(registrado em ${new Date().toLocaleDateString('pt-BR')})*`;

      if (content.includes('## Core Memory')) {
        content = content.replace('## Core Memory', `## Core Memory\n\n${entry}`);
      } else {
        content += `\n\n## Core Memory\n${entry}`;
      }

      fs.writeFileSync(memPath, content.trim() + '\n', 'utf-8');
      return { success: true, message: `Memória memorizada com sucesso: "${cleanFact}"` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Erro ao salvar memória: ${message}` };
    }
  }
}
