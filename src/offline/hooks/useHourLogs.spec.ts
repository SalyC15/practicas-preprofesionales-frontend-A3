import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type LocalHourLog } from '@/offline/db'
import { useHourLogs } from './useHourLogs'

/**
 * Tests del hook real: `useLiveQuery` de dexie-react-hooks consulta Dexie de
 * verdad sobre `fake-indexeddb`. No hay mocks del hook ni de las consultas.
 */

function hourLog(overrides: Partial<LocalHourLog> = {}): LocalHourLog {
  return {
    id: 1,
    placementId: 10,
    date: '2026-04-01',
    startTime: '08:00',
    endTime: '12:00',
    hours: 4,
    activity: 'Soporte en laboratorio',
    status: 'SUBMITTED',
    reviewNote: null,
    version: 1,
    updatedAt: '2026-04-01T12:00:00.000Z',
    syncState: 'synced',
    ...overrides,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(async () => {
  // Desmontar antes de borrar la base evita que una liveQuery viva reciba el
  // cierre de la base y dispare un error fuera de la prueba.
  cleanup()
  await db.delete()
  await db.open()
})

describe('useHourLogs', () => {
  it('devuelve undefined mientras la primera lectura de Dexie sigue pendiente', async () => {
    const seen: (LocalHourLog[] | undefined)[] = []
    renderHook(() => {
      const value = useHourLogs(10)
      seen.push(value)
      return value
    })

    expect(seen[0]).toBeUndefined()
    await waitFor(() => expect(seen[seen.length - 1]).toEqual([]))
  })

  it('devuelve las horas guardadas del placement ordenadas por fecha', async () => {
    await db.hourLogs.bulkAdd([
      hourLog({ id: 1, date: '2026-04-01' }),
      hourLog({ id: 3, date: '2026-04-03' }),
      hourLog({ id: 2, date: '2026-04-02' }),
    ])

    const { result } = renderHook(() => useHourLogs(10))

    await waitFor(() => expect(result.current).toHaveLength(3))
    expect(result.current?.map((log) => log.id)).toEqual([1, 2, 3])
    expect(result.current?.map((log) => log.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })

  it('devuelve un arreglo vacío cuando el placement no tiene horas guardadas', async () => {
    const { result } = renderHook(() => useHourLogs(10))

    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('devuelve solamente las horas del placement pedido', async () => {
    await db.hourLogs.bulkAdd([
      hourLog({ id: 1, placementId: 10 }),
      hourLog({ id: 2, placementId: 20, date: '2026-04-02' }),
      hourLog({ id: 3, placementId: 10, date: '2026-04-03' }),
    ])

    const { result } = renderHook(() => useHourLogs(10))

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current?.every((log) => log.placementId === 10)).toBe(true)
  })

  it('no devuelve las horas de otro placement cuando se consulta uno distinto', async () => {
    await db.hourLogs.bulkAdd([
      hourLog({ id: 1, placementId: 10 }),
      hourLog({ id: 2, placementId: 20, date: '2026-04-02' }),
    ])

    const { result } = renderHook(() => useHourLogs(20))

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]).toMatchObject({ id: 2, placementId: 20 })
  })

  it('se actualiza de forma reactiva cuando se escribe una hora después del render', async () => {
    const { result } = renderHook(() => useHourLogs(10))
    await waitFor(() => expect(result.current).toEqual([]))

    await act(async () => {
      await db.hourLogs.add(hourLog({ id: 7 }))
    })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]).toMatchObject({ id: 7, placementId: 10 })
  })

  it('se actualiza de forma reactiva cuando se borra una hora después del render', async () => {
    await db.hourLogs.add(hourLog({ id: 7 }))
    const { result } = renderHook(() => useHourLogs(10))
    await waitFor(() => expect(result.current).toHaveLength(1))

    await act(async () => {
      await db.hourLogs.delete(7)
    })

    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('reacciona a los cambios de otro placement sin alterar el resultado filtrado', async () => {
    await db.hourLogs.add(hourLog({ id: 1, placementId: 10 }))
    const { result } = renderHook(() => useHourLogs(10))
    await waitFor(() => expect(result.current).toHaveLength(1))

    await act(async () => {
      await db.hourLogs.add(hourLog({ id: 2, placementId: 20, date: '2026-04-02' }))
    })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0]).toMatchObject({ id: 1, placementId: 10 })
  })
})
