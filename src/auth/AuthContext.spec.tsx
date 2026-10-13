import type { ReactNode } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireRole } from './RequireRole'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { AuthProvider, useAuth } from './AuthContext'

const fetchMock = vi.fn()
function mockLogin() {
  fetchMock.mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ accessToken: 'tok-123', user: { id: 5, email: 'empresa0@miyura.com', fullName: 'Empresa 0', role: 'COMPANY', companyId: 1 } }),
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

function withProvider({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth(), { wrapper })).toThrow('useAuth debe usarse dentro de AuthProvider')
  })
})

describe('AuthProvider', () => {
  it('does not redirect a restored session before hydration finishes', () => {
    localStorage.setItem('access_token', 'legacy-token')
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'STUDENT' }))
    render(<MemoryRouter initialEntries={['/protected']}><AuthProvider><Routes>
      <Route path="/protected" element={<RequireRole roles={['STUDENT']}>Sesión restaurada</RequireRole>} />
      <Route path="/login" element={<div>Pantalla de login</div>} />
    </Routes></AuthProvider></MemoryRouter>)
    expect(screen.queryByText('Pantalla de login')).toBeNull()
    expect(screen.getByText('Sesión restaurada')).toBeInTheDocument()
  })
  it('starts with no user when localStorage is empty', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    expect(result.current.user).toBeNull()
    expect(result.current.role).toBeNull()
  })

  it('restores a valid stored user with an access token on init', () => {
    localStorage.setItem('access_token', 'legacy-token')
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 1, email: 'coordinador@miyura.com', fullName: 'Coordinación', role: 'COORDINATOR', companyId: null }),
    )
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    expect(result.current.user?.email).toBe('coordinador@miyura.com')
    expect(result.current.role).toBe('COORDINATOR')
  })

  it('ignores a corrupted stored user instead of throwing', () => {
    localStorage.setItem('user', '{not-json')
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    expect(result.current.user).toBeNull()
  })

  it('login stores the token and user, and updates the context', async () => {
    mockLogin()
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })

    await act(async () => {
      await result.current.login('empresa0@miyura.com', 'yura1234')
    })

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/login'), expect.objectContaining({
      method: 'POST', credentials: 'include', signal: expect.any(AbortSignal),
      body: JSON.stringify({ email: 'empresa0@miyura.com', password: 'yura1234' }),
    }))
    expect(localStorage.getItem('access_token')).toBe('tok-123')
    expect(result.current.user?.companyId).toBe(1)
    expect(result.current.role).toBe('COMPANY')
  })

  it('logout clears storage and the context', async () => {
    mockLogin()
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    await act(async () => {
      await result.current.login('empresa0@miyura.com', 'yura1234')
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('logout wipes local Dexie data, including the sync checkpoint, so the next session starts clean', async () => {
    // Simula datos dejados en el dispositivo por la sesión anterior: filas de
    // otro estudiante y el checkpoint global de sync (db.ts) que, sin
    // espacio de nombres por usuario, filtraría lo que la siguiente sesión
    // puede recibir del pull si sobreviviera al logout.
    await db.placements.put({
      id: 1,
      studentId: 99,
      tutorId: 1,
      companyId: 1,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      requiredHours: 200,
      status: 'ACTIVE',
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.meta.put({ key: 'syncCheckpoint', value: '2026-01-01T00:00:00.000Z' })

    mockLogin()
    const { result } = renderHook(() => useAuth(), { wrapper: withProvider })
    await act(async () => {
      await result.current.login('empresa0@miyura.com', 'yura1234')
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(await db.placements.count()).toBe(0)
    expect(await db.meta.count()).toBe(0)
  })
})
