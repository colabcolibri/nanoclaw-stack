import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CONFIG } from "../config.js";
import { UnifiedAgentGateway } from "./agent-gateway.js";

/**
 * MacChannelService - Dedicated Adapter for macOS Client
 * Adheres strictly to SRP and DRY by delegating all core turn execution,
 * LLM provider resolution, memory, and persistence to UnifiedAgentGateway.
 */
export class MacChannelService {
  private static getKeyFilePath(groupFolder = "barao"): string {
    return path.join(CONFIG.GROUPS_PATH, groupFolder, "mac_channel.json");
  }

  /**
   * Retrieves or initializes the dedicated API key for Mac integration.
   */
  static getOrCreateApiKey(groupFolder = "barao"): string {
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

  /**
   * Validates the provided Bearer token against the group's API key.
   */
  static validateApiKey(token: string, groupFolder = "barao"): boolean {
    const expected = this.getOrCreateApiKey(groupFolder);
    if (!token || !expected) return false;
    return token.trim() === expected.trim();
  }

  /**
   * Executes a user prompt via the UnifiedAgentGateway.
   */
  static async processPrompt(
    prompt: string,
    groupFolder = "barao",
    resetSession = false
  ) {
    return UnifiedAgentGateway.processTurn({
      prompt,
      channel: "macos",
      groupFolder,
      resetSession,
    });
  }

  /**
   * Retrieves conversation history for the macOS session.
   */
  static async getHistory(groupFolder = "barao", limit = 50) {
    return UnifiedAgentGateway.getHistory("macos", groupFolder, limit);
  }

  /**
   * Resets the conversation history for macOS session.
   */
  static async resetSession(groupFolder = "barao"): Promise<boolean> {
    return UnifiedAgentGateway.resetSession("macos", groupFolder);
  }

  /**
   * Transcribes incoming audio via local Whisper ASR and executes via UnifiedAgentGateway.
   */
  static async processAudio(
    audioBlob: Blob | ArrayBuffer | Uint8Array,
    groupFolder = "barao"
  ): Promise<{ transcription: string; reply: string; timestamp: string }> {
    const formData = new FormData();
    const blob = audioBlob instanceof Blob ? audioBlob : new Blob([audioBlob as any], { type: "audio/m4a" });
    formData.append("audio_file", blob, "recording.m4a");

    let transcription = "";
    try {
      const whisperRes = await fetch("http://127.0.0.1:9000/asr?encode=true&task=transcribe&language=pt&output=json", {
        method: "POST",
        body: formData,
      });

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        throw new Error(`Whisper ASR error (${whisperRes.status}): ${err}`);
      }

      const whisperData = (await whisperRes.json()) as { text?: string };
      transcription = (whisperData.text || "").trim();
    } catch (e: any) {
      throw new Error(`Falha na transcrição de voz: ${e.message}`);
    }

    if (!transcription) {
      throw new Error("Nenhum áudio inteligível detectado pelo Whisper.");
    }

    const result = await this.processPrompt(transcription, groupFolder, false);
    return {
      transcription,
      reply: result.reply,
      timestamp: result.timestamp,
    };
  }
}
