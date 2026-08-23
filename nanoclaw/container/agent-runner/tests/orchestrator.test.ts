import { describe, expect, test, beforeAll, beforeEach, afterEach } from "bun:test";
import { TurnOrchestrator } from "../src/orchestrator/turn-orchestrator.js";
import { ExecutionScratchpad } from "../src/orchestrator/scratchpad.js";
import { PayloadSanitizer } from "../src/orchestrator/payload-sanitizer.js";
import { ModelRegistry } from "../src/services/model-registry.js";
import type { LLMResponse } from "../src/orchestrator/types.js";

const TEST_MODEL = "deepseek-chat";

function seedTestCatalog(): void {
  ModelRegistry.seedForTests([
    {
      id: TEST_MODEL,
      name: "DeepSeek Chat",
      providerId: "deepseek",
      description: "Test model",
      completionUrl: "https://api.deepseek.com/chat/completions",
      keyEnvName: "DEEPSEEK_API_KEY",
      protocol: "openai-compatible",
      inferenceParams: {},
      contextWindow: "128k",
      pricing: { cacheHitPerMillion: 0, cacheMissPerMillion: 0, outputPerMillion: 0 },
    },
  ]);
}

const roleModels = {
  orchestratorModel: TEST_MODEL,
  senderModel: TEST_MODEL,
  memoModel: TEST_MODEL,
  defaultModel: TEST_MODEL,
};

beforeAll(() => {
  process.env.TZ = process.env.TZ || "UTC";
});

beforeEach(() => {
  ModelRegistry.resetForTests();
  seedTestCatalog();
});

afterEach(() => {
  ModelRegistry.resetForTests();
});

describe("TurnOrchestrator Multi-Agent Pipeline & Execution Memory", () => {
  test("routes domain requests through worker and sender with ExecutionScratchpad", async () => {
    let workerToolCalls = 0;
    let senderInvoked = false;

    const mockComplete = async (_messages: any[], _enableTools: any, options: any): Promise<LLMResponse> => {
      if (options?.purpose === "orchestrator_triage") {
        return {
          content: JSON.stringify({
            type: "department_delegation",
            reasoning: "E-mails requerem especialista",
            departmentId: "productivity",
            agentId: "productivity_attendant",
            taskDescription: "veja meus e-mails de hoje",
          }),
        };
      }

      if (options?.purpose === "stage1_action") {
        workerToolCalls += 1;
        return {
          content: "Encontrei os dados.",
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: {
                name: "read_file",
                arguments: JSON.stringify({ path: "/tmp" }),
              },
            },
          ],
        };
      }

      if (options?.purpose === "stage2_synthesis" || options?.agent === "sender") {
        senderInvoked = true;
        return {
          content: '<message to="telegram:123">\nÔ sô, olhei o trem aqui e tá tudo limpo!\n</message>',
        };
      }

      return { content: "memo" };
    };

    const result = await TurnOrchestrator.runTurn(mockComplete, {
      prompt: "veja meus e-mails de hoje",
      cwd: "/tmp",
      history: [],
      systemInstructions: "Base technical system instructions",
      personaInstructions: "# Mineiro Sarcástico\nVocê é o Barão.",
      coreMemory: "Memória permanente de teste",
      historyLimit: 10,
      ...roleModels,
    });

    expect(workerToolCalls).toBeGreaterThan(0);
    expect(senderInvoked).toBe(true);
    expect(result.toolsExecutedCount).toBeGreaterThan(0);
    expect(result.deliveredText).toContain("Ô sô, olhei o trem aqui");
  });

  test("routes pure conversation through fast-path to sender", async () => {
    let senderInvoked = false;
    let workerInvoked = false;

    const mockComplete = async (_messages: any[], _enableTools: any, options: any): Promise<LLMResponse> => {
      if (options?.purpose === "orchestrator_triage") {
        return {
          content: JSON.stringify({
            type: "fast_path",
            reasoning: "Saudação simples",
            instructionsForSender: "Responda com cordialidade.",
          }),
        };
      }
      if (options?.purpose === "stage1_action") workerInvoked = true;
      if (options?.purpose === "stage2_synthesis" || options?.agent === "sender") senderInvoked = true;
      return { content: "Bom dia, Sergio! Em que posso ajudar hoje?" };
    };

    const result = await TurnOrchestrator.runTurn(mockComplete, {
      prompt: "Bom dia!",
      cwd: "/tmp",
      history: [],
      systemInstructions: "Base technical",
      personaInstructions: "Persona Barão",
      historyLimit: 10,
      ...roleModels,
    });

    expect(senderInvoked).toBe(true);
    expect(workerInvoked).toBe(false);
    expect(result.toolsExecutedCount).toBe(0);
    expect(result.deliveredText).toContain("Bom dia, Sergio!");
  });

  test("PayloadSanitizer preserves all business fields on arbitrary unknown tools without hardcoding", () => {
    const customToolOutput = JSON.stringify({
      order_id: "ML-998822",
      customer: "Sergio",
      custom_notes: "Entregar na recepção",
      status: "approved",
      amount_cents: 25000,
      spf: "pass",
      rawHeaders: { host: "api.hubspot.com", cookie: "session=123" },
      imageBlob: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    });

    const sanitized = PayloadSanitizer.sanitize("mercado_livre_custom", customToolOutput);
    const parsed = JSON.parse(sanitized);

    // Business fields MUST be preserved
    expect(parsed.order_id).toBe("ML-998822");
    expect(parsed.customer).toBe("Sergio");
    expect(parsed.custom_notes).toBe("Entregar na recepção");
    expect(parsed.status).toBe("approved");
    expect(parsed.amount_cents).toBe(25000);

    // Technical noise MUST be stripped/collapsed
    expect(parsed.spf).toBeUndefined();
    expect(parsed.rawHeaders).toBeUndefined();
    expect(parsed.imageBlob).toContain("Base64 blob");
  });

  test("ExecutionScratchpad maintains and isolates tool execution memory", () => {
    const pad = new ExecutionScratchpad("Consulte reuniões e e-mails", [
      { role: "user", content: "Mensagem antiga do usuário" },
    ]);

    expect(pad.hasFindings()).toBe(false);

    pad.recordFinding("google_calendar", { date: "2026-08-18" }, JSON.stringify({ count: 0, events: [] }));
    pad.recordFinding("google_gmail", { query: "is:unread" }, JSON.stringify({ total: 1, messages: [{ id: "m1", subject: "Boleto" }] }));

    expect(pad.hasFindings()).toBe(true);
    expect(pad.findingsCount).toBe(2);

    const report = pad.toSynthesisReport();
    expect(report).toContain("google_calendar");
    expect(report).toContain("google_gmail");
    expect(report).toContain("Boleto");

    const stage1Messages = pad.toStage1Messages("System technical directive");
    expect(stage1Messages[0].role).toBe("system");
    expect(stage1Messages[1].content).toContain("Gathered Tool Findings");
  });
});
