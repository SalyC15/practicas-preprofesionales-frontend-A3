export interface SyncStatus {
  online: boolean
  pending: number
  lastSyncAt: string | null
  syncing: boolean
}

const SHARED_STATUS_KEY = 'practicas:sync-status'

type Listener = () => void

let state: SyncStatus = {
  online: navigator.onLine,
  pending: 0,
  lastSyncAt: null,
  syncing: false,
}

const listeners = new Set<Listener>()
let storageRevision = 0

interface SharedSyncStatus {
  pending: number
  lastSyncAt: string | null
}

export function getStatus(): SyncStatus {
  return state
}

export function setStatus(patch: Partial<SyncStatus>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()

  if ('pending' in patch || 'lastSyncAt' in patch) {
    try {
      localStorage.setItem(
        SHARED_STATUS_KEY,
        JSON.stringify({
          pending: state.pending,
          lastSyncAt: state.lastSyncAt,
          revision: ++storageRevision,
        }),
      )
    } catch {
      // Storage can be unavailable in private browsing or restricted contexts.
    }
  }
}

function parseSharedStatus(raw: string): SharedSyncStatus | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null

    const shared = value as { pending?: unknown; lastSyncAt?: unknown }
    if (
      !Number.isInteger(shared.pending) ||
      (shared.pending as number) < 0 ||
      (shared.lastSyncAt !== null && typeof shared.lastSyncAt !== 'string')
    ) {
      return null
    }

    return {
      pending: shared.pending as number,
      lastSyncAt: shared.lastSyncAt as string | null,
    }
  } catch {
    return null
  }
}

function applySharedStatus(raw: string | null): void {
  if (!raw) return
  const shared = parseSharedStatus(raw)
  if (!shared || (state.pending === shared.pending && state.lastSyncAt === shared.lastSyncAt)) return

  state = { ...state, ...shared }
  for (const listener of listeners) listener()
}

function handleStorage(event: StorageEvent): void {
  if (event.key === SHARED_STATUS_KEY) applySharedStatus(event.newValue)
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', handleStorage)
    try {
      applySharedStatus(localStorage.getItem(SHARED_STATUS_KEY))
    } catch {
      // Keep the in-memory status when storage is unavailable.
    }
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage)
  }
}
