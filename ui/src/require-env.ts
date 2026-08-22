/**
 * Lê variáveis obrigatórias do ambiente. Sem fallback silencioso.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. ` +
        `Configure em ui/.env (veja ui/.env.example).`,
    );
  }
  return value;
}

export function requireIntEnv(name: string): number {
  const raw = requireEnv(name);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Variável ${name} deve ser um número inteiro (recebido: "${raw}").`);
  }
  return parsed;
}
