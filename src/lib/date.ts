const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LEGACY_DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|T)/

/** Parsea una fecha ISO como fecha local, no como medianoche UTC. */
export function parseLocalDate(value: string): Date {
  const [datePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Whether a strict YYYY-MM-DD string is a real Gregorian calendar date. */
export function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(0)
  parsed.setUTCHours(0, 0, 0, 0)
  parsed.setUTCFullYear(year, month - 1, day)
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

/** Read the stored calendar day without shifting legacy timestamp prefixes. */
export function getCalendarDatePrefix(value: string): string | null {
  const dateString = LEGACY_DATE_PREFIX_PATTERN.exec(value)?.[1]
  return dateString && isValidCalendarDate(dateString) ? dateString : null
}

/** Build a UTC-midnight Date from the calendar prefix stored in Dexie. */
export function parseStoredCalendarDateUtc(value: string): Date {
  const dateString = getCalendarDatePrefix(value)
  if (!dateString) return new Date(Number.NaN)

  const [year, month, day] = dateString.split('-').map(Number)
  const parsed = new Date(0)
  parsed.setUTCHours(0, 0, 0, 0)
  parsed.setUTCFullYear(year, month - 1, day)
  return parsed
}

function placementRangeError(
  dateValue: string,
  placementStart: string,
  placementEnd: string | null,
): string | null {
  if (dateValue < placementStart || (placementEnd !== null && dateValue > placementEnd)) {
    const validRange = placementEnd
      ? `${placementStart} a ${placementEnd}`
      : `desde ${placementStart}, sin fecha de fin definida`
    return `La fecha del registro (${dateValue}) está fuera del rango válido de la práctica (${validRange}).`
  }
  return null
}

/** Validate an input calendar day against the institution day and placement bounds. */
export function validateHourLogCalendarDate(
  dateValue: string,
  placementStart: string,
  placementEnd: string | null | undefined,
  institutionToday: string,
): string | null {
  if (!isValidCalendarDate(dateValue)) return 'Ingresa una fecha válida'
  if (dateValue > institutionToday) return 'No se pueden registrar horas con fecha futura'

  const placementStartString = getCalendarDatePrefix(placementStart)
  const placementEndString = placementEnd ? getCalendarDatePrefix(placementEnd) : null
  if (!placementStartString || (placementEnd && !placementEndString)) {
    return 'No se pudo validar el período de la práctica en este dispositivo'
  }

  return placementRangeError(dateValue, placementStartString, placementEndString)
}
