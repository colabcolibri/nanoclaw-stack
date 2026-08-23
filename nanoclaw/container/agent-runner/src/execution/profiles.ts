import type {
  AgentCapability,
  CompletionInferenceInput,
  WorkerCompletion,
  WorkerExecutionProfile,
} from './types.js';

function hasSuccessfulTool(findings: CompletionInferenceInput['findings'], tool: string): boolean {
  const normalized = tool.toLowerCase();
  return findings.some((f) => {
    const name = f.tool.toLowerCase().replace(/-/g, '_');
    if (name !== normalized && !(normalized === 'web_search' && name === 'web_research')) {
      return false;
    }
    return !f.result.includes('"status":"budget_refused"') && !f.result.includes('"error"');
  });
}

function researchCompletion(input: CompletionInferenceInput): WorkerCompletion {
  const capability: AgentCapability = 'web.research';
  const searched = hasSuccessfulTool(input.findings, 'web_search');
  const browsed = hasSuccessfulTool(input.findings, 'browse_url');
  const done = input.summary.toUpperCase().includes('DONE');

  if (input.budgetExhausted && (searched || browsed)) {
    return {
      status: 'budget_exhausted',
      capability,
      reason: 'Research budget reached with partial evidence — synthesize from gathered findings.',
    };
  }

  if (done && (searched || browsed || input.findings.length === 0)) {
    return {
      status: 'sufficient',
      capability,
      reason: searched || browsed ? 'Research tools executed and worker marked DONE.' : 'Worker marked DONE without web tools.',
    };
  }

  if (input.iterationsRun >= input.maxIterations) {
    return {
      status: input.findings.length > 0 ? 'partial' : 'blocked',
      capability,
      reason:
        input.findings.length > 0
          ? 'Iteration limit reached with partial findings.'
          : 'Iteration limit reached without usable findings.',
    };
  }

  return {
    status: 'partial',
    capability,
    reason: 'Research in progress.',
  };
}

function metricsCompletion(input: CompletionInferenceInput): WorkerCompletion {
  const capability: AgentCapability = 'metrics.tokens';
  const used = hasSuccessfulTool(input.findings, 'token_usage');
  const done = input.summary.toUpperCase().includes('DONE');

  if (done && used) {
    return { status: 'sufficient', capability, reason: 'Token metrics retrieved.' };
  }
  if (input.iterationsRun >= input.maxIterations) {
    return {
      status: used ? 'partial' : 'blocked',
      capability,
      reason: used ? 'Metrics partial at iteration limit.' : 'No metrics retrieved.',
    };
  }
  return { status: 'partial', capability, reason: 'Metrics worker in progress.' };
}

function defaultCompletion(input: CompletionInferenceInput): WorkerCompletion {
  const done = input.summary.toUpperCase().includes('DONE');
  if (done && input.findings.length > 0) {
    return { status: 'sufficient', reason: 'Worker completed with tool findings.' };
  }
  if (done) {
    return { status: 'sufficient', reason: 'Worker marked DONE.' };
  }
  if (input.iterationsRun >= input.maxIterations) {
    return {
      status: input.findings.length > 0 ? 'partial' : 'blocked',
      reason: 'Default worker hit iteration limit.',
    };
  }
  return { status: 'partial', reason: 'Worker in progress.' };
}

const PROFILES: Record<string, WorkerExecutionProfile> = {
  default: {
    id: 'default',
    maxIterations: 6,
    toolBudgets: {},
    inferCompletion: defaultCompletion,
  },
  research_bounded: {
    id: 'research_bounded',
    maxIterations: 4,
    toolBudgets: {
      web_search: { maxCalls: 2, dedupeKey: 'query' },
      browse_url: { maxCalls: 2, dedupeKey: 'url' },
    },
    inferCompletion: researchCompletion,
  },
  metrics_readonly: {
    id: 'metrics_readonly',
    maxIterations: 2,
    toolBudgets: {
      token_usage: { maxCalls: 3 },
    },
    inferCompletion: metricsCompletion,
  },
};

export class ExecutionProfiles {
  static resolve(profileId?: string): WorkerExecutionProfile {
    if (profileId && PROFILES[profileId]) {
      return PROFILES[profileId];
    }
    return PROFILES.default;
  }

  static list(): string[] {
    return Object.keys(PROFILES);
  }
}
