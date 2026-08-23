import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";
import { DatabaseService } from "./db.js";
import { LlmCredentialsService } from "./llm-credentials.js";
import { LlmModelService } from "./llm-models.js";
import { alignRoleModelsWithProvider } from "../../../nanoclaw/src/container-config.js";
import type { MaterializedLlmRegistry } from "../../../nanoclaw/src/llm-models-materialize.js";

function loadMaterializedRegistry(): MaterializedLlmRegistry | null {
  const registryPath = path.join(CONFIG.DATA_PATH, "llm-models.json");
  if (!fs.existsSync(registryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(registryPath, "utf-8")) as MaterializedLlmRegistry;
  } catch {
    return null;
  }
}

function resolveEffectiveRoleModels(
  provider: string | null,
  overrides: { model?: string; orchestratorModel?: string; senderModel?: string; memoModel?: string },
): { model: string; orchestratorModel: string; senderModel: string; memoModel: string } | null {
  if (!provider) return null;
  const registry = loadMaterializedRegistry();
  if (!registry) return null;
  const aligned = alignRoleModelsWithProvider(
    {
      mcpServers: {},
      packages: { apt: [], npm: [] },
      additionalMounts: [],
      skills: [],
      provider,
      model: overrides.model,
      orchestratorModel: overrides.orchestratorModel,
      senderModel: overrides.senderModel,
      memoModel: overrides.memoModel,
    },
    registry,
  );
  if (!aligned.model || !aligned.orchestratorModel || !aligned.senderModel || !aligned.memoModel) return null;
  return {
    model: aligned.model,
    orchestratorModel: aligned.orchestratorModel,
    senderModel: aligned.senderModel,
    memoModel: aligned.memoModel,
  };
}

function resolveProviderForModel(modelId: string): string | null {
  if (!modelId) return null;
  const registry = LlmModelService.getRegistry();
  for (const [providerId, meta] of Object.entries(registry.providers)) {
    if (meta.models.some((m) => m.id === modelId)) return providerId;
  }
  return null;
}

function parseLocationFields(input: {
  city?: string | null;
  country?: string | null;
  location?: string | null;
}): { city: string; country: string; location: string } {
  let city = (input.city || "").trim();
  let country = (input.country || "").trim();
  const rawLocation = (input.location || "").trim();

  if (!city && !country && rawLocation) {
    const parts = rawLocation.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city = parts[0];
      country = parts.slice(1).join(", ");
    } else if (parts.length === 1) {
      city = parts[0];
    }
  }

  const location = rawLocation || [city, country].filter(Boolean).join(", ");
  return { city, country, location };
}

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
  source: "custom" | "default" | "empty";
}

type DocCategory = MarkdownDocInfo["category"];

interface ContainerDocMeta {
  title: string;
  category: DocCategory;
  fallback: string;
}

const MEMORY_SKIP_PATHS = new Set(["memory/system/index.md"]);

const MODULE_TITLES: Record<string, string> = {
  scheduling: "⏰ Agendamentos & Tarefas Cron (ncl tasks)",
  interactive: "💬 Modo Interativo & Perguntas (ask_user_question)",
  agents: "👥 Criação & Delegação de Agentes (create_agent)",
  "self-mod": "🔄 Instalação de Pacotes & Auto-Modificação",
  cli: "💻 Terminal & CLI do NanoClaw (ncl)",
  core: "⚙️ Core de Mensagens & Arquivos (module-core.md)",
};

const mcpToolsDir = () =>
  path.join(CONFIG.NANOCLAW_PATH, "container", "agent-runner", "src", "mcp-tools");

const skillsDir = () => path.join(CONFIG.NANOCLAW_PATH, "container", "skills");

const memoryTemplate = (rel: string) =>
  path.join(CONFIG.NANOCLAW_PATH, "container", "agent-runner", "src", "memory", "templates", rel);

function isJunkName(name: string): boolean {
  return name.startsWith(".");
}

function formatSkillTitle(skillName: string): string {
  const label = skillName
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `🔌 Skill: ${label}`;
}

function buildContainerDocsCatalog(): Record<string, ContainerDocMeta> {
  const catalog: Record<string, ContainerDocMeta> = {
    "instructions.prepend.md": {
      title: "🧠 SOUL — identidade & voz (instructions.prepend.md)",
      category: "⭐ 1. Principais (Edição Frequente)",
      fallback: `# Identity

Name, tone, and how you speak to the user.

## Response formatting

When a reply is more than a short line, structure it with Markdown (headings, bullets, **bold**) so it's easy to read — keep it proportional; don't over-format simple answers.

When the answer uses web search or verified URLs, include those links in the message as Markdown \`[label](url)\`. Do not drop URLs from search results.
`,
    },
    "instructions.context.md": {
      title: "📋 Contexto operacional (instructions.context.md)",
      category: "⭐ 1. Principais (Edição Frequente)",
      fallback: "",
    },
    "memory/index.md": {
      title: "💾 Memória Permanente & Fatos (memory/index.md)",
      category: "⭐ 1. Principais (Edição Frequente)",
      fallback: memoryTemplate("index.md"),
    },
    "memory/system/definition.md": {
      title: "📐 Arquitetura de Memória OKF (definition.md)",
      category: "🔒 3. Protocolos de Sistema (Avançado)",
      fallback: memoryTemplate("system/definition.md"),
    },
  };

  const mcpDir = mcpToolsDir();
  if (fs.existsSync(mcpDir)) {
    for (const entry of fs.readdirSync(mcpDir)) {
      if (isJunkName(entry)) continue;
      const match = entry.match(/^(.+)\.instructions\.md$/);
      if (!match) continue;
      const moduleName = match[1];
      const relPath = `.claude-fragments/module-${moduleName}.md`;
      catalog[relPath] = {
        title: MODULE_TITLES[moduleName] ?? `⚙️ Módulo: ${moduleName}`,
        category:
          moduleName === "core"
            ? "🔒 3. Protocolos de Sistema (Avançado)"
            : "⚙️ 2. Módulos & Ferramentas (Comportamento)",
        fallback: path.join(mcpDir, entry),
      };
    }
  }

  const skillsRoot = skillsDir();
  if (fs.existsSync(skillsRoot)) {
    for (const skillName of fs.readdirSync(skillsRoot)) {
      if (isJunkName(skillName)) continue;
      const instructions = path.join(skillsRoot, skillName, "instructions.md");
      if (!fs.existsSync(instructions)) continue;
      const relPath = `.claude-fragments/skill-${skillName}.md`;
      catalog[relPath] = {
        title: formatSkillTitle(skillName),
        category: "⚙️ 2. Módulos & Ferramentas (Comportamento)",
        fallback: instructions,
      };
    }
  }

  return catalog;
}

function readLocalDocFile(filePath: string): { content: string; isCustom: boolean } | null {
  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(filePath);
  } catch {
    return null;
  }

  if (lstat.isSymbolicLink()) {
    try {
      return { content: fs.readFileSync(filePath, "utf-8"), isCustom: false };
    } catch {
      return null;
    }
  }

  if (lstat.isFile()) {
    return { content: fs.readFileSync(filePath, "utf-8"), isCustom: true };
  }

  return null;
}

function resolveDocSource(
  folder: string,
  relativePath: string,
  meta?: ContainerDocMeta,
): { content: string; source: MarkdownDocInfo["source"]; exists: boolean } {
  const safeRel = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(CONFIG.GROUPS_PATH, path.basename(folder), safeRel);

  const local = readLocalDocFile(filePath);
  if (local) {
    return {
      content: local.content,
      source: local.isCustom ? "custom" : "default",
      exists: local.isCustom,
    };
  }

  if (meta?.fallback && fs.existsSync(meta.fallback)) {
    return {
      content: fs.readFileSync(meta.fallback, "utf-8"),
      source: "default",
      exists: false,
    };
  }

  return { content: "", source: "empty", exists: false };
}

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
            provider: cfg?.provider ?? null,
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

    const catalog = buildContainerDocsCatalog();
    const knownPaths = new Set<string>();

    for (const [relPath, meta] of Object.entries(catalog)) {
      knownPaths.add(relPath);
      const resolved = resolveDocSource(folder, relPath, meta);
      if (resolved.source === "empty") continue;

      docs.push({
        filename: path.basename(relPath),
        relativePath: relPath,
        title: meta.title,
        category: meta.category,
        fallbackPath: meta.fallback || undefined,
        source: resolved.source,
      });
    }

    // Dynamically discover custom memory files created by the agent/user
    const memoryDir = path.join(groupDir, "memory");
    if (fs.existsSync(memoryDir)) {
      const scanDir = (dir: string, baseRel: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (isJunkName(entry.name)) continue;
          const entryRel = path.join(baseRel, entry.name);
          if (entry.isDirectory() && entry.name !== "node_modules") {
            scanDir(path.join(dir, entry.name), entryRel);
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            if (knownPaths.has(entryRel) || MEMORY_SKIP_PATHS.has(entryRel)) continue;
            const resolved = resolveDocSource(folder, entryRel);
            if (resolved.source === "empty") continue;

            knownPaths.add(entryRel);
            docs.push({
              filename: entry.name,
              relativePath: entryRel,
              title: `📄 Memória: ${entryRel}`,
              category: "⭐ 1. Principais (Edição Frequente)",
              source: resolved.source,
            });
          }
        }
      };
      scanDir(memoryDir, "memory");
    }

    return docs;
  }

  static getMarkdownDoc(
    folder: string,
    relativePath: string,
  ): { content: string; path: string; exists: boolean; source: MarkdownDocInfo["source"] } {
    const safeRel = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(CONFIG.GROUPS_PATH, path.basename(folder), safeRel);
    const catalog = buildContainerDocsCatalog();
    const meta = catalog[safeRel];
    const resolved = resolveDocSource(folder, safeRel, meta);

    return {
      content: resolved.content,
      path: filePath,
      exists: resolved.exists,
      source: resolved.source,
    };
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
    const safeFolder = path.basename(folder);
    const configFile = path.join(CONFIG.GROUPS_PATH, safeFolder, "container.json");
    let containerCfg: any = {};
    if (fs.existsSync(configFile)) {
      try {
        containerCfg = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      } catch {}
    }

    const dbRow = DatabaseService.getContainerConfigByFolder(safeFolder);
    const envMap = this.readNanoClawEnv();
    const storedModel = dbRow?.model ?? containerCfg.model ?? "";
    const storedOrchestrator = dbRow?.orchestrator_model ?? containerCfg.orchestratorModel ?? "";
    const storedSender = dbRow?.sender_model ?? containerCfg.senderModel ?? "";
    const storedMemo = dbRow?.memo_model ?? containerCfg.memoModel ?? "";
    const roleInferenceParams = (() => {
      if (containerCfg.roleInferenceParams) return containerCfg.roleInferenceParams;
      if (!dbRow?.role_inference_params) return {};
      try {
        return JSON.parse(dbRow.role_inference_params);
      } catch {
        return {};
      }
    })();
    const derivedProvider = storedModel ? resolveProviderForModel(storedModel) : null;
    const activeProvider = containerCfg.provider ?? dbRow?.provider ?? derivedProvider ?? null;

    const effective = resolveEffectiveRoleModels(activeProvider, {
      model: storedModel,
      orchestratorModel: storedOrchestrator,
      senderModel: storedSender,
      memoModel: storedMemo,
    });

    const locationFields = parseLocationFields({
      city: containerCfg.city || dbRow?.city,
      country: containerCfg.country || dbRow?.country,
      location: containerCfg.location || dbRow?.location,
    });

    return {
      ...containerCfg,
      agentGroupId: containerCfg.agentGroupId || dbRow?.agent_group_id,
      provider: activeProvider,
      model: storedModel,
      orchestratorModel: storedOrchestrator,
      senderModel: storedSender,
      memoModel: storedMemo,
      roleInferenceParams,
      effectiveModels: effective ?? undefined,
      modelUsesDefault: {
        worker: !storedModel.trim(),
        orchestrator: !storedOrchestrator.trim(),
        sender: !storedSender.trim(),
        memo: !storedMemo.trim(),
      },
      assistantName:
        containerCfg.assistantName ||
        containerCfg.groupName ||
        dbRow?.assistant_name ||
        envMap["NANOCLAW_AGENT_NAME"] ||
        "",
      timezone: containerCfg.timezone || dbRow?.timezone || envMap["TZ"] || "",
      city: locationFields.city,
      country: locationFields.country,
      location: locationFields.location,
      hasTelegramToken: !!envMap["TELEGRAM_BOT_TOKEN"],
    };
  }

  static saveProviderApiKey(providerId: string, apiKey: string): boolean {
    if (!apiKey.trim()) return false;
    try {
      LlmCredentialsService.setProviderApiKey(providerId, apiKey);
      return true;
    } catch {
      return false;
    }
  }

  static getProviderKeysStatus(): Record<string, { hasKey: boolean; masked: string }> {
    return LlmCredentialsService.getKeysStatus();
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
      assistantName: newConfig.name ?? newConfig.assistantName ?? current.assistantName,
      name: newConfig.name ?? current.name,
      model: newConfig.model !== undefined ? newConfig.model : (current.model ?? ""),
      orchestratorModel:
        newConfig.orchestratorModel !== undefined
          ? newConfig.orchestratorModel
          : (current.orchestratorModel ?? ""),
      senderModel: newConfig.senderModel !== undefined ? newConfig.senderModel : (current.senderModel ?? ""),
      memoModel: newConfig.memoModel !== undefined ? newConfig.memoModel : (current.memoModel ?? ""),
      roleInferenceParams:
        newConfig.roleInferenceParams !== undefined
          ? newConfig.roleInferenceParams
          : (current.roleInferenceParams ?? {}),
      city,
      country,
      location,
      timezone: newConfig.timezone || current.timezone || "Europe/Brussels",
    };

    const derivedProvider = merged.model ? resolveProviderForModel(merged.model) : null;
    merged.provider =
      newConfig.provider || current.provider || derivedProvider || merged.provider || null;

    const effective = resolveEffectiveRoleModels(merged.provider, {
      model: merged.model,
      orchestratorModel: merged.orchestratorModel,
      senderModel: merged.senderModel,
      memoModel: merged.memoModel,
    });

    if (!merged.provider) {
      throw new Error("provider não configurado — defina o provider do grupo ou selecione um modelo válido");
    }
    if (!effective) {
      throw new Error("não foi possível resolver modelos padrão — verifique llm-models.json e o provider do grupo");
    }

    const containerRuntime = {
      ...merged,
      model: effective.model,
      orchestratorModel: effective.orchestratorModel,
      senderModel: effective.senderModel,
      memoModel: effective.memoModel,
    };

    fs.writeFileSync(configFile, JSON.stringify(containerRuntime, null, 2) + "\n", "utf-8");

    if (merged.agentGroupId) {
      DatabaseService.updateContainerConfigFields(merged.agentGroupId, {
        ...merged,
        model: merged.model || null,
        orchestratorModel: merged.orchestratorModel || null,
        senderModel: merged.senderModel || null,
        memoModel: merged.memoModel || null,
        roleInferenceParams: merged.roleInferenceParams ?? {},
      }, { syncContainerJson: false });
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
      isGlobal: boolean;
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

          const GLOBAL_SKILLS_LIST = [
            'retrieve_message_context',
            'manage_memory',
            'run_command',
            'read_file',
            'load_skill',
          ];

          const isGlobal = GLOBAL_SKILLS_LIST.includes(ent.name) ||
            GLOBAL_SKILLS_LIST.some((g) => g.replace(/_/g, '-') === ent.name);

          // Scripts are local executables executed on-demand via bash, NOT loaded into the LLM context prompt
          const totalChars = skillMdChars + referencesChars;
          const totalTokens = skillMdTokens + referencesTokens;

          skills.push({
            name: ent.name,
            description,
            isGlobal,
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

  static getDepartmentsAndAgents(folder: string) {
    const DEFAULT_DEPARTMENTS: Array<{ id: string; name: string; description: string; icon?: string }> = [
      { id: "productivity", name: "Produtividade & Comunicação", description: "E-mails Gmail, Agenda Google Calendar, Notion e Tarefas", icon: "Calendar" },
      { id: "commerce", name: "Comércio, Logística & Revenda", description: "Loja Yampi, Tabela Grok, Preços de Revenda e Fretes Correios", icon: "ShoppingBag" },
      { id: "research_intel", name: "Pesquisa, Inteligência & Web", description: "Varredura web em tempo real, URLs e Métricas de Tokens", icon: "Globe" },
      { id: "operations", name: "Operações & Sistema", description: "Operações em arquivos, comandos de terminal e memória", icon: "Server" },
    ];

    const agents: Array<{
      id: string;
      name: string;
      department: string;
      role: string;
      description: string;
      skills: string[];
      allowGlobalSkills: boolean;
      model?: string;
      systemPrompt: string;
      systemPromptChars: number;
      systemPromptTokens: number;
      rawYaml: string;
      isCustom: boolean;
      filePath: string;
    }> = [];

    const candidateDirs = [
      { dir: CONFIG.AGENTS_PATH, isCustom: false },
      { dir: path.join(CONFIG.GROUPS_PATH, path.basename(folder), "agents"), isCustom: true },
    ];

    const agentsById = new Map<string, (typeof agents)[number]>();

    for (const { dir, isCustom } of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isDirectory()) continue;
          const agentMdPath = path.join(dir, ent.name, "AGENT.md");
          if (!fs.existsSync(agentMdPath)) continue;

          try {
            const content = fs.readFileSync(agentMdPath, "utf-8");
            const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
            if (!frontmatterMatch) continue;

            const rawYaml = frontmatterMatch[1];
            const systemPrompt = frontmatterMatch[2].trim();

            const parseField = (f: string) => {
              const m = rawYaml.match(new RegExp(`^${f}:\\s*(.+)$`, "m"));
              return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";
            };

            const id = parseField("id") || ent.name;
            const name = parseField("name") || id;
            const department = parseField("department") || parseField("departmentId") || "general";
            const role = parseField("role") || "Agente Especialista";
            const description = parseField("description") || role;
            const model = parseField("model") || undefined;
            const allowGlobalStr = parseField("allow_global_skills");
            const allowGlobalSkills = allowGlobalStr !== "" ? allowGlobalStr === "true" : true;

            const skills: string[] = [];
            const skillsSection = rawYaml.match(/skills:\s*\n((?:\s*-\s*.+\n?)+)/);
            if (skillsSection && skillsSection[1]) {
              const lines = skillsSection[1].split("\n");
              for (const line of lines) {
                const item = line.replace(/^\s*-\s*/, "").trim().replace(/^['"]|['"]$/g, "");
                if (item) skills.push(item);
              }
            }

            agentsById.set(id, {
              id,
              name,
              department,
              role,
              description,
              skills,
              allowGlobalSkills,
              model,
              systemPrompt,
              systemPromptChars: systemPrompt.length,
              systemPromptTokens: Math.ceil(systemPrompt.length / 3.8),
              rawYaml,
              isCustom,
              filePath: agentMdPath,
            });
          } catch {}
        }
      } catch {}
    }

    agents.push(...agentsById.values());

    const groupConfig = this.getConfig(folder);
    const groupWorkerModel =
      (groupConfig.effectiveModels?.model as string | undefined)?.trim() ||
      String(groupConfig.model ?? "").trim() ||
      "";

    const agentsWithEffective = agents.map((ag) => ({
      ...ag,
      effectiveModel: ag.model?.trim() || groupWorkerModel || undefined,
    }));

    // Collect all departments from agents
    const departmentsMap = new Map<string, { id: string; name: string; description: string; icon?: string }>();
    for (const d of DEFAULT_DEPARTMENTS) {
      departmentsMap.set(d.id, d);
    }
    for (const ag of agents) {
      if (!departmentsMap.has(ag.department)) {
        departmentsMap.set(ag.department, {
          id: ag.department,
          name: ag.department.toUpperCase(),
          description: `Departamento ${ag.department}`,
          icon: "Folder",
        });
      }
    }

    return {
      departments: Array.from(departmentsMap.values()),
      agents: agentsWithEffective,
      groupWorkerModel: groupWorkerModel || undefined,
    };
  }

  static getAgent(folder: string, agentId: string) {
    const { agents, groupWorkerModel } = this.getDepartmentsAndAgents(folder);
    const agent = agents.find((a) => a.id === agentId) || null;
    if (!agent) return null;
    return {
      ...agent,
      effectiveModel: agent.model?.trim() || groupWorkerModel || undefined,
    };
  }

  static saveAgent(
    folder: string,
    agentId: string,
    data: {
      name: string;
      department: string;
      role: string;
      description?: string;
      skills: string[];
      allowGlobalSkills?: boolean;
      model?: string;
      systemPrompt: string;
    }
  ): boolean {
    const safeId = agentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const groupAgentsDir = path.join(CONFIG.GROUPS_PATH, path.basename(folder), "agents", safeId);
    fs.mkdirSync(groupAgentsDir, { recursive: true });

    const agentMdPath = path.join(groupAgentsDir, "AGENT.md");

    const skillsYaml = data.skills.length > 0
      ? `skills:\n${data.skills.map((s) => `  - ${s}`).join("\n")}`
      : "skills: []";

    const content = `---
id: ${safeId}
name: "${data.name.replace(/"/g, '\\"')}"
department: ${data.department}
role: "${data.role.replace(/"/g, '\\"')}"
description: "${(data.description || data.role).replace(/"/g, '\\"')}"
${skillsYaml}
allow_global_skills: ${data.allowGlobalSkills !== false}
${data.model?.trim() ? `model: ${data.model.trim()}` : ""}
---

${data.systemPrompt.trim()}
`;

    fs.writeFileSync(agentMdPath, content.trimEnd() + "\n", "utf-8");
    return true;
  }

  static deleteAgent(folder: string, agentId: string): boolean {
    const safeId = agentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const groupAgentDir = path.join(CONFIG.GROUPS_PATH, path.basename(folder), "agents", safeId);
    if (fs.existsSync(groupAgentDir)) {
      fs.rmSync(groupAgentDir, { recursive: true, force: true });
      return true;
    }
    return false;
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
