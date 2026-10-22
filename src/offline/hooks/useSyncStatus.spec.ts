import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getStatus, resetSyncStatus, setStatus } from '@/offline/sync/status'
import { useSyncStatus } from './useSyncStatus'

/**
 * `useSyncStatus` no lee Dexie: se apoya en el almacén en memoria de
 * `src/offline/sync/status.ts`. Los tests usan ese mismo almacén (sin mocks)
 * para verificar el estado inicial, los cambios publicados y el reinicio.
 */

const initialStatus = getStatus()

beforeEach(() => {
  resetSyncStatus()
  setStatus({ online: initialStatus.online })
})

afterEach(() => {
  cleanup()
  resetSyncStatus()
  setStatus({ online: initialStatus.online })
})

describe('useSyncStatus', () => {
  it('refleja el estado inicial del almacén', () => {
    const { result } = renderHook(() => useSyncStatus())

    expect(result.current).toEqual(initialStatus)
    expect(result.current).toEqual({ online: true, pending: 0, lastSyncAt: null, syncing: false })
  })

  it('refleja los cambios publicados con setStatus', () => {
    const { result } = renderHook(() => useSyncStatus())

    act(() => {
      setStatus({ pending: 3, syncing: true, lastSyncAt: '2026-04-01T10:00:00.000Z' })
    })

    expect(result.current).toMatchObject({
      pending: 3,
      syncing: true,
      lastSyncAt: '2026-04-01T10:00:00.000Z',
    })
  })

  it('refleja el estado online publicado con setStatus', () => {
    const { result } = renderHook(() => useSyncStatus())

    act(() => {
      setStatus({ online: false })
    })

    expect(result.current.online).toBe(false)
  })

  it('vuelve al estado inicial cuando se reinicia el almacén', () => {
    const { result } = renderHook(() => useSyncStatus())

    act(() => {
      setStatus({ pending: 5, syncing: true, lastSyncAt: '2026-04-01T10:00:00.000Z' })
    })
    expect(result.current.pending).toBe(5)

    act(() => {
      resetSyncStatus()
    })

    expect(result.current).toEqual(initialStatus)
    expect(result.current.pending).toBe(0)
    expect(result.current.syncing).toBe(false)
    expect(result.current.lastSyncAt).toBeNull()
  })

  it('deja de observar el almacén cuando el componente se desmonta', () => {
    const { result, unmount } = renderHook(() => useSyncStatus())
    const before = result.current

    unmount()

    act(() => {
      setStatus({ pending: 9 })
    })

    expect(result.current).toEqual(before)
  })
})
