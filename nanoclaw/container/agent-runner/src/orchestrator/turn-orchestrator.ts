import fs from 'node:fs';
import path from 'node:path';
import { OrchestratorAgent } from '../agents/orchestrator-agent.js';
import type { LLMCompletionFn, TurnOptions, OrchestratorResult } from './types.js';

export function getTemporalContext(cwd?: string): string {
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
   * Runs a complete multi-agent turn through the OrchestratorAgent architecture:
   * 1. Orchestrator Triage (Fast-Path bypass vs Department routing)
   * 2. Department & Specialist Worker Selection
   * 3. Worker Agent Execution with isolated tools & skills
   * 4. Orchestrator Quality Gate & Evaluation
   * 5. Sender Agent Synthesis (Soul, Tone, Formatting)
   */
  static async runTurn(
    complete: LLMCompletionFn,
    options: TurnOptions,
    onActivity?: () => void
  ): Promise<OrchestratorResult> {
    const timeContext = getTemporalContext(options.cwd);

    return OrchestratorAgent.runTurn(
      complete,
      {
        prompt: options.prompt,
        cwd: options.cwd,
        chatJid: options.chatJid,
        history: options.history,
        personaInstructions: options.personaInstructions,
        coreMemory: options.coreMemory,
        systemInstructions: options.systemInstructions,
        historyLimit: options.historyLimit,
        maxWorkerIterations: options.maxIterations,
      },
      timeContext,
      onActivity
    );
  }
}
