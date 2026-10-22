import { getCalendarDatePrefix, parseStoredCalendarDateUtc } from './date'
import type { LocalHourLog, LocalPlacement } from '@/offline/db'

export interface ScheduledSession {
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  hours: number
  activity: string
  sessionIndex: number
  existingLog?: LocalHourLog
  status: 'PENDING' | 'CONFIRMED' | 'APPROVED' | 'REJECTED'
}

export interface ScheduleSummary {
  requiredHours: number
  plannedHours: number
  confirmedHours: number
  totalSessions: number
  confirmedSessions: number
  dailyHours: number
  startDate: string
  endDate: string
  sessions: ScheduledSession[]
}

export interface ScheduleConfig {
  startTime?: string
  endTime?: string
  dailyHours?: number
  workDays?: number[] // 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie
  activity?: string
}

/**
 * Calcula la fecha fin exacta (YYYY-MM-DD) requerida para completar una cantidad de horas,
 * avanzando únicamente por los días laborables configurados.
 */
export function calculateEndDateFromHours(
  startDateStr: string,
  requiredHours: number,
  dailyHours = 4,
  workDays = [1, 2, 3, 4, 5],
): string {
  if (!startDateStr || requiredHours <= 0) return startDateStr
  const startDate = parseStoredCalendarDateUtc(startDateStr)
  if (Number.isNaN(startDate.getTime())) return startDateStr

  const current = new Date(startDate.getTime())
  current.setUTCHours(0, 0, 0, 0)

  let accumulated = 0
  let lastWorkingDate = startDateStr
  let safety = 0

  while (accumulated < requiredHours && safety < 730) {
    safety++
    const day = current.getUTCDay()
    if (workDays.includes(day)) {
      const remaining = requiredHours - accumulated
      accumulated += Math.min(dailyHours, remaining)
      const year = current.getUTCFullYear()
      const month = String(current.getUTCMonth() + 1).padStart(2, '0')
      const d = String(current.getUTCDate()).padStart(2, '0')
      lastWorkingDate = `${year}-${month}-${d}`
    }
    if (accumulated < requiredHours) {
      current.setUTCDate(current.getUTCDate() + 1)
    }
  }

  return lastWorkingDate
}

/**
 * Calcula el número total de horas laborables que caben entre startDate y endDate
 * (inclusivas), avanzando únicamente por los días laborables configurados.
 */
export function calculateWorkingHoursBetween(
  startDateStr: string,
  endDateStr: string,
  dailyHours = 4,
  workDays = [1, 2, 3, 4, 5],
): number {
  if (!startDateStr || !endDateStr || endDateStr < startDateStr) return 0
  const start = parseStoredCalendarDateUtc(startDateStr)
  const end = parseStoredCalendarDateUtc(endDateStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  const current = new Date(start.getTime())
  current.setUTCHours(0, 0, 0, 0)
  const endTime = end.getTime()

  let hours = 0
  let safety = 0

  while (current.getTime() <= endTime && safety < 730) {
    safety++
    const day = current.getUTCDay()
    if (workDays.includes(day)) {
      hours += dailyHours
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return hours
}

/**
 * Genera el cronograma de sesiones que justifica exactamente las horas ofertadas
 * por la empresa (placement.requiredHours), excluyendo fines de semana por defecto.
 */
export function generatePlacementSchedule(
  placement: LocalPlacement,
  existingLogs: LocalHourLog[] = [],
  config: ScheduleConfig = {},
): ScheduleSummary {
  const requiredHours = Math.max(0, placement.requiredHours || 0)
  const startTime = config.startTime ?? '08:00'
  const endTime = config.endTime ?? '12:00'
  const dailyHours = config.dailyHours ?? 4
  const workDays = config.workDays ?? [1, 2, 3, 4, 5] // Lun a Vie
  const baseActivity = config.activity
    ?? (placement.offerTitle ? `Práctica: ${placement.offerTitle}` : 'Actividades de práctica preprofesional')

  // Mapear logs existentes por fecha (YYYY-MM-DD)
  const logsByDate = new Map<string, LocalHourLog>()
  for (const log of existingLogs) {
    if (log.status === 'REJECTED') continue
    const datePrefix = getCalendarDatePrefix(log.date) ?? log.date
    if (datePrefix && !logsByDate.has(datePrefix)) {
      logsByDate.set(datePrefix, log)
    }
  }

  // Parsear fecha de inicio
  const startDate = parseStoredCalendarDateUtc(placement.startDate)
  const current = Number.isNaN(startDate.getTime()) ? new Date() : new Date(startDate.getTime())
  // Asegurarse de que esté a medianoche UTC
  current.setUTCHours(0, 0, 0, 0)

  const startDateStr = getCalendarDatePrefix(placement.startDate) ?? current.toISOString().slice(0, 10)

  let accumulatedHours = 0
  let sessionIndex = 1
  const sessions: ScheduledSession[] = []

  // Generar días laborables hasta cubrir requiredHours (tope de seguridad de 730 días)
  let safetyCounter = 0
  while (accumulatedHours < requiredHours && safetyCounter < 730) {
    safetyCounter++
    const dayOfWeek = current.getUTCDay() // 0=Dom, 1=Lun... 6=Sab

    if (workDays.includes(dayOfWeek)) {
      const year = current.getUTCFullYear()
      const month = String(current.getUTCMonth() + 1).padStart(2, '0')
      const day = String(current.getUTCDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const remainingHours = requiredHours - accumulatedHours
      const sessionHours = Math.min(dailyHours, remainingHours)
      const existing = logsByDate.get(dateStr)

      let status: ScheduledSession['status'] = 'PENDING'
      if (existing) {
        if (existing.status === 'APPROVED') status = 'APPROVED'
        else if (existing.status === 'REJECTED') status = 'REJECTED'
        else status = 'CONFIRMED'
      }

      sessions.push({
        date: dateStr,
        startTime,
        endTime,
        hours: sessionHours,
        activity: existing?.activity || baseActivity,
        sessionIndex,
        existingLog: existing,
        status,
      })

      accumulatedHours += sessionHours
      sessionIndex++
    }

    // Avanzar un día
    current.setUTCDate(current.getUTCDate() + 1)
  }

  const confirmedSessions = sessions.filter((s) => s.status === 'CONFIRMED' || s.status === 'APPROVED').length
  const confirmedHours = sessions
    .filter((s) => s.status === 'CONFIRMED' || s.status === 'APPROVED')
    .reduce((sum, s) => sum + s.hours, 0)

  const endDateStr = sessions.length > 0 ? sessions[sessions.length - 1].date : startDateStr

  return {
    requiredHours,
    plannedHours: accumulatedHours,
    confirmedHours,
    totalSessions: sessions.length,
    confirmedSessions,
    dailyHours,
    startDate: startDateStr,
    endDate: endDateStr,
    sessions,
  }
}
