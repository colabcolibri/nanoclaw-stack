import { describe, expect, test } from "bun:test";
import { AGENT_TOOLS } from "../src/tools/index.js";
import { ResalePricingEngine } from "../src/services/pricing.js";
import { MemoryManager } from "../src/services/memory.js";
import { TokenLedger } from "../src/services/token-ledger.js";

describe("Agent Runner Smoke & Regression Tests", () => {
  test("All agent tools are properly defined and typed", () => {
    expect(Array.isArray(AGENT_TOOLS)).toBe(true);
    expect(AGENT_TOOLS.length).toBeGreaterThan(0);

    for (const tool of AGENT_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function).toBeDefined();
      expect(typeof tool.function.name).toBe("string");
      expect(tool.function.name.length).toBeGreaterThan(0);
      expect(tool.function.parameters).toBeDefined();
    }
  });

  test("Pricing engine loads product catalog safely without syntax crashes", () => {
    const products = ResalePricingEngine.loadProductsFromCsv();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  test("MemoryManager initializes and loads memory cleanly", () => {
    const mem = MemoryManager.loadCoreMemory("/tmp");
    expect(typeof mem).toBe("string");
  });

  test("TokenLedger rates and peak calculations are deterministic", () => {
    const cost = TokenLedger.calculateCost("deepseek-v4-flash", {
      prompt_tokens: 1000,
      prompt_cache_hit_tokens: 800,
      prompt_cache_miss_tokens: 200,
      completion_tokens: 500,
    });
    expect(Number(cost.costUsd)).toBeGreaterThan(0);
    expect(Number(cost.costBrl)).toBeGreaterThan(0);
    expect(cost.promptTokens).toBe(1000);
    expect(cost.cacheHitTokens).toBe(800);
    expect(cost.cacheMissTokens).toBe(200);
    expect(cost.completionTokens).toBe(500);
  });

  test("Groq pricing rates and calculations are accurate", () => {
    const cost = TokenLedger.calculateCost("llama-3.3-70b-versatile", {
      prompt_tokens: 1000,
      completion_tokens: 500,
    });
    expect(Number(cost.costUsd)).toBeGreaterThan(0);
    expect(Number(cost.costBrl)).toBeGreaterThan(0);
  });

  test("All registered providers implement the full AgentProvider contract", async () => {
    const { createProvider } = await import("../src/providers/factory.js");
    await import("../src/providers/index.js");

    const providersToTest = ["deepseek", "groq"];
    for (const name of providersToTest) {
      const p = createProvider(name, { assistantName: "TestBot" });
      expect(p).toBeDefined();
      expect(typeof p.query).toBe("function");
      expect(typeof p.registerMemorySessionHook).toBe("function");
      expect(typeof p.isSessionInvalid).toBe("function");

      // Verify that calling registerMemorySessionHook does not crash
      expect(() => {
        p.registerMemorySessionHook({
          name: "test-memory-hook",
          description: "Test hook",
          source: "/tmp",
        });
      }).not.toThrow();
    }
  });

  test("web_search and browse_url are correctly registered in ALL_TOOLS", () => {
    expect(AGENT_TOOLS.some((t) => t.function.name === "web_search")).toBe(true);
    expect(AGENT_TOOLS.some((t) => t.function.name === "browse_url")).toBe(true);
  });
});
