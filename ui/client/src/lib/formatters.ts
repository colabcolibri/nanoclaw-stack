/**
 * Formatters centrais do client — convenção pt-BR (números 1.234,56; datas dd/mm/yyyy).
 * Única fonte de Intl no app: nenhum componente chama toLocaleString/Intl direto.
 */
export { formatCount, formatCountCompact } from './format-count'

/** Número inteiro com separadores pt-BR (tokens, contagens, chars). */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

/** Data curta (dd/mm/aaaa). */
export function formatDate(value: Date | string | number): string {
  return new Date(value).toLocaleDateString('pt-BR')
}

/** Hora (hh:mm). */
export function formatTime(value: Date | string | number): string {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Data e hora completas no padrão local. */
export function formatDateTime(value: Date | string | number): string {
  return new Date(value).toLocaleString('pt-BR')
}

/** Data e hora compactas (dd/mm hh:mm) para tabelas densas. */
export function formatDateTimeShort(value: Date | string | number): string {
  const d = new Date(value)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
