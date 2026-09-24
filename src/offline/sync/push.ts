import { api } from '@/api/client'
import { db, type OutboxEntry } from '@/offline/db'
import { applyResults, type SyncOperationResult } from './conflict'
import { setStatus } from './status'

export async function enqueue(
  op: Omit<OutboxEntry, 'id' | 'clientOpId' | 'createdAt' | 'attempts' | 'lastError'>,
): Promise<void> {
  const entry: OutboxEntry = {
    ...op,
    clientOpId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }

  await db.transaction('rw', [db.outbox, db.hourLogs], async () => {
    await db.outbox.add(entry)
    const rowId = entry.payload.id
    if (typeof rowId === 'number') {
      await db.hourLogs.update(rowId, { syncState: 'queued' })
    }
  })

  // Sin esto, el contador "N pendientes" solo se recalcula tras un push
  // exitoso (scheduler.ts:34) y jamás refleja lo que se acaba de encolar
  // mientras no hay conexión.
  setStatus({ pending: await db.outbox.count() })
}

export async function pushOutbox(): Promise<{ applied: number; failed: number }> {
  const entries = await db.outbox.orderBy('createdAt').limit(500).toArray()
  if (entries.length === 0) return { applied: 0, failed: 0 }

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
    })
    results = response.results
  } catch (error) {
    const lastError = error instanceof Error ? error.message : String(error)
    await db.outbox.bulkPut(
      entries.map((entry) => ({
        ...entry,
        attempts: entry.attempts + 1,
        lastError,
      })),
    )
    throw error
  }

  await applyResults(results, localIds)

  const resultByClientOpId = new Map(results.map((result) => [result.clientOpId, result]))
  await db.transaction('rw', db.outbox, async () => {
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

  return {
    applied: results.filter((r) => r.status === 'applied').length,
    failed: results.filter((r) => r.status !== 'applied').length,
  }
}
