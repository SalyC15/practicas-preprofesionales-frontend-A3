import { api } from '@/api/client'
import { db, type LocalDocument, type LocalEvaluation, type LocalHourLog, type LocalPlacement } from '@/offline/db'
import { isFenceCurrent, sessionCoordinator, type SessionFence } from '@/auth/session'
import { withSyncLock } from './syncLock'

type Tombstoned<T> = T & { deletedAt?: string | null }

export interface PullChanges {
  placements: Tombstoned<LocalPlacement>[]
  hourLogs: Tombstoned<Omit<LocalHourLog, 'syncState'>>[]
  documents: Tombstoned<LocalDocument>[]
  evaluations: Tombstoned<LocalEvaluation>[]
}

export interface PullResponse {
  changes: PullChanges
  checkpoint: string | null
  hasMore: boolean
}

async function applyPlacements(rows: PullChanges['placements']): Promise<void> {
  for (const row of rows) {
    if (row.deletedAt) await db.placements.delete(row.id)
    else await db.placements.put(row)
  }
}

async function applyHourLogs(rows: PullChanges['hourLogs']): Promise<void> {
  const queuedOutbox = await db.outbox.where('entity').equals('hourLog').toArray()
  const queuedIds = new Set(
    queuedOutbox.map((entry) => entry.payload.id).filter((id): id is number => typeof id === 'number'),
  )

  for (const row of rows) {
    if (row.deletedAt) {
      await db.hourLogs.delete(row.id)
    } else {
      const syncState = queuedIds.has(row.id) ? 'queued' : 'synced'
      await db.hourLogs.put({ ...row, syncState })
    }
  }
}

async function applyDocuments(rows: PullChanges['documents']): Promise<void> {
  for (const row of rows) {
    if (row.deletedAt) await db.documents.delete(row.id)
    else await db.documents.put(row)
  }
}

async function applyEvaluations(rows: PullChanges['evaluations']): Promise<void> {
  for (const row of rows) {
    if (row.deletedAt) await db.evaluations.delete(row.id)
    else await db.evaluations.put(row)
  }
}

export async function pullChanges(
  fence: SessionFence = sessionCoordinator.capture(),
): Promise<{ applied: number; hasMore: boolean }> {
  if (!isFenceCurrent(fence)) return { applied: 0, hasMore: false }

  const savedCheckpoint = await withSyncLock(async () => {
    if (!isFenceCurrent(fence)) return undefined
    return db.meta.get('checkpoint')
  })

  if (!isFenceCurrent(fence)) return { applied: 0, hasMore: false }

  const params = new URLSearchParams()
  if (savedCheckpoint) params.set('since', savedCheckpoint.value)
  params.set('limit', '200')

  let response: PullResponse
  try {
    response = await api<PullResponse>(`/sync/pull?${params.toString()}`, {
      signal: fence.signal,
    })
  } catch (error) {
    if (!isFenceCurrent(fence)) return { applied: 0, hasMore: false }
    throw error
  }

  if (!isFenceCurrent(fence) || !response?.changes) return { applied: 0, hasMore: false }
  const { changes, checkpoint, hasMore } = response

  await withSyncLock(async () => {
    if (!isFenceCurrent(fence)) return
    await db.transaction(
      'rw',
      [db.placements, db.hourLogs, db.documents, db.evaluations, db.outbox, db.meta],
      async () => {
        if (!isFenceCurrent(fence)) return
        await applyPlacements(changes.placements)
        await applyHourLogs(changes.hourLogs)
        await applyDocuments(changes.documents)
        await applyEvaluations(changes.evaluations)

        if (checkpoint != null) {
          await db.meta.put({ key: 'checkpoint', value: checkpoint })
        }
      },
    )
  })

  if (!isFenceCurrent(fence)) return { applied: 0, hasMore: false }

  const applied =
    changes.placements.length + changes.hourLogs.length + changes.documents.length + changes.evaluations.length

  return { applied, hasMore }
}
