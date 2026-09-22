import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { pullChanges } from './pull'
import { pushOutbox } from './push'
import { resetRetryConfig, setRetryConfig } from './retryConfig'
import { cancelRetry, getScheduledRetryDelay, isRetryScheduled, startSync, syncNow } from './scheduler'
import { getStatus } from './status'

vi.mock('./pull', () => ({ pullChanges: vi.fn() }))
vi.mock('./push', () => ({ pushOutbox: vi.fn() }))

const mockedPull = vi.mocked(pullChanges)
const mockedPush = vi.mocked(pushOutbox)

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  mockedPull.mockReset()
  mockedPush.mockReset()
  cancelRetry()
  resetRetryConfig()
})

afterEach(() => {
  cancelRetry()
  vi.useRealTimers()
})

describe('syncNow', () => {
  it('no sincroniza sin sesión activa', async () => {
    await syncNow()

    expect(mockedPull).not.toHaveBeenCalled()
    expect(mockedPush).not.toHaveBeenCalled()
  })

  it('hace pull hasta agotar hasMore y luego push cuando hay sesión', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull
      .mockResolvedValueOnce({ applied: 1, hasMore: true })
      .mockResolvedValueOnce({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    await syncNow()

    expect(mockedPull).toHaveBeenCalledTimes(2)
    expect(mockedPush).toHaveBeenCalledTimes(1)
    expect(getStatus().syncing).toBe(false)
  })

  it('reutiliza la corrida en curso si ya hay una sincronización en vuelo', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    await Promise.all([syncNow(), syncNow()])

    expect(mockedPush).toHaveBeenCalledTimes(1)
  })

  it('atrapa errores de red y deja de sincronizar sin propagar la excepción', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockRejectedValue(new Error('sin conexión'))

    await expect(syncNow()).resolves.toBeUndefined()
    expect(getStatus().syncing).toBe(false)
  })
})

describe('retry con backoff exponencial y eventos online/offline', () => {
  it('programa reintentos con esperas crecientes ante fallos sucesivos y respeta el tope', async () => {
    setRetryConfig({
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 4000,
      factor: 2,
    })
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValue(new Error('Error de conexión'))

    // 1er intento fallido (attempts = 1): delay = 1000 * 2^0 = 1000ms
    await db.outbox.add({
      clientOpId: 'op-retry-1',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 1 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 1,
      lastError: 'Error de conexión',
    })

    await syncNow()
    expect(isRetryScheduled()).toBe(true)
    expect(getScheduledRetryDelay()).toBe(1000)

    // 2do intento fallido (attempts = 2): delay = 1000 * 2^1 = 2000ms
    await db.outbox.update(1, { attempts: 2 })
    await syncNow()
    expect(getScheduledRetryDelay()).toBe(2000)

    // 3er intento fallido (attempts = 3): delay = 1000 * 2^2 = 4000ms
    await db.outbox.update(1, { attempts: 3 })
    await syncNow()
    expect(getScheduledRetryDelay()).toBe(4000)

    // 4to intento fallido (attempts = 4): delay sería 8000ms, pero tope es 4000ms
    await db.outbox.update(1, { attempts: 4 })
    await syncNow()
    expect(getScheduledRetryDelay()).toBe(4000)
  })

  it('no programa reintentos si todas las operaciones ya agotaron el número máximo de intentos', async () => {
    setRetryConfig({ maxAttempts: 3 })
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValue(new Error('Fallo'))

    await db.outbox.add({
      clientOpId: 'exhausted',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 2 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 3,
      lastError: 'Fallo permanente',
    })

    await syncNow()
    expect(isRetryScheduled()).toBe(false)
    expect(getScheduledRetryDelay()).toBeNull()
  })

  it('cancela los reintentos programados al recibir el evento offline', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValue(new Error('Fallo de red'))

    await db.outbox.add({
      clientOpId: 'op-cancel',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 3 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 1,
      lastError: 'Fallo de red',
    })

    const stop = startSync()
    await syncNow()
    expect(isRetryScheduled()).toBe(true)

    // Simulamos evento offline del navegador
    window.dispatchEvent(new Event('offline'))

    expect(isRetryScheduled()).toBe(false)
    expect(getStatus().online).toBe(false)

    stop()
  })

  it('reanuda inmediatamente la sincronización al recibir el evento online', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 1, failed: 0 })

    const stop = startSync()
    // Esperamos a que la sincronización inicial de startSync termine
    await new Promise((r) => setTimeout(r, 20))
    mockedPush.mockClear()

    // Simulamos evento online
    window.dispatchEvent(new Event('online'))
    await new Promise((r) => setTimeout(r, 20))

    // syncNow fue invocado de inmediato
    expect(mockedPush).toHaveBeenCalledTimes(1)
    expect(getStatus().online).toBe(true)

    stop()
  })

  it('al cumplirse el intervalo de reintento ejecuta la sincronización programada', async () => {
    setRetryConfig({ initialDelayMs: 40, factor: 1, maxDelayMs: 100 })
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockRejectedValueOnce(new Error('Timeout temporal')).mockResolvedValueOnce({ applied: 1, failed: 0 })

    await db.outbox.add({
      clientOpId: 'op-timer',
      entity: 'hourLog',
      op: 'create',
      payload: { id: 4 },
      baseVersion: null,
      createdAt: new Date().toISOString(),
      attempts: 1,
      lastError: 'Timeout temporal',
    })

    await syncNow()
    expect(isRetryScheduled()).toBe(true)
    expect(getScheduledRetryDelay()).toBe(40)

    mockedPush.mockClear()
    // Esperamos a que venza el temporizador de 40ms
    await new Promise((r) => setTimeout(r, 70))

    expect(mockedPush).toHaveBeenCalledTimes(1)
  })

  it('no solapa sincronizaciones cuando se llama syncNow múltiples veces concurrentes', async () => {
    localStorage.setItem('access_token', 'tok')
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30))
      return { applied: 1, failed: 0 }
    })

    const p1 = syncNow()
    const p2 = syncNow()
    const p3 = syncNow()

    await Promise.all([p1, p2, p3])

    expect(mockedPush).toHaveBeenCalledTimes(1)
  })
})

describe('startSync', () => {
  it('registra los listeners de online/offline y los retira al desmontar', () => {
    mockedPull.mockResolvedValue({ applied: 0, hasMore: false })
    mockedPush.mockResolvedValue({ applied: 0, failed: 0 })

    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const stop = startSync()
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    stop()
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
