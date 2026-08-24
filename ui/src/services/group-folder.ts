import path from "node:path";

/**
 * Sanitiza um nome de pasta de grupo vindo de input externo antes de compor
 * caminhos de arquivo. Garante um único segmento de diretório, bloqueando
 * path traversal (`../`, paths absolutos, segmentos aninhados).
 */
export function sanitizeGroupFolder(folder: string | null | undefined): string {
  const base = path.basename((folder ?? "").trim());
  if (!base || base === "." || base.startsWith(".")) {
    throw new Error(`Pasta de grupo inválida: ${folder}`);
  }
  return base;
}
