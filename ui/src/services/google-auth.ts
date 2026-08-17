import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";
import { GroupManager } from "./groups.js";

export class GoogleAuthService {
  private static getTokensPath(folder: string = "barao"): string {
    return path.join(CONFIG.GROUPS_PATH, path.basename(folder), "google_tokens.json");
  }

  private static getCredentials(folder: string = "barao") {
    const cfg = GroupManager.getConfig(folder) || {};
    const mcp = cfg.mcpServers || {};
    
    // Look in calendar, gmail, or drive mcp configs
    const clientEntry = mcp.calendar?.oauth || mcp.gmail?.oauth || mcp.drive?.oauth || mcp.calendar?.env || mcp.gmail?.env || {};
    const clientId = clientEntry.clientId || clientEntry.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = clientEntry.clientSecret || clientEntry.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

    return { clientId, clientSecret };
  }

  static getAuthUrl(folder: string = "barao", reqHost?: string): string {
    const { clientId } = this.getCredentials(folder);
    const host = reqHost || "uai.sergioluciano.com";
    const redirectUri = `https://${host}/api/integrations/google/callback`;

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: folder,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async handleCallback(code: string, folder: string = "barao", reqHost?: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const { clientId, clientSecret } = this.getCredentials(folder);
    const host = reqHost || "uai.sergioluciano.com";
    const redirectUri = `https://${host}/api/integrations/google/callback`;

    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok || data.error) {
        return { success: false, error: data.error_description || data.error || "Falha ao trocar código OAuth" };
      }

      // Fetch user profile email
      let userEmail = "";
      if (data.access_token) {
        try {
          const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${data.access_token}` },
          });
          if (userRes.ok) {
            const userData = (await userRes.json()) as any;
            userEmail = userData.email || "";
          }
        } catch {}
      }

      const tokenPayload = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        scope: data.scope,
        token_type: data.token_type,
        expiry_date: Date.now() + (data.expires_in || 3600) * 1000,
        user_email: userEmail,
        updated_at: new Date().toISOString(),
        client_id: clientId,
        client_secret: clientSecret,
      };

      const tokensPath = this.getTokensPath(folder);
      fs.writeFileSync(tokensPath, JSON.stringify(tokenPayload, null, 2), "utf-8");

      return { success: true, email: userEmail };
    } catch (err: any) {
      return { success: false, error: err.message || "Erro durante comunicação com Google" };
    }
  }

  static getStatus(folder: string = "barao"): { connected: boolean; email?: string; updatedAt?: string } {
    const tokensPath = this.getTokensPath(folder);
    if (!fs.existsSync(tokensPath)) {
      return { connected: false };
    }

    try {
      const data = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
      return {
        connected: !!data.refresh_token || !!data.access_token,
        email: data.user_email || "Conta Conectada",
        updatedAt: data.updated_at,
      };
    } catch {
      return { connected: false };
    }
  }

  static disconnect(folder: string = "barao"): boolean {
    const tokensPath = this.getTokensPath(folder);
    if (fs.existsSync(tokensPath)) {
      try {
        fs.unlinkSync(tokensPath);
        return true;
      } catch {}
    }
    return false;
  }
}
