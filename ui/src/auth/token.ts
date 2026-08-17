import { createHmac, timingSafeEqual } from "node:crypto";
import { CONFIG } from "../config.js";

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
    return `${data}.${sig}`;
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
}
