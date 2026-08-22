import type { Department, SpecialistAgent } from './types.js';
import { ALL_TOOLS } from '../tools/index.js';
import type { ToolDefinition } from '../tools/types.js';

export class AgentRegistry {
  private static departments: Map<string, Department> = new Map();
  private static agents: Map<string, SpecialistAgent> = new Map();

  public static readonly GLOBAL_SKILLS: string[] = [
    'retrieve_message_context',
    'manage_memory',
    'run_command',
    'read_file',
    'load_skill',
  ];

  static {
    this.initializeDefaults();
  }

  static initializeDefaults(): void {
    this.departments.clear();
    this.agents.clear();

    // 1. Productivity & Communication Department
    this.registerDepartment({
      id: 'productivity',
      name: 'Produtividade & Comunicação',
      description: 'Gestão de agendas, e-mails Gmail, notas e banco de dados Notion, compromissos e agendamentos.',
      keywords: [
        'email', 'e-mail', 'gmail', 'inbox', 'mensagem', 'caixa de entrada',
        'agenda', 'calendario', 'calendário', 'reuniao', 'reunião', 'compromisso', 'evento', 'horario', 'horário',
        'notion', 'tarefa', 'tarefas', 'nota', 'notas', 'anotacao', 'anotações', 'lembrete', 'followup', 'agendar',
      ],
      agentIds: ['productivity_attendant', 'notion_architect'],
    });

    this.registerAgent({
      id: 'productivity_attendant',
      name: 'Atendente de Produtividade & Google Suite',
      departmentId: 'productivity',
      role: 'Especialista em e-mails (Gmail), reuniões e agendamentos de calendário (Google Calendar).',
      description: 'Consulta, filtra e redige e-mails no Gmail e gerencia eventos na agenda do Google com precisão técnica.',
      systemPrompt: `Você é um agente especialista em comunicação e produtividade executiva (Gmail & Google Calendar).
Sua responsabilidade é consultar, processar e estruturar informações de e-mails e reuniões.
Seja preciso, execute as ferramentas necessárias com os parâmetros corretos e colete os dados solicitados.
Responda de forma técnica e estruturada com os dados encontrados. Não inclua cumprimentos vazios.`,
      agentSkills: ['google_gmail', 'google_calendar', 'schedule_followup'],
      allowGlobalSkills: true,
    });

    this.registerAgent({
      id: 'notion_architect',
      name: 'Especialista em Notion & Documentação',
      departmentId: 'productivity',
      role: 'Especialista em consultar e atualizar páginas, bancos de dados e tarefas no Notion.',
      description: 'Busca notas, atualiza status de projetos e cadastra registros no Notion.',
      systemPrompt: `Você é um agente especialista em Notion e gestão de conhecimento.
Sua responsabilidade é interagir com as bases de dados e páginas do Notion para recuperar ou registrar informações.
Retorne dados estruturados em JSON ou tabelas markdown limpas.`,
      agentSkills: ['notion'],
      allowGlobalSkills: true,
    });

    // 2. Commerce & Logistics Department
    this.registerDepartment({
      id: 'commerce',
      name: 'Comércio, Logística & Revenda',
      description: 'Gestão de pedidos na loja Yampi, cálculo de preços de revenda/atacado e estimativa de frete Correios.',
      keywords: [
        'yampi', 'loja', 'pedido', 'pedidos', 'venda', 'vendas', 'cliente', 'pagamento',
        'preco', 'preço', 'precos', 'preços', 'tabela', 'revenda', 'atacado', 'grok', 'jogo grok',
        'frete', 'correios', 'cep', 'sedex', 'pac', 'entrega', 'rastreio', 'envio', 'prazo',
      ],
      agentIds: ['store_attendant', 'pricing_logistics_agent'],
    });

    this.registerAgent({
      id: 'store_attendant',
      name: 'Atendente de E-Commerce Yampi',
      departmentId: 'commerce',
      role: 'Especialista em pedidos, clientes, status de transações e catálogo da loja Yampi.',
      description: 'Consulta pedidos por número, nome de cliente ou status na plataforma Yampi.',
      systemPrompt: `Você é um agente técnico especialista na plataforma de e-commerce Yampi.
Consulte pedidos, valores, itens e status de rastreamento com total fidelidade aos dados da API.
Forneça os relatórios brutos e estruturados sem suposições.`,
      agentSkills: ['yampi_store'],
      allowGlobalSkills: true,
    });

    this.registerAgent({
      id: 'pricing_logistics_agent',
      name: 'Calculador de Preços & Fretes',
      departmentId: 'commerce',
      role: 'Especialista em tabela de preços de revenda (Grok) e cálculo de frete oficial Correios.',
      description: 'Calcula orçamentos com margens de revenda/atacado e calcula prazos/valores de frete SEDEX/PAC.',
      systemPrompt: `Você é um agente analista de preços e logística de fretes.
Utilize as tabelas oficiais de revenda e as cotações dos Correios para responder a cotações com exatidão matemática.`,
      agentSkills: ['resale_pricing', 'correios_shipping'],
      allowGlobalSkills: true,
    });

    // 3. Research & Intelligence Department
    this.registerDepartment({
      id: 'research_intel',
      name: 'Pesquisa, Inteligência & Web',
      description: 'Buscas na web em tempo real, navegação em URLs e monitoramento de métricas e custos de tokens.',
      keywords: [
        'pesquisa', 'pesquisar', 'busca', 'buscar', 'google', 'web', 'internet', 'site', 'url', 'noticia', 'notícias',
        'token', 'tokens', 'gasto', 'gastos', 'custo', 'custos', 'consumo', 'ledger', 'deepseek', 'fatura', 'uso',
      ],
      agentIds: ['web_researcher', 'system_metrics_agent'],
    });

    this.registerAgent({
      id: 'web_researcher',
      name: 'Pesquisador Web & Fontes',
      departmentId: 'research_intel',
      role: 'Especialista em pesquisas na internet, sintetização de artigos e verificação de fontes.',
      description: 'Executa buscas online e lê o conteúdo de URLs para responder com dados atualizados do mundo real.',
      systemPrompt: `Você é um agente pesquisador especializado em varredura de informações online.
Execute buscas direcionadas, acesse as URLs mais relevantes e resuma os fatos técnicos com citação de fontes.`,
      agentSkills: ['web_search', 'web_research', 'browse_url'],
      allowGlobalSkills: true,
    });

    this.registerAgent({
      id: 'system_metrics_agent',
      name: 'Monitor de Métricas & Custos',
      departmentId: 'research_intel',
      role: 'Especialista em auditoria de consumo de tokens, custos em BRL/USD e métricas do sistema.',
      description: 'Consulta o livro-razão de tokens (TokenLedger) e relata os custos e taxas do modelo.',
      systemPrompt: `Você é um agente auditor de telemetria e custos de IA.
Consulte o TokenLedger para relatar o gasto de tokens e valores financeiros consolidados.`,
      agentSkills: ['token_usage'],
      allowGlobalSkills: true,
    });

    // 4. General / Operations Department
    this.registerDepartment({
      id: 'operations',
      name: 'Operações & Sistema',
      description: 'Operações de sistema de arquivos, comandos de infraestrutura e memória compartilhada.',
      keywords: [
        'sistema', 'arquivo', 'pasta', 'disco', 'comando', 'terminal', 'bash', 'memoria', 'memória', 'lembrar',
      ],
      agentIds: ['system_operator'],
    });

    this.registerAgent({
      id: 'system_operator',
      name: 'Operador de Sistema & Arquivos',
      departmentId: 'operations',
      role: 'Especialista em inspeção de arquivos, diretórios e manutenção de memória contextual.',
      description: 'Lê arquivos no ambiente local, gerencia itens na memória permanente e executa operações seguras.',
      systemPrompt: `Você é um operador técnico de sistema.
Execute leituras e manutenções de forma concisa e segura.`,
      agentSkills: ['read_file', 'run_command', 'manage_memory'],
      allowGlobalSkills: true,
    });
  }

  static registerDepartment(dept: Department): void {
    this.departments.set(dept.id, dept);
  }

  static registerAgent(agent: SpecialistAgent): void {
    this.agents.set(agent.id, agent);
    const dept = this.departments.get(agent.departmentId);
    if (dept && !dept.agentIds.includes(agent.id)) {
      dept.agentIds.push(agent.id);
    }
  }

  static getDepartments(): Department[] {
    return Array.from(this.departments.values());
  }

  static getDepartment(id: string): Department | null {
    return this.departments.get(id) || null;
  }

  static getAgentsInDepartment(deptId: string): SpecialistAgent[] {
    const dept = this.departments.get(deptId);
    if (!dept) return [];
    return dept.agentIds
      .map((id) => this.agents.get(id))
      .filter((a): a is SpecialistAgent => Boolean(a));
  }

  static getAgent(id: string): SpecialistAgent | null {
    return this.agents.get(id) || null;
  }

  static getAllAgents(): SpecialistAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Resolves the available tool definitions for a specific specialist agent.
   * Encapsulates agent-specific skills and selectively attaches global utility skills.
   */
  static getToolsForAgent(agentId: string): ToolDefinition[] {
    const agent = this.agents.get(agentId);
    if (!agent) return [];

    const allowedToolNames = new Set<string>(agent.agentSkills);
    if (agent.allowGlobalSkills !== false) {
      this.GLOBAL_SKILLS.forEach((s) => allowedToolNames.add(s));
    }

    const tools: ToolDefinition[] = [];
    for (const toolName of allowedToolNames) {
      const toolObj = ALL_TOOLS[toolName];
      if (toolObj?.definition) {
        tools.push(toolObj.definition);
      }
    }

    return tools;
  }

  /**
   * Generates a compact Department Summary Prompt (~60 tokens)
   * The Orchestrator receives ONLY department summaries instead of dozens of agents,
   * keeping the top-level reasoning scalable and token-efficient.
   */
  static getDepartmentCatalogPrompt(): string {
    const depts = this.getDepartments();
    const lines = ['## Departamentos Especializados Disponíveis:'];
    for (const d of depts) {
      lines.push(`- **[${d.id}]** ${d.name}: ${d.description}`);
    }
    return lines.join('\n');
  }

  /**
   * Generates a compact summary of the agents within a specific department (~40 tokens).
   */
  static getAgentsInDepartmentPrompt(deptId: string): string {
    const agents = this.getAgentsInDepartment(deptId);
    if (agents.length === 0) return 'Nenhum agente registrado neste departamento.';
    const lines = [`## Especialistas no Departamento [${deptId}]:`];
    for (const a of agents) {
      lines.push(`- **[${a.id}]** ${a.name}: ${a.role}`);
    }
    return lines.join('\n');
  }
}
