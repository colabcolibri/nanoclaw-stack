import { CONFIG } from "../config.js";
import type {
  ConversationMode,
  MacResetResponse,
  MacTurnResponse,
} from "../../shared/channels/macos/index.js";

export interface MotorPromptResult {
  reply: string;
  timestamp: string;
  toolsExecutedCount: number;
  sessionId: string;
}

export interface MotorResetResult {
  message: string;
  sessionId: string;
}

export class NanoclawMotorClient {
  private static motorUnavailable(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('Connection refused')) {
      return 'Motor NanoClaw não está rodando. Inicie com pnpm dev ou pnpm ai na raiz do projeto.';
    }
    return msg;
  }

  private static async postJson<T>(
    pathSuffix: string,
    groupFolder: string,
    bearerToken: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${CONFIG.NANOCLAW_MOTOR_URL}/webhook/internal-mac/${pathSuffix}?group=${encodeURIComponent(groupFolder)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Motor respondeu ${res.status}`);
      }
      return data as T;
    } catch (err) {
      throw new Error(this.motorUnavailable(err));
    }
  }

  static async processPrompt(
    prompt: string,
    groupFolder: string,
    bearerToken: string,
    opts?: { sessionId?: string; resetSession?: boolean; conversationMode?: ConversationMode },
  ): Promise<MotorPromptResult> {
    const data = await this.postJson<MacTurnResponse>("prompt", groupFolder, bearerToken, {
      prompt,
      sessionId: opts?.sessionId,
      resetSession: opts?.resetSession,
      conversationMode: opts?.conversationMode,
    });
    return {
      reply: data.reply ?? "",
      timestamp: data.timestamp ?? new Date().toISOString(),
      toolsExecutedCount: data.toolsExecutedCount ?? 0,
      sessionId: data.sessionId,
    };
  }

  static async resetSession(
    groupFolder: string,
    bearerToken: string,
    mode: ConversationMode = "new",
  ): Promise<MotorResetResult> {
    const data = await this.postJson<MacResetResponse>("reset", groupFolder, bearerToken, { mode });
    return {
      message: data.message ?? "New conversation started.",
      sessionId: data.sessionId,
    };
  }
}
