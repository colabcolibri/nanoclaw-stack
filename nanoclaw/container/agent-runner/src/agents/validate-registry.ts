import { ALL_TOOLS } from '../tools/index.js';
import { SkillsManager } from '../services/skills-manager.js';
import { AgentRegistry } from './registry.js';

export type AgentRegistryIssueLevel = 'error' | 'warning';

export interface AgentRegistryIssue {
  level: AgentRegistryIssueLevel;
  code: string;
  message: string;
  agentId?: string;
  departmentId?: string;
  skill?: string;
}

function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/-/g, '_');
}

function toolExists(name: string): boolean {
  const normalized = normalizeToolName(name);
  return Boolean(ALL_TOOLS[name] || ALL_TOOLS[normalized]);
}

/**
 * Static validation of discovered agents, departments, skills, and tool wiring.
 * Run in CI (`bun test`) and at agent-runner startup — misconfig must fail loud.
 */
export function validateAgentRegistry(cwd?: string): AgentRegistryIssue[] {
  const issues: AgentRegistryIssue[] = [];

  AgentRegistry.initializeDefaults();
  AgentRegistry.discoverAgents(cwd);

  const agents = AgentRegistry.getAllAgents(cwd);
  const agentsById = new Map(agents.map((a) => [a.id, a]));

  if (agents.length === 0) {
    issues.push({
      level: 'error',
      code: 'no_agents',
      message: 'No AGENT.md discovered — specialist registry is empty.',
    });
    return issues;
  }

  for (const dept of AgentRegistry.getDepartments(cwd)) {
    if (dept.agentIds.length === 0) {
      issues.push({
        level: 'error',
        code: 'empty_department',
        departmentId: dept.id,
        message: `Department "${dept.id}" has no registered agents.`,
      });
    }

    for (const agentId of dept.agentIds) {
      if (!agentsById.has(agentId)) {
        issues.push({
          level: 'error',
          code: 'department_unknown_agent',
          departmentId: dept.id,
          agentId,
          message: `Department "${dept.id}" references agent "${agentId}" with no discovered AGENT.md.`,
        });
      }
    }
  }

  for (const agent of agents) {
    if (!agent.systemPrompt.trim()) {
      issues.push({
        level: 'error',
        code: 'empty_system_prompt',
        agentId: agent.id,
        message: `Agent "${agent.id}" has an empty AGENT.md body.`,
      });
    }

    if (agent.agentSkills.length === 0) {
      issues.push({
        level: 'warning',
        code: 'no_skills',
        agentId: agent.id,
        message: `Agent "${agent.id}" declares no skills: — only global tools will be available.`,
      });
    }

    for (const skillName of agent.agentSkills) {
      const skill = SkillsManager.getSkillByName(skillName, cwd);
      if (!skill) {
        issues.push({
          level: 'error',
          code: 'missing_skill',
          agentId: agent.id,
          skill: skillName,
          message: `Agent "${agent.id}" references missing skill "${skillName}" (no SKILL.md).`,
        });
        continue;
      }

      if (!skill.instructions.trim()) {
        issues.push({
          level: 'warning',
          code: 'empty_skill_manual',
          agentId: agent.id,
          skill: skillName,
          message: `Skill "${skillName}" (agent "${agent.id}") has an empty manual.`,
        });
      }

      const declaredTools = skill.tools ?? [];
      for (const toolName of declaredTools) {
        if (!toolExists(toolName)) {
          issues.push({
            level: 'error',
            code: 'skill_unknown_tool',
            agentId: agent.id,
            skill: skillName,
            message: `Skill "${skillName}" declares tool "${toolName}" which does not exist in ALL_TOOLS.`,
          });
        }
      }

      if (declaredTools.length === 0) {
        issues.push({
          level: 'warning',
          code: 'skill_no_tools',
          agentId: agent.id,
          skill: skillName,
          message: `Skill "${skillName}" does not declare tools: in frontmatter.`,
        });
      }
    }

    const resolvedTools = new Set(AgentRegistry.resolveToolNamesForAgent(agent, cwd));
    if (resolvedTools.size === 0) {
      issues.push({
        level: 'error',
        code: 'agent_no_tools',
        agentId: agent.id,
        message: `Agent "${agent.id}" resolves no tools — check skills and allow_global_skills.`,
      });
    }

    for (const skillName of agent.agentSkills) {
      const skill = SkillsManager.getSkillByName(skillName, cwd);
      if (!skill?.tools?.length) continue;
      for (const toolName of skill.tools) {
        const normalized = normalizeToolName(toolName);
        if (toolExists(toolName) && !resolvedTools.has(normalized)) {
          issues.push({
            level: 'error',
            code: 'skill_tool_not_on_agent',
            agentId: agent.id,
            skill: skillName,
            message: `Agent "${agent.id}" does not expose tool "${toolName}" required by skill "${skillName}".`,
          });
        }
      }
    }

    const skillPrompt = SkillsManager.getAgentSkillsPrompt(agent.agentSkills, cwd);
    if (agent.agentSkills.length > 0 && !skillPrompt.trim()) {
      issues.push({
        level: 'error',
        code: 'skills_not_injectable',
        agentId: agent.id,
        message: `Agent "${agent.id}" lists skills but none have an injectable manual for the worker.`,
      });
    }
  }

  return issues;
}

export function formatAgentRegistryIssues(issues: AgentRegistryIssue[]): string {
  return issues
    .map((i) => {
      const prefix = i.level === 'error' ? 'error' : 'warn';
      return `  [${prefix}] ${i.message}`;
    })
    .join('\n');
}

/** Throws when any error-level issue exists. Warnings are logged only if `log` is provided. */
export function assertAgentRegistryValid(
  cwd?: string,
  log?: (line: string) => void,
): void {
  const issues = validateAgentRegistry(cwd);
  const warnings = issues.filter((i) => i.level === 'warning');
  const errors = issues.filter((i) => i.level === 'error');

  for (const w of warnings) {
    log?.(`[agent-registry] warning: ${w.message}`);
  }

  if (errors.length === 0) return;

  const body = formatAgentRegistryIssues(errors);
  throw new Error(`Agent registry validation failed:\n${body}`);
}
