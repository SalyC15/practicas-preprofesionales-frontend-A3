import { describe, expect, it, vi } from 'vitest'
import { getStatus, setStatus, subscribe } from './status'

describe('sync status store', () => {
  it('merges a partial patch into the current status', () => {
    setStatus({ pending: 3 })
    expect(getStatus()).toMatchObject({ pending: 3 })

    setStatus({ syncing: true })
    expect(getStatus()).toMatchObject({ pending: 3, syncing: true })
  })

  it('notifies subscribers on every update and stops after unsubscribing', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setStatus({ online: false })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setStatus({ online: true })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('applies the shared pending count and last sync received from another tab', () => {
    setStatus({ pending: 0, lastSyncAt: null })
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'practicas:sync-status',
        newValue: JSON.stringify({ pending: 4, lastSyncAt: '2026-09-23T12:00:00.000Z', revision: 1 }),
      }),
    )

    expect(getStatus()).toMatchObject({ pending: 4, lastSyncAt: '2026-09-23T12:00:00.000Z' })
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })
})
