import { sessionCoordinator } from '@/auth/session'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token')
  const protectedRequest = path !== '/auth/login' && path !== '/auth/logout'
  const fence = sessionCoordinator.capture()
  const controller = new AbortController()
  const abort = () => controller.abort()
  const signals = [init.signal, protectedRequest ? fence.signal : null].filter((signal): signal is AbortSignal => !!signal)
  for (const signal of signals) {
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  }
  try {
    const headers = new Headers(init.headers)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (token && path !== '/auth/login' && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_URL}${path}`, {
      ...init, signal: controller.signal, headers,
      ...(path.startsWith('/auth/') ? { credentials: 'include' as const } : {}),
    })
    if (res.status === 401 && protectedRequest && token === localStorage.getItem('access_token')) {
      sessionCoordinator.unauthorized(fence)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(res.status, body.message ?? `Error ${res.status}`)
    }
    const body = res.status === 204 ? undefined : await res.json()
    if (protectedRequest && !sessionCoordinator.isCurrent(fence)) throw new Error('La sesión cambió.')
    return body as T
  } finally {
    signals.forEach((signal) => signal.removeEventListener('abort', abort))
  }
}
