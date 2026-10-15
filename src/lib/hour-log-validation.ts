export const DEFAULT_MIN_HOUR_LOG_HOURS = 0.5
export const DEFAULT_MAX_HOUR_LOG_HOURS = 10
export const HOUR_LOG_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export class HourLogValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HourLogValidationError'
  }
}

export interface HourLogBounds {
  minHours: number
  maxHours: number
}

export interface HourLogTimeInput {
  startTime: string
  endTime: string
}

export interface HourLogInput extends HourLogTimeInput {
  hours: number
}

/**
 * Resuelve los límites de horas a partir de variables de entorno o valores provistos,
 * asegurando coincidencia con el backend por defecto (0.5h min, 10h max).
 */
export function resolveHourLogBounds(
  configuredMin?: unknown,
  configuredMax?: unknown,
): HourLogBounds {
  const parsedMin = typeof configuredMin === 'number' ? configuredMin : Number(configuredMin)
  const parsedMax = typeof configuredMax === 'number' ? configuredMax : Number(configuredMax)

  const minHours = Number.isFinite(parsedMin) && parsedMin > 0
    ? parsedMin
    : DEFAULT_MIN_HOUR_LOG_HOURS

  const maxHours = Number.isFinite(parsedMax) && parsedMax >= minHours
    ? parsedMax
    : DEFAULT_MAX_HOUR_LOG_HOURS

  return { minHours, maxHours }
}

const defaultBounds = resolveHourLogBounds(
  import.meta.env?.VITE_MIN_HOUR_LOG_HOURS,
  import.meta.env?.VITE_MAX_HOUR_LOG_HOURS,
)

export const MIN_HOUR_LOG_HOURS = defaultBounds.minHours
export const MAX_HOUR_LOG_HOURS = defaultBounds.maxHours

export function validateHourLogHours(
  hours: number,
  bounds: HourLogBounds = defaultBounds,
): void {
  if (!Number.isFinite(hours) || hours < bounds.minHours || hours > bounds.maxHours) {
    throw new HourLogValidationError(
      `las horas deben estar entre ${bounds.minHours} y ${bounds.maxHours}`,
    )
  }
}

export function validateHourLogTime(time: string): void {
  if (!HOUR_LOG_TIME_PATTERN.test(time)) {
    throw new HourLogValidationError('las horas deben tener el formato HH:mm')
  }
}

function timeStringToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function validateHourLogTimes({ startTime, endTime }: HourLogTimeInput): void {
  validateHourLogTime(startTime)
  validateHourLogTime(endTime)

  if (timeStringToMinutes(startTime) >= timeStringToMinutes(endTime)) {
    throw new HourLogValidationError('la hora de inicio debe ser anterior a la de fin')
  }
}

export function validateHourLogInput(
  input: HourLogInput,
  bounds: HourLogBounds = defaultBounds,
): void {
  validateHourLogHours(input.hours, bounds)
  validateHourLogTimes(input)
}

/**
 * Helper para formularios y avisos en vivo: retorna un string de error o null si es válido.
 * Garantiza que el estudiante vea el mismo mensaje de error ya sea en validación local
 * o en el servidor.
 */
export function getHourLogValidationErrorMessage(
  hours: string | number,
  startTime?: string,
  endTime?: string,
  bounds: HourLogBounds = defaultBounds,
): string | null {
  const rawString = String(hours).trim()
  if (!rawString) {
    return 'Ingresa un número de horas válido'
  }

  const numericHours = typeof hours === 'number' ? hours : Number(rawString)
  if (!Number.isFinite(numericHours)) {
    return 'Ingresa un número de horas válido'
  }

  try {
    validateHourLogHours(numericHours, bounds)
  } catch (error) {
    if (error instanceof HourLogValidationError) {
      return error.message
    }
    throw error
  }

  if (startTime && endTime) {
    try {
      validateHourLogTimes({ startTime, endTime })
    } catch (error) {
      if (error instanceof HourLogValidationError) {
        return error.message
      }
      throw error
    }
  }

  return null
}
