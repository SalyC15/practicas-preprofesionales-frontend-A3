import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { db } from '@/offline/db'
import { enqueue, pushOutbox } from './push'
import { resetRetryConfig, setRetryConfig } from './retryConfig'

vi.mock('@/api/client', () => ({ api: vi.fn() }))

const mockedApi = vi.mocked(api)

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockedApi.mockReset()
  resetRetryConfig()
})

describe('enqueue', () => {
  it('adds an outbox entry and marks the local hour log as queued', async () => {
    await db.hourLogs.put({
      id: 9,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'local',
    })

    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 9, hours: 4 },
      baseVersion: null,
    })

    await expect(db.outbox.count()).resolves.toBe(1)
    await expect(db.hourLogs.get(9)).resolves.toMatchObject({ syncState: 'queued' })
  })
})

describe('pushOutbox', () => {
  it('no llama a la red cuando el outbox está vacío', async () => {
    const result = await pushOutbox()

    expect(result).toEqual({ applied: 0, failed: 0 })
    expect(api).not.toHaveBeenCalled()
  })

  it('envía las operaciones en cola, vacía el outbox y aplica los resultados', async () => {
    await db.hourLogs.put({
      id: 10,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'local',
    })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 10, hours: 4 },
      baseVersion: null,
    })
    const [entry] = await db.outbox.toArray()

    mockedApi.mockResolvedValue({
      results: [{ clientOpId: entry.clientOpId, status: 'applied', server: { id: 10, version: 2 }, reason: null }],
    })

    const result = await pushOutbox()

    expect(result).toEqual({ applied: 1, failed: 0 })
    await expect(db.outbox.count()).resolves.toBe(0)
    await expect(db.hourLogs.get(10)).resolves.toMatchObject({ syncState: 'synced', version: 2 })
  })

  it('no borra la cola cuando el envío falla y registra el intento y último error en outbox', async () => {
    await db.hourLogs.put({
      id: 11,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'local',
    })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 11, hours: 4 },
      baseVersion: null,
    })

    mockedApi.mockRejectedValue(new Error('Fallo de red'))

    await expect(pushOutbox()).rejects.toThrow('Fallo de red')

    // La operación NO se borró
    await expect(db.outbox.count()).resolves.toBe(1)
    const [savedEntry] = await db.outbox.toArray()
    expect(savedEntry.attempts).toBe(1)
    expect(savedEntry.lastError).toBe('Fallo de red')

    // Como aún no agota los intentos (por defecto max 5), sigue en 'queued'
    await expect(db.hourLogs.get(11)).resolves.toMatchObject({ syncState: 'queued' })
  })

  it('tras agotar los reintentos marca la fila local como fallida y no la descarta de la cola', async () => {
    setRetryConfig({ maxAttempts: 2 })

    await db.hourLogs.put({
      id: 12,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Soporte',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T00:00:00.000Z',
      syncState: 'local',
    })
    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 12, hours: 4 },
      baseVersion: null,
    })

    mockedApi.mockRejectedValue(new Error('Servidor inaccesible'))

    // Intento 1
    await expect(pushOutbox()).rejects.toThrow('Servidor inaccesible')
    let [entry] = await db.outbox.toArray()
    expect(entry.attempts).toBe(1)
    await expect(db.hourLogs.get(12)).resolves.toMatchObject({ syncState: 'queued' })

    // Intento 2 (alcanza maxAttempts = 2)
    await expect(pushOutbox()).rejects.toThrow('Servidor inaccesible')
    ;[entry] = await db.outbox.toArray()
    expect(entry.attempts).toBe(2)
    expect(entry.lastError).toBe('Servidor inaccesible')

    // No se descarta de la cola (sigue en outbox)
    await expect(db.outbox.count()).resolves.toBe(1)
    // Pero la fila queda marcada como fallida para el usuario
    await expect(db.hourLogs.get(12)).resolves.toMatchObject({
      syncState: 'failed',
      reviewNote: 'Servidor inaccesible',
    })
  })

  it('no reintenta operaciones que ya agotaron el tope máximo de intentos', async () => {
    setRetryConfig({ maxAttempts: 3 })

    // Insertamos una entrada que ya tiene 3 intentos
    await db.outbox.add({
      clientOpId: 'exhausted-op',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 13 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 3,
      lastError: 'Agotado previamente',
    })

    const result = await pushOutbox()

    expect(result).toEqual({ applied: 0, failed: 0 })
    expect(mockedApi).not.toHaveBeenCalled()
  })

  it('solo elimina del outbox las operaciones confirmadas por el servidor', async () => {
    await db.outbox.bulkAdd([
      {
        clientOpId: 'op-1',
        entity: 'hourLog',
        op: 'create',
        payload: { id: 101 },
        baseVersion: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        attempts: 0,
        lastError: null,
      },
      {
        clientOpId: 'op-2',
        entity: 'hourLog',
        op: 'create',
        payload: { id: 102 },
        baseVersion: null,
        createdAt: '2026-04-01T00:01:00.000Z',
        attempts: 0,
        lastError: null,
      },
    ])

    mockedApi.mockResolvedValue({
      results: [
        { clientOpId: 'op-1', status: 'applied', server: { id: 101, version: 2 }, reason: null },
        { clientOpId: 'op-2', status: 'rejected', server: null, reason: 'Placement no existe' },
      ],
    })

    await pushOutbox()

    // Solo op-1 fue confirmada y eliminada; op-2 permanece en outbox
    const remaining = await db.outbox.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].clientOpId).toBe('op-2')
    expect(remaining[0].lastError).toBe('Placement no existe')
  })
})
