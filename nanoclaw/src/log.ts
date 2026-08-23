import fs from 'node:fs';
import path from 'node:path';

const LEVELS = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
type Level = keyof typeof LEVELS;

/** Evita import de config.js (env.ts importa log.ts — ciclo de inicialização). */
function getLogFilePath(): string {
  const root = process.env.NANOCLAW_PATH?.trim() || process.cwd();
  return path.join(root, 'data', 'logs', 'nanoclaw.log');
}

let logFileReady = false;

const COLORS: Record<Level, string> = {
  debug: '\x1b[34m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[41m\x1b[37m',
};
const KEY_COLOR = '\x1b[35m';
const MSG_COLOR = '\x1b[36m';
const RESET = '\x1b[39m';
const FULL_RESET = '\x1b[0m';

const threshold = LEVELS[(process.env.LOG_LEVEL as Level) || 'info'] ?? LEVELS.info;

function formatErr(err: unknown): string {
  if (err instanceof Error) {
    return `{ type: "${err.constructor.name}", message: "${err.message}", stack: ${err.stack} }`;
  }
  return JSON.stringify(err);
}

function formatData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    parts.push(`${KEY_COLOR}${k}${RESET}=${k === 'err' ? formatErr(v) : JSON.stringify(v)}`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

function formatDataPlain(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    parts.push(`${k}=${k === 'err' ? formatErr(v) : JSON.stringify(v)}`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

function ensureLogFileReady(): void {
  if (logFileReady) return;
  try {
    fs.mkdirSync(path.dirname(getLogFilePath()), { recursive: true });
    logFileReady = true;
  } catch {
    // ignore — stdout logging must keep working
  }
}

function appendLogFile(level: Level, msg: string, data?: Record<string, unknown>): void {
  try {
    ensureLogFileReady();
    if (!logFileReady) return;
    const line = `[${ts()}] ${level.toUpperCase()} ${msg}${data ? formatDataPlain(data) : ''}\n`;
    fs.appendFileSync(getLogFilePath(), line, 'utf-8');
  } catch {
    // ignore — never break the logging pipeline
  }
}

function ts(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function emit(level: Level, msg: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;
  const tag = `${COLORS[level]}${level.toUpperCase()}${level === 'fatal' ? FULL_RESET : RESET}`;
  const stream = LEVELS[level] >= LEVELS.warn ? process.stderr : process.stdout;
  stream.write(`[${ts()}] ${tag} ${MSG_COLOR}${msg}${RESET}${data ? formatData(data) : ''}\n`);
  appendLogFile(level, msg, data);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => emit('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit('error', msg, data),
  fatal: (msg: string, data?: Record<string, unknown>) => emit('fatal', msg, data),
};

process.on('uncaughtException', (err) => {
  log.fatal('Uncaught exception', { err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', { err: reason });
});
