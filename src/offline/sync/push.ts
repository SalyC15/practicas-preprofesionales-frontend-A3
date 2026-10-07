import { api } from '@/api/client'
import { db, type OutboxEntry } from '@/offline/db'
import { isFenceCurrent, sessionCoordinator, type SessionFence } from '@/auth/session'
import { applyResults, type SyncOperationResult } from './conflict'
import { setStatus } from './status'
import { withSyncLock } from './syncLock'

export async function enqueue(
  op: Omit<OutboxEntry, 'id' | 'clientOpId' | 'createdAt' | 'attempts' | 'lastError'>,
  fence: SessionFence = sessionCoordinator.capture(),
): Promise<void> {
  const entry: OutboxEntry = {
    ...op,
    clientOpId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }

  await withSyncLock(async () => {
    if (!isFenceCurrent(fence)) return
    await db.transaction('rw', [db.outbox, db.hourLogs], async () => {
      if (!isFenceCurrent(fence)) return
      await db.outbox.add(entry)
      const rowId = entry.payload.id
      if (typeof rowId === 'number') {
        await db.hourLogs.update(rowId, { syncState: 'queued' })
      }
    })
  })

  // Sin esto, el contador "N pendientes" solo se recalcula tras un push
  // exitoso (scheduler.ts:34) y jamás refleja lo que se acaba de encolar
  // mientras no hay conexión.
  if (isFenceCurrent(fence)) {
    setStatus({ pending: await db.outbox.count() })
  }
}

export async function pushOutbox(
  fence: SessionFence = sessionCoordinator.capture(),
): Promise<{ applied: number; failed: number }> {
  if (!isFenceCurrent(fence)) return { applied: 0, failed: 0 }

  const entries = await withSyncLock(async () => {
    if (!isFenceCurrent(fence)) return []
    return db.outbox.orderBy('createdAt').limit(500).toArray()
  })
  if (entries.length === 0 || !isFenceCurrent(fence)) return { applied: 0, failed: 0 }

  const ops = entries.map((e) => ({
    clientOpId: e.clientOpId,
    entity: e.entity,
    op: e.op,
    baseVersion: e.baseVersion,
    payload: e.payload,
  }))

  // El outbox es lo único que sabe qué id local le corresponde a cada operación,
  // así que el mapa se captura en memoria antes de enviar el lote.
  const localIds = new Map(entries.map((e) => [e.clientOpId, Number(e.payload.id)]))

  let results: SyncOperationResult[]
  try {
    const response = await api<{ results: SyncOperationResult[] }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ ops }),
      signal: fence.signal,
    })
    if (!isFenceCurrent(fence) || !response?.results) {
      return { applied: 0, failed: 0 }
    }
    results = response.results
  } catch (error) {
    if (isFenceCurrent(fence)) {
      const lastError = error instanceof Error ? error.message : String(error)
      await withSyncLock(async () => {
        if (!isFenceCurrent(fence)) return
        await db.outbox.bulkPut(
          entries.map((entry) => ({
            ...entry,
            attempts: entry.attempts + 1,
            lastError,
          })),
        )
      })
    }
    throw error
  }

  if (!isFenceCurrent(fence)) return { applied: 0, failed: 0 }

  const resultByClientOpId = new Map(results.map((result) => [result.clientOpId, result]))
  await withSyncLock(async () => {
    if (!isFenceCurrent(fence)) return
    await db.transaction('rw', [db.hourLogs, db.outbox], async () => {
      if (!isFenceCurrent(fence)) return
      await applyResults(results, localIds)
      for (const entry of entries) {
        const result = resultByClientOpId.get(entry.clientOpId)
        if (result?.status === 'applied' && result.server) {
          await db.outbox.delete(entry.id as number)
          continue
        }

        if (result) {
          await db.outbox.update(entry.id as number, {
            attempts: entry.attempts + 1,
            lastError: result.reason ?? 'El servidor no aplicó la operación',
          })
        }
      }
    })
  })

  if (!isFenceCurrent(fence)) return { applied: 0, failed: 0 }

  return {
    applied: results.filter((r) => r.status === 'applied').length,
    failed: results.filter((r) => r.status !== 'applied').length,
  }
}
