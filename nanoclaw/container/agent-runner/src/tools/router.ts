import type { ToolDefinition, AgentTool } from './types.js';

export interface ToolDomain {
  id: string;
  name: string;
  description: string;
  toolNames: string[];
  keywords: string[];
  patterns?: RegExp[];
}

export class ToolRouter {
  private static domains: Map<string, ToolDomain> = new Map();
  private static registry: Record<string, AgentTool> = {};

  static {
    // 1. Google Productivity & Communication Domain
    this.registerDomain({
      id: 'google_suite',
      name: 'Google Suite (Gmail & Calendar)',
      description: 'Consultas e envios de e-mails, agenda, compromissos e reuniões no Google.',
      toolNames: ['google_gmail', 'google_calendar'],
      keywords: [
        'email',
        'e-mail',
        'emails',
        'e-mails',
        'gmail',
        'inbox',
        'caixa de entrada',
        'mensagem',
        'mensagens',
        'agenda',
        'calendario',
        'calendário',
        'reuniao',
        'reunião',
        'reunioes',
        'reuniões',
        'compromisso',
        'compromissos',
        'evento',
        'eventos',
        'dentista',
        'consulta',
        'marcar',
        'agendar',
        'horario',
        'horário',
        'hoje',
        'amanha',
        'amanhã',
        'ontem',
        'darf',
        'inss',
        'gestta',
      ],
      patterns: [
        /\b(?:e-?mails?|gmail|inbox)\b/i,
        /\b(?:agenda|calend[aá]rio|compromissos?|reuni[aã]o|reuni[oõ]es)\b/i,
        /\b(?:ler|ver|checar|listar|buscar|enviar)\s+(?:e-?mails?|mensagens?|agenda)\b/i,
      ],
    });

    // 2. E-commerce, Catalog & Logistics Domain
    this.registerDomain({
      id: 'ecommerce_logistics',
      name: 'E-Commerce, Preços e Logística',
      description: 'Gestão de pedidos Yampi, catálogo/preços de revenda e cálculo de frete Correios.',
      toolNames: ['yampi_store', 'resale_pricing', 'correios_shipping'],
      keywords: [
        'yampi',
        'pedido',
        'pedidos',
        'loja',
        'venda',
        'vendas',
        'produto',
        'produtos',
        'catalogo',
        'catálogo',
        'estoque',
        'preco',
        'preço',
        'precos',
        'preços',
        'tabela',
        'revenda',
        'atacado',
        'grok',
        'jogo grok',
        'frete',
        'correios',
        'cep',
        'sedex',
        'pac',
        'entrega',
        'rastreio',
        'rastreamento',
        'envio',
      ],
      patterns: [
        /\b(?:yampi|loja|pedidos?|estoque|revenda)\b/i,
        /\b(?:frete|correios|cep|\d{5}-?\d{3})\b/i,
        /\b(?:pre[çc]os?|tabela|quanto custa|or[çc]amento)\b/i,
      ],
    });

    // 3. Notion Management Domain
    this.registerDomain({
      id: 'notion_management',
      name: 'Gestão de Conteúdo e Páginas no Notion',
      description: 'Gestão de páginas, anotações, atas de reunião e bancos de dados no Notion.',
      toolNames: ['notion'],
      keywords: [
        'notion',
        'quadro',
        'database',
        'pagina',
        'página',
        'bloco',
        'documento notion',
      ],
      patterns: [
        /\b(?:notion|quadro|database)\b/i,
      ],
    });

    // 4. Autonomous Scheduling & Cron Domain
    this.registerDomain({
      id: 'automation_scheduling',
      name: 'Agendamento Autônomo & Rotinas Recorrentes (Cron)',
      description: 'Agendamento de rotinas periódicas cron, lembretes futuros e continuidade autônoma.',
      toolNames: ['schedule_followup'],
      keywords: [
        'cron',
        'agendar',
        'agendamento',
        'rotina',
        'recorrente',
        'periodicidade',
        'periodico',
        'periódico',
        'followup',
        'follow-up',
        'lembrete',
        'lembretes',
        'lembrar',
        'aviso',
        'alarme',
        'a cada',
        'cada duas horas',
        'em 15 minutos',
      ],
      patterns: [
        /\b(?:cron|rotina|recorrente|periodic(?:o|a|idade))\b/i,
        /\b(?:lembr(?:ar|e)|agendar|follow-?up)\b/i,
        /\ba\s+cada\s+\d+\s+(?:minutos?|horas?|dias?)\b/i,
      ],
    });

    // 4. Core System & Memory Domain
    this.registerDomain({
      id: 'core_system',
      name: 'Sistema, Memória e Arquivos',
      description: 'Memória permanente de longo prazo, inspeção de arquivos e execução de comandos seguros.',
      toolNames: ['manage_memory', 'read_file', 'run_command'],
      keywords: [
        'memoria',
        'memória',
        'lembre-se',
        'memorize',
        'guarde',
        'grave',
        'salve este fato',
        'arquivo',
        'ler arquivo',
        'comando',
        'terminal',
        'bash',
        'executar',
      ],
      patterns: [
        /\b(?:guarde|memorize|grave|salve na mem[oó]ria)\b/i,
        /\b(?:leia o arquivo|execute o comando|terminal)\b/i,
      ],
    });

    // 6. Web Search & Real-Time Intelligence Domain
    this.registerDomain({
      id: 'web_research',
      name: 'Pesquisa Web & Inteligência em Tempo Real',
      description: 'Busca na internet em tempo real, notícias, tendências, leitura de artigos e sites.',
      toolNames: ['web_search', 'web_research', 'browse_url'],
      keywords: [
        'pesquisar',
        'pesquise',
        'pesquisa',
        'buscar',
        'busque',
        'busca',
        'procurar',
        'procure',
        'internet',
        'web',
        'google',
        'noticia',
        'notícia',
        'noticias',
        'notícias',
        'tendencia',
        'tendência',
        'tendencias',
        'tendências',
        'novidade',
        'novidades',
        'artigo',
        'site',
        'link',
        'url',
        'inteligencia artificial',
        'inteligência artificial',
        'ia',
        'ai',
        'lancamento',
        'lançamento',
      ],
      patterns: [
        /\b(?:pesquis(?:ar|e|a)|busqu?e?|procur(?:ar|e))\s+(?:na\s+)?(?:web|internet|google|sobre)\b/i,
        /\b(?:tend[eê]ncias?|not[ií]cias?|novidades?|artigos?)\b/i,
        /\bhttps?:\/\/[^\s]+/i,
      ],
    });

    // 7. Runtime Meta Domain (Dynamic Skills & Message Retrieval)
    this.registerDomain({
      id: 'runtime_meta',
      name: 'Controle de Runtime & Skills Dinâmicas',
      description: 'Ferramentas de sistema para carregamento de manuais de skills e recuperação de contexto original.',
      toolNames: ['load_skill', 'retrieve_message_context'],
      keywords: ['skill', 'manual', 'contexto'],
    });
  }

  /**
   * Registers or extends a tool domain dynamically.
   * Enables third-party plugins and new modules to effortlessly plug into the router.
   */
  static registerDomain(domain: ToolDomain): void {
    const existing = this.domains.get(domain.id);
    if (!existing) {
      this.domains.set(domain.id, {
        ...domain,
        toolNames: [...domain.toolNames],
        keywords: [...domain.keywords],
        patterns: domain.patterns ? [...domain.patterns] : [],
      });
      return;
    }

    // Merge without clobbering existing tools and keywords
    const toolSet = new Set([...existing.toolNames, ...domain.toolNames]);
    const kwSet = new Set([...existing.keywords, ...domain.keywords]);
    const patterns = [...(existing.patterns || []), ...(domain.patterns || [])];

    this.domains.set(domain.id, {
      id: domain.id,
      name: existing.name || domain.name,
      description: existing.description || domain.description,
      toolNames: Array.from(toolSet),
      keywords: Array.from(kwSet),
      patterns,
    });
  }

  /**
   * Strict registry validator & synchronizer:
   * 1. Asserts every registered tool has a valid, non-empty domain.
   * 2. Asserts every domain exists in the catalog.
   * 3. Dynamically populates domain.toolNames directly from the tool registry.
   * Throws immediately if any orphaned or misconfigured tool is detected.
   */
  static syncRegistry(tools: Record<string, AgentTool>): void {
    for (const [toolName, tool] of Object.entries(tools)) {
      if (!tool.domain || typeof tool.domain !== 'string' || !tool.domain.trim()) {
        throw new Error(
          `[Strict Tool Registry] Tool "${toolName}" has no assigned domain! Every tool must belong to a group.`
        );
      }
      if (!this.domains.has(tool.domain)) {
        throw new Error(
          `[Strict Tool Registry] Tool "${toolName}" belongs to unknown domain "${tool.domain}". Register the domain first!`
        );
      }
    }

    this.registry = { ...tools };

    // Automatically synchronize toolNames for every domain from tools
    for (const [domId, domain] of this.domains.entries()) {
      const matchingTools = Object.entries(tools)
        .filter(([_, t]) => t.domain === domId)
        .map(([name]) => name);

      const combined = new Set([...domain.toolNames, ...matchingTools]);
      domain.toolNames = Array.from(combined);
    }
  }

  /**
   * Generates a concise index of available tool capability groups for the system prompt (~60 tokens).
   * Excludes internal runtime_meta from user-facing group prompt.
   */
  static getGroupSummaryPrompt(): string {
    const lines: string[] = ['## 🛠️ Tool Capability Groups (Available for Dynamic Chaining):'];
    for (const [id, dom] of this.domains.entries()) {
      if (id === 'runtime_meta') continue;
      if (dom.toolNames.length === 0) continue;
      lines.push(`- **${dom.name}** (\`${id}\`): ${dom.description} [Tools: ${dom.toolNames.map((t) => `\`${t}\``).join(', ')}]`);
    }
    lines.push('\n*(If you need tools from another group during execution, call `load_skill` or invoke the tool to dynamically chain it into your active set.)*');
    return lines.join('\n');
  }

  /**
   * Retrieves a domain by its ID.
   */
  static getDomain(domainId: string): ToolDomain | undefined {
    return this.domains.get(domainId);
  }

  /**
   * Retrieves all registered domains.
   */
  static getDomains(): ToolDomain[] {
    return Array.from(this.domains.values());
  }

  /**
   * Scores and matches active domains based on user input and intent patterns.
   */
  static matchDomains(prompt: string): string[] {
    if (!prompt || typeof prompt !== 'string') return [];
    const text = prompt.toLowerCase();
    const matchedDomainIds = new Set<string>();

    for (const [id, domain] of this.domains.entries()) {
      // 1. Keyword matching with boundary safety
      for (const kw of domain.keywords) {
        const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9À-ÿ])${escaped}($|\\s|[^a-zA-Z0-9À-ÿ])`, 'i');
        if (regex.test(text)) {
          matchedDomainIds.add(id);
          break;
        }
      }

      // 2. Regex Pattern matching
      if (!matchedDomainIds.has(id) && domain.patterns) {
        for (const pat of domain.patterns) {
          if (pat.test(prompt)) {
            matchedDomainIds.add(id);
            break;
          }
        }
      }
    }

    return Array.from(matchedDomainIds);
  }

  /**
   * Determines if a query is a purely conversational chit-chat prompt that requires zero tools.
   */
  static isPureConversation(prompt: string): boolean {
    const clean = prompt.trim().toLowerCase().replace(/[?!.,;:()]/g, '');
    const chitChatPhrases = [
      'oi',
      'olá',
      'ola',
      'bom dia',
      'boa tarde',
      'boa noite',
      'tudo bem',
      'como vai',
      'e ai',
      'e aí',
      'opa',
      'valeu',
      'obrigado',
      'obrigada',
      'quem é você',
      'quem e voce',
      'o que você faz',
      'qual o seu nome',
      'ajuda',
      'help',
      'teste',
      'ping',
    ];

    if (chitChatPhrases.includes(clean)) return true;
    if (clean.length < 15 && chitChatPhrases.some((p) => clean.startsWith(p))) return true;

    return false;
  }

  /**
   * Intelligently selects the minimal, optimal subset of ToolDefinitions for a given query.
   * Reduces prompt overhead by up to 85% per turn.
   */
  static selectTools(
    prompt: string,
    options: {
      forceAll?: boolean;
      includeCore?: boolean;
      fallbackToAll?: boolean;
    } = {}
  ): ToolDefinition[] {
    const allRegistered = Object.values(this.registry);
    const allDefs = allRegistered.map((t) => t.definition);

    if (options.forceAll) {
      return allDefs;
    }

    // 1. Pure conversational queries don't need any tool schemas injected
    if (this.isPureConversation(prompt)) {
      return [];
    }

    // 2. Identify relevant domains
    const matchedDomainIds = this.matchDomains(prompt);

    if (matchedDomainIds.length > 0) {
      const selectedToolNames = new Set<string>();

      for (const domId of matchedDomainIds) {
        const dom = this.domains.get(domId);
        if (dom) {
          dom.toolNames.forEach((tn) => selectedToolNames.add(tn));
        }
      }

      if (options.includeCore) {
        const core = this.domains.get('core_system');
        if (core) core.toolNames.forEach((tn) => selectedToolNames.add(tn));
      }

      // Always include dynamic capability tools (skills on demand & message retrieval)
      selectedToolNames.add('load_skill');
      selectedToolNames.add('retrieve_message_context');

      const tools: ToolDefinition[] = [];
      for (const name of selectedToolNames) {
        const tool = this.registry[name];
        if (tool) tools.push(tool.definition);
      }

      return tools;
    }

    // 3. Fallback: If no specific domain matched, defensively provide all tools
    if (options.fallbackToAll !== false) {
      return allDefs;
    }

    return [];
  }
}
