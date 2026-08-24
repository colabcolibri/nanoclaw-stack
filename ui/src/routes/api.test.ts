import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Env de teste ANTES de qualquer import da app — CONFIG lê no import.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "nanoclaw-api-router-"));
process.env.NANOCLAW_PATH = TMP_ROOT;
process.env.NANOCLAW_DEFAULT_GROUP = "barao";
process.env.PORT = "3999";
process.env.ALLOWED_EMAIL = "admin@example.com";
process.env.RESEND_API_KEY = "re_test_key";
process.env.FROM_EMAIL = "test@example.com";
process.env.SESSION_SECRET = "test-session-secret";
process.env.UI_PUBLIC_URL = "http://localhost:3999";
process.env.NANOCLAW_MOTOR_URL = "http://127.0.0.1:5999";

const { ApiRouter } = await import("./api.js");
const { TokenManager } = await import("../auth/token.js");
const { RateLimiter } = await import("../auth/rate-limit.js");

const BASE = "http://localhost:3999";

function request(
  method: string,
  pathname: string,
  opts: { body?: unknown; cookie?: string; ip?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  return ApiRouter.handle(
    new Request(`${BASE}${pathname}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    new URL(`${BASE}${pathname}`),
  ).then((res) => res ?? new Response(null, { status: 500 }));
}

async function loginCookie(ip = "10.0.0.1"): Promise<string> {
  const realFetch = globalThis.fetch;
  let otpCode = "";
  globalThis.fetch = (async (_input: any, init?: any) => {
    const body = String(init?.body ?? "");
    const match = body.match(/\b(\d{6})\b/);
    otpCode = match?.[1] ?? "";
    return new Response(JSON.stringify({ id: "test" }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    const sendRes = await request("POST", "/api/auth/send-code", {
      body: { email: "admin@example.com" },
      ip,
    });
    expect(sendRes.status).toBe(200);
    expect(otpCode).toMatch(/^\d{6}$/);

    const verifyRes = await request("POST", "/api/auth/verify-code", {
      body: { email: "admin@example.com", code: otpCode },
      ip,
    });
    expect(verifyRes.status).toBe(200);
    const setCookie = verifyRes.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    return setCookie.split(";")[0]!;
  } finally {
    globalThis.fetch = realFetch;
  }
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  RateLimiter.reset();
});

describe("ApiRouter — autenticação", () => {
  test("rota protegida sem cookie retorna 401", async () => {
    const res = await request("GET", "/api/groups");
    expect(res.status).toBe(401);
  });

  test("POST /api/service/restart sem cookie retorna 401", async () => {
    const res = await request("POST", "/api/service/restart");
    expect(res.status).toBe(401);
  });

  test("send-code com e-mail inválido retorna 400", async () => {
    const res = await request("POST", "/api/auth/send-code", {
      body: { email: "sem-arroba" },
      ip: "10.9.9.9",
    });
    expect(res.status).toBe(400);
  });

  test("send-code fora da allowlist responde genérico e NÃO envia e-mail", async () => {
    let called = 0;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const res = await request("POST", "/api/auth/send-code", {
      body: { email: "intruso@example.com" },
      ip: "10.9.9.8",
    });
    const json = (await res.json()) as { success?: boolean; message?: string };
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(called).toBe(0); // anti-enumeration: nada é enviado
  });

  test("verify-code sem registro prévio retorna erro", async () => {
    const res = await request("POST", "/api/auth/verify-code", {
      body: { email: "admin@example.com", code: "000000" },
      ip: "10.9.9.7",
    });
    expect(res.status).toBe(400);
  });

  test("rate limit dispara 429 com Retry-After após estourar a janela", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request("POST", "/api/auth/send-code", {
        body: { email: "intruso@example.com" },
        ip: "10.5.5.5",
      });
      expect(res.status).toBe(200);
    }
    const sixth = await request("POST", "/api/auth/send-code", {
      body: { email: "intruso@example.com" },
      ip: "10.5.5.5",
    });
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get("Retry-After"))).toBeGreaterThan(0);

    // IP diferente não é afetado
    const otherIp = await request("POST", "/api/auth/send-code", {
      body: { email: "intruso@example.com" },
      ip: "10.5.5.6",
    });
    expect(otherIp.status).toBe(200);
  });

  test("login completo emite cookie de sessão válido", async () => {
    const cookie = await loginCookie("10.1.1.1");
    expect(cookie).toContain("nanoclaw_session=");

    const me = await request("GET", "/api/auth/me", { cookie });
    expect(me.status).toBe(200);
    const json = (await me.json()) as { authenticated: boolean; user?: { email: string } };
    expect(json.authenticated).toBe(true);
    expect(json.user?.email).toBe("admin@example.com");
  });

  test("logout zera o cookie e revoga a sessão server-side", async () => {
    const cookie = await loginCookie("10.2.2.2");
    const logout = await request("POST", "/api/auth/logout", { cookie });
    expect(logout.status).toBe(200);
    const setCookie = logout.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Max-Age=0");

    // Mesmo com o token antigo, a sessão foi revogada no store.
    const me = await request("GET", "/api/auth/me", { cookie });
    expect(me.status).toBe(401);
  });
});

describe("ApiRouter — rotas autenticadas", () => {
  let cookie: string;
  beforeAll(async () => {
    cookie = await loginCookie("10.3.3.3");
  });

  test("/api/app-config retorna config pública", async () => {
    const res = await request("GET", "/api/app-config", { cookie });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { defaultGroupFolder?: string };
    expect(json.defaultGroupFolder).toBe("barao");
  });

  test("traversal no folder via query não vaza fora de groups/", async () => {
    const res = await request("GET", "/api/integrations/google/policy?folder=..%2F..%2Fetc", { cookie });
    expect(res.status).toBe(200);
    const raw = JSON.stringify(await res.json());
    // sanitizeGroupFolder reduz a "etc"; resposta padrão, nunca conteúdo fora da árvore.
    expect(raw).not.toContain(TMP_ROOT + "/etc");
  });

  test("purge sem confirmação válida retorna 400 pedindo 'confirmar'", async () => {
    const res = await request("POST", "/api/maintenance/purge-chat-and-costs", {
      cookie,
      body: { confirmation: "sim" },
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toContain("confirmar");
  });

  test("google callback com state inválido reporta falha de state", async () => {
    const res = await request("GET", "/api/integrations/google/callback?code=abc&state=tampered", {
      cookie,
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("State OAuth inválido");
  });

  test("endpoint desconhecido autenticado retorna 404 JSON", async () => {
    const res = await request("GET", "/api/nao-existe", { cookie });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBeTruthy();
  });
});

describe("ApiRouter — endpoints /api/mac/*", () => {
  test("sem bearer e sem cookie retorna 401", async () => {
    const res = await request("GET", "/api/mac/threads?group=barao");
    expect(res.status).toBe(401);
  });

  test("bearer correto autentica /api/mac/verify", async () => {
    fs.mkdirSync(path.join(TMP_ROOT, "groups", "barao"), { recursive: true });
    // Cria chave conhecida para o grupo
    const keyPath = path.join(TMP_ROOT, "groups", "barao", "mac_channel.json");
    fs.writeFileSync(keyPath, JSON.stringify({ apiKey: "mac_test_key_123" }));
    const res = await ApiRouter.handle(
      new Request(`${BASE}/api/mac/verify?group=barao`, {
        headers: { Authorization: "Bearer mac_test_key_123" },
      }),
      new URL(`${BASE}/api/mac/verify?group=barao`),
    );
    expect(res?.status).toBe(200);
    const json = (await res!.json()) as { success?: boolean };
    expect(json.success).toBe(true);
  });
});

// NOTA: o tmpdir NÃO é removido no afterAll de propósito — o Bun roda todos os
// arquivos de teste no mesmo processo e outros módulos leem CONFIG.NANOCLAW_PATH
// (cacheado apontando para cá). O SO limpa /tmp eventualmente.
