import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { db, type LocalPlacement } from '@/offline/db'
import { usePlacement } from './usePlacement'

/**
 * Tests del hook real: `usePlacement` consulta Dexie de verdad sobre
 * `fake-indexeddb` y usa el `AuthProvider` real (el mismo patrón que
 * `src/auth/AuthContext.spec.tsx`): la sesión se restaurá desde
 * `localStorage`, sin mockear el módulo de auth ni las consultas de Dexie.
 */

function placement(overrides: Partial<LocalPlacement> = {}): LocalPlacement {
  return {
    id: 100,
    studentId: 1,
    tutorId: 5,
    companyId: 7,
    startDate: '2026-03-01',
    endDate: '2026-06-30',
    requiredHours: 120,
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-03-01T00:00:00.000Z',
    companyName: 'Empresa Uno',
    tutorName: 'Tutor Uno',
    ...overrides,
  }
}

function signIn(user: { id: number; role: string }) {
  localStorage.setItem('access_token', 'legacy-token')
  localStorage.setItem('user', JSON.stringify({
    id: user.id,
    email: 'estudiante@miyura.com',
    fullName: 'Estudiante Uno',
    role: user.role,
    companyId: null,
  }))
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, createElement(AuthProvider, null, children))
}

beforeEach(async () => {
  localStorage.clear()
  await db.delete()
  await db.open()
})

afterEach(async () => {
  // Desmontar antes de borrar la base evita que una liveQuery viva reciba el
  // cierre de la base y dispare un error fuera de la prueba.
  cleanup()
  localStorage.clear()
  await db.delete()
  await db.open()
})

describe('usePlacement', () => {
  it('devuelve undefined mientras la consulta del placement sigue pendiente', async () => {
    signIn({ id: 1, role: 'STUDENT' })
    await db.placements.add(placement())

    const seen: (LocalPlacement | null | undefined)[] = []
    renderHook(() => {
      const value = usePlacement()
      seen.push(value)
      return value
    }, { wrapper })

    expect(seen[0]).toBeUndefined()
    await waitFor(() => expect(seen[seen.length - 1]).toMatchObject({ id: 100 }))
  })

  it('devuelve el placement del estudiante autenticado', async () => {
    signIn({ id: 1, role: 'STUDENT' })
    await db.placements.add(placement({ id: 100, studentId: 1 }))

    const { result } = renderHook(() => usePlacement(), { wrapper })

    await waitFor(() => expect(result.current).toMatchObject({ id: 100, studentId: 1 }))
    expect(result.current?.companyName).toBe('Empresa Uno')
  })

  it('devuelve null cuando el estudiante no tiene ningún placement guardado', async () => {
    signIn({ id: 1, role: 'STUDENT' })

    const { result } = renderHook(() => usePlacement(), { wrapper })

    await waitFor(() => expect(result.current).toBeNull())
  })

  it('devuelve solamente el placement del estudiante autenticado', async () => {
    signIn({ id: 1, role: 'STUDENT' })
    await db.placements.bulkAdd([
      placement({ id: 100, studentId: 1, companyName: 'Empresa Uno' }),
      placement({ id: 200, studentId: 2, companyName: 'Empresa Dos' }),
    ])

    const { result } = renderHook(() => usePlacement(), { wrapper })

    await waitFor(() => expect(result.current).toMatchObject({ id: 100 }))
    expect(result.current?.studentId).toBe(1)
    expect(result.current?.companyName).toBe('Empresa Uno')
  })

  it('devuelve null cuando el usuario autenticado no es un estudiante', async () => {
    signIn({ id: 1, role: 'TUTOR' })
    await db.placements.add(placement({ id: 100, studentId: 1 }))

    const { result } = renderHook(() => usePlacement(), { wrapper })

    await waitFor(() => expect(result.current).toBeNull())
  })

  it('devuelve null cuando no hay usuario autenticado', async () => {
    const { result } = renderHook(() => usePlacement(), { wrapper })

    await waitFor(() => expect(result.current).toBeNull())
  })

  it('se actualiza de forma reactiva cuando se guarda un placement después del render', async () => {
    signIn({ id: 1, role: 'STUDENT' })

    const { result } = renderHook(() => usePlacement(), { wrapper })
    await waitFor(() => expect(result.current).toBeNull())

    await act(async () => {
      await db.placements.add(placement({ id: 100, studentId: 1 }))
    })

    await waitFor(() => expect(result.current).toMatchObject({ id: 100, studentId: 1 }))
  })

  it('se actualiza de forma reactiva cuando se borra el placement después del render', async () => {
    signIn({ id: 1, role: 'STUDENT' })
    await db.placements.add(placement({ id: 100, studentId: 1 }))

    const { result } = renderHook(() => usePlacement(), { wrapper })
    await waitFor(() => expect(result.current).toMatchObject({ id: 100 }))

    await act(async () => {
      await db.placements.delete(100)
    })

    await waitFor(() => expect(result.current).toBeNull())
  })
})
