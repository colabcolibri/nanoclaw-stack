import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CONFIG } from "../../config.js";
import { DatabaseService } from "../../services/db.js";
import { GroupManager } from "../../services/groups.js";
import { NanoclawMotorClient } from "../../services/nanoclaw-motor-client.js";

/**
 * MacChannelService - UI adapter for the macOS client.
 * Reads (threads/history) via Bun sqlite; executes turns on the Node motor.
 */
export class MacChannelService {
  private static getKeyFilePath(groupFolder: string): string {
    return path.join(CONFIG.GROUPS_PATH, groupFolder, "mac_channel.json");
  }

  static getOrCreateApiKey(groupFolder: string): string {
    const filePath = this.getKeyFilePath(groupFolder);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (data.apiKey) return data.apiKey;
      } catch {}
    }

    const newKey = `mac_${crypto.randomBytes(24).toString("hex")}`;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ apiKey: newKey }, null, 2), "utf-8");
    return newKey;
  }

  static validateApiKey(token: string, groupFolder: string): boolean {
    const expected = this.getOrCreateApiKey(groupFolder);
    if (!token || !expected) return false;
    return token.trim() === expected.trim();
  }

  private static resolveAgentGroupId(groupFolder: string): string {
    const groups = GroupManager.list();
    const match = groups.find((g) => g.folder === groupFolder);
    if (!match?.id) {
      throw new Error(`Grupo de agente não encontrado para pasta: ${groupFolder}`);
    }
    return match.id;
  }

  static async processPrompt(
    prompt: string,
    groupFolder: string,
    opts?: { resetSession?: boolean; conversationMode?: "new" | "new-resume"; sessionId?: string },
    bearerToken?: string,
  ) {
    const token = bearerToken ?? this.getOrCreateApiKey(groupFolder);
    return NanoclawMotorClient.processPrompt(prompt, groupFolder, token, {
      sessionId: opts?.sessionId,
      resetSession: opts?.resetSession,
      conversationMode: opts?.conversationMode,
    });
  }

  static getThreads(groupFolder: string, limit = 50) {
    const agentGroupId = this.resolveAgentGroupId(groupFolder);
    return DatabaseService.getChatThreadsForGroup(agentGroupId, "macos", limit);
  }

  static async getHistory(groupFolder: string, limit = 50, sessionId?: string) {
    const agentGroupId = this.resolveAgentGroupId(groupFolder);

    if (sessionId?.trim()) {
      const row = DatabaseService.getSessionById(sessionId.trim());
      if (!row || row.agent_group_id !== agentGroupId) {
        throw new Error("Sessão não encontrada.");
      }
      const messages = DatabaseService.getChatMessages(limit, sessionId.trim());
      return messages.map((m) => ({
        id: m.id,
        role: m.type,
        text: m.text,
        timestamp: m.timestamp,
      }));
    }

    const threadId = "macos:default";
    const threads = DatabaseService.getChatThreadsForGroup(agentGroupId, "macos", 10);
    const active = threads.find((t) => t.status === "active" && t.threadId === threadId);
    if (active) {
      const messages = DatabaseService.getChatMessages(limit, active.sessionId);
      return messages.map((m) => ({
        id: m.id,
        role: m.type,
        text: m.text,
        timestamp: m.timestamp,
      }));
    }
    return [];
  }

  static async resetSession(
    groupFolder: string,
    mode: "new" | "new-resume" = "new",
  ): Promise<{ message: string; sessionId: string }> {
    const token = this.getOrCreateApiKey(groupFolder);
    return NanoclawMotorClient.resetSession(groupFolder, token, mode);
  }

  static async processAudio(
    audioBlob: Blob | ArrayBuffer | Uint8Array,
    groupFolder: string,
    sessionId?: string,
  ): Promise<{ transcription: string; reply: string; timestamp: string; sessionId: string }> {
    const formData = new FormData();
    const blob = audioBlob instanceof Blob ? audioBlob : new Blob([audioBlob as BlobPart], { type: "audio/m4a" });
    formData.append("audio_file", blob, "recording.m4a");

    let transcription = "";
    try {
      const whisperRes = await fetch(
        "http://127.0.0.1:9000/asr?encode=true&task=transcribe&language=pt&output=json",
        { method: "POST", body: formData },
      );

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        throw new Error(`Whisper ASR error (${whisperRes.status}): ${err}`);
      }

      const whisperData = (await whisperRes.json()) as { text?: string };
      transcription = (whisperData.text || "").trim();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Falha na transcrição de voz: ${msg}`);
    }

    if (!transcription) {
      throw new Error("Nenhum áudio inteligível detectado pelo Whisper.");
    }

    const result = await this.processPrompt(transcription, groupFolder, { sessionId });
    return {
      transcription,
      reply: result.reply,
      timestamp: result.timestamp,
      sessionId: result.sessionId,
    };
  }
}
