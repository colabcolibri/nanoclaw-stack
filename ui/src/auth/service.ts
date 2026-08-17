import { CONFIG } from "../config.js";
import { EmailService } from "./resend.js";

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

export class AuthService {
  private static store = new Map<string, OtpRecord>();

  static isAllowed(email: string): boolean {
    const norm = email.toLowerCase().trim();
    return CONFIG.ALLOWED_EMAILS.includes(norm);
  }

  static async requestOtp(email: string): Promise<{ success: boolean; error?: string }> {
    const norm = email.toLowerCase().trim();
    if (!this.isAllowed(norm)) {
      return { success: false, error: "Este e-mail não possui autorização de acesso." };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.store.set(norm, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    return await EmailService.sendOtp(norm, code);
  }

  static verifyOtp(email: string, code: string): { valid: boolean; reason?: string } {
    const norm = email.toLowerCase().trim();
    const entry = this.store.get(norm);

    if (!entry) {
      return { valid: false, reason: "Código não encontrado ou expirado." };
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(norm);
      return { valid: false, reason: "Código expirado. Solicite um novo." };
    }

    entry.attempts++;
    if (entry.attempts > 5) {
      this.store.delete(norm);
      return { valid: false, reason: "Limite de tentativas excedido." };
    }

    if (entry.code !== code.trim()) {
      return { valid: false, reason: "Código incorreto." };
    }

    this.store.delete(norm);
    return { valid: true };
  }
}
