import type { LocalHourLog } from '@/offline/db'
import type { HourLogSubmitValues } from './types'

export function buildHourLogOperation(values: HourLogSubmitValues, now = new Date()) {
  const localId = -now.getTime()
  const nowIso = now.toISOString()
  const hoursValue = Number(values.hours)
  const trimmedActivity = values.activity.trim()

  const row: LocalHourLog = {
    id: localId,
    placementId: values.placementId,
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    hours: hoursValue,
    activity: trimmedActivity,
    status: 'SUBMITTED',
    reviewNote: null,
    version: 1,
    updatedAt: nowIso,
    syncState: 'local',
  }

  const operation = {
    entity: 'hourLog' as const,
    op: 'create' as const,
    payload: {
      id: row.id,
      placementId: row.placementId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      hours: row.hours,
      activity: row.activity,
      status: row.status,
      reviewNote: row.reviewNote,
      version: row.version,
      updatedAt: row.updatedAt,
    },
    baseVersion: null,
  }

  return { row, operation }
}
