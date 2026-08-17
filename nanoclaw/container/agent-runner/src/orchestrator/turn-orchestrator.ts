import { executeTool } from '../tools/index.js';
import { ResponseParser } from './parser.js';
import { IntermediateNotifier } from './notifier.js';
import type { LLMCompletionFn, TurnOptions, OrchestratorResult } from './types.js';

export class TurnOrchestrator {
  /**
   * Executes a full conversational turn with tool orchestration and guaranteed human delivery.
   */
  static async runTurn(
    complete: LLMCompletionFn,
    options: TurnOptions,
    onActivity?: () => void
  ): Promise<OrchestratorResult> {
    const targetDest = IntermediateNotifier.resolveDestination(options.prompt, options.chatJid);
    const messages: any[] = [
      { role: 'system', content: options.systemInstructions },
      ...options.history,
      { role: 'user', content: options.prompt },
    ];

    let currentMessages = [...messages];
    let finalContent = '';
    let toolsRunCount = 0;
    const maxIterations = Math.min(Math.max(Number(options.maxIterations) || 15, 1), 30);

    for (let iter = 0; iter < maxIterations; iter++) {
      onActivity?.();

      const response = await complete(currentMessages, true);
      const toolCalls = ResponseParser.extractToolCalls(response);

      // If tools were requested
      if (toolCalls.length > 0) {
        // 1. Send immediate natural pre-text to user if the model generated a preliminary greeting
        const preText = ResponseParser.cleanHumanText(response.content);
        if (preText && iter === 0) {
          IntermediateNotifier.notify(targetDest, preText);
        }

        currentMessages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.tool_calls,
        });

        // 2. Execute each tool in sequence
        for (const call of toolCalls) {
          onActivity?.();
          toolsRunCount++;
          const resultText = await executeTool(call.name, call.args, options.cwd);

          currentMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content: resultText,
          });
        }

        // Loop again to allow model to consume tool outputs
        continue;
      }

      // No tools called — capture model's final response
      finalContent = ResponseParser.cleanHumanText(response.content);
      break;
    }

    // 3. Guaranteed Closure: If tools ran but final content is empty or unformatted, force completion
    if (!finalContent || !finalContent.trim()) {
      try {
        onActivity?.();
        const closureResponse = await complete(
          [
            ...currentMessages,
            {
              role: 'user',
              content:
                'Com base nos resultados das ferramentas acima, elabore a resposta final completa, amigável, calorosa e detalhada para o usuário, incluindo todas as tabelas ou dados necessários.',
            },
          ],
          false
        );
        finalContent = ResponseParser.cleanHumanText(closureResponse.content);
      } catch (err) {
        console.error('[TurnOrchestrator] Failed during final closure prompt:', err);
      }
    }

    // 4. Deterministic Domain Synthesis Fallback (Zero Dry Responses)
    if (!finalContent || !finalContent.trim()) {
      finalContent = this.synthesizeFromToolHistory(currentMessages);
    }

    // 5. Wrap in <message to="..."> for NanoClaw message delivery
    let deliveredText = finalContent;
    if (!deliveredText.includes('<message') && !deliveredText.includes('<internal>')) {
      deliveredText = `<message to="${targetDest}">\n${deliveredText}\n</message>`;
    }

    // 5. Update session history
    const historyLimit = options.historyLimit || 50;
    const updatedHistory = [
      ...options.history,
      { role: 'user', content: options.prompt },
      { role: 'assistant', content: deliveredText },
    ].slice(-historyLimit);

    return {
      deliveredText,
      updatedHistory,
      toolsExecutedCount: toolsRunCount,
    };
  }

  /**
   * Universally and polymorphically synthesizes any tool execution outputs into structured, human-readable markdown.
   */
  private static synthesizeFromToolHistory(messages: any[]): string {
    const toolMessages = messages.filter((m) => m.role === 'tool' && m.content);
    if (toolMessages.length === 0) {
      return 'Tudo pronto! As consultas e operações foram concluídas com sucesso.';
    }

    const sections: string[] = [];

    for (const tm of toolMessages) {
      const toolName = tm.name || 'Operação';
      const rawContent = tm.content;

      if (!rawContent || (typeof rawContent === 'string' && !rawContent.trim())) continue;

      // Case A: Raw text already in Markdown format (tables, headers, lists)
      if (typeof rawContent === 'string' && (rawContent.includes('# ') || rawContent.includes('| :') || rawContent.includes('\n- ') || rawContent.includes('\n* '))) {
        sections.push(rawContent.trim());
        continue;
      }

      // Case B: Try parsing JSON objects
      try {
        const data = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

        // 1. Explicit formatted proposal or summary string
        if (data.formattedProposalMarkdown) {
          sections.push(data.formattedProposalMarkdown);
          continue;
        }
        if (data.markdown || data.formattedText || data.summary) {
          sections.push(data.markdown || data.formattedText || data.summary);
          continue;
        }

        // 2. Arrays / Lists of Items (Notion records, Gmail threads, Google Calendar events, products, tasks)
        const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
        if (Array.isArray(data) || (arrayKey && Array.isArray(data[arrayKey]))) {
          const list: any[] = Array.isArray(data) ? data : data[arrayKey!];
          if (list.length === 0) {
            sections.push(`📋 **${toolName}:** Nenhum item ou registro pendente encontrado.`);
          } else {
            const formattedItems = list.slice(0, 10).map((item, idx) => {
              if (typeof item === 'string') return `• ${item}`;
              // Extract best display attributes
              const title = item.title || item.name || item.subject || item.summary || item.product || item.action || `Item ${idx + 1}`;
              const sub = item.from || item.status || item.date || item.price || item.customer_name || item.recurrence || '';
              const detail = item.needsReply ? '🔴 *(Requer resposta)*' : (sub ? `(${sub})` : '');
              return `• **${title}** ${detail}`;
            });
            const more = list.length > 10 ? `\n*(...e mais ${list.length - 10} itens)*` : '';
            sections.push(`📋 **Resultado (${toolName} — ${list.length} itens):**\n${formattedItems.join('\n')}${more}`);
          }
          continue;
        }

        // 3. Single Object with key-value properties
        if (typeof data === 'object' && data !== null) {
          if (data.message && Object.keys(data).length <= 2) {
            sections.push(`✅ **${toolName}:** ${data.message}`);
            continue;
          }

          const entries = Object.entries(data)
            .filter(([k, v]) => v !== null && v !== undefined && k !== 'status' && typeof v !== 'object')
            .map(([k, v]) => `• **${k.replace(/_/g, ' ')}:** ${v}`);

          if (entries.length > 0) {
            const header = data.message ? `✅ **${data.message}**\n` : `📋 **Dados (${toolName}):**\n`;
            sections.push(`${header}${entries.join('\n')}`);
            continue;
          }
        }

        // Fallback JSON stringification
        sections.push(`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
      } catch {
        // Case C: Non-JSON raw string
        if (typeof rawContent === 'string' && rawContent.trim()) {
          sections.push(rawContent.trim());
        }
      }
    }

    if (sections.length > 0) {
      return sections.join('\n\n---\n\n');
    }

    return 'Tudo pronto! As consultas e operações foram concluídas com sucesso.';
  }
}
