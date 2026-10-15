export const DEFAULT_INSTITUTION_TIMEZONE = 'America/Guayaquil'

export function resolveInstitutionTimezone(configuredTimezone?: string): string {
  return configuredTimezone?.trim() || DEFAULT_INSTITUTION_TIMEZONE
}

export const INSTITUTION_TIMEZONE = resolveInstitutionTimezone(import.meta.env.VITE_INSTITUTION_TIMEZONE)

/** Return the calendar day at an instant in the configured institution timezone. */
export function getCurrentDateInInstitutionTz(
  timeZone: string = INSTITUTION_TIMEZONE,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}
