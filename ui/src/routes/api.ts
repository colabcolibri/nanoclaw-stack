import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";
import { AuthService } from "../auth/service.js";
import { TokenManager } from "../auth/token.js";
import { GroupManager } from "../services/groups.js";
import { DatabaseService } from "../services/db.js";
import { SystemService } from "../services/system.js";
import { GoogleAuthService } from "../services/google-auth.js";
import { NotionAuthService } from "../services/notion-auth.js";
import { YampiAuthService } from "../services/yampi-auth.js";
import { MacChannelService } from "../channels/macos/index.js";
import { LlmModelService } from "../services/llm-models.js";
import {
  isValidPurgeConfirmation,
  purgeChatAndCosts,
} from "../services/maintenance.js";

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const val = rest.join("=").trim();
    if (!val) return;
    list[name] = decodeURIComponent(val);
  });
  return list;
}

function requireRequestHost(req: Request): string {
  const host = req.headers.get("host")?.trim();
  if (!host) {
    throw new Error("Header Host ausente — impossível montar URLs de callback.");
  }
  return host;
}

function resolveGroupFolder(param: string | null | undefined): string {
  const trimmed = param?.trim();
  if (trimmed) return trimmed;
  return CONFIG.DEFAULT_GROUP_FOLDER;
}

function jsonResponse(data: any, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export class ApiRouter {
  static async handle(req: Request, url: URL): Promise<Response | null> {
    if (!url.pathname.startsWith("/api/")) return null;

    const method = req.method;

    // --- PUBLIC AUTH ROUTES ---
    if (url.pathname === "/api/auth/send-code" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { email?: string };
      const email = body.email?.trim().toLowerCase();
      if (!email || !email.includes("@")) return jsonResponse({ error: "E-mail inválido." }, 400);

      const result = await AuthService.requestOtp(email);
      if (!result.success) return jsonResponse({ error: result.error || "Falha ao enviar código." }, 400);
      return jsonResponse({
        success: true,
        message: result.message || "Caso este seja o e-mail cadastrado, você receberá um código de verificação em instantes.",
      });
    }

    if (url.pathname === "/api/auth/verify-code" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
      const email = body.email?.trim().toLowerCase();
      const code = body.code?.trim();
      if (!email || !code) return jsonResponse({ error: "E-mail e código são obrigatórios." }, 400);

      const check = AuthService.verifyOtp(email, code);
      if (!check.valid) return jsonResponse({ error: check.reason || "Código inválido." }, 400);

      const token = TokenManager.create(email);
      const cookie = `${CONFIG.COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
        CONFIG.SESSION_MAX_AGE_DAYS * 24 * 60 * 60
      }`;
      return jsonResponse({ success: true, user: { email } }, 200, { "Set-Cookie": cookie });
    }

    if (url.pathname === "/api/auth/me" && method === "GET") {
      const cookies = parseCookies(req.headers.get("cookie"));
      const token = cookies[CONFIG.COOKIE_NAME];
      const verified = token ? TokenManager.verify(token) : null;
      if (!verified) return jsonResponse({ authenticated: false }, 401);
      return jsonResponse({ authenticated: true, user: { email: verified.email } });
    }

    if (url.pathname === "/api/auth/logout" && method === "POST") {
      const expiredCookie = `${CONFIG.COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
      return jsonResponse({ success: true }, 200, { "Set-Cookie": expiredCookie });
    }

    // --- MACBOOK / NATIVE APP API (Bearer Token Auth) ---
    if (url.pathname.startsWith("/api/mac/")) {
      const authHeader = req.headers.get("Authorization") || "";
      const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      const folder = resolveGroupFolder(url.searchParams.get("group"));

      // Allow Bearer token auth for all /api/mac/* endpoints
      if (!MacChannelService.validateApiKey(bearerToken, folder)) {
        // If not valid bearer token, check if user is logged in via cookie for config query
        const cookies = parseCookies(req.headers.get("cookie"));
        const token = cookies[CONFIG.COOKIE_NAME];
        const user = token ? TokenManager.verify(token) : null;
        if (!user) {
          return jsonResponse({ error: "Token de autenticação inválido. Configure sua chave do Mac." }, 401);
        }
      }

      if (url.pathname === "/api/mac/verify" && (method === "GET" || method === "POST")) {
        return jsonResponse({ success: true, message: "Autenticado com sucesso!", folder });
      }

      if (url.pathname === "/api/mac/threads" && method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        try {
          const threads = MacChannelService.getThreads(folder, limit);
          return jsonResponse({ success: true, threads });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao listar conversas." }, 500);
        }
      }

      if (url.pathname === "/api/mac/history" && method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const sessionId = url.searchParams.get("sessionId")?.trim() || undefined;
        try {
          const messages = await MacChannelService.getHistory(folder, limit, sessionId);
          return jsonResponse({ success: true, messages });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao resgatar histórico." }, 500);
        }
      }

      if (url.pathname === "/api/mac/prompt" && method === "POST") {
        const body = (await req.json().catch(() => ({}))) as {
          prompt?: string;
          resetSession?: boolean;
          conversationMode?: "new" | "new-resume";
          sessionId?: string;
        };
        const prompt = body.prompt?.trim();
        if (!prompt) return jsonResponse({ error: "Prompt é obrigatório." }, 400);

        try {
          const result = await MacChannelService.processPrompt(prompt, folder, {
            resetSession: !!body.resetSession,
            conversationMode: body.conversationMode,
            sessionId: body.sessionId?.trim() || undefined,
          });
          return jsonResponse({
            success: true,
            reply: result.reply,
            timestamp: result.timestamp,
            sessionId: result.sessionId,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao processar instrução no Barão." }, 500);
        }
      }

      if (url.pathname === "/api/mac/audio" && method === "POST") {
        try {
          const contentType = req.headers.get("content-type") || "";
          let audioBuffer: ArrayBuffer;

          let sessionId: string | undefined;
          if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("audio") || formData.get("audio_file") || formData.get("file");
            if (!file || !(file instanceof Blob)) {
              return jsonResponse({ error: "Arquivo de áudio não encontrado na requisição." }, 400);
            }
            audioBuffer = await file.arrayBuffer();
            const sid = formData.get("sessionId");
            if (typeof sid === "string" && sid.trim()) sessionId = sid.trim();
          } else {
            audioBuffer = await req.arrayBuffer();
          }

          if (!audioBuffer || audioBuffer.byteLength === 0) {
            return jsonResponse({ error: "Buffer de áudio vazio." }, 400);
          }

          const result = await MacChannelService.processAudio(audioBuffer, folder, sessionId);
          return jsonResponse({
            success: true,
            transcription: result.transcription,
            reply: result.reply,
            timestamp: result.timestamp,
            sessionId: result.sessionId,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao transcrever e processar áudio." }, 500);
        }
      }

      if (url.pathname === "/api/mac/reset" && method === "POST") {
        try {
          const body = (await req.json().catch(() => ({}))) as { mode?: "new" | "new-resume" };
          const mode = body.mode === "new-resume" ? "new-resume" : "new";
          const result = await MacChannelService.resetSession(folder, mode);
          return jsonResponse({
            success: true,
            message: result.message,
            sessionId: result.sessionId,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao reiniciar sessão." }, 500);
        }
      }

      if (url.pathname === "/api/mac/config" && method === "GET") {
        const configFolder = resolveGroupFolder(url.searchParams.get("group"));
        const origin = new URL(req.url).origin;
        return jsonResponse({
          apiKey: MacChannelService.getOrCreateApiKey(configFolder),
          endpoint: `${origin}/api/mac/prompt`,
          group: configFolder,
        });
      }
    }


    // --- PROTECTED ROUTES CHECK ---
    const cookies = parseCookies(req.headers.get("cookie"));
    const token = cookies[CONFIG.COOKIE_NAME];
    const user = token ? TokenManager.verify(token) : null;
    if (!user) return jsonResponse({ error: "Não autorizado." }, 401);

    if (url.pathname === "/api/app-config" && method === "GET") {
      return jsonResponse({
        defaultGroupFolder: CONFIG.DEFAULT_GROUP_FOLDER,
        uiPublicUrl: CONFIG.UI_PUBLIC_URL,
      });
    }

    // Groups
    if (url.pathname === "/api/groups" && method === "GET") {
      return jsonResponse({ groups: GroupManager.list() });
    }

    // LLM Models Registry (read-only — catálogo vem do código)
    if (url.pathname === "/api/llm/registry" && method === "GET") {
      return jsonResponse(LlmModelService.getRegistry());
    }

    const llmProviderKeyMatch = url.pathname.match(/^\/api\/llm\/providers\/([^/]+)\/api-key$/);
    if (llmProviderKeyMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as Record<string, any>;
      if (!body.apiKey || !String(body.apiKey).trim()) {
        return jsonResponse({ error: "apiKey é obrigatória." }, 400);
      }
      const ok = GroupManager.saveProviderApiKey(llmProviderKeyMatch[1], String(body.apiKey));
    if (!ok) {
      return jsonResponse(
        { error: "Não foi possível salvar a chave. Verifique NANOCLAW_CREDENTIALS_ENCRYPTION_KEY em nanoclaw/.env." },
        400,
      );
    }
      return jsonResponse({ success: true, keysStatus: GroupManager.getProviderKeysStatus() });
    }

    if (url.pathname === "/api/llm/keys-status" && method === "GET") {
      return jsonResponse({ keysStatus: GroupManager.getProviderKeysStatus() });
    }

    // Soul / Docs List
    const docsListMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/docs$/);
    if (docsListMatch && method === "GET") {
      return jsonResponse({ docs: GroupManager.listMarkdownDocs(docsListMatch[1]) });
    }

    // Generic Doc Get / Save
    const docMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/doc$/);
    if (docMatch && method === "GET") {
      const relPath = url.searchParams.get("path") || "instructions.prepend.md";
      return jsonResponse(GroupManager.getMarkdownDoc(docMatch[1], relPath));
    }
    if (docMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { path?: string; content?: string };
      const relPath = body.path || "instructions.prepend.md";
      GroupManager.saveMarkdownDoc(docMatch[1], relPath, body.content || "");
      return jsonResponse({ success: true });
    }

    // Soul (Backward compat)
    const soulMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/soul$/);
    if (soulMatch && method === "GET") {
      return jsonResponse(GroupManager.getSoul(soulMatch[1]));
    }
    if (soulMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { content?: string };
      GroupManager.saveSoul(soulMatch[1], body.content || "");
      return jsonResponse({ success: true });
    }

    // Config
    const configMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/config$/);
    if (configMatch && method === "GET") {
      return jsonResponse({ config: GroupManager.getConfig(configMatch[1]) });
    }
    if (configMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { config?: any };
      if (body.config) GroupManager.saveConfig(configMatch[1], body.config);
      return jsonResponse({ success: true });
    }

    // Agents & Departments
    const agentsMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/agents$/);
    if (agentsMatch && method === "GET") {
      return jsonResponse(GroupManager.getDepartmentsAndAgents(agentsMatch[1]));
    }
    if (agentsMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as any;
      if (!body.id || !body.name) {
        return jsonResponse({ error: "id e name são obrigatórios" }, 400);
      }
      GroupManager.saveAgent(agentsMatch[1], body.id, body);
      return jsonResponse({ success: true, agent: GroupManager.getAgent(agentsMatch[1], body.id) });
    }

    const agentDetailMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/agents\/([^\/]+)$/);
    if (agentDetailMatch && method === "GET") {
      const agent = GroupManager.getAgent(agentDetailMatch[1], agentDetailMatch[2]);
      if (!agent) return jsonResponse({ error: "Agente não encontrado" }, 404);
      return jsonResponse({ agent });
    }
    if (agentDetailMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as any;
      GroupManager.saveAgent(agentDetailMatch[1], agentDetailMatch[2], body);
      return jsonResponse({ success: true, agent: GroupManager.getAgent(agentDetailMatch[1], agentDetailMatch[2]) });
    }
    if (agentDetailMatch && method === "DELETE") {
      const deleted = GroupManager.deleteAgent(agentDetailMatch[1], agentDetailMatch[2]);
      return jsonResponse({ success: deleted });
    }

    // Skills
    const skillsMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/skills$/);
    if (skillsMatch && method === "GET") {
      return jsonResponse(GroupManager.getSkills(skillsMatch[1]));
    }
    if (skillsMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { mode?: "all" | "custom"; skills?: string[] };
      GroupManager.saveSkills(skillsMatch[1], body.mode || "all", body.skills || []);
      return jsonResponse({ success: true });
    }

    // MCPs
    const mcpsMatch = url.pathname.match(/^\/api\/groups\/([^\/]+)\/mcps$/);
    if (mcpsMatch && method === "GET") {
      return jsonResponse({ mcps: GroupManager.getMcpServers(mcpsMatch[1]) });
    }
    if (mcpsMatch && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { mcps?: Record<string, any> };
      GroupManager.saveMcpServers(mcpsMatch[1], body.mcps || {});
      return jsonResponse({ success: true });
    }

    // Google OAuth 2.0 Integration
    if (url.pathname === "/api/integrations/google/connect" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      const authUrl = GoogleAuthService.getAuthUrl(folder);
      return jsonResponse({ url: authUrl });
    }

    if (url.pathname === "/api/integrations/google/callback" && method === "GET") {
      const code = url.searchParams.get("code");
      const folder = resolveGroupFolder(url.searchParams.get("state"));
      if (!code) {
        return new Response("Código de autorização ausente", { status: 400 });
      }
      const res = await GoogleAuthService.handleCallback(code, folder);
      if (res.success) {
        return Response.redirect(`${CONFIG.UI_PUBLIC_URL.replace(/\/+$/, "")}/#mcps?google_auth=success`, 302);
      } else {
        return new Response(`Erro ao autenticar com o Google: ${res.error}`, { status: 500 });
      }
    }

    if (url.pathname === "/api/integrations/google/status" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      return jsonResponse(GoogleAuthService.getStatus(folder));
    }

    if (url.pathname === "/api/integrations/google/disconnect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      return jsonResponse({ success: GoogleAuthService.disconnect(resolveGroupFolder(body.folder)) });
    }

    if (url.pathname === "/api/integrations/google/policy" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      const filePath = path.join(CONFIG.GROUPS_PATH, folder, "email_policy.json");
      const defaults = {
        mode: "draft_approval",
        signature: "Assistente Virtual da Colibri <contato@colabcolibri.com>",
        forwardToTelegram: true,
        autoMarkAsRead: false,
      };
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          return jsonResponse({ ...defaults, ...data });
        } catch {}
      }
      return jsonResponse(defaults);
    }

    if (url.pathname === "/api/integrations/google/policy" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as {
        folder?: string;
        mode?: string;
        signature?: string;
        forwardToTelegram?: boolean;
        autoMarkAsRead?: boolean;
      };
      const folder = resolveGroupFolder(body.folder);
      const folderDir = path.join(CONFIG.GROUPS_PATH, folder);
      if (!fs.existsSync(folderDir)) {
        fs.mkdirSync(folderDir, { recursive: true });
      }
      const filePath = path.join(folderDir, "email_policy.json");
      const current = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
      
      const updated = {
        mode: body.mode || current.mode || "draft_approval",
        signature: body.signature?.trim() || current.signature || "Assistente Virtual da Colibri <contato@colabcolibri.com>",
        forwardToTelegram: body.forwardToTelegram ?? current.forwardToTelegram ?? true,
        autoMarkAsRead: body.autoMarkAsRead ?? current.autoMarkAsRead ?? false,
      };

      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
      return jsonResponse({ success: true, policy: updated });
    }

    // Notion Integration
    if (url.pathname === "/api/integrations/notion/status" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      return jsonResponse(NotionAuthService.getStatus(folder));
    }

    if (url.pathname === "/api/integrations/notion/connect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string; apiKey?: string; defaultDatabaseId?: string };
      const res = await NotionAuthService.connect(resolveGroupFolder(body.folder), body.apiKey || "", body.defaultDatabaseId);
      return jsonResponse(res, res.success ? 200 : 400);
    }

    if (url.pathname === "/api/integrations/notion/disconnect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      return jsonResponse({ success: NotionAuthService.disconnect(resolveGroupFolder(body.folder)) });
    }

    // Yampi Store Integration
    if (url.pathname === "/api/integrations/yampi/status" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      return jsonResponse(YampiAuthService.getStatus(folder));
    }

    if (url.pathname === "/api/integrations/yampi/connect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string; alias?: string; userToken?: string; userSecretKey?: string };
      const folder = resolveGroupFolder(body.folder);
      const existing = YampiAuthService.getCredentials(folder);
      const alias = body.alias?.trim() || existing?.alias || "";
      const userToken = body.userToken?.trim() || existing?.userToken || "";
      const userSecretKey = body.userSecretKey?.trim() || existing?.userSecretKey || "";

      if (!alias || !userToken || !userSecretKey) {
        return jsonResponse({ success: false, error: "Alias, User-Token e Secret-Key são obrigatórios." }, 400);
      }
      const test = await YampiAuthService.testConnection({
        alias,
        userToken,
        userSecretKey,
      });
      if (!test.success) {
        return jsonResponse({ success: false, error: test.error || "Falha ao validar credenciais com a API da Yampi." }, 400);
      }
      YampiAuthService.saveCredentials(
        {
          alias,
          userToken,
          userSecretKey,
        },
        folder
      );
      return jsonResponse({ success: true, message: `Loja ${alias} conectada com sucesso à Yampi!` });
    }

    if (url.pathname === "/api/integrations/yampi/disconnect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      YampiAuthService.removeCredentials(resolveGroupFolder(body.folder));
      return jsonResponse({ success: true });
    }

    // Correios & Shipping Logistics Config
    if (url.pathname === "/api/shipping/config" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      const filePath = path.join(CONFIG.GROUPS_PATH, folder, "shipping_config.json");
      const defaults = {
        originCep: "12243-380",
        originCityState: "São José dos Campos - SP",
        priceMarginPercent: 30,
        daysBuffer: 3,
      };

      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          return jsonResponse({ ...defaults, ...data });
        } catch {}
      }
      return jsonResponse(defaults);
    }

    if (url.pathname === "/api/shipping/config" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as {
        folder?: string;
        originCep?: string;
        priceMarginPercent?: number;
        daysBuffer?: number;
      };
      const folder = resolveGroupFolder(body.folder);
      const folderDir = path.join(CONFIG.GROUPS_PATH, folder);
      if (!fs.existsSync(folderDir)) {
        fs.mkdirSync(folderDir, { recursive: true });
      }
      const filePath = path.join(folderDir, "shipping_config.json");
      const current = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
      
      const updated = {
        originCep: body.originCep?.trim() || current.originCep || "12243-380",
        originCityState: current.originCityState || "São José dos Campos - SP",
        priceMarginPercent: Number(body.priceMarginPercent ?? current.priceMarginPercent ?? 30),
        daysBuffer: Number(body.daysBuffer ?? current.daysBuffer ?? 3),
      };

      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
      return jsonResponse({ success: true, config: updated });
    }

    // Scheduler & Autonomous Routines (Cron & Delayed Tasks)
    if (url.pathname === "/api/scheduler/tasks" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      const tasks = DatabaseService.getScheduledTasks();
      return jsonResponse({ tasks, total: tasks.length });
    }

    if (url.pathname === "/api/scheduler/cancel" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { taskId?: string };
      if (!body.taskId) {
        return jsonResponse({ success: false, error: "taskId é obrigatório." }, 400);
      }
      const ok = DatabaseService.cancelScheduledTask(body.taskId);
      return jsonResponse({ success: ok });
    }

    if (url.pathname === "/api/scheduler/update" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { taskId?: string; cron?: string; prompt?: string };
      if (!body.taskId) {
        return jsonResponse({ success: false, error: "taskId é obrigatório." }, 400);
      }
      const ok = DatabaseService.updateScheduledTask(body.taskId, {
        cron: body.cron,
        prompt: body.prompt,
      });
      return jsonResponse({ success: ok });
    }

    if (url.pathname === "/api/scheduler/logs" && method === "GET") {
      const folder = resolveGroupFolder(url.searchParams.get("folder"));
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const logs = DatabaseService.getCronExecutionLogs(limit);
      return jsonResponse({ logs, total: logs.length });
    }

    // Chat & Stats
    if (url.pathname === "/api/chat/threads" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      return jsonResponse({ threads: DatabaseService.getChatThreads(limit) });
    }

    if (url.pathname === "/api/chat" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      const sessionId = url.searchParams.get("sessionId")?.trim() || undefined;
      return jsonResponse({ messages: DatabaseService.getChatMessages(limit, sessionId) });
    }

    if (url.pathname === "/api/stats" && method === "GET") {
      return jsonResponse(DatabaseService.getSystemStats());
    }

    if (url.pathname === "/api/usage" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "200", 10);
      return jsonResponse({
        stats: DatabaseService.getSystemStats(),
        logs: DatabaseService.getUsageLogs(limit),
        apiLedger: DatabaseService.getRealTokenRecords(limit),
      });
    }

    // Intermediate Runs
    if (url.pathname === "/api/runs" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      return jsonResponse({
        runs: DatabaseService.getDetailedRuns(limit),
      });
    }

    if (url.pathname === "/api/audit-traces" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "300", 10);
      const group = url.searchParams.get("group") || undefined;
      return jsonResponse({
        traces: DatabaseService.getAgentAuditTraces(limit, group),
      });
    }

    // Security & Users
    if (url.pathname === "/api/security" && method === "GET") {
      return jsonResponse(DatabaseService.getSecurityData());
    }

    // System
    if (url.pathname === "/api/service/status" && method === "GET") {
      return jsonResponse(await SystemService.getServiceStatus());
    }

    if (url.pathname === "/api/service/logs" && method === "GET") {
      const lines = parseInt(url.searchParams.get("lines") || "100", 10);
      return jsonResponse(await SystemService.getLogs(lines));
    }

    if (url.pathname === "/api/service/restart" && method === "POST") {
      return jsonResponse(await SystemService.restartNanoClaw());
    }

    if (url.pathname === "/api/maintenance/purge-chat-and-costs" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { confirmation?: unknown };
      if (!isValidPurgeConfirmation(body.confirmation)) {
        return jsonResponse(
          { error: 'Confirmação inválida. Digite "confirmar" para prosseguir.' },
          400,
        );
      }
      return jsonResponse({ success: true, result: purgeChatAndCosts() });
    }

    if (url.pathname === "/api/channels/connected" && method === "GET") {
      return jsonResponse({ channels: DatabaseService.getConnectedChannels() });
    }

    if (url.pathname === "/api/channels/telegram/pair" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      return jsonResponse(await SystemService.generateTelegramPairing(resolveGroupFolder(body.folder)));
    }

    return jsonResponse({ error: "Endpoint não encontrado." }, 404);
  }
}
