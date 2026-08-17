import { CONFIG } from "../config.js";
import { AuthService } from "../auth/service.js";
import { TokenManager } from "../auth/token.js";
import { GroupManager } from "../services/groups.js";
import { DatabaseService } from "../services/db.js";
import { SystemService } from "../services/system.js";
import { GoogleAuthService } from "../services/google-auth.js";
import { NotionAuthService } from "../services/notion-auth.js";
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
      return jsonResponse({ success: true, message: "Código enviado com sucesso." });
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

    // --- MACBOOK / SHORTCUTS DIRECT API (Bearer Token Auth) ---
    if (url.pathname === "/api/mac/prompt" && method === "POST") {
      const authHeader = req.headers.get("Authorization") || "";
      const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      const folder = url.searchParams.get("group") || "barao";

      if (!MacChannelService.validateApiKey(bearerToken, folder)) {
        return jsonResponse({ error: "Token de autenticação inválido. Configure sua chave nos Atalhos do Mac." }, 401);
      }

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
