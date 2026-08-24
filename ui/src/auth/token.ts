import { createHmac, timingSafeEqual } from "node:crypto";
import { CONFIG } from "../config.js";
import { SessionStore } from "./session-store.js";

export interface SessionPayload {
  email: string;
  exp: number;
}

export class TokenManager {
  static create(email: string): string {
    const payload: SessionPayload = {
      email: email.toLowerCase().trim(),
      exp: Math.floor(Date.now() / 1000) + CONFIG.SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", CONFIG.SESSION_SECRET).update(data).digest("base64url");
    const token = `${data}.${sig}`;
    // Registra a sessão para permitir revogação server-side.
    SessionStore.register(token, payload);
    return token;
  }

  static verify(token: string): SessionPayload | null {
    try {
      const [data, sig] = token.split(".");
      if (!data || !sig) return null;

      const expectedSig = createHmac("sha256", CONFIG.SESSION_SECRET).update(data).digest("base64url");
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expectedSig);

      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /** Revoga a sessão no store (logout / invalidação). Idempotente. */
  static revoke(token: string): void {
    SessionStore.revoke(token);
  }

  /** Verificação completa: assinatura + expiração + sessão não revogada no store. */
  static verifyActive(token: string): SessionPayload | null {
    const payload = this.verify(token);
    if (!payload) return null;
    return SessionStore.isActive(token, payload) ? payload : null;
  }

  static buildSetCookie(value: string, maxAgeSeconds: number): string {
    const flags = [
      `${CONFIG.COOKIE_NAME}=${encodeURIComponent(value)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (CONFIG.COOKIE_SECURE) flags.push("Secure");
    return flags.join("; ");
  }
}
