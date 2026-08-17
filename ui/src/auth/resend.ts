import { CONFIG } from "../config.js";

export class EmailService {
  static async sendOtp(to: string, code: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!CONFIG.RESEND_API_KEY) {
        return { success: false, error: "Chave do Resend não configurada." };
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CONFIG.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: CONFIG.FROM_EMAIL,
          to: [to],
          subject: `Seu código de acesso ao NanoClaw: ${code}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #070a12; color: #f8fafc; border-radius: 14px; border: 1px solid #1e2c4a;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 700; color: #38bdf8; letter-spacing: -0.5px;">⚡ NanoClaw UAI</span>
              </div>
              <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 15px; line-height: 1.5; text-align: center;">
                Seu código de acesso ao painel:
              </p>
              <div style="background: #0e1526; border: 1px solid #1e2c4a; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: monospace; font-size: 38px; letter-spacing: 8px; font-weight: 700; color: #38bdf8;">${code}</span>
              </div>
              <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                Válido por <strong>10 minutos</strong>.
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Resend error (${response.status}): ${errText}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Erro ao conectar com Resend" };
    }
  }
}
