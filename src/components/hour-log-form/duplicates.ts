import { db, type LocalHourLog } from '@/offline/db'
import { getCalendarDatePrefix } from '@/lib/date'
export async function checkDuplicateHourLog(
  placementId: number,
  date: string,
  startTime: string,
  endTime: string,
  activity: string,
): Promise<{ field: 'activity' | 'startTime'; message: string } | null> {
  if (!date || !startTime || !endTime) return null
  const normalizedActivity = activity.trim().toLowerCase()

  const existingLogs = await db.hourLogs
    .where('placementId')
    .equals(placementId)
    .toArray()

  for (const log of existingLogs) {
    if (log.status === 'REJECTED') continue

    // Si la fila quedó varada en 'local' con id temporal negativo y no llegó al outbox
    // (por un fallo previo o cierre abortado), la purgamos para no bloquear al usuario
    // con falsos duplicados ni dejar registros fantasmas.
    if (log.syncState === 'local' && log.id < 0) {
      const outboxEntries = await db.outbox.toArray()
      const isEnqueued = outboxEntries.some((e) => (e.payload as { id?: number })?.id === log.id)
      if (!isEnqueued) {
        await db.hourLogs.delete(log.id).catch(() => {})
        continue
      }
    }

    const duplicate = findConflict(log, date, startTime, endTime, normalizedActivity)
    if (duplicate) return duplicate
  }
  return null
}

function findConflict(
  log: LocalHourLog, date: string, startTime: string, endTime: string, activity: string,
): { field: 'activity' | 'startTime'; message: string } | null {
  if ((getCalendarDatePrefix(log.date) ?? log.date) !== date) return null
  if (log.startTime === startTime && log.endTime === endTime) {
    return log.activity.trim().toLowerCase() === activity
      ? { field: 'activity', message: 'Ya existe un registro con la misma fecha, horario y actividad.' }
      : { field: 'startTime', message: `Ya tienes horas registradas en este mismo horario (${startTime}–${endTime}).` }
  }
  if (startTime < log.endTime && endTime > log.startTime) {
    return { field: 'startTime',
      message: `El horario (${startTime}–${endTime}) se solapa con otro registro existente (${log.startTime}–${log.endTime}).` }
  }
  return null
}
