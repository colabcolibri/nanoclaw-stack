import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { CONFIG } from "../config.js";

const execAsync = promisify(exec);

export function motorLogFilePath(): string {
  return path.join(CONFIG.NANOCLAW_PATH, "data", "logs", "nanoclaw.log");
}

/** Lê as últimas N linhas não vazias de um arquivo de log local. */
export function tailLogLines(filePath: string, maxLines: number): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
}

export interface MotorHealthPayload {
  status: "ok";
  pid: number;
  uptimeSeconds: number;
  startedAt: string;
}

/** Consulta GET /webhook/health — fonte de verdade do motor em dev e produção. */
export async function fetchMotorHealth(
  motorUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MotorHealthPayload | null> {
  const base = motorUrl.replace(/\/$/, "");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetchImpl(`${base}/webhook/health`, { signal: controller.signal });
      if (!res.ok) return null;
      const data = (await res.json()) as MotorHealthPayload;
      if (data?.status !== "ok" || !Number.isFinite(data.pid)) return null;
      return data;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

async function readSystemdStatus(): Promise<{
  active: boolean;
  statusText: string;
  uptime: string;
  mainPid: number;
}> {
  let active = false;
  let statusText = "Parado";
  let uptime = "";
  let mainPid = 0;

  try {
    const { stdout: sysOut } = await execAsync(
      "systemctl is-active nanoclaw.service 2>/dev/null || echo 'inactive'",
    );
    active = sysOut.trim() === "active";
    statusText = active ? "Em execução (systemd)" : "Parado";
  } catch {
    statusText = "Inativo";
  }

  if (!active) return { active, statusText, uptime, mainPid };

  try {
    const { stdout: psOut } = await execAsync(
      "systemctl show nanoclaw.service --property=ActiveEnterTimestamp,MainPID 2>/dev/null",
    );
    for (const line of psOut.split("\n")) {
      if (line.startsWith("ActiveEnterTimestamp=")) uptime = line.replace("ActiveEnterTimestamp=", "").trim();
      if (line.startsWith("MainPID=")) mainPid = parseInt(line.replace("MainPID=", "").trim(), 10) || 0;
    }
  } catch {}

  return { active, statusText, uptime, mainPid };
}

export class SystemService {
  static async getServiceStatus(): Promise<{
    active: boolean;
    statusText: string;
    uptime?: string;
    mainPid?: number;
    dockerContainers: string[];
  }> {
    let active = false;
    let statusText = "Parado";
    let uptime = "";
    let mainPid = 0;
    const dockerContainers: string[] = [];

    const health = await fetchMotorHealth(CONFIG.NANOCLAW_MOTOR_URL);
    if (health) {
      active = true;
      mainPid = health.pid;
      uptime = health.startedAt;
      statusText = "Em execução";
    } else {
      const systemd = await readSystemdStatus();
      active = systemd.active;
      statusText = systemd.statusText;
      uptime = systemd.uptime;
      mainPid = systemd.mainPid;
    }

    try {
      const { stdout: dockOut } = await execAsync("docker ps --format '{{.Names}}#{{.Status}}#{{.Image}}' 2>/dev/null");
      const lines = dockOut.trim().split("\n").filter(Boolean);
      for (const l of lines) {
        const [name, status, img] = l.split("#");
        if (name) {
          const isAgent = name.startsWith("nanoclaw");
          const label = isAgent ? `🤖 Agente Ativo: ${name}` : name === "whisper-asr" ? `🎙️ Whisper ASR (Voz): ${name}` : `🌐 Proxy: ${name}`;
          dockerContainers.push(`${label} (${status})`);
        }
      }
    } catch {}

    return { active, statusText, uptime, mainPid, dockerContainers };
  }

  static async restartNanoClaw(): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync("systemctl restart nanoclaw.service");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Erro ao reiniciar serviço" };
    }
  }

  static async generateTelegramPairing(folder: string): Promise<{ code?: string; error?: string }> {
    try {
      const cmd = `cd ${CONFIG.NANOCLAW_PATH} && node /usr/bin/pnpm exec tsx -e '
        import("./src/channels/telegram/pairing.js").then(async ({ createPairing }) => {
          const rec = await createPairing({ kind: "wire-to", folder: "${folder}" });
          console.log("PAIRING_CODE:" + rec.code);
          process.exit(0);
        });
      '`;
      const { stdout } = await execAsync(cmd);
      const match = stdout.match(/PAIRING_CODE:([A-Za-z0-9_-]+)/);
      if (match) return { code: match[1] };
      return { error: "Código de pareamento não encontrado." };
    } catch (err: any) {
      return { error: err.message || "Erro ao gerar pareamento" };
    }
  }

  static async getLogs(
    lines = 100,
  ): Promise<{ logs: string[]; source?: "journalctl" | "file" | "none"; error?: string }> {
    try {
      const { stdout } = await execAsync(
        `journalctl -u nanoclaw.service -n ${lines} --no-pager 2>/dev/null || true`,
      );
      const journalLines = stdout.split("\n").filter(Boolean);
      if (journalLines.length > 0) {
        return { logs: journalLines, source: "journalctl" };
      }
    } catch {
      // journal indisponível (macOS / dev) — cai no arquivo local
    }

    const fileLines = tailLogLines(motorLogFilePath(), lines);
    if (fileLines.length > 0) {
      return { logs: fileLines, source: "file" };
    }

    return {
      logs: [],
      source: "none",
      error:
        process.platform === "darwin"
          ? "Nenhum log ainda. Reinicie o motor (pnpm dev) — as linhas passam a ser gravadas em data/logs/nanoclaw.log."
          : "Nenhum log no journal nem em data/logs/nanoclaw.log.",
    };
  }
}
