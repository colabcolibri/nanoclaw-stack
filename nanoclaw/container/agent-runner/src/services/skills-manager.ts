import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolDomainRegistry } from '../tools/router.js';
import { asStringArray, attrString, parseFrontmatter } from './frontmatter.js';

const REPO_CONTAINER_SKILLS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'skills',
);

export interface DiscoveredSkill {
  name: string;
  description: string;
  domain?: string;
  tools?: string[];
  instructions: string;
  sourcePath: string;
}

export class SkillsManager {
  private static cachedSkills: Map<string, DiscoveredSkill> = new Map();
  private static lastScanTime = 0;
  private static CACHE_TTL_MS = 10000; // 10s TTL for fast local iteration

  /**
   * Discovers all available skills from standard skill directories:
   * 1. System/Shared skills (/app/skills)
   * 2. Group custom skills (/workspace/agent/skills, <cwd>/skills)
   */
  static discoverSkills(cwd?: string): DiscoveredSkill[] {
    const now = Date.now();
    if (this.cachedSkills.size > 0 && now - this.lastScanTime < this.CACHE_TTL_MS && !cwd) {
      return Array.from(this.cachedSkills.values());
    }

    const candidateDirs = [
      '/app/skills',
      REPO_CONTAINER_SKILLS_DIR,
      path.join(process.cwd(), 'skills'),
      path.join(process.cwd(), 'container', 'skills'),
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

              // Register tool domain for syncRegistry validation
              if (parsed.domain && parsed.tools && parsed.tools.length > 0) {
                ToolDomainRegistry.registerDomain({
                  id: parsed.domain,
                  name: parsed.description || parsed.name,
                  description: parsed.description || '',
                  toolNames: parsed.tools,
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
   * Full operational manuals for an agent's assigned skills — injected into the worker
   * system prompt so scheduling/email rules are in context without a load_skill round-trip.
   */
  static getAgentSkillsPrompt(skillNames: string[], cwd?: string): string {
    if (skillNames.length === 0) return '';

    const sections: string[] = [];
    for (const skillName of skillNames) {
      const skill = this.getSkillByName(skillName, cwd);
      if (!skill?.instructions) continue;
      sections.push(`## Skill: ${skill.name}\n\n${skill.instructions}`);
    }

    if (sections.length === 0) return '';
    return ['## Assigned skill manuals (follow these)', ...sections].join('\n\n');
  }

  /**
   * Replaces multi-thousand token raw markdown dumps in the Stage 1 system prompt.
   */
  static getCompactCatalogPrompt(cwd?: string): string {
    const allSkills = this.discoverSkills(cwd);
    if (allSkills.length === 0) return '';

    const domainGroups: Record<string, string[]> = {};

    for (const skill of allSkills) {
      const domain = skill.domain || 'General';
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      const desc = skill.description ? ` (${skill.description.slice(0, 70)}...)` : '';
      domainGroups[domain].push(`\`${skill.name}\`${desc}`);
    }

    const lines: string[] = ['## 📚 Available Skills Catalog (Skills on Demand):'];
    for (const [domain, items] of Object.entries(domainGroups)) {
      lines.push(`- **${domain.replace(/_/g, ' ').toUpperCase()}**: ${items.join(', ')}`);
    }

    lines.push('\n*(Important: The entries above are business rule SKILLS, not tool names. To read a skill manual, call `load_skill({ name: "..." })`. To execute real-world actions, invoke tools directly like `web_search`, `browse_url`, `google_gmail`, etc.)*');
    return lines.join('\n');
  }

  /**
   * Parses a SKILL.md file with YAML frontmatter.
   * Returns null when the file has no frontmatter or fails to parse (logged).
   */
  private static parseSkillFile(filePath: string): DiscoveredSkill | null {
    let doc: ReturnType<typeof parseFrontmatter>;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      doc = parseFrontmatter(raw);
    } catch (err) {
      console.warn(`[skills-manager] Falha ao parsear ${filePath}:`, err instanceof Error ? err.message : err);
      return null;
    }
    if (!doc) {
      // SKILL.md sem frontmatter: manual puro, nome derivado da pasta.
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return {
          name: path.basename(path.dirname(filePath)),
          description: '',
          instructions: raw.trim(),
          sourcePath: filePath,
        };
      } catch {
        return null;
      }
    }

    const { attrs, body } = doc;
    const tools = asStringArray(attrs.tools) ?? asStringArray(attrs.tool);

    return {
      name: attrString(attrs, 'name') || path.basename(path.dirname(filePath)),
      description: attrString(attrs, 'description') || '',
      domain: attrString(attrs, 'domain'),
      tools,
      instructions: body,
      sourcePath: filePath,
    };
  }
}
