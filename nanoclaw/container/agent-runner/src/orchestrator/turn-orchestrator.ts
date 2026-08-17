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
                'Por favor, envie uma resposta em linguagem natural e amigável para o usuário confirmando com clareza o resultado das ações executadas.',
            },
          ],
          false
        );
        finalContent = ResponseParser.cleanHumanText(closureResponse.content);
      } catch (err) {
        console.error('[TurnOrchestrator] Failed during final closure prompt:', err);
      }
    }

    if (!finalContent || !finalContent.trim()) {
      finalContent = 'Ação executada com sucesso no ambiente.';
    }

    // 4. Wrap in <message to="..."> for NanoClaw message delivery
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
}
