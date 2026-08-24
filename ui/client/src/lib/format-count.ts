/** Formata contagens para chips, badges e paginação (pt-BR, legível em 10k+). */
export function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

/** Versão compacta para espaços apertados (ex.: 12,4 mil). */
export function formatCountCompact(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${millions.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (value >= 10_000) {
    const thousands = value / 1_000
    return `${thousands.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return formatCount(value)
}
