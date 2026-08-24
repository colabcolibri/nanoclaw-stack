import { parse as parseYaml } from 'yaml';

export interface FrontmatterDoc {
  /** Atributos do bloco frontmatter já parseados como mapa YAML. */
  attrs: Record<string, unknown>;
  /** Corpo markdown após o frontmatter (trim). */
  body: string;
  /** Bloco YAML bruto — mantido para parsers especializados (ex.: inference params). */
  rawYaml: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Único parser de frontmatter YAML do agent-runner.
 * Usado por AGENT.md (registry) e SKILL.md (skills-manager).
 *
 * Falha alto: YAML malformado lança erro em vez de retornar campos vazios
 * silenciosamente. Documento sem bloco `---` retorna null.
 */
export function parseFrontmatter(content: string): FrontmatterDoc | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;

  const rawYaml = match[1];
  const body = (match[2] ?? '').trim();

  let parsed: unknown;
  try {
    parsed = parseYaml(rawYaml);
  } catch (err) {
    throw new Error(`Frontmatter YAML inválido: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (parsed === null || parsed === undefined) {
    return { attrs: {}, body, rawYaml };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter deve ser um mapa YAML (chave: valor).');
  }

  return { attrs: parsed as Record<string, unknown>, body, rawYaml };
}

/**
 * Normaliza um valor de frontmatter para lista de strings.
 * Aceita lista YAML, array inline `[a, b]`, string única ou separada por vírgulas.
 */
export function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const str = String(value).trim();
  if (!str) return undefined;
  return str
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** Lê uma chave string do frontmatter, com fallback opcional. */
export function attrString(attrs: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = attrs[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

/** Lê uma chave booleana do frontmatter ("true"/"false"), com default. */
export function attrBool(
  attrs: Record<string, unknown>,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = attrs[key];
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  return String(value).trim() === 'true';
}
