import { api } from '@/api/client'
import { db, type OutboxEntry } from '@/offline/db'
import { applyResults, type SyncOperationResult } from './conflict'
import { getRetryConfig } from './retryConfig'
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

async function handleServerResults(
  entries: OutboxEntry[],
  results: SyncOperationResult[],
  maxAttempts: number,
): Promise<void> {
  const appliedOpIds = new Set(results.filter((r) => r.status === 'applied').map((r) => r.clientOpId))
  const appliedEntries = entries.filter((e) => appliedOpIds.has(e.clientOpId))
  if (appliedEntries.length > 0) {
    await db.outbox.bulkDelete(appliedEntries.map((e) => e.id as number))
  }

  const rejectedResults = new Map(results.filter((r) => r.status !== 'applied').map((r) => [r.clientOpId, r]))
  for (const entry of entries) {
    const rejected = rejectedResults.get(entry.clientOpId)
    if (rejected && entry.id != null) {
      await db.outbox.update(entry.id, {
        attempts: maxAttempts,
        lastError: rejected.reason ?? 'Rechazado por el servidor',
      })
    }
  }
}

async function handlePushFailure(
  entries: OutboxEntry[],
  errorMessage: string,
  maxAttempts: number,
): Promise<void> {
  for (const entry of entries) {
    if (entry.id == null) continue
    const nextAttempts = entry.attempts + 1
    await db.outbox.update(entry.id, {
      attempts: nextAttempts,
      lastError: errorMessage,
    })

    if (nextAttempts >= maxAttempts && typeof entry.payload.id === 'number') {
      await db.hourLogs.update(entry.payload.id, {
        syncState: 'failed',
        reviewNote: errorMessage || 'Reintentos agotados',
      })
    }
  }
}

export async function pushOutbox(): Promise<{ applied: number; failed: number }> {
  const config = getRetryConfig()
  const allEntries = await db.outbox.orderBy('createdAt').toArray()
  const entries = allEntries.filter((e) => e.attempts < config.maxAttempts).slice(0, 500)
  if (entries.length === 0) return { applied: 0, failed: 0 }

  const ops = entries.map((e) => ({
    clientOpId: e.clientOpId,
    entity: e.entity,
    op: e.op,
    baseVersion: e.baseVersion,
    payload: e.payload,
  }))

  const localIds = new Map(entries.map((e) => [e.clientOpId, Number(e.payload.id)]))

  try {
    const { results } = await api<{ results: SyncOperationResult[] }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ ops }),
    })

    await handleServerResults(entries, results, config.maxAttempts)
    await applyResults(results, localIds)
    setStatus({ pending: await db.outbox.count() })

    return {
      applied: results.filter((r) => r.status === 'applied').length,
      failed: results.filter((r) => r.status !== 'applied').length,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await handlePushFailure(entries, errorMessage, config.maxAttempts)
    setStatus({ pending: await db.outbox.count() })
    throw err
  }
}
