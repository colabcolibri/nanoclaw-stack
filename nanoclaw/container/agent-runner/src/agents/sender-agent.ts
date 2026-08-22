import { ResponseParser } from '../orchestrator/parser.js';
import { IntermediateNotifier } from '../orchestrator/notifier.js';
import { AgentAuditLogger } from './audit-logger.js';
import type { HandoverPackage } from './types.js';
import type { LLMCompletionFn } from '../orchestrator/types.js';

export interface SenderContext {
  prompt: string;
  chatJid?: string;
  cwd: string;
  history: Array<{ role: string; content?: string; [key: string]: any }>;
  personaInstructions?: string;
  coreMemory?: string;
  temporalContext?: string;
  senderModel?: string;
}

export class SenderAgent {
  /**
   * The Sender Agent absorbs the Soul and formats the final user-facing response.
   * It takes raw technical findings or conversation instructions from the Orchestrator
   * and communicates with the user in the authentic persona style.
   */
  static async deliver(
    handover: HandoverPackage,
    context: SenderContext,
    complete: LLMCompletionFn,
    onActivity?: () => void
  ): Promise<{ deliveredText: string; rawContent: string }> {
    const targetDest = IntermediateNotifier.resolveDestination(context.prompt, context.chatJid);

    const personaPrompt = [
      context.temporalContext || '',
      context.personaInstructions || '',
      context.coreMemory ? `## Context & Permanent Memory\n${context.coreMemory}` : '',
      `## DIRETRIZ DO SENDER AGENT (VOZ & IDENTIDADE)
Você é o Agente de Entrega e Comunicação (Sender).
Você é quem possui a Alma (Soul), o tom de voz e o relacionamento com o usuário.
- Se foram executadas ações técnicas, apresente os resultados com clareza, objetividade e na sua voz autêntica.
- Se for conversa direta ou solicitação de orientação, responda com cordialidade e inteligência.
- NUNCA mencione termos internos de infraestrutura como "Orchestrator", "Worker", "Scratchpad", "JSON de handover", etc.
- NUNCA adicione rodapés ou assinaturas automáticas no final da resposta.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    let userContent = '';
    if (handover.isFastPath) {
      userContent = context.prompt;
    } else {
      userContent = `## Solicitação do Usuário
${handover.userGoal}

## Resultados Técnicos Verificados
${handover.technicalFindings}

${handover.guidanceForSender ? `## Orientações do Orquestrador\n${handover.guidanceForSender}` : ''}
`;
    }

    const messages: any[] = [
      { role: 'system', content: personaPrompt },
      ...context.history.slice(-10),
      { role: 'user', content: userContent },
    ];

    onActivity?.();
    const startTime = Date.now();

    const response = await complete(messages, false, {
      purpose: 'stage2_synthesis',
      agent: 'sender',
      model: context.senderModel,
    });

    const latencyMs = Date.now() - startTime;
    let finalContent = ResponseParser.cleanHumanText(response.content);

    AgentAuditLogger.record(context.cwd, {
      step: 'sender_synthesis',
      agent: 'sender',
      purpose: handover.isFastPath ? 'Sender Fast-path direct voice' : 'Sender synthesis from worker findings',
      latencyMs,
      promptPreview: userContent.slice(0, 100),
      responsePreview: finalContent.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    if (!finalContent || !finalContent.trim()) {
      if (handover.technicalFindings && handover.technicalFindings !== '(No tools needed to be executed)') {
        finalContent = `Feito, sô. As informações solicitadas foram processadas:\n\n${handover.technicalFindings}`;
      } else {
        finalContent = 'Entendido, sô. Como posso te ajudar hoje?';
      }
    }

    const cleanText = finalContent
      .replace(/<message\s+to="[^"]*">/gi, '')
      .replace(/<\/message>/gi, '')
      .trim();

    const deliveredText = `<message to="${targetDest}">\n${cleanText}\n</message>`;

    return {
      deliveredText,
      rawContent: cleanText,
    };
  }
}
