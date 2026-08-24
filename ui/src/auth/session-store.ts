import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { CONFIG } from "../config.js";
import type { SessionPayload } from "./token.js";

/**
 * Persistência de sessões da dashboard no DB central (tabela ui_sessions).
 *
 * O token continua HMAC stateless (`TokenManager`), mas agora cada sessão
 * emitida é registrada e pode ser **revogada** server-side (logout em todos
 * os devices / vazamento). Lookup por hash do token — o DB nunca contém o
 * valor assinado.
 */
export class SessionStore {
  private static hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private static open(): Database {
    fs.mkdirSync(path.dirname(CONFIG.DB_PATH), { recursive: true });
    const db = new Database(CONFIG.DB_PATH);
    db.run(`
      CREATE TABLE IF NOT EXISTS ui_sessions (
        token_hash TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      )
    `);
    return db;
  }

  /** Registra a sessão emitida e limpa linhas expiradas antigas. */
  static register(token: string, payload: SessionPayload): void {
    let db: Database | null = null;
    try {
      db = this.open();
      const now = new Date().toISOString();
      db.run("DELETE FROM ui_sessions WHERE expires_at < ?", [now]);
      db.run(
        "INSERT OR REPLACE INTO ui_sessions (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)",
        [this.hashToken(token), payload.email, now, new Date(payload.exp * 1000).toISOString()],
      );
    } finally {
      db?.close();
    }
  }

  /**
   * Sessão ativa? Assinatura válida mas registro ausente só é aceito quando a
   * tabela está vazia (grace p/ tokens emitidos antes deste módulo existir).
   */
  static isActive(token: string, payload: SessionPayload): boolean {
    let db: Database | null = null;
    try {
      db = this.open();
      const row = db
        .query("SELECT revoked_at FROM ui_sessions WHERE token_hash = ?")
        .get(this.hashToken(token)) as { revoked_at: string | null } | undefined;
      if (row) return row.revoked_at === null;
      const any = db.query("SELECT COUNT(*) AS c FROM ui_sessions").get() as { c: number };
      if ((any?.c ?? 0) === 0) {
        this.register(token, payload);
        return true;
      }
      return false;
    } catch (err) {
      // Falha fechada: sem confirmação do store, a sessão não vale.
      console.error("[session-store] falha ao consultar sessão:", err);
      return false;
    } finally {
      db?.close();
    }
  }

  /** Revoga uma sessão (logout). Idempotente. */
  static revoke(token: string): void {
    let db: Database | null = null;
    try {
      db = this.open();
      db.run("UPDATE ui_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", [
        new Date().toISOString(),
        this.hashToken(token),
      ]);
    } catch (err) {
      console.error("[session-store] falha ao revogar sessão:", err);
    } finally {
      db?.close();
    }
  }
}
