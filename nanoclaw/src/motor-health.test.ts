import { afterAll, describe, expect, it } from 'vitest';

import { getMotorHealthPayload, registerMotorHealth } from './motor-health.js';
import { stopWebhookServer } from './webhook-server.js';

const PORT = 22000 + Math.floor(Math.random() * 20000);

async function getHealth(): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(`http://127.0.0.1:${PORT}/webhook/health`);
    } catch (err) {
      if (attempt >= 40) throw err;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

afterAll(async () => {
  await stopWebhookServer();
  delete process.env.WEBHOOK_PORT;
});

describe('motor health', () => {
  it('getMotorHealthPayload returns ok with pid and uptime', () => {
    const payload = getMotorHealthPayload(Date.now() + 5000);
    expect(payload.status).toBe('ok');
    expect(payload.pid).toBe(process.pid);
    expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(5);
    expect(payload.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GET /webhook/health returns JSON payload', async () => {
    process.env.WEBHOOK_PORT = String(PORT);
    registerMotorHealth();

    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReturnType<typeof getMotorHealthPayload>;
    expect(body.status).toBe('ok');
    expect(body.pid).toBe(process.pid);
  });

  it('rejects non-GET methods', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/webhook/health`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
