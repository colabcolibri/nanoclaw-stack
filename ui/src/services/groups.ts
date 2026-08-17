import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";
import { DatabaseService } from "./db.js";

export interface GroupSummary {
  id: string;
  name: string;
  folder: string;
  provider: string | null;
  createdAt: string;
  hasSoul: boolean;
  model?: string;
  assistantName?: string;
}

export interface MarkdownDocInfo {
  filename: string;
  relativePath: string;
  title: string;
  category: "⭐ 1. Principais (Edição Frequente)" | "⚙️ 2. Módulos & Ferramentas (Comportamento)" | "🔒 3. Protocolos de Sistema (Avançado)";
  fallbackPath?: string;
}

const DEFAULT_CONTAINER_DOCS: Record<string, { title: string; category: MarkdownDocInfo["category"]; fallback: string }> = {
  "instructions.prepend.md": {
    title: "🧠 Persona & Alma do Barão (instructions.prepend.md)",
    category: "⭐ 1. Principais (Edição Frequente)",
    fallback: "",
  },
  "memory/index.md": {
    title: "💾 Memória Permanente & Fatos (memory/index.md)",
    category: "⭐ 1. Principais (Edição Frequente)",
    fallback: "",
  },
  ".claude-fragments/module-scheduling.md": {
    title: "⏰ Agendamentos & Tarefas Cron (ncl tasks)",
    category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
    fallback: "/opt/nanoclaw/container/agent-runner/src/mcp-tools/scheduling.instructions.md",
  },
  ".claude-fragments/module-interactive.md": {
    title: "💬 Modo Interativo & Perguntas (ask_user_question)",
    category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
    fallback: "/opt/nanoclaw/container/agent-runner/src/mcp-tools/interactive.instructions.md",
  },
  ".claude-fragments/module-agents.md": {
    title: "👥 Criação & Delegação de Agentes (create_agent)",
    category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
    fallback: "/opt/nanoclaw/container/agent-runner/src/mcp-tools/agents.instructions.md",
  },
  ".claude-fragments/module-self-mod.md": {
    title: "🔄 Instalação de Pacotes & Auto-Modificação",
    category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
    fallback: "/opt/nanoclaw/container/agent-runner/src/mcp-tools/self-mod.instructions.md",
  },
  ".claude-fragments/module-cli.md": {
    title: "💻 Terminal & CLI do NanoClaw (ncl)",
    category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
    fallback: "/opt/nanoclaw/container/agent-runner/src/mcp-tools/cli.instructions.md",
  },
  ".claude-fragments/skill-onecli-gateway.md": {
    title: "🔌 Skill: OneCLI Gateway & Auth",
    category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
    fallback: "/opt/nanoclaw/container/skills/onecli-gateway/instructions.md",
  },
  "memory/system/definition.md": {
    title: "📐 Arquitetura de Memória OKF (definition.md)",
    category: "🔒 3. Protocolos de Sistema (Avançado)",
    fallback: "",
  },
  ".claude-fragments/module-core.md": {
    title: "⚙️ Core de Mensagens & Arquivos (module-core.md)",
    category: "🔒 3. Protocolos de Sistema (Avançado)",
    fallback: "/opt/nanoclaw/container/agent-runner/src/mcp-tools/core.instructions.md",
  },
};

export class GroupManager {
  static list(): GroupSummary[] {
    const groups: GroupSummary[] = [];
    const dbRows = DatabaseService.listAgentGroups();

    for (const r of dbRows) {
      const groupDir = path.join(CONFIG.GROUPS_PATH, r.folder);
      const soulFile = path.join(groupDir, "instructions.prepend.md");
      const cfg = this.getConfig(r.folder);

      groups.push({
        id: r.id,
        name: r.name,
        folder: r.folder,
        provider: cfg?.provider || r.agent_provider,
        createdAt: r.created_at,
        hasSoul: fs.existsSync(soulFile),
        model: cfg?.model || "",
        assistantName: cfg?.assistantName || cfg?.groupName || r.name,
      });
    }

    if (fs.existsSync(CONFIG.GROUPS_PATH)) {
      const entries = fs.readdirSync(CONFIG.GROUPS_PATH, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && !groups.some((g) => g.folder === ent.name)) {
          const groupDir = path.join(CONFIG.GROUPS_PATH, ent.name);
          const soulFile = path.join(groupDir, "instructions.prepend.md");
          const cfg = this.getConfig(ent.name);

          groups.push({
            id: ent.name,
            name: cfg?.assistantName || cfg?.groupName || ent.name,
            folder: ent.name,
            provider: cfg?.provider || "deepseek",
            createdAt: new Date().toISOString(),
            hasSoul: fs.existsSync(soulFile),
            model: cfg?.model || "",
            assistantName: cfg?.assistantName || cfg?.groupName || ent.name,
          });
        }
      }
    }

    return groups;
  }

  static listMarkdownDocs(folder: string): MarkdownDocInfo[] {
    const groupDir = path.join(CONFIG.GROUPS_PATH, path.basename(folder));
    const docs: MarkdownDocInfo[] = [];

    if (!fs.existsSync(groupDir)) return docs;

    const knownPaths = new Set<string>();

    for (const [relPath, meta] of Object.entries(DEFAULT_CONTAINER_DOCS)) {
      knownPaths.add(relPath);
      docs.push({
        filename: path.basename(relPath),
        relativePath: relPath,
        title: meta.title,
        category: meta.category,
        fallbackPath: meta.fallback,
      });
    }

    // Dynamically discover any custom memory files created by the agent/user
    const memoryDir = path.join(groupDir, "memory");
    if (fs.existsSync(memoryDir)) {
      const scanDir = (dir: string, baseRel: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryRel = path.join(baseRel, entry.name);
          if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
            scanDir(path.join(dir, entry.name), entryRel);
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            if (!knownPaths.has(entryRel)) {
              knownPaths.add(entryRel);
              docs.push({
                filename: entry.name,
                relativePath: entryRel,
                title: `📄 Memória: ${entryRel}`,
                category: "⭐ 1. Principais (Edição Frequente)",
              });
            }
          }
        }
      };
      scanDir(memoryDir, "memory");
    }

    return docs;
  }

  static getMarkdownDoc(folder: string, relativePath: string): { content: string; path: string; exists: boolean } {
    const safeRel = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(CONFIG.GROUPS_PATH, path.basename(folder), safeRel);

    // If file exists and is a regular readable file (or valid symlink)
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          return { content: fs.readFileSync(filePath, "utf-8"), path: filePath, exists: true };
        }
      } catch {}
    }

    // Check if we have a default fallback from container source
    const meta = DEFAULT_CONTAINER_DOCS[safeRel];
    if (meta && meta.fallback && fs.existsSync(meta.fallback)) {
      return { content: fs.readFileSync(meta.fallback, "utf-8"), path: filePath, exists: true };
    }

    return { content: "", path: filePath, exists: false };
  }

  static saveMarkdownDoc(folder: string, relativePath: string, content: string): boolean {
    const safeRel = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(CONFIG.GROUPS_PATH, path.basename(folder), safeRel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // If it was a symlink, remove it first so we create a real customized file for this group
    try {
      if (fs.lstatSync(filePath).isSymbolicLink()) {
        fs.unlinkSync(filePath);
      }
    } catch {}

    fs.writeFileSync(filePath, content.trimEnd() + "\n", "utf-8");
    return true;
  }

  static getSoul(folder: string): { content: string; path: string; exists: boolean } {
    return this.getMarkdownDoc(folder, "instructions.prepend.md");
  }

  static saveSoul(folder: string, content: string): boolean {
    return this.saveMarkdownDoc(folder, "instructions.prepend.md", content);
  }

  static readNanoClawEnv(): Record<string, string> {
    const envFile = path.join(CONFIG.NANOCLAW_PATH, ".env");
    const result: Record<string, string> = {};
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [k, ...v] = trimmed.split("=");
        if (k) result[k.trim()] = v.join("=").trim();
      }
    }
    return result;
  }

  static writeNanoClawEnv(updates: Record<string, string>) {
    const envFile = path.join(CONFIG.NANOCLAW_PATH, ".env");
    const current = this.readNanoClawEnv();
    const merged = { ...current, ...updates };
    const content = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";
    fs.writeFileSync(envFile, content, "utf-8");
  }

  static getConfig(folder: string): any {
    const configFile = path.join(CONFIG.GROUPS_PATH, path.basename(folder), "container.json");
    let containerCfg: any = {};
    if (fs.existsSync(configFile)) {
      try {
        containerCfg = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      } catch {}
    }

    const envMap = this.readNanoClawEnv();
    const deepseekKey = envMap["DEEPSEEK_API_KEY"] || "";
    const maskedKey = deepseekKey ? `${deepseekKey.slice(0, 6)}...${deepseekKey.slice(-4)}` : "";

    return {
      ...containerCfg,
      provider: containerCfg.provider || envMap["NANOCLAW_AGENT_PROVIDER"] || "deepseek",
      model: containerCfg.model || envMap["DEEPSEEK_MODEL"] || "deepseek-v4-flash",
      assistantName: containerCfg.assistantName || containerCfg.groupName || envMap["NANOCLAW_AGENT_NAME"] || "Barão",
      baseUrl: envMap["DEEPSEEK_BASE_URL"] || "https://api.deepseek.com",
      hasApiKey: !!deepseekKey,
      maskedApiKey: maskedKey,
      hasTelegramToken: !!envMap["TELEGRAM_BOT_TOKEN"],
    };
  }

  static saveConfig(folder: string, newConfig: any): boolean {
    const configFile = path.join(CONFIG.GROUPS_PATH, path.basename(folder), "container.json");
    let current = {};
    if (fs.existsSync(configFile)) {
      try {
        current = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      } catch {}
    }

    const merged: any = { ...current, ...newConfig };
    fs.writeFileSync(configFile, JSON.stringify(merged, null, 2) + "\n", "utf-8");

    // Sync SQLite table container_configs in central DB (Primary source of truth for NanoClaw)
    if (merged.agentGroupId) {
      DatabaseService.updateContainerConfig(merged.agentGroupId, merged);
    }

    const envUpdates: Record<string, string> = {};
    if (newConfig.provider) envUpdates["NANOCLAW_AGENT_PROVIDER"] = newConfig.provider;
    if (newConfig.model) envUpdates["DEEPSEEK_MODEL"] = newConfig.model;
    if (newConfig.assistantName) envUpdates["NANOCLAW_AGENT_NAME"] = newConfig.assistantName;
    if (newConfig.apiKey && newConfig.apiKey.trim()) envUpdates["DEEPSEEK_API_KEY"] = newConfig.apiKey.trim();
    if (newConfig.baseUrl && newConfig.baseUrl.trim()) envUpdates["DEEPSEEK_BASE_URL"] = newConfig.baseUrl.trim();

    if (Object.keys(envUpdates).length > 0) {
      this.writeNanoClawEnv(envUpdates);
    }

    return true;
  }

  static getSkills(folder: string) {
    const cfg = this.getConfig(folder) || {};
    const enabledConfig = cfg.skills ?? "all";
    const isAll = enabledConfig === "all";
    const enabledList = Array.isArray(enabledConfig) ? enabledConfig : [];

    const descriptions: Record<string, string> = {
      "agent-browser": "Navegação web e extração de dados via Puppeteer/Playwright.",
      "frontend-engineer": "Assistência em desenvolvimento frontend e componentes.",
      "onecli-gateway": "Gateway e ponte para execução de comandos OneCLI.",
      "self-customize": "Auto-aprendizado e evolução dinâmica de instruções.",
      welcome: "Fluxo de boas-vindas e introdução.",
    };

    const skills: { name: string; description: string; enabled: boolean }[] = [];
    if (fs.existsSync(CONFIG.SKILLS_PATH)) {
      const entries = fs.readdirSync(CONFIG.SKILLS_PATH, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          skills.push({
            name: ent.name,
            description: descriptions[ent.name] || "Ferramenta nativa do contêiner NanoClaw.",
            enabled: isAll || enabledList.includes(ent.name),
          });
        }
      }
    }

    return { skills, mode: isAll ? "all" : "custom" };
  }

  static saveSkills(folder: string, mode: "all" | "custom", selectedSkills: string[]): boolean {
    const cfg = this.getConfig(folder) || {};
    cfg.skills = mode === "all" ? "all" : selectedSkills;
    return this.saveConfig(folder, cfg);
  }

  static getMcpServers(folder: string): Record<string, any> {
    const cfg = this.getConfig(folder) || {};
    return cfg.mcpServers || {};
  }

  static saveMcpServers(folder: string, mcpServers: Record<string, any>): boolean {
    const raw = mcpServers && typeof mcpServers === "object" && mcpServers.mcpServers ? mcpServers.mcpServers : mcpServers;
    const normalized: Record<string, any> = {};

    if (raw && typeof raw === "object") {
      for (const [key, val] of Object.entries(raw)) {
        if (val && typeof val === "object") {
          const entry: any = { ...(val as Record<string, any>) };
          if (entry.serverUrl && !entry.url) {
            entry.url = entry.serverUrl;
          }
          if (entry.url && !entry.type) {
            entry.type = "http";
          }
          if (entry.command && !entry.type) {
            entry.type = "stdio";
          }
          normalized[key] = entry;
        }
      }
    }

    const cfg = this.getConfig(folder) || {};
    cfg.mcpServers = normalized;
    return this.saveConfig(folder, cfg);
  }
}
