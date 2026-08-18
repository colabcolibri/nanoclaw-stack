import fs from 'node:fs';
import path from 'node:path';
import { executeTool, ToolRouter } from '../tools/index.js';
import { SkillsManager } from '../services/skills-manager.js';
import { ResponseParser } from './parser.js';
import { IntermediateNotifier } from './notifier.js';
import { ExecutionScratchpad } from './scratchpad.js';
import { PromptLoader } from '../services/prompt-loader.js';
import { MemoService } from '../services/memo-service.js';
import type { LLMCompletionFn, TurnOptions, OrchestratorResult } from './types.js';

function getTemporalContext(cwd?: string): string {
  const now = new Date();
  let tz = process.env.TZ || '';
  let city = '';
  let country = '';
  let location = '';

  const candidateFiles = [
    ...(cwd ? [path.join(cwd, 'container.json')] : []),
    '/workspace/group/container.json',
    '/opt/nanoclaw-stack/nanoclaw/groups/barao/container.json',
    ...(process.env.AGENT_GROUP_DIR ? [path.join(process.env.AGENT_GROUP_DIR, 'container.json')] : []),
  ];

  for (const f of candidateFiles) {
    try {
      if (fs.existsSync(f)) {
        const parsed = JSON.parse(fs.readFileSync(f, 'utf-8'));
        if (parsed.timezone) tz = parsed.timezone;
        if (parsed.city) city = parsed.city;
        if (parsed.country) country = parsed.country;
        if (parsed.location) location = parsed.location;
        break;
      }
    } catch {}
  }

  const resolvedLocation = [city, country].filter(Boolean).join(', ') || location;
  const resolvedTz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: resolvedTz,
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(now);

    const locationLine = resolvedLocation ? `- User Location: ${resolvedLocation}\n` : '';
    return `## Temporal & Geographic Context\n${locationLine}- Current Local Date & Time: ${formatted} (${resolvedTz})\n- ISO Timestamp: ${now.toISOString()}`;
  } catch {
    const locationLine = resolvedLocation ? `- User Location: ${resolvedLocation}\n` : '';
    return `## Temporal & Geographic Context\n${locationLine}- Current Date & Time: ${now.toUTCString()}\n- ISO Timestamp: ${now.toISOString()}`;
  }
}

export class TurnOrchestrator {
  /**
   * Executes a two-stage conversational turn with an isolated ExecutionScratchpad (Execution Memory):
   * Fast-Path: Direct single-turn execution for pure conversations.
   * Stage 1: State-only tool loop that populates ExecutionScratchpad with dense business findings.
   * Stage 2: Synthesis pass connecting Persona, Core Memory and the consolidated Scratchpad report.
   */
  static async runTurn(
    complete: LLMCompletionFn,
    options: TurnOptions,
    onActivity?: () => void
  ): Promise<OrchestratorResult> {
    const targetDest = IntermediateNotifier.resolveDestination(options.prompt, options.chatJid);
    const timeContext = getTemporalContext(options.cwd);

    // 1. Domain Routing: Select only relevant tools for this prompt
    const routedTools = ToolRouter.selectTools(options.prompt);

    // 2. Direct Conversation Fast-Path (Zero tools needed)
    if (routedTools.length === 0) {
      const personaPrompt = [
        timeContext,
        options.personaInstructions || '',
        options.coreMemory ? `## Context & Permanent Memory\n${options.coreMemory}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const messages: any[] = [
        { role: 'system', content: personaPrompt },
        ...options.history.slice(-6),
        { role: 'user', content: options.prompt },
      ];

      onActivity?.();
      const response = await complete(messages, false);
      let finalContent = ResponseParser.cleanHumanText(response.content);

      if (!finalContent || !finalContent.trim()) {
        finalContent = 'Entendido. Como posso te ajudar hoje?';
      }

      const cleanText = finalContent
        .replace(/<message\s+to="[^"]*">/gi, '')
        .replace(/<\/message>/gi, '')
        .trim();

      const deliveredText = `<message to="${targetDest}">\n${cleanText}\n</message>`;

      const memo = await MemoService.generateSemanticMemo(cleanText, async (sys, usr) => {
        const resp = await complete(
          [
            { role: 'system', content: sys },
            { role: 'user', content: usr },
          ],
          false,
        );
        return resp.content || '';
      });

      const historyLimit = options.historyLimit || 8;
      const updatedHistory = [
        ...options.history,
        { role: 'user', content: options.prompt },
        { role: 'assistant', content: deliveredText },
      ].slice(-historyLimit);

      return {
        deliveredText,
        updatedHistory,
        toolsExecutedCount: 0,
        memo,
      };
    }

    // 3. Tool-Assisted Execution Path with Execution Memory (Scratchpad)
    const activeToolNames = routedTools.map((t) => t.function?.name).filter(Boolean);
    const skillCatalog = SkillsManager.getSkillInstructionsForTools(activeToolNames, options.cwd);

    const baseActionPrompt = PromptLoader.load('stage1.action.md') ||
      'You are an autonomous technical execution engine running on NanoClaw.\nExecute tools directly with exact parameters to gather real data with minimal overhead.\nWhen all necessary information has been gathered from the tools, reply ONLY with "DONE".';

    const actionSystemPrompt = [
      timeContext,
      baseActionPrompt,
      options.systemInstructions || '',
      skillCatalog || '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const scratchpad = new ExecutionScratchpad(options.prompt, options.history);
    let finalContent = '';
    let toolsRunCount = 0;
    const maxIterations = Math.max(1, Number(options.maxIterations) || Number(process.env.NANOCLAW_MAX_TOOL_RUNS) || 8);

    // Stage 1: Action & Tool Execution Loop using Scratchpad State
    for (let iter = 0; iter < maxIterations; iter++) {
      onActivity?.();

      const currentMessages = scratchpad.toStage1Messages(actionSystemPrompt);
      const response = await complete(currentMessages, routedTools);
      const toolCalls = ResponseParser.extractToolCalls(response);

      if (toolCalls.length > 0) {
        const preText = ResponseParser.cleanHumanText(response.content);
        if (preText && iter === 0) {
          IntermediateNotifier.notify(targetDest, preText);
        }

        // Execute tools and record findings into Scratchpad
        for (const call of toolCalls) {
          onActivity?.();
          toolsRunCount++;
          const resultText = await executeTool(call.name, call.args, options.cwd);
          scratchpad.recordFinding(call.name, call.args, resultText);
        }

        continue;
      }

      // Model completed its tool calls (or emitted DONE)
      finalContent = ResponseParser.cleanHumanText(response.content);
      break;
    }

    // Stage 2: Synthesis Pass with findings gathered in Stage 1
    if (scratchpad.hasFindings()) {
      const synthesisDirective = PromptLoader.load('stage2.synthesis.md') ||
        '## Synthesis Directive\nSynthesize the verified execution findings and deliver a complete, elegant, and conclusive response to the user.\nApply persona directives, core business memory, executive structuring, clickable Markdown reference links, and clean formatting.';

      const personaPrompt = [
        timeContext,
        options.personaInstructions || '',
        options.coreMemory ? `## Context & Permanent Memory\n${options.coreMemory}` : '',
        synthesisDirective,
      ]
        .filter(Boolean)
        .join('\n\n');

      const synthesisPromptText = PromptLoader.load('scratchpad.synthesis.md', {
        USER_GOAL: options.prompt,
        FINDINGS_REPORT: scratchpad.toSynthesisReport(),
      }) || `## User Request\n${options.prompt}\n\n${scratchpad.toSynthesisReport()}\n\nPlease deliver the comprehensive executive synthesis:`;

      const synthesisMessages: any[] = [
        { role: 'system', content: personaPrompt },
        ...options.history.slice(-4),
        {
          role: 'user',
          content: synthesisPromptText,
        },
      ];

      try {
        onActivity?.();
        const synthResponse = await complete(synthesisMessages, false);
        const synthContent = ResponseParser.cleanHumanText(synthResponse.content);
        if (synthContent && synthContent.trim().length > 0) {
          finalContent = synthContent;
        }
      } catch (err) {
        console.error('[TurnOrchestrator] Error during executive synthesis pass:', err);
      }
    }

    // Fallback if model returned empty content
    if (!finalContent || !finalContent.trim() || finalContent === 'DONE') {
      finalContent = 'The requested actions and queries have completed successfully.';
    }

    const cleanText = finalContent
      .replace(/<message\s+to="[^"]*">/gi, '')
      .replace(/<\/message>/gi, '')
      .trim();

    const deliveredText = `<message to="${targetDest}">\n${cleanText}\n</message>`;

    const memo = await MemoService.generateSemanticMemo(cleanText, async (sys, usr) => {
      const resp = await complete(
        [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
        false,
      );
      return resp.content || '';
    });

    const historyLimit = options.historyLimit || 8;
    const updatedHistory = [
      ...options.history,
      { role: 'user', content: options.prompt },
      { role: 'assistant', content: deliveredText },
    ].slice(-historyLimit);

    return {
      deliveredText,
      updatedHistory,
      toolsExecutedCount: toolsRunCount,
      memo,
    };
  }
}
