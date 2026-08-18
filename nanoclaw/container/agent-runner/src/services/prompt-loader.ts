import fs from 'fs';
import path from 'path';

/**
 * PromptLoader (SRP & Clean Architecture):
 * Loads externalized Markdown prompt templates from `src/prompts/` (or runtime directory).
 * Keeps all system prompts out of TypeScript code files for complete maintainability and zero hardcoding.
 */
export class PromptLoader {
  private static cache: Map<string, { content: string; mtime: number }> = new Map();

  /**
   * Loads a markdown prompt template and interpolates variables `{KEY}`.
   */
  static load(templateName: string, variables: Record<string, string> = {}): string {
    const rawTemplate = this.readTemplateFile(templateName);
    if (!rawTemplate) return '';

    let populated = rawTemplate;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      populated = populated.replace(regex, value || '');
    }

    return populated.trim();
  }

  /**
   * Reads template file from disk with cache validation.
   */
  private static readTemplateFile(templateName: string): string {
    const filename = templateName.endsWith('.md') ? templateName : `${templateName}.md`;

    const candidatePaths = [
      path.join(process.cwd(), 'src', 'prompts', filename),
      path.join(process.cwd(), 'prompts', filename),
      path.join('/opt/nanoclaw-stack/nanoclaw/container/agent-runner/src/prompts', filename),
      path.join(import.meta.dirname || '', '..', 'prompts', filename),
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const stat = fs.statSync(p);
          const cached = this.cache.get(p);
          if (cached && cached.mtime === stat.mtimeMs) {
            return cached.content;
          }

          const content = fs.readFileSync(p, 'utf-8');
          this.cache.set(p, { content, mtime: stat.mtimeMs });
          return content;
        }
      } catch {}
    }

    return '';
  }
}
