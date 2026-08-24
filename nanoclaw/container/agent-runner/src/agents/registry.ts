import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Department, SpecialistAgent } from './types.js';
import { ALL_TOOLS } from '../tools/index.js';
import type { ToolDefinition } from '../tools/types.js';
import { CONTAINER_AGENT_DIR } from '../runtime-paths.js';
import { parseInferenceParamsYamlBlock } from '../inference-params.js';
import { SkillsManager } from '../services/skills-manager.js';
import { asStringArray, attrBool, attrString, parseFrontmatter } from '../services/frontmatter.js';

const REPO_CONTAINER_AGENTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'agents',
);

export class AgentRegistry {
  private static departments: Map<string, Department> = new Map();
  private static agents: Map<string, SpecialistAgent> = new Map();
  private static lastScanTime = 0;
  private static CACHE_TTL_MS = 10000;

  public static readonly GLOBAL_SKILLS: string[] = [
    'retrieve_message_context',
    'manage_memory',
    'run_command',
    'read_file',
    'load_skill',
  ];

  static {
    this.initializeDefaults();
    this.discoverAgents();
  }

  static initializeDefaults(): void {
    this.departments.clear();
    this.agents.clear();
    this.loadDefaultDepartments();
  }

  /**
   * Departamentos default vêm de `departments.json` (data, não código) —
   * mesma filosofia AGENT.md-as-data. Primeiro diretório encontrado ganha.
   */
  private static loadDefaultDepartments(): void {
    const candidateDirs = [
      '/app/agents',
      path.join(CONTAINER_AGENT_DIR, 'agents'),
      REPO_CONTAINER_AGENTS_DIR,
      path.join(process.cwd(), 'agents'),
      path.join(process.cwd(), 'container', 'agents'),
    ];

    for (const baseDir of candidateDirs) {
      const filePath = path.join(baseDir, 'departments.json');
      if (!fs.existsSync(filePath)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
          departments?: Array<{ id?: string; name?: string; description?: string; agentIds?: string[] }>;
        };
        for (const seed of raw.departments ?? []) {
          if (!seed?.id) continue;
          this.registerDepartment({
            id: seed.id,
            name: seed.name || seed.id.toUpperCase(),
            description: seed.description || '',
            agentIds: Array.isArray(seed.agentIds) ? [...seed.agentIds] : [],
          });
        }
        return;
      } catch (err) {
        console.warn(
          `[agent-registry] Falha ao carregar ${filePath}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /**
   * Discovers and parses AGENT.md files from standard filesystem locations.
   */
  static discoverAgents(cwd?: string): SpecialistAgent[] {
    const now = Date.now();
    if (this.agents.size > 0 && now - this.lastScanTime < this.CACHE_TTL_MS && !cwd) {
      return Array.from(this.agents.values());
    }

    const candidateDirs = [
      '/app/agents',
      path.join(CONTAINER_AGENT_DIR, 'agents'),
      REPO_CONTAINER_AGENTS_DIR,
      path.join(process.cwd(), 'agents'),
      path.join(process.cwd(), 'container', 'agents'),
    ];

    // Group overrides must win over shared /app/agents (last registration wins).
    if (cwd) {
      candidateDirs.push(path.join(cwd, 'agents'));
    }

    for (const baseDir of candidateDirs) {
      try {
        if (!fs.existsSync(baseDir)) continue;
        const entries = fs.readdirSync(baseDir);

        for (const entry of entries) {
          const agentDir = path.join(baseDir, entry);
          const stat = fs.statSync(agentDir);
          if (!stat.isDirectory()) continue;

          const agentMdPath = path.join(agentDir, 'AGENT.md');
          if (fs.existsSync(agentMdPath)) {
            const parsed = this.parseAgentFile(agentMdPath);
            if (parsed) {
              this.registerAgent(parsed);
            }
          }
        }
      } catch {}
    }

    this.lastScanTime = now;
    return Array.from(this.agents.values());
  }

  /**
   * Parses an AGENT.md file with YAML frontmatter + prompt body.
   * Returns null when the file has no frontmatter or fails to parse (logged).
   */
  static parseAgentFile(filePath: string): SpecialistAgent | null {
    let doc: ReturnType<typeof parseFrontmatter>;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      doc = parseFrontmatter(content);
    } catch (err) {
      console.warn(`[agent-registry] Falha ao parsear ${filePath}:`, err instanceof Error ? err.message : err);
      return null;
    }
    if (!doc) return null;

    const { attrs, rawYaml } = doc;
    const id = attrString(attrs, 'id') || path.basename(path.dirname(filePath));
    const name = attrString(attrs, 'name') || id;
    const departmentId = attrString(attrs, 'department', 'departmentId') || 'general';
    const role = attrString(attrs, 'role') || 'Specialist agent';
    const description = attrString(attrs, 'description') || role;
    const model = attrString(attrs, 'model');
    const executionProfile = attrString(attrs, 'execution_profile');
    const allowGlobalSkills = attrBool(attrs, 'allow_global_skills', true);
    const inferenceParsed = parseInferenceParamsYamlBlock(rawYaml);
    const inferenceParams =
      Object.keys(inferenceParsed).length > 0 ? inferenceParsed : undefined;

    const skills = asStringArray(attrs.skills) ?? [];
    const capabilities = (asStringArray(attrs.capabilities) ?? []).map((c) =>
      c as import('../execution/types.js').AgentCapability,
    );

    return {
      id,
      name,
      departmentId,
      role,
      description,
      systemPrompt: doc.body,
      agentSkills: skills,
      allowGlobalSkills,
      model,
      inferenceParams,
      executionProfile,
      capabilities: capabilities.length > 0 ? capabilities : undefined,
    };
  }

  static registerDepartment(dept: Department): void {
    this.departments.set(dept.id, dept);
  }

  static registerAgent(agent: SpecialistAgent): void {
    this.agents.set(agent.id, agent);
    let dept = this.departments.get(agent.departmentId);
    if (!dept) {
      // Auto-create department if not yet defined
      dept = {
        id: agent.departmentId,
        name: agent.departmentId.toUpperCase(),
        description: `Departamento ${agent.departmentId}`,
        agentIds: [],
      };
      this.departments.set(agent.departmentId, dept);
    }
    if (!dept.agentIds.includes(agent.id)) {
      dept.agentIds.push(agent.id);
    }
  }

  static getDepartments(cwd?: string): Department[] {
    this.discoverAgents(cwd);
    return Array.from(this.departments.values());
  }

  static getDepartment(id: string, cwd?: string): Department | null {
    this.discoverAgents(cwd);
    return this.departments.get(id) || null;
  }

  static getAgentsInDepartment(deptId: string, cwd?: string): SpecialistAgent[] {
    this.discoverAgents(cwd);
    const dept = this.departments.get(deptId);
    if (!dept) return [];
    return dept.agentIds
      .map((id) => this.agents.get(id))
      .filter((a): a is SpecialistAgent => Boolean(a));
  }

  static getAgent(id: string, cwd?: string): SpecialistAgent | null {
    this.discoverAgents(cwd);
    return this.agents.get(id) || null;
  }

  static getAllAgents(cwd?: string): SpecialistAgent[] {
    this.discoverAgents(cwd);
    return Array.from(this.agents.values());
  }

  private static resolveToolName(name: string): string {
    return name.toLowerCase().replace(/-/g, '_');
  }

  private static addResolvedToolName(allowedToolNames: Set<string>, name: string): void {
    const normalized = this.resolveToolName(name);
    if (ALL_TOOLS[name] || ALL_TOOLS[normalized]) {
      allowedToolNames.add(normalized);
    }
  }

  /**
   * Resolves skill slugs from AGENT.md into concrete tool names via SKILL.md frontmatter.
   */
  static resolveToolNamesForAgent(agent: SpecialistAgent, cwd?: string): string[] {
    const allowedToolNames = new Set<string>();

    for (const skillName of agent.agentSkills) {
      const skill = SkillsManager.getSkillByName(skillName, cwd);
      if (skill?.tools?.length) {
        for (const toolName of skill.tools) {
          this.addResolvedToolName(allowedToolNames, toolName);
        }
        continue;
      }

      this.addResolvedToolName(allowedToolNames, skillName);
    }

    if (agent.allowGlobalSkills !== false) {
      for (const globalSkill of this.GLOBAL_SKILLS) {
        this.addResolvedToolName(allowedToolNames, globalSkill);
      }
    }

    return [...allowedToolNames];
  }

  /**
   * Resolves the available tool definitions for a specific specialist agent.
   * Encapsulates agent-specific skills and selectively attaches global utility skills.
   */
  static getToolsForAgent(agentId: string, cwd?: string): ToolDefinition[] {
    const agent = this.getAgent(agentId, cwd);
    if (!agent) return [];

    const tools: ToolDefinition[] = [];
    const seen = new Set<string>();

    for (const toolName of this.resolveToolNamesForAgent(agent, cwd)) {
      if (seen.has(toolName)) continue;
      seen.add(toolName);

      const toolObj = ALL_TOOLS[toolName];
      if (toolObj?.definition) {
        tools.push(toolObj.definition);
      }
    }

    return tools;
  }

  static getDepartmentCatalogPrompt(cwd?: string): string {
    const depts = this.getDepartments(cwd);
    const lines = ['## Available specialist departments:'];
    for (const d of depts) {
      lines.push(`- **[${d.id}]** ${d.name}: ${d.description}`);
    }
    return lines.join('\n');
  }

  /**
   * Semantic catalog for LLM triage — language-agnostic.
   * Routing must use scope descriptions and capability ids, never keyword matching.
   */
  static buildTriageCatalog(cwd?: string): string {
    const lines: string[] = [
      'Pick the best specialist by semantic intent. User message may be in any language.',
      '',
    ];

    for (const dept of this.getDepartments(cwd)) {
      lines.push(`## ${dept.id}`);
      lines.push(`name: ${dept.name}`);
      lines.push(`scope: ${dept.description}`);
      lines.push('specialists:');

      for (const agent of this.getAgentsInDepartment(dept.id, cwd)) {
        const capabilityLine = agent.capabilities?.length
          ? `capabilities: ${agent.capabilities.join(', ')}`
          : undefined;
        lines.push(`- id: ${agent.id}`);
        lines.push(`  role: ${agent.role}`);
        lines.push(`  description: ${agent.description}`);
        if (capabilityLine) lines.push(`  ${capabilityLine}`);
      }

      lines.push('');
    }

    return lines.join('\n').trim();
  }

  static getAgentsInDepartmentPrompt(deptId: string, cwd?: string): string {
    const agents = this.getAgentsInDepartment(deptId, cwd);
    if (agents.length === 0) return 'No agents registered in this department.';
    const lines = [`## Specialists in department [${deptId}]:`];
    for (const a of agents) {
      const caps = a.capabilities?.length ? ` | capabilities: ${a.capabilities.join(', ')}` : '';
      lines.push(`- **[${a.id}]** ${a.name}: ${a.role}${caps}`);
    }
    return lines.join('\n');
  }
}
