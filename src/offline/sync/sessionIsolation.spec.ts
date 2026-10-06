import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { db } from '@/offline/db'
import { sessionCoordinator, SessionCoordinator } from '@/auth/session'
import { pullChanges } from './pull'
import { enqueue, pushOutbox } from './push'
import { getStatus, setStatus } from './status'

vi.mock('@/api/client', () => ({
  api: vi.fn(),
}))

const mockedApi = vi.mocked(api)

const userA = { id: 1, email: 'a@example.test', fullName: 'Ana', role: 'STUDENT' as const, companyId: null }
const userB = { id: 2, email: 'b@example.test', fullName: 'Bob', role: 'STUDENT' as const, companyId: null }

beforeEach(async () => {
  sessionCoordinator.stop()
  localStorage.clear()
  await db.delete()
  await db.open()
  mockedApi.mockReset()
  setStatus({ pending: 0, syncing: false, lastSyncAt: null, online: true })
})

describe('T3 offline-sync session isolation', () => {
  it('drops delayed pull results after signout/purge and leaves Dexie clean', async () => {
    let resolvePull!: (val: unknown) => void
    mockedApi.mockImplementationOnce(() => new Promise((resolve) => { resolvePull = resolve }))

    localStorage.setItem('access_token', 'token-a')
    localStorage.setItem('user', JSON.stringify(userA))
    sessionCoordinator.start()

    const pendingPull = pullChanges()
    await vi.waitFor(() => expect(mockedApi).toHaveBeenCalled())

    // Sign out while pull is in flight
    await sessionCoordinator.logout()

    // Delayed pull response arrives after teardown
    resolvePull({
      changes: {
        placements: [],
        hourLogs: [
          {
            id: 101,
            placementId: 1,
            date: '2026-04-01',
            startTime: '08:00',
            endTime: '12:00',
            hours: 4,
            activity: 'Tarea de usuario A',
            status: 'SUBMITTED',
            version: 1,
            updatedAt: '2026-04-01T12:00:00.000Z',
          },
        ],
        documents: [],
        evaluations: [],
      },
      checkpoint: 'cp-user-a',
      hasMore: false,
    })

    const result = await pendingPull
    expect(result.applied).toBe(0)
    await expect(db.hourLogs.count()).resolves.toBe(0)
    await expect(db.meta.get('checkpoint')).resolves.toBeUndefined()
  })

  it('drops delayed push success after teardown and does not write previous-user data', async () => {
    localStorage.setItem('access_token', 'token-a')
    localStorage.setItem('user', JSON.stringify(userA))
    sessionCoordinator.start()

    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 201, hours: 3 },
      baseVersion: null,
    })

    let resolvePush!: (val: unknown) => void
    mockedApi.mockImplementationOnce(() => new Promise((resolve) => { resolvePush = resolve }))

    const pendingPush = pushOutbox()
    await vi.waitFor(() => expect(mockedApi).toHaveBeenCalled())

    // Teardown during in-flight push
    await sessionCoordinator.logout()

    resolvePush({
      results: [
        {
          clientOpId: 'any',
          status: 'applied',
          server: { id: 201, version: 1 },
          reason: null,
        },
      ],
    })

    const result = await pendingPush
    expect(result.applied).toBe(0)
    await expect(db.hourLogs.count()).resolves.toBe(0)
    await expect(db.outbox.count()).resolves.toBe(0)
  })

  it('suppresses push retry bookkeeping on catch after teardown so outbox is not recreated', async () => {
    localStorage.setItem('access_token', 'token-a')
    localStorage.setItem('user', JSON.stringify(userA))
    sessionCoordinator.start()

    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 301, hours: 2 },
      baseVersion: null,
    })

    let rejectPush!: (err: unknown) => void
    mockedApi.mockImplementationOnce(() => new Promise((_, reject) => { rejectPush = reject }))

    const pendingPush = pushOutbox()
    await vi.waitFor(() => expect(mockedApi).toHaveBeenCalled())

    // Teardown occurs while request is in flight
    await sessionCoordinator.logout()

    // In-flight network request rejects
    rejectPush(new Error('Network disconnected'))

    await expect(pendingPush).rejects.toThrow()
    await expect(db.outbox.count()).resolves.toBe(0)
  })

  it('aborts in-flight sync on sibling storage logout and resets sync status', async () => {
    localStorage.setItem('access_token', 'token-a')
    localStorage.setItem('user', JSON.stringify(userA))
    sessionCoordinator.start()
    setStatus({ pending: 2, lastSyncAt: '2026-04-01T10:00:00.000Z' })

    await db.hourLogs.put({
      id: 401,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Actividad',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T12:00:00.000Z',
      syncState: 'synced',
    })
    await db.meta.put({ key: 'checkpoint', value: 'cp-sibling-test' })

    // Sibling logs out via localStorage
    localStorage.removeItem('auth_session')
    localStorage.removeItem('access_token')
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_session', storageArea: localStorage }))

    await Promise.resolve()
    // Give async cleanup a tick to complete
    await new Promise((r) => setTimeout(r, 50))

    await expect(db.hourLogs.count()).resolves.toBe(0)
    await expect(db.meta.get('checkpoint')).resolves.toBeUndefined()
    expect(getStatus()).toMatchObject({ pending: 0, lastSyncAt: null, syncing: false })
  })

  it('cancels obsolete in-flight sync on renewal without wiping user local data', async () => {
    let resolveRefreshReq!: (val: unknown) => void
    const mockRequest = vi.fn().mockImplementation((path: string) => {
      if (path === '/auth/refresh') {
        return new Promise((resolve) => { resolveRefreshReq = resolve })
      }
      return Promise.resolve({ ok: true })
    })

    const customSession = new SessionCoordinator({
      request: mockRequest,
      purge: async () => {
        await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) await table.clear()
        })
      },
      lock: async (work) => work(),
    })

    localStorage.setItem('access_token', 'token-initial')
    localStorage.setItem('user', JSON.stringify(userA))
    customSession.start()

    await db.hourLogs.put({
      id: 501,
      placementId: 1,
      date: '2026-04-01',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Actividad del usuario',
      status: 'SUBMITTED',
      version: 1,
      updatedAt: '2026-04-01T12:00:00.000Z',
      syncState: 'synced',
    })

    const oldFence = customSession.capture()
    let resolvePull!: (val: unknown) => void
    mockedApi.mockImplementationOnce(() => new Promise((resolve) => { resolvePull = resolve }))

    const pendingPull = pullChanges(oldFence)
    await vi.waitFor(() => expect(mockedApi).toHaveBeenCalled())

    // Trigger renewal
    const pendingRefresh = customSession.refresh()
    resolveRefreshReq({
      accessToken: 'token-renewed',
      user: userA,
      expiresAt: Date.now() + 600_000,
    })
    await pendingRefresh

    // Sibling/old fence is no longer current
    expect(customSession.isCurrent(oldFence)).toBe(false)

    // Delayed pull arrives
    resolvePull({
      changes: {
        placements: [],
        hourLogs: [
          {
            id: 502,
            placementId: 1,
            date: '2026-04-02',
            startTime: '08:00',
            endTime: '12:00',
            hours: 4,
            activity: 'Obsolete pull',
            status: 'SUBMITTED',
            version: 1,
            updatedAt: '2026-04-02T12:00:00.000Z',
          },
        ],
        documents: [],
        evaluations: [],
      },
      checkpoint: 'cp-obsolete',
      hasMore: false,
    })

    const pullResult = await pendingPull
    expect(pullResult.applied).toBe(0)

    // User's own data is NOT wiped
    await expect(db.hourLogs.get(501)).resolves.toMatchObject({ id: 501, activity: 'Actividad del usuario' })
    // Obsolete pull row was NOT applied
    await expect(db.hourLogs.get(502)).resolves.toBeUndefined()

    customSession.stop()
  })

  it('resets pending, checkpoint, and status so a subsequent new-user login sees nothing old', async () => {
    localStorage.setItem('access_token', 'token-a')
    localStorage.setItem('user', JSON.stringify(userA))
    sessionCoordinator.start()

    await enqueue({
      entity: 'hourLog',
      op: 'create',
      payload: { id: 601, hours: 5 },
      baseVersion: null,
    })
    await db.meta.put({ key: 'checkpoint', value: 'cp-user-a' })
    setStatus({ pending: 1, lastSyncAt: '2026-04-01T10:00:00.000Z' })

    // User A logs out
    await sessionCoordinator.logout()

    expect(getStatus()).toMatchObject({ pending: 0, lastSyncAt: null, syncing: false })
    await expect(db.outbox.count()).resolves.toBe(0)
    await expect(db.meta.get('checkpoint')).resolves.toBeUndefined()
    await expect(db.hourLogs.count()).resolves.toBe(0)

    // User B logs in
    mockedApi.mockResolvedValueOnce({
      accessToken: 'token-b',
      user: userB,
      expiresAt: Date.now() + 600_000,
    })
    await sessionCoordinator.login('bob@example.test', 'password')

    // New user environment is clean
    await expect(db.outbox.count()).resolves.toBe(0)
    await expect(db.meta.get('checkpoint')).resolves.toBeUndefined()
    expect(getStatus().pending).toBe(0)
  })
})
