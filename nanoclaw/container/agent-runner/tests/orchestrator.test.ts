import { describe, expect, test } from "bun:test";
import { TurnOrchestrator } from "../src/orchestrator/turn-orchestrator.js";
import { ExecutionScratchpad } from "../src/orchestrator/scratchpad.js";
import { PayloadSanitizer } from "../src/orchestrator/payload-sanitizer.js";
import type { LLMResponse } from "../src/orchestrator/types.js";

describe("TurnOrchestrator Multi-Agent Pipeline & Execution Memory", () => {
  test("Executes specialist worker in Stage 1 and applies Persona exclusively in Sender Agent with ExecutionScratchpad", async () => {
    let stage1ToolsPassed: any = null;
    let stage1HadTechnicalPrompt = false;
    let stage2PersonaPresent: boolean = false;
    let stage2ReceivedFindings = false;
    let callCount = 0;

    const mockComplete = async (messages: any[], enableTools: any, options: any): Promise<LLMResponse> => {
      callCount++;

      if (callCount === 1) {
        // Stage 1 - Specialist worker execution
        stage1ToolsPassed = enableTools;
        const sys = messages.find((m) => m.role === "system")?.content || "";
        if (sys.includes("agente especialista")) {
          stage1HadTechnicalPrompt = true;
        }

        return {
          content: "Vou verificar seus e-mails.",
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

      if (callCount === 2) {
        // Stage 1 - conclusion after tool execution
        return {
          content: "Encontrei os dados.",
        };
      }

      // Stage 2 / Sender - Persona synthesis pass
      const sys = messages.find((m) => m.role === "system")?.content || "";
      if (sys.includes("Mineiro Sarcástico") || sys.includes("Barão")) {
        stage2PersonaPresent = true;
      }

      const userPrompt = messages.find((m) => m.role === "user")?.content || "";
      if (userPrompt.includes("read_file") || userPrompt.includes("Resultados Técnicos")) {
        stage2ReceivedFindings = true;
      }

      return {
        content: "<message to=\"telegram:123\">\nÔ sô, olhei o trem aqui e tá tudo limpo!\n</message>",
      };
    };

    const result = await TurnOrchestrator.runTurn(mockComplete, {
      prompt: "veja meus e-mails de hoje",
      cwd: "/tmp",
      history: [],
      systemInstructions: "Base technical system instructions",
      personaInstructions: "# Mineiro Sarcástico\nVocê é o Barão.",
      coreMemory: "Memória permanente de teste",
      historyLimit: 10,
    });

    expect(result.toolsExecutedCount).toBe(1);
    expect(Array.isArray(stage1ToolsPassed)).toBe(true);
    expect(stage1HadTechnicalPrompt).toBe(true);
    expect(stage2PersonaPresent).toBe(true);
    expect(stage2ReceivedFindings).toBe(true);
    expect(result.deliveredText).toContain("Ô sô, olhei o trem aqui");
  });

  test("Direct conversation with zero tools completes in exactly 1 direct pass through Sender Agent", async () => {
    let directCalls = 0;
    const mockComplete = async (messages: any[], enableTools: any, options: any): Promise<LLMResponse> => {
      directCalls++;
      expect(enableTools).toBe(false);
      return {
        content: "Bom dia, Sergio! Em que posso ajudar hoje?",
      };
    };

    const result = await TurnOrchestrator.runTurn(mockComplete, {
      prompt: "Bom dia!",
      cwd: "/tmp",
      history: [],
      systemInstructions: "Base technical",
      personaInstructions: "Persona Barão",
      historyLimit: 10,
    });

    expect(directCalls).toBe(1);
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
    expect(parsed.imageBlob).toContain("Blob Base64");
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
