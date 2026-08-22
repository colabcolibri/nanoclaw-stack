export interface AgentAuditTraceRow {
  step: string;
  agent?: string;
  department?: string;
  purpose?: string;
  latencyMs?: number;
  timestamp: string;
  messageId?: string;
  supervisorStep?: number;
  decision?: string;
  promptPreview?: string;
  responsePreview?: string;
  metadata?: Record<string, unknown>;
  tokens?: { prompt?: number; completion?: number; total?: number };
}

export interface AgentAuditTraceItem {
  id: string;
  step: string;
  agent?: string;
  department?: string;
  purpose: string;
  latencyMs: number;
  timestamp: string;
  messageId?: string;
  supervisorStep?: number;
  decision?: string;
  promptPreview?: string;
  responsePreview?: string;
  metadata?: Record<string, unknown>;
  tokens?: { prompt?: number; completion?: number; total?: number };
}

/** Parser puro de linhas JSONL — testável sem I/O. */
export function parseAgentAuditJsonl(
  lines: string[],
  idOffset = 0,
): AgentAuditTraceItem[] {
  const traces: AgentAuditTraceItem[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as AgentAuditTraceRow;
      if (!row?.step || !row?.timestamp) continue;
      traces.push({
        id: `${row.timestamp}-${row.step}-${idOffset + traces.length}`,
        step: row.step,
        agent: row.agent,
        department: row.department,
        purpose: row.purpose || row.step,
        latencyMs: row.latencyMs ?? 0,
        timestamp: row.timestamp,
        messageId: row.messageId,
        supervisorStep: row.supervisorStep,
        decision: row.decision,
        promptPreview: row.promptPreview,
        responsePreview: row.responsePreview,
        metadata: row.metadata,
        tokens: row.tokens,
      });
    } catch {
      // skip malformed line
    }
  }

  return traces;
}
