import { db } from '@/offline/db'
import { enqueue } from '@/offline/sync/push'
import { buildFormErrors } from './validation'
import { buildHourLogOperation } from './operation'
import type { HourLogSubmitValues, HourLogSubmitActions } from './types'
export async function submitHourLog(
  values: HourLogSubmitValues,
  actions: HourLogSubmitActions,
) {
  actions.setSubmitError(null)
  actions.setSubmitting(true)

  try {
    const nextErrors = await buildFormErrors(
      values.placementId,
      values.date,
      values.startTime,
      values.endTime,
      values.hours,
      values.activity,
    )
    actions.setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      // Los errores ya se renderizan contextualizados debajo del campo correspondiente.
      // No duplicamos el mensaje en el banner general de submitError.
      return
    }

    const { row, operation } = buildHourLogOperation(values)

    // 1) Escribe local primero:
    await db.hourLogs.add(row)

    // 2) Encola la operación para cuando haya conexión.
    // enqueue() gestiona internamente withSyncLock y su propia transacción
    // sobre db.outbox y db.hourLogs, actualizando syncState a 'queued'.
    // NOTA: No envolver enqueue() en un db.transaction() externo porque
    // navigator.locks dentro de una transacción activa de IndexedDB aborta
    // la transacción en navegadores reales (PrematureCommitError / TransactionInactiveError).
    try {
      await enqueue(operation)
    } catch (enqueueError) {
      // Si enqueue falla, limpiamos la fila local para no dejar rezagos huérfanos ni falsos duplicados
      await db.hourLogs.delete(row.id).catch(() => {})
      throw enqueueError
    }

    actions.resetForm()
    actions.onSaved?.()
  } catch (error) {
    console.error('Error al guardar horas en el dispositivo:', error)
    actions.setSubmitError('No se pudo guardar el registro en este dispositivo. Intenta de nuevo.')
  } finally {
    actions.setSubmitting(false)
  }
}
