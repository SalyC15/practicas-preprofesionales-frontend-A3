import { api } from '@/api/client'
import { db } from '@/offline/db'
import { resetSyncStatus } from '@/offline/sync/status'
import { withSyncLock } from '@/offline/sync/syncLock'
import type { AuthUser } from './AuthContext'

const SESSION_KEY = 'auth_session'
const CLEANUP_KEY = 'auth_cleanup_pending'
const EXPIRED_MESSAGE = 'Tu sesión expiró. Volvé a iniciar sesión para continuar.'
const CLEANUP_MESSAGE = 'No se pudieron borrar los datos locales. Intentá iniciar sesión de nuevo.'
const MAX_TIMER = 2_147_483_647

export interface SessionResponse {
  accessToken: string
  user: AuthUser
  // Absolute Unix milliseconds or ISO 8601; JWT exp remains a UX hint, not authorization.
  expiresAt?: number | string
}
interface StoredSession extends SessionResponse { revision: string }
interface SessionState {
  user: AuthUser | null
  accessToken: string | null
  expiresAt: number | null
  message: string | null
  renewing: boolean
}
export interface SessionFence {
  readonly generation: number
  readonly signal: AbortSignal
  readonly storageSnapshot: string | null
  readonly isCurrent?: () => boolean
}

export function isFenceCurrent(fence?: SessionFence): boolean {
  if (!fence) return false
  if (typeof fence.isCurrent === 'function') return fence.isCurrent()
  return sessionCoordinator.isCurrent(fence)
}
interface Dependencies {
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  purge: () => Promise<void>
  lock: <T>(work: () => Promise<T>) => Promise<T>
}

function expiryOf(session: SessionResponse): number | null {
  if (session.expiresAt !== undefined) {
    const value = typeof session.expiresAt === 'number' ? session.expiresAt : Date.parse(session.expiresAt)
    if (!Number.isFinite(value)) throw new Error('La sesión recibida no es válida.')
    return value
  }
  try {
    const payload = session.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const exp: unknown = JSON.parse(atob(payload)).exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
  } catch { return null } // Legacy tokens have no expiry until T2 ships.
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const value = raw ? JSON.parse(raw) : {
      accessToken: localStorage.getItem('access_token'),
      user: JSON.parse(localStorage.getItem('user') ?? 'null'), revision: 'legacy',
    }
    if (typeof value.accessToken !== 'string' || !value.accessToken ||
        !Number.isInteger(value.user?.id) || !['STUDENT', 'TUTOR', 'COMPANY', 'COORDINATOR'].includes(value.user?.role)) return null
    expiryOf(value)
    return value
  } catch { return null }
}

function readSignoutMessage(): string | null | undefined {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    if (stored?.signedOut === true) return typeof stored.message === 'string' ? stored.message : null
  } catch { /* Malformed storage is handled as an invalid session by startup. */ }
  return undefined
}

export class SessionCoordinator {
  private state: SessionState = { user: null, accessToken: null, expiresAt: null, message: null, renewing: false }
  private generation = 0
  private controller = new AbortController()
  private revision: string | null = null
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private active = false
  private cleanup: Promise<void> = Promise.resolve()
  private cleanupFailed = false
  private revocations = new Map<AbortController, ReturnType<typeof setTimeout>>()

  constructor(private readonly dependencies: Dependencies) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  capture = (): SessionFence => {
    const generation = this.generation
    const signal = this.controller.signal
    const storageSnapshot = localStorage.getItem(SESSION_KEY)
    return {
      generation,
      signal,
      storageSnapshot,
      isCurrent: () =>
        this.generation === generation &&
        !signal.aborted &&
        storageSnapshot === localStorage.getItem(SESSION_KEY),
    }
  }
  isCurrent = (fence: SessionFence) =>
    fence.isCurrent ? fence.isCurrent() : (
      fence.generation === this.generation &&
      !fence.signal.aborted &&
      fence.storageSnapshot === localStorage.getItem(SESSION_KEY)
    )

  private publish(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  private invalidate() {
    clearTimeout(this.timer)
    this.controller.abort()
    this.controller = new AbortController()
    this.generation++
  }
  private assertCurrent(fence: SessionFence) {
    if (!this.isCurrent(fence)) throw new Error('La sesión cambió. Volvé a intentarlo.')
  }
  private queuePurge(): Promise<void> {
    localStorage.setItem(CLEANUP_KEY, 'true')
    this.cleanup = this.cleanup.then(async () => {
      try {
        await this.dependencies.purge()
        this.cleanupFailed = false
        localStorage.removeItem(CLEANUP_KEY)
      } catch {
        this.cleanupFailed = true
        this.publish({ message: CLEANUP_MESSAGE })
      }
    })
    return this.cleanup
  }
  private clear(message: string | null, broadcast = true) {
    this.invalidate()
    this.revision = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    // A unique tombstone also fences login requests started while already signed out.
    if (broadcast) localStorage.setItem(SESSION_KEY, JSON.stringify({ signedOut: true, revision: crypto.randomUUID(), message }))
    this.publish({ user: null, accessToken: null, expiresAt: null, message, renewing: false })
    resetSyncStatus()
    return this.queuePurge()
  }

  start = () => {
    if (this.active) return
    this.active = true
    window.addEventListener('storage', this.onStorage)
    window.addEventListener('focus', this.checkExpiry)
    document.addEventListener('visibilitychange', this.checkExpiry)
    const stored = readStored()
    const signoutMessage = readSignoutMessage()
    if (localStorage.getItem(CLEANUP_KEY)) {
      void this.clear(CLEANUP_MESSAGE)
    } else if (stored) {
      const legacy = !localStorage.getItem(SESSION_KEY)
      this.install(legacy ? { ...stored, revision: crypto.randomUUID() } : stored, legacy)
    } else if (signoutMessage !== undefined) {
      this.invalidate()
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      this.publish({ user: null, accessToken: null, expiresAt: null, message: signoutMessage, renewing: false })
    } else if (localStorage.getItem('access_token') || localStorage.getItem('user') || localStorage.getItem(SESSION_KEY)) {
      void this.clear(EXPIRED_MESSAGE)
    } else {
      this.invalidate()
      this.publish({ user: null, accessToken: null, expiresAt: null, message: null, renewing: false })
    }
  }
  stop = () => {
    this.active = false
    window.removeEventListener('storage', this.onStorage)
    window.removeEventListener('focus', this.checkExpiry)
    document.removeEventListener('visibilitychange', this.checkExpiry)
    this.invalidate()
    for (const [controller, timer] of this.revocations) {
      controller.abort()
      clearTimeout(timer)
    }
    this.revocations.clear()
  }
  private checkExpiry = () => {
    clearTimeout(this.timer)
    const expiresAt = this.state.expiresAt
    if (!this.state.user || expiresAt === null) return
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) { void this.clear(EXPIRED_MESSAGE); return }
    // Recheck in bounded intervals for sleep/wake and clock changes; never auto-renew.
    this.timer = setTimeout(this.checkExpiry, Math.min(remaining, MAX_TIMER, 60_000))
  }
  private install(stored: StoredSession, persist: boolean) {
    const expiresAt = expiryOf(stored)
    if (expiresAt !== null && expiresAt <= Date.now()) { void this.clear(EXPIRED_MESSAGE); return }
    this.invalidate()
    this.revision = stored.revision
    localStorage.setItem('access_token', stored.accessToken)
    localStorage.setItem('user', JSON.stringify(stored.user))
    // Allowlist access-session fields: never serialize a response's refresh credential.
    const snapshot: StoredSession = {
      accessToken: stored.accessToken, user: stored.user, expiresAt: expiresAt ?? undefined,
      revision: stored.revision,
    }
    if (persist) localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot))
    this.publish({ user: snapshot.user, accessToken: snapshot.accessToken, expiresAt, message: null, renewing: false })
    this.checkExpiry()
  }
  private onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage || (event.key !== SESSION_KEY && event.key !== null)) return
    // Read latest bytes rather than an obsolete queued event's newValue.
    const stored = localStorage.getItem(SESSION_KEY) ? readStored() : null
    if (!stored) {
      void this.clear(readSignoutMessage() ?? 'La sesión se cerró en otra pestaña. Volvé a iniciar sesión.', false)
      return
    }
    if (stored.revision === this.revision) return
    const accountChanged = stored.user.id !== this.state.user?.id
    this.invalidate()
    if (!accountChanged) { this.install(stored, false); return }
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    this.publish({ user: null, accessToken: null, expiresAt: null, renewing: false })
    resetSyncStatus()
    const fence = this.capture()
    void this.queuePurge().then(() => {
      if (this.isCurrent(fence) && !this.cleanupFailed) this.install(stored, false)
    })
  }
  unauthorized = (fence: SessionFence) => {
    if (this.isCurrent(fence)) void this.clear(EXPIRED_MESSAGE)
  }

  login = async (email: string, password: string) => {
    // Login is an account boundary even if the next credentials name the same user.
    void this.clear(null)
    const fence = this.capture()
    await this.cleanup
    this.assertCurrent(fence)
    if (this.cleanupFailed) throw new Error(CLEANUP_MESSAGE)
    const result = await this.dependencies.request<SessionResponse>('/auth/login', {
      method: 'POST', credentials: 'include', signal: fence.signal,
      body: JSON.stringify({ email, password }),
    })
    this.assertCurrent(fence)
    this.install({ ...result, revision: crypto.randomUUID() }, true)
    if (!this.state.user) throw new Error(EXPIRED_MESSAGE)
  }

  refresh = async () => {
    this.checkExpiry()
    if (!this.state.user) throw new Error(EXPIRED_MESSAGE)
    if (this.state.renewing) return
    const fence = this.capture()
    const revision = this.revision
    this.publish({ renewing: true, message: null })
    try {
      await this.dependencies.lock(async () => {
        const latest = localStorage.getItem(SESSION_KEY) ? readStored() : null
        // Adopt an already-completed sibling renewal only in the same local generation/account.
        if (latest && latest.revision !== revision && latest.user.id === this.state.user?.id &&
            fence.generation === this.generation && !fence.signal.aborted) {
          this.install(latest, false)
          return
        }
        this.assertCurrent(fence)
        const result = await this.dependencies.request<SessionResponse>('/auth/refresh', {
          method: 'POST', credentials: 'include', signal: fence.signal,
        })
        this.assertCurrent(fence)
        if (result.user.id !== this.state.user?.id) throw new Error('La cuenta de la sesión cambió.')
        this.install({ ...result, revision: crypto.randomUUID() }, true)
      })
    } catch (error) {
      if (this.isCurrent(fence)) this.publish({ message: 'No se pudo renovar la sesión. Intentá de nuevo antes de que expire.' })
      throw error
    } finally {
      if (this.isCurrent(fence)) this.publish({ renewing: false })
    }
  }
  logout = async () => {
    const token = this.state.accessToken
    const cleanup = this.clear(null)
    // Revocation is best effort and session-bound; local teardown never waits on the network.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    this.revocations.set(controller, timer)
    const req = this.dependencies.request('/auth/logout', {
      method: 'POST', credentials: 'include', signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    void Promise.resolve(req).catch(() => {}).finally(() => {
      clearTimeout(timer)
      this.revocations.delete(controller)
    })
    await cleanup
  }
}

export const sessionCoordinator = new SessionCoordinator({
  request: (path, init) => api(path, init),
  purge: async () => {
    resetSyncStatus()
    await withSyncLock(async () => {
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) await table.clear()
      })
    })
  },
  lock: async (work) => {
    if (!navigator.locks) throw new Error('Este navegador no permite renovar la sesión de forma segura.')
    return navigator.locks.request('practicas-auth-refresh', work)
  },
})
