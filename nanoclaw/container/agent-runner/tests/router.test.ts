import { describe, expect, test } from "bun:test";
import { ToolRouter, AGENT_TOOLS } from "../src/tools/index.js";

describe("ToolRouter Domain Segmentation & Routing", () => {
  test("Accurately matches Google Suite for email queries", () => {
    const tools = ToolRouter.selectTools("veja se hoje chegou algum e-mail importante para mim");
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("google_gmail");
    expect(names).toContain("google_calendar");
    expect(names).toContain("load_skill");
    expect(names).toContain("retrieve_message_context");
  });

  test("Accurately matches Google Suite for calendar and schedule queries", () => {
    const tools = ToolRouter.selectTools("qual minha agenda de amanha?");
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("google_calendar");
    expect(names).toContain("google_gmail");
    expect(names).toContain("load_skill");
  });

  test("Accurately matches E-Commerce & Logistics for Yampi, frete or prices", () => {
    const tools = ToolRouter.selectTools("quanto fica o frete pelos Correios para o CEP 12243-380 do jogo Grok?");
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("correios_shipping");
    expect(names).toContain("resale_pricing");
    expect(names).toContain("yampi_store");
    expect(names).not.toContain("google_gmail");
  });

  test("Accurately matches Notion & Task Management", () => {
    const tools = ToolRouter.selectTools("quais são as tarefas pendentes no Notion?");
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("notion");
    expect(names).toContain("schedule_followup");
    expect(names).not.toContain("yampi_store");
  });

  test("Returns 0 tools for pure chit-chat / conversational queries", () => {
    const tools1 = ToolRouter.selectTools("Oi, tudo bem?");
    expect(tools1.length).toBe(0);

    const tools2 = ToolRouter.selectTools("bom dia!");
    expect(tools2.length).toBe(0);

    const tools3 = ToolRouter.selectTools("quem é você?");
    expect(tools3.length).toBe(0);
  });

  test("Defensively falls back to full toolset for ambiguous action prompts", () => {
    const tools = ToolRouter.selectTools("analise a situacao e tome as providencias necessarias");
    expect(tools.length).toBe(AGENT_TOOLS.length);
  });

  test("Extensible domain registration works dynamically for new plugins", () => {
    ToolRouter.registerDomain({
      id: "crm_hubspot",
      name: "HubSpot CRM",
      description: "Integração CRM para leads e contatos.",
      toolNames: ["run_command"], // proxy mock tool
      keywords: ["hubspot", "lead", "pipeline"],
    });

    const domains = ToolRouter.getDomains();
    expect(domains.some((d) => d.id === "crm_hubspot")).toBe(true);

    const matched = ToolRouter.matchDomains("atualize o lead no hubspot");
    expect(matched).toContain("crm_hubspot");
  });
});
