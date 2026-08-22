const FALLBACK_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Fortaleza',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Africa/Luanda',
  'Africa/Johannesburg',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

let cachedTimezones: string[] | null = null

export function getSupportedTimezones(): string[] {
  if (cachedTimezones) return cachedTimezones
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      cachedTimezones = [...Intl.supportedValuesOf('timeZone')].sort()
      return cachedTimezones
    }
  } catch {}
  cachedTimezones = [...FALLBACK_TIMEZONES]
  return cachedTimezones
}

export function formatTimezoneLabel(timezone: string, locale = 'pt-BR'): string {
  if (!timezone) return ''
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const offset =
      formatter.formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? ''
    return offset ? `${timezone} (${offset})` : timezone
  } catch {
    return timezone
  }
}

export function filterTimezones(query: string, timezones: string[]): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return timezones
  return timezones.filter((tz) => tz.toLowerCase().includes(q))
}
