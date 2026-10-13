import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { LoginPage } from './LoginPage'

beforeEach(() => localStorage.clear())
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

it('shows a clear Spanish message on startup expiry', async () => {
  localStorage.setItem('auth_session', JSON.stringify({
    accessToken: 'expired', user: { id: 1, role: 'STUDENT' },
    expiresAt: Date.now() - 1, revision: 'expired',
  }))
  render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>)
  expect(await screen.findByRole('status')).toHaveTextContent('Tu sesión expiró. Volvé a iniciar sesión')
  expect(localStorage.getItem('access_token')).toBeNull()
})

it('keeps invalid credentials local to the form', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false, status: 401, json: async () => ({ message: 'Correo o contraseña incorrectos' }),
  }))
  render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'a@example.test' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos'))
  expect(screen.queryByText(/Tu sesión expiró/)).toBeNull()
})
