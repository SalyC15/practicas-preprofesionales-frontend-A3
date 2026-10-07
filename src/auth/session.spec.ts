import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionCoordinator } from './session'

const user = { id: 1, email: 'a@example.test', fullName: 'Ana', role: 'STUDENT' as const, companyId: null }
const response = (token = 'first', id = 1, expiresAt = Date.now() + 600_000) => ({ accessToken: token, user: { ...user, id }, expiresAt })
let session: SessionCoordinator
let request: ReturnType<typeof vi.fn>
let purge: ReturnType<typeof vi.fn>
const lock = async <T,>(work: () => Promise<T>) => work()
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  request = vi.fn().mockResolvedValue(response())
  purge = vi.fn().mockResolvedValue(undefined)
  session = new SessionCoordinator({ request, purge, lock })
  session.start()
})
afterEach(() => { session.stop(); vi.useRealTimers(); localStorage.clear() })

describe('session lifecycle', () => {
  it('expires without automatic refresh and aborts the previous generation', async () => {
    request.mockResolvedValue(response('first', 1, Date.now() + 1000))
    await session.login('a', 'password')
    const fence = session.capture()
    await vi.advanceTimersByTimeAsync(1000)
    expect(session.getSnapshot().user).toBeNull()
    expect(session.getSnapshot().message).toMatch(/sesión expiró/)
    expect(fence.signal.aborted).toBe(true)
    expect(session.isCurrent(fence)).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('migrates legacy storage to an atomic snapshot so logout reaches sibling tabs', () => {
    session.stop()
    localStorage.setItem('access_token', 'legacy')
    localStorage.setItem('user', JSON.stringify(user))
    session.start()
    expect(JSON.parse(localStorage.getItem('auth_session')!).accessToken).toBe('legacy')
  })

  it('rejects expired startup credentials and bounds long timers', async () => {
    await session.login('a', 'password')
    session.stop()
    const stored = JSON.parse(localStorage.getItem('auth_session')!)
    localStorage.setItem('auth_session', JSON.stringify({ ...stored, expiresAt: Date.now() - 1 }))
    session.start()
    expect(session.getSnapshot().user).toBeNull()
    await session.login('a', 'password')
    request.mockResolvedValue(response('long', 1, Date.now() + 3_000_000_000))
    await session.refresh()
    await vi.advanceTimersByTimeAsync(2_147_483_647)
    expect(session.getSnapshot().user?.id).toBe(1)
  })

  it('uses JWT exp as a hint and rechecks forward/backward clock changes on focus', async () => {
    const initialTime = Date.now()
    const accessToken = `header.${btoa(JSON.stringify({ exp: Math.floor(initialTime / 1000) + 60 }))}.signature`
    request.mockResolvedValue({ accessToken, user })
    await session.login('a', 'password')
    expect(session.getSnapshot().expiresAt).toBe((Math.floor(initialTime / 1000) + 60) * 1000)
    vi.setSystemTime(initialTime - 60_000)
    window.dispatchEvent(new Event('focus'))
    expect(session.getSnapshot().user?.id).toBe(1)
    vi.setSystemTime(initialTime + 61_000)
    window.dispatchEvent(new Event('focus'))
    expect(session.getSnapshot().user).toBeNull()
  })

  it('stops timers and aborts authenticated work on disposal', async () => {
    await session.login('a', 'password')
    await vi.advanceTimersByTimeAsync(0)
    const fence = session.capture()
    session.stop()
    expect(fence.signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('explicitly renews via cookie without a refresh secret and rotates the fence', async () => {
    await session.login('a', 'password')
    const fence = session.capture()
    request.mockResolvedValue(response('rotated'))
    await session.refresh()
    expect(request).toHaveBeenLastCalledWith('/auth/refresh', expect.objectContaining({ method: 'POST', credentials: 'include' }))
    expect(request.mock.calls.at(-1)?.[1].body).toBeUndefined()
    expect(localStorage.getItem('access_token')).toBe('rotated')
    expect(session.isCurrent(fence)).toBe(false)
  })

  it('never persists an unexpected refresh credential from a server response', async () => {
    request.mockResolvedValue({ ...response(), refreshToken: 'must-not-be-stored' })
    await session.login('a', 'password')
    expect(localStorage.getItem('auth_session')).not.toContain('must-not-be-stored')
  })

  it('clears credentials immediately despite failed purge and revocation; blocks reuse until cleanup succeeds', async () => {
    await session.login('a', 'password')
    purge.mockRejectedValue(new Error('IndexedDB unavailable'))
    request.mockRejectedValue(new Error('offline'))
    const pending = session.logout()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(session.getSnapshot().user).toBeNull()
    await pending
    request.mockResolvedValue(response('second', 2))
    await expect(session.login('b', 'password')).rejects.toThrow(/datos locales/)
    expect(session.getSnapshot().user).toBeNull()
    purge.mockResolvedValue(undefined)
    await session.login('b', 'password')
    expect(session.getSnapshot().user?.id).toBe(2)
  })

  it('immediately fences and clears the previous account while replacement login is pending', async () => {
    await session.login('a', 'password')
    let resolve!: (value: ReturnType<typeof response>) => void
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const pending = session.login('b', 'password')
    expect(session.getSnapshot().user).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
    await vi.advanceTimersByTimeAsync(0)
    resolve(response('second', 2))
    await pending
    expect(session.getSnapshot().user?.id).toBe(2)
  })

  it('purges before installing a replacement account', async () => {
    await session.login('a', 'password')
    request.mockResolvedValue(response('second', 2))
    await session.login('b', 'password')
    expect(purge).toHaveBeenCalled()
    expect(session.getSnapshot().user?.id).toBe(2)
  })

  it.each(['login', 'refresh'] as const)('blocks a late %s response after logout', async (operation) => {
    await session.login('a', 'password')
    let resolve!: (value: ReturnType<typeof response>) => void
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const pending = operation === 'login' ? session.login('b', 'password') : session.refresh()
    await Promise.resolve()
    await session.logout()
    resolve(response('late', 2))
    await expect(pending).rejects.toThrow()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('blocks the earlier of two overlapping login responses', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const first = session.login('a', 'password')
    await vi.advanceTimersByTimeAsync(0)
    request.mockResolvedValue(response('second', 2))
    await session.login('b', 'password')
    resolve(response('old', 1))
    await expect(first).rejects.toThrow()
    expect(session.getSnapshot().user?.id).toBe(2)
  })

  it('keeps sibling replacement credentials unavailable when purge fails', async () => {
    await session.login('a', 'password')
    purge.mockRejectedValue(new Error('cleanup failed'))
    localStorage.setItem('auth_session', JSON.stringify({ ...response('other', 2), revision: 'other' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_session', storageArea: localStorage }))
    await vi.advanceTimersByTimeAsync(0)
    expect(session.getSnapshot().user).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(session.getSnapshot().message).toMatch(/datos locales/)
  })

  it('accepts sibling rotation, ignores stale 401 and signs out on sibling removal', async () => {
    await session.login('a', 'password')
    const old = session.capture()
    const stored = JSON.parse(localStorage.getItem('auth_session')!)
    localStorage.setItem('auth_session', JSON.stringify({ ...stored, accessToken: 'sibling', revision: 'new' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_session', storageArea: localStorage }))
    await Promise.resolve()
    expect(session.getSnapshot().accessToken).toBe('sibling')
    session.unauthorized(old)
    expect(session.getSnapshot().user?.id).toBe(1)
    localStorage.removeItem('auth_session')
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_session', storageArea: localStorage }))
    expect(session.getSnapshot().user).toBeNull()
    expect(purge).toHaveBeenCalled()
  })

  it('fences a pending anonymous login when another tab signs out', async () => {
    const sibling = new SessionCoordinator({ request, purge, lock })
    let resolve!: (value: ReturnType<typeof response>) => void
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const pending = session.login('a', 'password')
    await vi.advanceTimersByTimeAsync(0)
    await sibling.logout()
    resolve(response('late'))
    await expect(pending).rejects.toThrow()
    expect(localStorage.getItem('access_token')).toBeNull()
    sibling.stop()
  })

  it('blocks a response when sibling logout bytes change before the storage event arrives', async () => {
    await session.login('a', 'password')
    let resolve!: (value: ReturnType<typeof response>) => void
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const pending = session.refresh()
    await Promise.resolve()
    localStorage.removeItem('auth_session')
    resolve(response('late'))
    await expect(pending).rejects.toThrow()
    expect(localStorage.getItem('auth_session')).toBeNull()
  })

  it('fences pending responses on cross-tab account change and purges', async () => {
    await session.login('a', 'password')
    let resolve!: (value: ReturnType<typeof response>) => void
    request.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const pending = session.refresh()
    await Promise.resolve()
    localStorage.setItem('auth_session', JSON.stringify({ ...response('other', 2), revision: 'other' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_session', storageArea: localStorage }))
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    resolve(response('late'))
    await expect(pending).rejects.toThrow()
    expect(purge).toHaveBeenCalled()
    expect(session.getSnapshot().user?.id).toBe(2)
  })
})
