const SYNC_LOCK_NAME = 'practicas-offline-sync'

type AsyncLockManager = {
  request<T>(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>,
  ): Promise<T>
}

/** Serializa las sincronizaciones entre pestañas del mismo origen. */
export function withSyncLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return operation()
  const locks = navigator.locks as unknown as AsyncLockManager
  return locks.request(SYNC_LOCK_NAME, { mode: 'exclusive' }, () => operation())
}
