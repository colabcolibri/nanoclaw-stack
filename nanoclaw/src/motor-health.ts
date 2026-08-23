/**
 * Liveness/readiness do motor Node — consumido pela UI e ferramentas de ops.
 * GET /webhook/health → JSON com pid, uptime e startedAt.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { log } from './log.js';
import { registerWebhookHandler } from './webhook-server.js';

const startedAt = new Date();

export interface MotorHealthPayload {
  status: 'ok';
  pid: number;
  uptimeSeconds: number;
  startedAt: string;
}

export function getMotorHealthPayload(now = Date.now()): MotorHealthPayload {
  const uptimeSeconds = Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));
  return {
    status: 'ok',
    pid: process.pid,
    uptimeSeconds,
    startedAt: startedAt.toISOString(),
  };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function registerMotorHealth(): void {
  registerWebhookHandler('health', (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }

    const payload = getMotorHealthPayload();
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end();
      return;
    }

    writeJson(res, 200, payload);
  });

  log.info('Motor health endpoint registered', { path: '/webhook/health' });
}
