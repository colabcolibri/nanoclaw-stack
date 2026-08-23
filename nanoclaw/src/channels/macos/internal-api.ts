/**
 * Internal HTTP API for the UI (Bun) to proxy macOS channel turns to the Node motor.
 * Routes: /webhook/internal-mac/prompt | /webhook/internal-mac/reset
 */
import fs from 'fs';
import path from 'path';
import type http from 'http';

import { GROUPS_DIR } from '../../config.js';
import type {
  MacPromptRequest,
  MacResetRequest,
  MacResetResponse,
  MacTurnResponse,
} from './api-contract.js';
import { processSyncTurn, resetSyncSession } from '../../gateway/sync-turn-gateway.js';
import { log } from '../../log.js';
import { registerWebhookHandler } from '../../webhook-server.js';

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(chunk as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function parseBearer(req: http.IncomingMessage): string {
  const header = req.headers.authorization || '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

function validateMacApiKey(token: string, groupFolder: string): boolean {
  if (!token) return false;
  const safeFolder = path.basename(groupFolder);
  const filePath = path.join(GROUPS_DIR, safeFolder, 'mac_channel.json');
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { apiKey?: string };
    return data.apiKey?.trim() === token.trim();
  } catch {
    return false;
  }
}

function resolveGroupFolder(raw: string | null | undefined, fallback = 'barao'): string {
  const folder = (raw || fallback).trim();
  return path.basename(folder);
}

export function registerMacInternalApi(): void {
  registerWebhookHandler('internal-mac', async (req, res) => {
    const urlPath = (req.url || '').split('?')[0];
    const suffix = urlPath.replace(/^\/webhook\/internal-mac/, '') || '/';
    const query = new URL(req.url || '/', 'http://localhost').searchParams;
    const groupFolder = resolveGroupFolder(query.get('group'));

    if (req.method !== 'POST') {
      jsonResponse(res, 405, { error: 'Método não permitido.' });
      return;
    }

    const token = parseBearer(req);
    if (!validateMacApiKey(token, groupFolder)) {
      jsonResponse(res, 401, { error: 'Token de autenticação inválido.' });
      return;
    }

    try {
      if (suffix === '/prompt' || suffix === '/prompt/') {
        const body = (await readJsonBody(req)) as MacPromptRequest;
        const prompt = body.prompt?.trim();
        if (!prompt) {
          jsonResponse(res, 400, { error: 'Prompt é obrigatório.' });
          return;
        }
        const result = await processSyncTurn({
          prompt,
          channel: 'macos',
          groupFolder,
          sessionId: body.sessionId?.trim() || undefined,
          resetSession: body.resetSession,
          conversationMode: body.conversationMode,
        });
        const response: MacTurnResponse = {
          success: true,
          reply: result.reply,
          timestamp: result.timestamp,
          toolsExecutedCount: result.toolsExecutedCount,
          sessionId: result.sessionId,
        };
        jsonResponse(res, 200, response);
        return;
      }

      if (suffix === '/reset' || suffix === '/reset/') {
        const body = (await readJsonBody(req)) as MacResetRequest;
        const mode = body.mode === 'new-resume' ? 'new-resume' : 'new';
        const result = await resetSyncSession('macos', groupFolder, 'default', mode);
        const response: MacResetResponse = {
          success: true,
          message: result.reply,
          sessionId: result.sessionId,
        };
        jsonResponse(res, 200, response);
        return;
      }

      jsonResponse(res, 404, { error: 'Rota interna não encontrada.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('Mac internal API error', { suffix, groupFolder, err: message });
      jsonResponse(res, 500, { error: message });
    }
  });

  log.info('Mac internal API registered', { basePath: '/webhook/internal-mac' });
}
