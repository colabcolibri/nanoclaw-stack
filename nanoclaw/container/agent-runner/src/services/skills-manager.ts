import fs from 'fs';
import path from 'path';
import { ToolRouter } from '../tools/router.js';

export interface DiscoveredSkill {
  name: string;
  description: string;
  domain?: string;
  tools?: string[];
  keywords?: string[];
  instructions: string;
  sourcePath: string;
}

export class SkillsManager {
  private static cachedSkills: Map<string, DiscoveredSkill> = new Map();
  private static lastScanTime = 0;
  private static CACHE_TTL_MS = 10000; // 10s TTL for fast local iteration

  /**
   * Discovers all available skills from standard skill directories:
   * 1. System/Shared skills (/app/skills, /opt/nanoclaw-stack/nanoclaw/container/skills)
   * 2. Group custom skills (/workspace/agent/skills, <cwd>/skills)
   */
  static discoverSkills(cwd?: string): DiscoveredSkill[] {
    const now = Date.now();
    if (this.cachedSkills.size > 0 && now - this.lastScanTime < this.CACHE_TTL_MS && !cwd) {
      return Array.from(this.cachedSkills.values());
    }

    const candidateDirs = [
      '/app/skills',
      path.join(process.cwd(), 'skills'),
      path.join(process.cwd(), 'container', 'skills'),
      '/opt/nanoclaw-stack/nanoclaw/container/skills',
    ];

    if (cwd) {
      candidateDirs.unshift(path.join(cwd, 'skills'));
      candidateDirs.unshift('/workspace/agent/skills');
    }

    const discovered = new Map<string, DiscoveredSkill>();

    for (const baseDir of candidateDirs) {
      try {
        if (!fs.existsSync(baseDir)) continue;
        const entries = fs.readdirSync(baseDir);

        for (const entry of entries) {
          const skillDir = path.join(baseDir, entry);
          const stat = fs.statSync(skillDir);
          if (!stat.isDirectory()) continue;

          const skillMdPath = path.join(skillDir, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            const parsed = this.parseSkillFile(skillMdPath);
            if (parsed && !discovered.has(parsed.name)) {
              discovered.set(parsed.name, parsed);

              // Dynamically register or extend domain in ToolRouter
              if (parsed.domain && parsed.tools && parsed.tools.length > 0) {
                ToolRouter.registerDomain({
                  id: parsed.domain,
                  name: parsed.description || parsed.name,
                  description: parsed.description || '',
                  toolNames: parsed.tools,
                  keywords: parsed.keywords || [parsed.name],
                });
              }
            }
          }
        }
      } catch {}
    }

    this.cachedSkills = discovered;
    this.lastScanTime = now;
    return Array.from(discovered.values());
  }

  /**
   * Retrieves a single skill by exact name or normalized slug.
   */
  static getSkillByName(name: string, cwd?: string): DiscoveredSkill | null {
    const all = this.discoverSkills(cwd);
    const target = name.trim().toLowerCase();
    return all.find((s) => s.name.toLowerCase() === target) || null;
  }

  /**
   * Generates a compact, domain-grouped catalog of available skills (~80 to 120 tokens).
   * Replaces multi-thousand token raw markdown dumps in the Stage 1 system prompt.
   */
  static getCompactCatalogPrompt(cwd?: string): string {
    const allSkills = this.discoverSkills(cwd);
    if (allSkills.length === 0) return '';

    const domainGroups: Record<string, string[]> = {};

    for (const skill of allSkills) {
      const domain = skill.domain || 'Geral';
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      const desc = skill.description ? ` (${skill.description.slice(0, 70)}...)` : '';
      domainGroups[domain].push(`\`${skill.name}\`${desc}`);
    }

    const lines: string[] = ['## 📚 Catálogo de Habilidades Disponíveis (Skills on Demand):'];
    for (const [domain, items] of Object.entries(domainGroups)) {
      lines.push(`- **${domain.replace(/_/g, ' ').toUpperCase()}**: ${items.join(', ')}`);
    }

    lines.push('\n*(Se precisar carregar diretrizes completas ou regras de negócio específicas, execute `load_skill({ name: "..." })`)*');
    return lines.join('\n');
  }

  /**
   * Retrieves operational instructions from relevant skill folders matching the active tools.
   */
  static getSkillInstructionsForTools(toolNames: string[], cwd?: string): string {
    return this.getCompactCatalogPrompt(cwd);
  }

  /**
   * Parses a SKILL.md file with YAML frontmatter.
   */
  private static parseSkillFile(filePath: string): DiscoveredSkill | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

      if (!frontmatterMatch) {
        return {
          name: path.basename(path.dirname(filePath)),
          description: '',
          instructions: raw.trim(),
          sourcePath: filePath,
        };
      }

      const yamlBlock = frontmatterMatch[1];
      const body = frontmatterMatch[2];

      const meta = this.parseSimpleYaml(yamlBlock);
      const name = meta.name || path.basename(path.dirname(filePath));
      const description = meta.description || '';
      const domain = meta.domain;
      const tools = Array.isArray(meta.tools)
        ? meta.tools
        : meta.tool
        ? [meta.tool]
        : meta.tools
        ? String(meta.tools).split(',').map((s) => s.trim())
        : undefined;
      const keywords = Array.isArray(meta.keywords)
        ? meta.keywords
        : meta.keywords
        ? String(meta.keywords).split(',').map((s) => s.trim())
        : undefined;

      return {
        name,
        description,
        domain,
        tools,
        keywords,
        instructions: body.trim(),
        sourcePath: filePath,
      };
    } catch {
      return null;
    }
  }

  /**
   * Lightweight YAML parser for frontmatter blocks (handles strings, lists, arrays).
   */
  private static parseSimpleYaml(yamlText: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yamlText.split('\n');
    let currentKey = '';
    let isList = false;

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('- ') && currentKey && isList) {
        result[currentKey].push(line.slice(2).trim().replace(/^["']|["']$/g, ''));
        continue;
      }

      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();

        if (!val) {
          currentKey = key;
          isList = true;
          result[key] = [];
        } else if (val.startsWith('[') && val.endsWith(']')) {
          result[key] = val
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
          isList = false;
        } else {
          result[key] = val.replace(/^["']|["']$/g, '');
          isList = false;
        }
      }
    }

    return result;
  }
}
