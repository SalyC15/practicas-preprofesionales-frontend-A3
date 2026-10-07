import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { AppLayout } from './AppLayout'

vi.mock('@/offline/sync/scheduler', () => ({ startSync: () => () => {} }))
vi.mock('@/components/SyncIndicator', () => ({ SyncIndicator: () => null }))
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

it('renews only on an explicit action and publishes the rotated token', async () => {
  const user = { id: 1, email: 'a@example.test', fullName: 'Ana', role: 'STUDENT', companyId: null }
  localStorage.setItem('auth_session', JSON.stringify({ accessToken: 'old', user, expiresAt: Date.now() + 60_000, revision: 'old' }))
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ accessToken: 'rotated', user, expiresAt: Date.now() + 120_000 }),
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, work: () => Promise<unknown>) => work() } })
  render(<MemoryRouter><AuthProvider><AppLayout /></AuthProvider></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('Podés renovarla antes de que expire')
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Renovar sesión' }))
  await waitFor(() => expect(localStorage.getItem('access_token')).toBe('rotated'))
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.objectContaining({ method: 'POST', credentials: 'include' }))
})
