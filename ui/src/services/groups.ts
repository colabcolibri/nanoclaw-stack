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

    const PROVIDER_ENV_MAP: Record<string, { keyName: string; modelName: string; urlName: string; defaultUrl: string }> = {
      deepseek: { keyName: "DEEPSEEK_API_KEY", modelName: "DEEPSEEK_MODEL", urlName: "DEEPSEEK_BASE_URL", defaultUrl: "https://api.deepseek.com" },
      groq: { keyName: "GROQ_API_KEY", modelName: "GROQ_MODEL", urlName: "GROQ_BASE_URL", defaultUrl: "https://api.groq.com/openai/v1" },
      claude: { keyName: "ANTHROPIC_API_KEY", modelName: "ANTHROPIC_MODEL", urlName: "ANTHROPIC_BASE_URL", defaultUrl: "https://api.anthropic.com" },
      openrouter: { keyName: "OPENROUTER_API_KEY", modelName: "OPENROUTER_MODEL", urlName: "OPENROUTER_BASE_URL", defaultUrl: "https://openrouter.ai/api/v1" },
      opencode: { keyName: "OPENCODE_API_KEY", modelName: "OPENCODE_MODEL", urlName: "OPENCODE_BASE_URL", defaultUrl: "http://127.0.0.1:4096" },
    };

    const envMap = this.readNanoClawEnv();
    const activeProvider = containerCfg.provider || envMap["NANOCLAW_AGENT_PROVIDER"] || "deepseek";

    const keysStatus: Record<string, { hasKey: boolean; masked: string }> = {};
    for (const [p, mapping] of Object.entries(PROVIDER_ENV_MAP)) {
      const rawKey = envMap[mapping.keyName] || "";
      keysStatus[p] = {
        hasKey: Boolean(rawKey && rawKey.trim().length > 0),
        masked: rawKey && rawKey.trim().length > 8 ? `${rawKey.slice(0, 5)}...${rawKey.slice(-4)}` : (rawKey ? "••••••••" : ""),
      };
    }

    const currentMapping = PROVIDER_ENV_MAP[activeProvider] || PROVIDER_ENV_MAP.deepseek;
    const currentKey = envMap[currentMapping.keyName] || "";
    const hasApiKey = Boolean(currentKey && currentKey.trim().length > 0);
    const maskedKey = hasApiKey && currentKey.length > 8 ? `${currentKey.slice(0, 5)}...${currentKey.slice(-4)}` : (hasApiKey ? "••••••••" : "");

    return {
      ...containerCfg,
      provider: activeProvider,
      model: containerCfg.model || envMap[currentMapping.modelName] || (activeProvider === "groq" ? "openai/gpt-oss-120b" : "deepseek-v4-flash"),
      assistantName: containerCfg.assistantName || containerCfg.groupName || envMap["NANOCLAW_AGENT_NAME"] || "Íris",
      timezone: containerCfg.timezone || envMap["TZ"] || "Europe/Brussels",
      city: containerCfg.city || "",
      country: containerCfg.country || containerCfg.location || "",
      location: containerCfg.location || [containerCfg.city, containerCfg.country].filter(Boolean).join(", ") || "",
      baseUrl: envMap[currentMapping.urlName] || currentMapping.defaultUrl,
      hasApiKey,
      maskedApiKey: maskedKey,
      keysStatus,
      hasTelegramToken: !!envMap["TELEGRAM_BOT_TOKEN"],
    };
  }

  static saveConfig(folder: string, newConfig: any): boolean {
    const configFile = path.join(CONFIG.GROUPS_PATH, path.basename(folder), "container.json");
    let current: any = {};
    if (fs.existsSync(configFile)) {
      try {
        current = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      } catch {}
    }

    const city = newConfig.city !== undefined ? newConfig.city : (current.city || "");
    const country = newConfig.country !== undefined ? newConfig.country : (current.country || "");
    const location = [city, country].filter(Boolean).join(", ") || newConfig.location || current.location || "";

    const merged: any = {
      ...current,
      ...newConfig,
      city,
      country,
      location,
      timezone: newConfig.timezone || current.timezone || "Europe/Brussels",
    };
    fs.writeFileSync(configFile, JSON.stringify(merged, null, 2) + "\n", "utf-8");

    // Sync SQLite table container_configs in central DB (Primary source of truth for NanoClaw)
    if (merged.agentGroupId) {
      DatabaseService.updateContainerConfig(merged.agentGroupId, merged);
    }

    const PROVIDER_ENV_MAP: Record<string, { keyName: string; modelName: string; urlName: string }> = {
      deepseek: { keyName: "DEEPSEEK_API_KEY", modelName: "DEEPSEEK_MODEL", urlName: "DEEPSEEK_BASE_URL" },
      groq: { keyName: "GROQ_API_KEY", modelName: "GROQ_MODEL", urlName: "GROQ_BASE_URL" },
      claude: { keyName: "ANTHROPIC_API_KEY", modelName: "ANTHROPIC_MODEL", urlName: "ANTHROPIC_BASE_URL" },
      openrouter: { keyName: "OPENROUTER_API_KEY", modelName: "OPENROUTER_MODEL", urlName: "OPENROUTER_BASE_URL" },
      opencode: { keyName: "OPENCODE_API_KEY", modelName: "OPENCODE_MODEL", urlName: "OPENCODE_BASE_URL" },
    };

    const envUpdates: Record<string, string> = {};
    const provider = newConfig.provider || current.provider || "deepseek";
    envUpdates["NANOCLAW_AGENT_PROVIDER"] = provider;

    if (newConfig.assistantName) envUpdates["NANOCLAW_AGENT_NAME"] = newConfig.assistantName;
    if (newConfig.timezone) envUpdates["TZ"] = newConfig.timezone;

    const mapping = PROVIDER_ENV_MAP[provider] || PROVIDER_ENV_MAP.deepseek;
    if (newConfig.model) envUpdates[mapping.modelName] = newConfig.model;
    if (newConfig.baseUrl && newConfig.baseUrl.trim()) envUpdates[mapping.urlName] = newConfig.baseUrl.trim();
    if (newConfig.apiKey && newConfig.apiKey.trim()) envUpdates[mapping.keyName] = newConfig.apiKey.trim();

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

    const skills: Array<{
      name: string;
      description: string;
      enabled: boolean;
      skillMdContent: string;
      skillMdChars: number;
      skillMdTokens: number;
      references: Array<{
        name: string;
        relativePath: string;
        sizeBytes: number;
        content: string;
        charCount: number;
        tokenCount: number;
      }>;
      referencesChars: number;
      referencesTokens: number;
      scripts: Array<{
        name: string;
        relativePath: string;
        sizeBytes: number;
        content?: string;
        charCount: number;
        tokenCount: number;
      }>;
      scriptsChars: number;
      scriptsTokens: number;
      totalChars: number;
      totalTokens: number;
    }> = [];

    if (fs.existsSync(CONFIG.SKILLS_PATH)) {
      const entries = fs.readdirSync(CONFIG.SKILLS_PATH, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const skillDir = path.join(CONFIG.SKILLS_PATH, ent.name);
          const skillMdPath = path.join(skillDir, "SKILL.md");
          let description = "Habilidade do assistente.";
          let skillMdContent = "";
          let skillMdChars = 0;
          let skillMdTokens = 0;

          if (fs.existsSync(skillMdPath)) {
            skillMdContent = fs.readFileSync(skillMdPath, "utf-8");
            skillMdChars = skillMdContent.length;
            skillMdTokens = Math.ceil(skillMdChars / 3.8);
            // Parse YAML frontmatter description
            const descMatch = skillMdContent.match(/description:\s*([^\n\r]+)/i);
            if (descMatch && descMatch[1]) {
              description = descMatch[1].trim();
            } else {
              const firstHeading = skillMdContent.match(/^#\s+(.+)$/m);
              if (firstHeading && firstHeading[1]) description = firstHeading[1].trim();
            }
          }

          // Scan references/
          const references: Array<{
            name: string;
            relativePath: string;
            sizeBytes: number;
            content: string;
            charCount: number;
            tokenCount: number;
          }> = [];
          let referencesChars = 0;
          let referencesTokens = 0;

          const refDir = path.join(skillDir, "references");
          if (fs.existsSync(refDir)) {
            try {
              const refFiles = fs.readdirSync(refDir, { withFileTypes: true });
              for (const rf of refFiles) {
                if (rf.isFile()) {
                  const fullPath = path.join(refDir, rf.name);
                  const stat = fs.statSync(fullPath);
                  const content = fs.readFileSync(fullPath, "utf-8");
                  const charCount = content.length;
                  const tokenCount = Math.ceil(charCount / 3.8);
                  referencesChars += charCount;
                  referencesTokens += tokenCount;
                  references.push({
                    name: rf.name,
                    relativePath: `references/${rf.name}`,
                    sizeBytes: stat.size,
                    content,
                    charCount,
                    tokenCount,
                  });
                }
              }
            } catch {}
          }

          // Scan scripts/
          const scripts: Array<{
            name: string;
            relativePath: string;
            sizeBytes: number;
            content?: string;
            charCount: number;
            tokenCount: number;
          }> = [];
          let scriptsChars = 0;
          let scriptsTokens = 0;

          const scriptDir = path.join(skillDir, "scripts");
          if (fs.existsSync(scriptDir)) {
            try {
              const scFiles = fs.readdirSync(scriptDir, { withFileTypes: true });
              for (const sf of scFiles) {
                if (sf.isFile()) {
                  const fullPath = path.join(scriptDir, sf.name);
                  const stat = fs.statSync(fullPath);
                  const content = fs.readFileSync(fullPath, "utf-8");
                  const charCount = content.length;
                  const tokenCount = Math.ceil(charCount / 3.8);
                  scriptsChars += charCount;
                  scriptsTokens += tokenCount;
                  scripts.push({
                    name: sf.name,
                    relativePath: `scripts/${sf.name}`,
                    sizeBytes: stat.size,
                    content,
                    charCount,
                    tokenCount,
                  });
                }
              }
            } catch {}
          }

          // Scripts are local executables executed on-demand via bash, NOT loaded into the LLM context prompt
          const totalChars = skillMdChars + referencesChars;
          const totalTokens = skillMdTokens + referencesTokens;

          skills.push({
            name: ent.name,
            description,
            enabled: isAll || enabledList.includes(ent.name),
            skillMdContent,
            skillMdChars,
            skillMdTokens,
            references,
            referencesChars,
            referencesTokens,
            scripts,
            scriptsChars,
            scriptsTokens: 0,
            totalChars,
            totalTokens,
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
