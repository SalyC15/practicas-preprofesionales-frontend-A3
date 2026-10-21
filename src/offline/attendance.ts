import { db, type LocalHourLog } from '@/offline/db'
import { enqueue } from '@/offline/sync/push'
import type { ScheduledSession } from '@/lib/schedule'

/**
 * Registra la asistencia del estudiante a una sesión del cronograma planificado.
 * Con 1 solo clic, la sesión pasa a guardarse localmente en IndexedDB y se encola
 * para sincronización automática con el backend.
 */
export async function confirmAttendance(
  placementId: number,
  session: ScheduledSession,
): Promise<LocalHourLog> {
  const localId = -Date.now()
  const nowIso = new Date().toISOString()

  const row: LocalHourLog = {
    id: localId,
    placementId,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    hours: session.hours,
    activity: session.activity,
    status: 'SUBMITTED',
    reviewNote: null,
    version: 1,
    updatedAt: nowIso,
    syncState: 'local',
  }

  // 1) Guardar en Dexie
  await db.hourLogs.add(row)

  // 2) Encolar para sincronización
  try {
    await enqueue({
      entity: 'hourLog',
      op: 'create',
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
    })
  } catch (err) {
    // Si falla el encolado, revertimos la fila local para no dejar rezagos huérfanos
    await db.hourLogs.delete(row.id).catch(() => {})
    throw err
  }

  return row
}
