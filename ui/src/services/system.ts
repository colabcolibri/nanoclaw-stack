import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CONFIG } from "../config.js";

const execAsync = promisify(exec);

export class SystemService {
  static async getServiceStatus(): Promise<{
    active: boolean;
    statusText: string;
    uptime?: string;
    mainPid?: number;
    dockerContainers: string[];
  }> {
    let active = false;
    let statusText = "Desconhecido";
    let uptime = "";
    let mainPid = 0;
    const dockerContainers: string[] = [];

    try {
      const { stdout: sysOut } = await execAsync("systemctl is-active nanoclaw.service 2>/dev/null || echo 'inactive'");
      active = sysOut.trim() === "active";
      statusText = active ? "Em Execução (Online)" : "Parado";
    } catch {
      statusText = "Inativo";
    }

    try {
      const { stdout: psOut } = await execAsync("systemctl show nanoclaw.service --property=ActiveEnterTimestamp,MainPID 2>/dev/null");
      const lines = psOut.split("\n");
      for (const line of lines) {
        if (line.startsWith("ActiveEnterTimestamp=")) uptime = line.replace("ActiveEnterTimestamp=", "").trim();
        if (line.startsWith("MainPID=")) mainPid = parseInt(line.replace("MainPID=", "").trim(), 10) || 0;
      }
    } catch {}

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

  static async generateTelegramPairing(folder = "barao"): Promise<{ code?: string; error?: string }> {
    try {
      const cmd = `cd ${CONFIG.NANOCLAW_PATH} && node /usr/bin/pnpm exec tsx -e '
        import("./src/channels/telegram-pairing.js").then(async ({ createPairing }) => {
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

  static async getLogs(lines = 100): Promise<{ logs: string[]; error?: string }> {
    try {
      const { stdout } = await execAsync(`journalctl -u nanoclaw.service -n ${lines} --no-pager 2>/dev/null || true`);
      return { logs: stdout.split("\n").filter(Boolean) };
    } catch (err: any) {
      return { logs: [], error: err.message || "Falha ao obter logs" };
    }
  }
}
