import { SkillsManager } from '../services/skills-manager.js';
import type { ToolDefinition } from './types.js';

export const LOAD_SKILL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'load_skill',
    description:
      'Loads the complete operational manual, business rules, and guidelines of a specialized skill into execution memory. Call this ONLY when you need detailed domain-specific instructions (e.g. store customer support rules, complex formatting guides, or quoting formulas).',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The exact name of the skill to load (e.g., "store-email-attendant", "gmail-inbox", "yampi-store", "notion-notes").',
        },
      },
      required: ['name'],
    },
  },
};

export async function handleLoadSkill(args: { name?: string }, cwd?: string): Promise<string> {
  const name = args.name?.trim().toLowerCase();
  if (!name) {
    return JSON.stringify({ error: 'name is required to load a skill' });
  }

  const skill = SkillsManager.getSkillByName(name, cwd);
  if (!skill) {
    const available = SkillsManager.discoverSkills(cwd).map((s) => s.name);
    return JSON.stringify({
      error: `Skill "${name}" not found. Available skills: ${available.join(', ')}`,
    });
  }

  return JSON.stringify({
    skill: skill.name,
    description: skill.description,
    domain: skill.domain || 'general',
    tools: skill.tools || [],
    manual: skill.instructions,
  });
}
