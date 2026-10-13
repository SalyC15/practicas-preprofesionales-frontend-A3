import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionCoordinator } from '@/auth/session'
import { ApiError, api } from './client'

beforeEach(() => { localStorage.clear(); sessionCoordinator.start() })
afterEach(() => { sessionCoordinator.stop(); vi.unstubAllGlobals(); localStorage.clear() })

describe('api', () => {
  it('attaches the bearer token and returns parsed json', async () => {
    localStorage.setItem('access_token', 'tok')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api<{ id: number }>('/offers')).resolves.toEqual({ id: 1 })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.get('Authorization')).toBe('Bearer tok')
  })

  it('clears protected credentials on 401 but keeps invalid-login 401 local', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Credenciales inválidas' }) })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('access_token', 'old')
    await expect(api('/auth/login', { method: 'POST' })).rejects.toMatchObject({ statusCode: 401 })
    expect(localStorage.getItem('access_token')).toBe('old')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    expect(fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(false)
    await expect(api('/offers')).rejects.toMatchObject({ statusCode: 401 })
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(sessionCoordinator.getSnapshot().message).toMatch(/sesión expiró/)
  })

  it('does not tear down a rotated credential on a late 401', async () => {
    localStorage.setItem('access_token', 'old')
    let resolve!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done })))
    const pending = api('/offers')
    localStorage.setItem('access_token', 'rotated')
    resolve({ ok: false, status: 401, json: async () => ({}) })
    await expect(pending).rejects.toMatchObject({ statusCode: 401 })
    expect(localStorage.getItem('access_token')).toBe('rotated')
  })

  it('rejects a successful protected response that finishes after teardown', async () => {
    let resolveBody!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => new Promise((done) => { resolveBody = done }),
    }))
    const fence = sessionCoordinator.capture()
    const pending = api('/offers')
    await Promise.resolve()
    sessionCoordinator.unauthorized(fence)
    resolveBody({ privateData: 'previous account' })
    await expect(pending).rejects.toThrow('La sesión cambió')
  })

  it('handles cookie logout with an empty response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('throws ApiError carrying the backend message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ statusCode: 403, message: 'rol insuficiente' }),
    }))

    await expect(api('/offers')).rejects.toMatchObject({ statusCode: 403, message: 'rol insuficiente' })
    await expect(api('/offers')).rejects.toBeInstanceOf(ApiError)
  })
})
