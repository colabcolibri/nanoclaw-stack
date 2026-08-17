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
   * Intelligently synthesizes a human-readable, domain-rich response from executed tool results.
   */
  private static synthesizeFromToolHistory(messages: any[]): string {
    const toolMessages = messages.filter((m) => m.role === 'tool' && m.content);
    if (toolMessages.length === 0) {
      return 'Tudo pronto! A solicitação foi concluída.';
    }

    const sections: string[] = [];

    for (const tm of toolMessages) {
      try {
        const parsed = typeof tm.content === 'string' ? JSON.parse(tm.content) : tm.content;

        // 1. Resale Quote calculation
        if (parsed.formattedProposalMarkdown) {
          sections.push(parsed.formattedProposalMarkdown);
          continue;
        }

        // 2. Gmail results
        if (parsed.conversations && Array.isArray(parsed.conversations)) {
          if (parsed.conversations.length === 0) {
            sections.push('📬 **Caixa de Entrada:** Nenhuma conversa não lida pendente no momento.');
          } else {
            const list = parsed.conversations
              .slice(0, 5)
              .map(
                (c: any) =>
                  `• **De:** ${c.from || 'Desconhecido'} | **Assunto:** ${c.subject || '(Sem assunto)'} ${c.needsReply ? '🔴 *(Precisa de Resposta)*' : '🟢'}`
              )
              .join('\n');
            sections.push(`📬 **E-mails Encontrados (${parsed.conversations.length}):**\n${list}`);
          }
          continue;
        }

        // 3. Yampi Order Tracking
        if (parsed.order_number || parsed.status_alias) {
          sections.push(
            `📦 **Pedido #${parsed.order_number || ''}**\n• Status: **${parsed.status_alias || 'Em processamento'}**\n• Cliente: ${parsed.customer_name || ''}\n• Rastreio: ${parsed.tracking_url || parsed.tracking_code || 'Aguardando despacho'}`
          );
          continue;
        }

        // 4. Product search / Stock check
        if (parsed.stock !== undefined || parsed.available !== undefined) {
          sections.push(
            `🛍️ **Disponibilidade:** Produto ${parsed.product_name || ''} — Saldo em estoque: **${parsed.stock ?? 0} unidades**.`
          );
          continue;
        }

        // 5. General message fallback
        if (parsed.message) {
          sections.push(parsed.message);
        }
      } catch {
        if (typeof tm.content === 'string' && tm.content.trim().length > 10) {
          sections.push(tm.content.trim());
        }
      }
    }

    if (sections.length > 0) {
      return sections.join('\n\n---\n\n');
    }

    return 'Tudo pronto! As consultas e operações foram concluídas com sucesso.';
  }
}
