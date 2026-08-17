import fs from 'fs';
import path from 'path';

export interface MemoryFact {
  category: string;
  fact: string;
  timestamp?: string;
}

export class MemoryManager {
  private static findMemoryPath(cwd: string): string | null {
    const candidates = [
      path.join(cwd, 'memory', 'index.md'),
      path.join(cwd, 'groups', 'barao', 'memory', 'index.md'),
      '/workspace/group/memory/index.md',
      '/opt/nanoclaw-stack/nanoclaw/groups/barao/memory/index.md',
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
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
      memPath = path.join(cwd, 'memory', 'index.md');
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
    } catch (err: any) {
      return { success: false, message: `Erro ao salvar memória: ${err.message}` };
    }
  }
}
