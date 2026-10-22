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
function translateErrorMessage(msg: unknown): string {
  if (typeof msg !== 'string') return ''
  let text = msg
  if (/email must be an email/i.test(text)) {
    text = text.replace(/email must be an email/gi, 'El correo electrónico debe ser válido')
  }
  if (/password must be longer than or equal to (\d+) characters/i.test(text)) {
    text = text.replace(/password must be longer than or equal to (\d+) characters/gi, 'La contraseña debe tener al menos $1 caracteres')
  }
  if (/password should not be empty/i.test(text)) {
    text = text.replace(/password should not be empty/gi, 'La contraseña no puede estar vacía')
  }
  if (/email should not be empty/i.test(text)) {
    text = text.replace(/email should not be empty/gi, 'El correo no puede estar vacío')
  }
  if (/([a-zA-Z0-9_]+) must be an email/i.test(text)) {
    text = text.replace(/([a-zA-Z0-9_]+) must be an email/gi, 'El campo $1 debe ser un correo válido')
  }
  if (/([a-zA-Z0-9_]+) must be longer than or equal to (\d+) characters/i.test(text)) {
    text = text.replace(/([a-zA-Z0-9_]+) must be longer than or equal to (\d+) characters/gi, 'El campo $1 debe tener al menos $2 caracteres')
  }
  if (/([a-zA-Z0-9_]+) must be shorter than or equal to (\d+) characters/i.test(text)) {
    text = text.replace(/([a-zA-Z0-9_]+) must be shorter than or equal to (\d+) characters/gi, 'El campo $1 debe tener como máximo $2 caracteres')
  }
  if (/([a-zA-Z0-9_]+) should not be empty/i.test(text)) {
    text = text.replace(/([a-zA-Z0-9_]+) should not be empty/gi, 'El campo $1 no puede estar vacío')
  }
  if (/([a-zA-Z0-9_]+) must be a string/i.test(text)) {
    text = text.replace(/([a-zA-Z0-9_]+) must be a string/gi, 'El campo $1 debe ser un texto')
  }
  if (text === 'Unauthorized') {
    text = 'Credenciales incorrectas o sesión no autorizada'
  }
  if (text === 'Forbidden resource') {
    text = 'No tienes permisos para realizar esta acción'
  }
  if (text === 'Internal server error') {
    text = 'Error interno del servidor. Intenta de nuevo más tarde.'
  }
  return text
}

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const raw = body.message
      const message = Array.isArray(raw)
        ? raw.map(translateErrorMessage).filter(Boolean).join('. ')
        : translateErrorMessage(raw) || `Error ${res.status}`
      throw new ApiError(res.status, message)
    }
    const body = res.status === 204 ? undefined : await res.json()
    if (protectedRequest && !sessionCoordinator.isCurrent(fence)) throw new Error('La sesión cambió.')
    return body as T
  } finally {
    signals.forEach((signal) => signal.removeEventListener('abort', abort))
  }
}
