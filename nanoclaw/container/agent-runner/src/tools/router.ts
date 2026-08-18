import { ALL_TOOLS, AGENT_TOOLS } from './index.js';
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

    // 3. Notion & Autonomous Scheduling Domain
    this.registerDomain({
      id: 'notion_management',
      name: 'Gestão de Tarefas & Agendamentos',
      description: 'Gestão de páginas e bancos no Notion e agendamento de tarefas autônomas periódicas.',
      toolNames: ['notion', 'schedule_followup'],
      keywords: [
        'notion',
        'tarefa',
        'tarefas',
        'task',
        'tasks',
        'quadro',
        'database',
        'pagina',
        'página',
        'lembrete',
        'lembretes',
        'agendar lembrete',
        'followup',
        'follow-up',
        'lembrar',
        'aviso',
        'alarme',
        'cron',
        'recorrente',
      ],
      patterns: [
        /\b(?:notion|tarefas?|tasks?|quadro)\b/i,
        /\b(?:lembr(?:ar|e)|agendar|follow-?up)\b/i,
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

    // 5. Web Search & Real-Time Intelligence Domain
    this.registerDomain({
      id: 'web_research',
      name: 'Pesquisa Web & Inteligência em Tempo Real',
      description: 'Busca na internet em tempo real, notícias, tendências, leitura de artigos e sites.',
      toolNames: ['web_search', 'browse_url'],
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
    if (options.forceAll) {
      return AGENT_TOOLS;
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
        const tool = ALL_TOOLS[name];
        if (tool) tools.push(tool.definition);
      }

      return tools;
    }

    // 3. Fallback: If no specific domain matched but the user asked an action-oriented question,
    // safely provide all tools defensively so no capabilities are lost.
    if (options.fallbackToAll !== false) {
      return AGENT_TOOLS;
    }

    return [];
  }
}
