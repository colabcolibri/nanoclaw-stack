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
import { MacChannelService } from "../services/mac-channel.js";

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
      const folder = url.searchParams.get("group") || "barao";

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

      if (url.pathname === "/api/mac/history" && method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        try {
          const messages = await MacChannelService.getHistory(folder, limit);
          return jsonResponse({ success: true, messages });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao resgatar histórico." }, 500);
        }
      }

      if (url.pathname === "/api/mac/prompt" && method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { prompt?: string; resetSession?: boolean };
        const prompt = body.prompt?.trim();
        if (!prompt) return jsonResponse({ error: "Prompt é obrigatório." }, 400);

        try {
          const result = await MacChannelService.processPrompt(prompt, folder, !!body.resetSession);
          return jsonResponse({
            success: true,
            reply: result.reply,
            timestamp: result.timestamp,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao processar instrução no Barão." }, 500);
        }
      }

      if (url.pathname === "/api/mac/audio" && method === "POST") {
        try {
          const contentType = req.headers.get("content-type") || "";
          let audioBuffer: ArrayBuffer;

          if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("audio") || formData.get("audio_file") || formData.get("file");
            if (!file || !(file instanceof Blob)) {
              return jsonResponse({ error: "Arquivo de áudio não encontrado na requisição." }, 400);
            }
            audioBuffer = await file.arrayBuffer();
          } else {
            audioBuffer = await req.arrayBuffer();
          }

          if (!audioBuffer || audioBuffer.byteLength === 0) {
            return jsonResponse({ error: "Buffer de áudio vazio." }, 400);
          }

          const result = await MacChannelService.processAudio(audioBuffer, folder);
          return jsonResponse({
            success: true,
            transcription: result.transcription,
            reply: result.reply,
            timestamp: result.timestamp,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao transcrever e processar áudio." }, 500);
        }
      }

      if (url.pathname === "/api/mac/reset" && method === "POST") {
        try {
          await MacChannelService.resetSession(folder);
          return jsonResponse({ success: true, message: "Histórico da sessão Mac reiniciado." });
        } catch (err: any) {
          return jsonResponse({ error: err.message || "Erro ao reiniciar sessão." }, 500);
        }
      }
    }


    // --- PROTECTED ROUTES CHECK ---
    const cookies = parseCookies(req.headers.get("cookie"));
    const token = cookies[CONFIG.COOKIE_NAME];
    const user = token ? TokenManager.verify(token) : null;
    if (!user) return jsonResponse({ error: "Não autorizado." }, 401);

    // Mac Channel Config (For Web UI)
    if (url.pathname === "/api/mac/config" && method === "GET") {
      const folder = url.searchParams.get("group") || "barao";
      const key = MacChannelService.getOrCreateApiKey(folder);
      return jsonResponse({
        apiKey: key,
        endpoint: "https://uai.sergioluciano.com/api/mac/prompt",
        group: folder,
      });
    }

    // Groups
    if (url.pathname === "/api/groups" && method === "GET") {
      return jsonResponse({ groups: GroupManager.list() });
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
      const folder = url.searchParams.get("folder") || "barao";
      const host = req.headers.get("host") || "uai.sergioluciano.com";
      const authUrl = GoogleAuthService.getAuthUrl(folder, host);
      return jsonResponse({ url: authUrl });
    }

    if (url.pathname === "/api/integrations/google/callback" && method === "GET") {
      const code = url.searchParams.get("code");
      const folder = url.searchParams.get("state") || "barao";
      const host = req.headers.get("host") || "uai.sergioluciano.com";
      if (!code) {
        return new Response("Código de autorização ausente", { status: 400 });
      }
      const res = await GoogleAuthService.handleCallback(code, folder, host);
      if (res.success) {
        return Response.redirect(`https://${host}/#mcps?google_auth=success`, 302);
      } else {
        return new Response(`Erro ao autenticar com o Google: ${res.error}`, { status: 500 });
      }
    }

    if (url.pathname === "/api/integrations/google/status" && method === "GET") {
      const folder = url.searchParams.get("folder") || "barao";
      return jsonResponse(GoogleAuthService.getStatus(folder));
    }

    if (url.pathname === "/api/integrations/google/disconnect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      return jsonResponse({ success: GoogleAuthService.disconnect(body.folder || "barao") });
    }

    if (url.pathname === "/api/integrations/google/policy" && method === "GET") {
      const folder = url.searchParams.get("folder") || "barao";
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
      const folder = body.folder || "barao";
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
      const folder = url.searchParams.get("folder") || "barao";
      return jsonResponse(NotionAuthService.getStatus(folder));
    }

    if (url.pathname === "/api/integrations/notion/connect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string; apiKey?: string; defaultDatabaseId?: string };
      const res = await NotionAuthService.connect(body.folder || "barao", body.apiKey || "", body.defaultDatabaseId);
      return jsonResponse(res, res.success ? 200 : 400);
    }

    if (url.pathname === "/api/integrations/notion/disconnect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      return jsonResponse({ success: NotionAuthService.disconnect(body.folder || "barao") });
    }

    // Yampi Store Integration
    if (url.pathname === "/api/integrations/yampi/status" && method === "GET") {
      const folder = url.searchParams.get("folder") || "barao";
      const creds = YampiAuthService.getCredentials(folder);
      return jsonResponse({
        connected: !!creds,
        alias: creds?.alias || null,
        updatedAt: creds?.updatedAt || null,
      });
    }

    if (url.pathname === "/api/integrations/yampi/connect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string; alias?: string; userToken?: string; userSecretKey?: string };
      if (!body.alias || !body.userToken || !body.userSecretKey) {
        return jsonResponse({ success: false, error: "Alias, User-Token e Secret-Key são obrigatórios." }, 400);
      }
      const test = await YampiAuthService.testConnection({
        alias: body.alias,
        userToken: body.userToken,
        userSecretKey: body.userSecretKey,
      });
      if (!test.success) {
        return jsonResponse({ success: false, error: test.error || "Falha ao validar credenciais com a API da Yampi." }, 400);
      }
      YampiAuthService.saveCredentials(
        {
          alias: body.alias,
          userToken: body.userToken,
          userSecretKey: body.userSecretKey,
        },
        body.folder || "barao"
      );
      return jsonResponse({ success: true, message: `Loja ${body.alias} conectada com sucesso à Yampi!` });
    }

    if (url.pathname === "/api/integrations/yampi/disconnect" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      YampiAuthService.removeCredentials(body.folder || "barao");
      return jsonResponse({ success: true });
    }

    // Mac & Apple Shortcuts Config
    if (url.pathname === "/api/mac/config" && method === "GET") {
      const folder = url.searchParams.get("folder") || "barao";
      const host = req.headers.get("host") || "uai.sergioluciano.com";
      const apiKey = MacChannelService.getOrCreateApiKey(folder);
      return jsonResponse({
        endpoint: `https://${host}/api/mac/prompt`,
        apiKey,
      });
    }

    // Correios & Shipping Logistics Config
    if (url.pathname === "/api/shipping/config" && method === "GET") {
      const folder = url.searchParams.get("folder") || "barao";
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
      const folder = body.folder || "barao";
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
      const folder = url.searchParams.get("folder") || "barao";
      const tasks = DatabaseService.getScheduledTasks(folder);
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

    // Chat & Stats
    if (url.pathname === "/api/chat" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      return jsonResponse({ messages: DatabaseService.getChatMessages(limit) });
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

    if (url.pathname === "/api/channels/telegram/pair" && method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { folder?: string };
      return jsonResponse(await SystemService.generateTelegramPairing(body.folder || "barao"));
    }

    return jsonResponse({ error: "Endpoint não encontrado." }, 404);
  }
}
