import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Department, SpecialistAgent } from './types.js';
import { ALL_TOOLS } from '../tools/index.js';
import type { ToolDefinition } from '../tools/types.js';
import { CONTAINER_AGENT_DIR } from '../runtime-paths.js';
import { SkillsManager } from '../services/skills-manager.js';

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

    // 1. Productivity & Communication Department
    this.registerDepartment({
      id: 'productivity',
      name: 'Produtividade & Comunicação',
      description: 'Gestão de agendas, e-mails Gmail, notas e banco de dados Notion, compromissos e agendamentos.',
      agentIds: ['productivity_attendant', 'notion_architect'],
    });

    // 2. Commerce & Logistics Department
    this.registerDepartment({
      id: 'commerce',
      name: 'Comércio, Logística & Revenda',
      description: 'Gestão de pedidos na loja Yampi, cálculo de preços de revenda/atacado e estimativa de frete Correios.',
      agentIds: ['store_attendant', 'pricing_logistics_agent'],
    });

    // 3. Research & Intelligence Department
    this.registerDepartment({
      id: 'research_intel',
      name: 'Pesquisa, Inteligência & Web',
      description: 'Buscas na web em tempo real, navegação em URLs e monitoramento de métricas e custos de tokens.',
      agentIds: ['web_researcher', 'system_metrics_agent'],
    });

    // 4. General / Operations Department
    this.registerDepartment({
      id: 'operations',
      name: 'Operações & Sistema',
      description: 'Operações de sistema de arquivos, comandos de infraestrutura e memória compartilhada.',
      agentIds: ['system_operator'],
    });
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
   */
  static parseAgentFile(filePath: string): SpecialistAgent | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

      if (!frontmatterMatch) {
        return null;
      }

      const rawYaml = frontmatterMatch[1];
      const body = frontmatterMatch[2].trim();

      const parseYamlField = (fieldName: string): string | undefined => {
        const m = rawYaml.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
        return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
      };

      const id = parseYamlField('id') || path.basename(path.dirname(filePath));
      const name = parseYamlField('name') || id;
      const departmentId = parseYamlField('department') || parseYamlField('departmentId') || 'general';
      const role = parseYamlField('role') || 'Agente Especialista';
      const description = parseYamlField('description') || role;
      const model = parseYamlField('model');
      const executionProfile = parseYamlField('execution_profile');
      const allowGlobalStr = parseYamlField('allow_global_skills');
      const allowGlobalSkills = allowGlobalStr !== undefined ? allowGlobalStr === 'true' : true;

      // Parse skills list
      const skills: string[] = [];
      const skillsSection = rawYaml.match(/skills:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (skillsSection && skillsSection[1]) {
        const lines = skillsSection[1].split('\n');
        for (const line of lines) {
          const item = line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, '');
          if (item) skills.push(item);
        }
      }

      const capabilities: import('../execution/types.js').AgentCapability[] = [];
      const capabilitiesSection = rawYaml.match(/capabilities:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (capabilitiesSection && capabilitiesSection[1]) {
        const lines = capabilitiesSection[1].split('\n');
        for (const line of lines) {
          const item = line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, '');
          if (item) capabilities.push(item as import('../execution/types.js').AgentCapability);
        }
      }

      return {
        id,
        name,
        departmentId,
        role,
        description,
        systemPrompt: body,
        agentSkills: skills,
        allowGlobalSkills,
        model,
        executionProfile,
        capabilities: capabilities.length > 0 ? capabilities : undefined,
      };
    } catch {
      return null;
    }
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
    const lines = ['## Departamentos Especializados Disponíveis:'];
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
    if (agents.length === 0) return 'Nenhum agente registrado neste departamento.';
    const lines = [`## Especialistas no Departamento [${deptId}]:`];
    for (const a of agents) {
      const caps = a.capabilities?.length ? ` | capabilities: ${a.capabilities.join(', ')}` : '';
      lines.push(`- **[${a.id}]** ${a.name}: ${a.role}${caps}`);
    }
    return lines.join('\n');
  }
}
