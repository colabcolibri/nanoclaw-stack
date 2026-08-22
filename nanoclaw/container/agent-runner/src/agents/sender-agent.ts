import { ResponseParser } from '../orchestrator/parser.js';
import { IntermediateNotifier } from '../orchestrator/notifier.js';
import { AgentAuditLogger } from './audit-logger.js';
import { ModelRegistry } from '../services/model-registry.js';
import { PersonaLoader } from '../services/persona-loader.js';
import {
  ContextPack,
  DEFAULT_FAST_CONTEXT_PLAN,
  DEFAULT_SYNTHESIS_CONTEXT_PLAN,
} from '../services/context-pack.js';
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
  defaultModel?: string;
}

export class SenderAgent {
  static async deliver(
    handover: HandoverPackage,
    context: SenderContext,
    complete: LLMCompletionFn,
    onActivity?: () => void
  ): Promise<{ deliveredText: string; rawContent: string }> {
    const targetDest = IntermediateNotifier.resolveDestination(context.prompt, context.chatJid);
    const isFastPath = Boolean(handover.isFastPath);
    const contextPlan =
      handover.contextPlan ?? (isFastPath ? DEFAULT_FAST_CONTEXT_PLAN : DEFAULT_SYNTHESIS_CONTEXT_PLAN);
    const soulMode = contextPlan.soulMode ?? 'compact';

    const soul = PersonaLoader.resolveForSender(
      context.cwd,
      context.personaInstructions,
      soulMode,
    );
    const memos = ContextPack.resolveMemos(contextPlan, isFastPath);
    const memoSection = ContextPack.formatMemosSection(memos);
    const memorySection = ContextPack.buildMemorySection(context.cwd, contextPlan);

    const personaPrompt = [
      context.temporalContext || '',
      soul,
      memorySection,
      memoSection,
      `## Sender (voz final)
Você fala com o usuário na persona. Não mencione Orchestrator, Worker, Scratchpad ou handover.
Responda só o que foi pedido, com clareza e tom autêntico.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    let userContent = '';
    if (isFastPath) {
      userContent = [
        handover.guidanceForSender ? `## Orientação\n${handover.guidanceForSender}` : '',
        `## Mensagem\n${context.prompt}`,
      ]
        .filter(Boolean)
        .join('\n\n');
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
      { role: 'user', content: userContent },
    ];

    onActivity?.();
    const startTime = Date.now();

    const resolvedModel = ModelRegistry.requireModelId(
      context.senderModel,
      'senderModel',
      context.cwd,
    );

    const response = await complete(messages, false, {
      purpose: isFastPath ? 'fast_path_direct' : 'stage2_synthesis',
      agent: 'sender',
      model: resolvedModel,
    });

    const latencyMs = Date.now() - startTime;
    let finalContent = ResponseParser.cleanHumanText(response.content);

    AgentAuditLogger.record(context.cwd, {
      step: 'sender_synthesis',
      agent: 'sender',
      purpose: isFastPath ? 'Sender fast-path (lean context)' : 'Sender synthesis from worker findings',
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
