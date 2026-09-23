import { db } from '@/offline/db'
import { pullChanges } from './pull'
import { pushOutbox } from './push'
import { calculateBackoffDelay, getRetryConfig } from './retryConfig'
import { setStatus } from './status'
import { withSyncLock } from './syncLock'

const SYNC_INTERVAL_MS = 60_000
// Tope de rondas de pull por corrida: evita que un servidor que siempre
// responda hasMore:true cuelgue el scheduler en un bucle infinito.
const MAX_PULL_ROUNDS = 20

function hasSession(): boolean {
  return Boolean(localStorage.getItem('access_token'))
}

let currentSync: Promise<void> | null = null
let retryTimerId: number | null = null
let nextRetryDelayMs: number | null = null

export function cancelRetry(): void {
  if (retryTimerId != null) {
    window.clearTimeout(retryTimerId)
    retryTimerId = null
    nextRetryDelayMs = null
  }
}

export function isRetryScheduled(): boolean {
  return retryTimerId != null
}

export function getScheduledRetryDelay(): number | null {
  return nextRetryDelayMs
}

async function scheduleRetryIfNeeded(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    cancelRetry()
    return
  }

  const config = getRetryConfig()
  const allEntries = await db.outbox.toArray()
  const retryable = allEntries.filter((e) => e.attempts < config.maxAttempts)

  if (retryable.length === 0) {
    cancelRetry()
    return
  }

  const maxAttempts = Math.max(...retryable.map((e) => e.attempts))
  const delay = calculateBackoffDelay(maxAttempts, config)

  cancelRetry()
  nextRetryDelayMs = delay
  retryTimerId = window.setTimeout(() => {
    retryTimerId = null
    nextRetryDelayMs = null
    void syncNow()
  }, delay)
}

async function runSync(): Promise<void> {
  if (!hasSession()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  setStatus({ syncing: true })

  try {
    let hasMore = true
    let rounds = 0
    while (hasMore && rounds < MAX_PULL_ROUNDS) {
      const result = await pullChanges()
      hasMore = result.hasMore
      rounds += 1
    }

    await pushOutbox()

    const pending = await db.outbox.count()
    setStatus({ syncing: false, lastSyncAt: new Date().toISOString(), pending })
    cancelRetry()
  } catch (err) {
    console.error('sincronización falló', err)
    setStatus({ syncing: false })
    await scheduleRetryIfNeeded()
  }
}

/** Corre pull + push. Si ya hay una corrida en curso, la reutiliza en vez de duplicarla. */
export function syncNow(): Promise<void> {
  cancelRetry()
  if (!currentSync) {
    currentSync = withSyncLock(runSync).finally(() => {
      currentSync = null
    })
  }
  return currentSync
}

/**
 * Arranca el scheduler: sincroniza al montar, al recuperar conexión, y cada
 * 60s. Debe llamarse una sola vez (desde un useEffect en AppLayout) — llamar
 * en cada hook crearía un timer y un listener por cada consumidor.
 */
export function startSync(): () => void {
  void syncNow()

  const handleOnline = () => {
    setStatus({ online: true })
    cancelRetry()
    void syncNow()
  }
  const handleOffline = () => {
    setStatus({ online: false })
    cancelRetry()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  const intervalId = window.setInterval(() => {
    void syncNow()
  }, SYNC_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.clearInterval(intervalId)
    cancelRetry()
  }
}

