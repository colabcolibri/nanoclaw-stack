import path from 'path';
import fs from 'fs';

import { readLocalEnvFile } from './env-file.js';

export interface OpenAiCompleteMessage {
  role: string;
  content?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface OpenAiCompleteOptions {
  model?: string;
  purpose?: string;
  inferenceOverride?: import('../../container/agent-runner/src/inference-params.js').InferenceParams;
}

export type OpenAiCompleteFn = (
  messages: OpenAiCompleteMessage[],
  tools?: unknown[],
  options?: OpenAiCompleteOptions,
) => Promise<{ content?: string; tool_calls?: unknown[] }>;

export interface OpenAiCompleteFactoryOptions {
  groupDir: string;
  registryPath: string;
  projectRoot: string;
  defaultModel: string;
  messageId: string;
  /** Token ledger só funciona no subprocesso Bun; no host Node fica desligado. */
  recordTelemetry?: boolean;
}

export async function createOpenAiCompatibleComplete(
  options: OpenAiCompleteFactoryOptions,
): Promise<OpenAiCompleteFn> {
  const containerSrc = path.join(options.projectRoot, 'container', 'agent-runner', 'src');

  if (!options.defaultModel?.trim()) {
    throw new Error('model not configured in container_configs');
  }

  const { ModelRegistry } = await import(path.join(containerSrc, 'services', 'model-registry.ts'));
  if (!ModelRegistry.loadFromDisk(options.registryPath)) {
    throw new Error('llm-models.json not found. Restart NanoClaw to materialize the catalog.');
  }

  const envMap = readLocalEnvFile();
  const defaultModel = options.defaultModel.trim();

  let roleInferenceOverrides = {};
  const containerJsonPath = path.join(options.groupDir, 'container.json');
  try {
    if (fs.existsSync(containerJsonPath)) {
      const raw = JSON.parse(fs.readFileSync(containerJsonPath, 'utf-8')) as { roleInferenceParams?: unknown };
      const { parseRoleInferenceOverrides } = await import(
        path.join(containerSrc, 'services', 'inference-resolver.ts')
      );
      roleInferenceOverrides = parseRoleInferenceOverrides(raw.roleInferenceParams);
    }
  } catch {
    /* optional */
  }

  return async (messages, tools, callOptions) => {
    const explicitModel = callOptions?.model;
    const targetModel = ModelRegistry.requireModelId(
      explicitModel ?? defaultModel,
      explicitModel ? 'model' : 'model',
      options.registryPath,
    );
    const invocation = ModelRegistry.requireInvocation(targetModel, options.registryPath);
    if (invocation.protocol !== 'openai-compatible') {
      throw new Error(`Model "${targetModel}" uses protocol ${invocation.protocol} — not supported in this gateway.`);
    }

    const apiKey = (envMap[invocation.keyEnvName] ?? process.env[invocation.keyEnvName])?.trim();
    if (!apiKey) {
      throw new Error(`Missing API key (${invocation.keyEnvName}). Set it in the NanoClaw .env file.`);
    }

    const payload: Record<string, unknown> = {
      model: targetModel,
      messages: messages.map((m) => {
        const formatted: Record<string, unknown> = { role: m.role, content: m.content || '' };
        if (m.tool_calls) formatted.tool_calls = m.tool_calls;
        if (m.tool_call_id) formatted.tool_call_id = m.tool_call_id;
        return formatted;
      }),
    };
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }
    ModelRegistry.applyParamsToPayload(payload, targetModel, {
      cwd: options.registryPath,
      purpose: callOptions?.purpose,
      roleOverrides: roleInferenceOverrides,
      callOverride: callOptions?.inferenceOverride,
    });

    const res = await fetch(invocation.completionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API Error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: unknown[] } }>;
      usage?: Record<string, unknown>;
    };
    const msg = data.choices?.[0]?.message || {};
    const usage = data.usage || {};

    if (options.recordTelemetry) {
      try {
        const { TokenLedger } = await import(path.join(containerSrc, 'services', 'token-ledger.ts'));
        const { buildLedgerPreview, resolvePurpose } = await import(
          path.join(containerSrc, 'services', 'llm-call-purpose.ts')
        );
        const purpose = resolvePurpose({
          purpose: callOptions?.purpose,
          hasToolCalls: Boolean(msg.tool_calls?.length),
        });
        TokenLedger.record(options.groupDir, targetModel, usage, {
          toolCallsCount: msg.tool_calls?.length || 0,
          preview: buildLedgerPreview(purpose, msg.content, msg.tool_calls),
          messageId: options.messageId,
          purpose,
        });
      } catch {
        /* telemetry optional */
      }
    }

    return {
      content: msg.content,
      tool_calls: msg.tool_calls,
    };
  };
}
