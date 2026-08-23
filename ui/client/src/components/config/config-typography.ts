/** Hierarquia tipográfica da área de configuração (alinhada ao Label e PageHeader). */
export const configTypography = {
  /** Título de card ou bloco (ex.: Worker, Sender). */
  cardTitle: 'text-sm font-semibold text-(--text-main)',
  /** Subtítulo / descrição curta abaixo do título. */
  cardSubtitle: 'text-xs leading-relaxed text-(--text-muted)',
  /** Rótulo de campo — mesmo peso do componente Label. */
  fieldLabel: 'text-xs font-semibold text-(--text-muted)',
  /** Texto de corpo. */
  body: 'text-sm text-(--text-main)',
  /** Texto secundário / metadado. */
  meta: 'text-xs text-(--text-dim)',
  /** Valores técnicos (model id, preço). */
  mono: 'text-xs font-mono text-(--text-main)',
  monoMuted: 'text-xs font-mono text-(--text-dim)',
  /** Nota de rodapé dentro da seção. */
  footnote: 'text-xs leading-relaxed text-(--text-dim)',
} as const
