import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionCoordinator } from './session'

export type Role = 'STUDENT' | 'TUTOR' | 'COMPANY' | 'COORDINATOR'

export interface AuthUser {
  id: number
  email: string
  fullName: string
  role: Role
  // Only COMPANY users have a companyId.
  companyId: number | null
}

interface AuthContextValue {
  user: AuthUser | null
  role: Role | null
  sessionMessage: string | null
  expiresAt: number | null
  renewing: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(sessionCoordinator.subscribe, sessionCoordinator.getSnapshot)
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    sessionCoordinator.start()
    setReady(true)
    return sessionCoordinator.stop
  }, [])
  useEffect(() => {
    if (!state.user && state.message) navigate('/login', { replace: true })
  }, [state.user, state.message, navigate])

  async function logout() {
    const pending = sessionCoordinator.logout()
    navigate('/login', { replace: true })
    await pending
  }

  // Protected routes must not render a redirect while startup hydration is pending.
  if (!ready) return null

  return (
    <AuthContext.Provider value={{
      user: state.user, role: state.user?.role ?? null,
      sessionMessage: state.message, expiresAt: state.expiresAt, renewing: state.renewing,
      login: sessionCoordinator.login, logout, refresh: sessionCoordinator.refresh,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
