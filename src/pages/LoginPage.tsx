import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/BrandLogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface QuickRole {
  label: string
  roleName: string
  email: string
  icon: string
  badge: string
}

const QUICK_ROLES: QuickRole[] = [
  {
    label: 'Coordinador',
    roleName: 'COORDINATOR',
    email: 'coordinador@miyura.com',
    icon: '⚖️',
    badge: 'Acreditación y gestión',
  },
  {
    label: 'Tutor',
    roleName: 'TUTOR',
    email: 'tutor0@miyura.com',
    icon: '👨‍🏫',
    badge: 'Revisión de horas',
  },
  {
    label: 'Empresa',
    roleName: 'COMPANY',
    email: 'empresa0@miyura.com',
    icon: '🏢',
    badge: 'Ofertas y cupos',
  },
  {
    label: 'Estudiante',
    roleName: 'STUDENT',
    email: 'estudiantenuevo@miyura.com',
    icon: '🎓',
    badge: 'Listo para postular',
  },
]

export function LoginPage() {
  const { login, register, sessionMessage } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  function handleSelectRole(role: QuickRole) {
    setEmail(role.email)
    setPassword('yura1234')
    setSelectedRole(role.roleName)
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'register') {
        if (!fullName.trim()) {
          setError('Ingresá tu nombre completo')
          setSubmitting(false)
          return
        }
        await register(fullName.trim(), email.trim(), password)
      } else {
        await login(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : mode === 'register' ? 'no se pudo registrar la cuenta' : 'no se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-paper via-paper to-hero/40 px-4 py-12 antialiased">
      {/* Luces y texturas ambientales de fondo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[650px] -translate-x-1/2 rounded-full bg-stamp/10 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-1/4 size-[500px] rounded-full bg-hero/50 blur-[120px]"
      />

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Cabecera de marca */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 shadow-sm backdrop-blur-sm">
            <span className="size-2 rounded-full bg-stamp animate-pulse" />
            <span className="font-data text-11 font-medium tracking-wide text-inkSoft uppercase">
              YURA · VINCULACIÓN ACADÉMICA
            </span>
          </div>

          <BrandLogo size="lg" linkToHome={false} className="justify-center" />
          <p className="mt-1 text-13 text-inkMid">
            Gestión integral de prácticas preprofesionales y acreditación
          </p>
        </div>

        {/* Tarjeta de Login Principal */}
        <div className="rounded-3xl border border-line/90 bg-surface/95 p-6 shadow-[0_20px_50px_rgba(14,58,107,0.07)] backdrop-blur-md sm:p-8">
          <div className="border-b border-paperRule pb-4">
            <h1 className="font-display text-22 font-bold tracking-tight text-ink">
              {mode === 'register' ? 'Registrate como estudiante' : 'Entrá a tu cuenta'}
            </h1>
            <p className="mt-0.5 text-13 text-inkMid">
              {mode === 'register'
                ? 'Creá tu cuenta institucional para postular a ofertas y registrar tus horas.'
                : 'Con el correo institucional que te dio la unidad de vinculación.'}
            </p>
          </div>

          {/* Selector de Acceso Rápido para Pruebas / Demostración (solo en modo login) */}
          {mode === 'login' && (
            <div className="mt-5 rounded-2xl bg-paper/60 p-3 border border-line/70">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-11 font-semibold uppercase tracking-wider text-inkMute">
                  Acceso rápido por rol (demo)
                </span>
                <span className="font-data text-11 text-inkSoft">clave: yura1234</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ROLES.map((r) => {
                  const isSelected = selectedRole === r.roleName
                  return (
                    <button
                      key={r.roleName}
                      type="button"
                      onClick={() => handleSelectRole(r)}
                      className={`group flex items-center gap-2 rounded-xl p-2 text-left transition-all ${
                        isSelected
                          ? 'bg-surface font-semibold text-stamp shadow-sm border border-stamp/30 ring-1 ring-stamp/20'
                          : 'bg-surface/60 text-inkBody hover:bg-surface hover:text-ink border border-line/50'
                      }`}
                    >
                      <span className="text-16 select-none" aria-hidden="true">
                        {r.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-12 leading-tight font-medium group-hover:text-ink">
                          {r.label}
                        </div>
                        <div className="text-10 truncate text-inkMute leading-none mt-0.5">
                          {r.badge}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {sessionMessage && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-void/20 bg-chipVoid/60 px-3.5 py-2.5">
              <svg className="size-4 shrink-0 text-void" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p role="status" className="text-13 text-void font-medium">
                {sessionMessage}
              </p>
            </div>
          )}

          <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fullName" className="text-13 font-semibold text-ink">
                  Nombre completo
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Ej. Ana Belén Pérez"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="h-field bg-well/40 border-line hover:border-inkSoft/60 focus:bg-surface transition-colors"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-13 font-semibold text-ink">
                Correo institucional
              </Label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3.5 text-inkMute">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ejemplo@miyura.com"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setSelectedRole(null)
                  }}
                  className="pl-10 h-field bg-well/40 border-line hover:border-inkSoft/60 focus:bg-surface transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-13 font-semibold text-ink">
                {mode === 'register' ? 'Contraseña (mínimo 6 caracteres)' : 'Contraseña'}
              </Label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3.5 text-inkMute">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder="Tu contraseña"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10 pr-10 h-field bg-well/40 border-line hover:border-inkSoft/60 focus:bg-surface transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-3 text-inkMute hover:text-ink transition-colors"
                >
                  {showPassword ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-void/30 bg-chipVoid px-3.5 py-2.5">
                <svg className="size-4 shrink-0 text-void" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p role="alert" className="text-13 font-medium text-void">
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="mt-2 h-field w-full rounded-xl bg-stamp font-semibold text-white shadow-md shadow-stamp/20 hover:bg-stamp/90 transition-all active:scale-[0.99]"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{mode === 'register' ? 'Registrando…' : 'Entrando…'}</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>{mode === 'register' ? 'Crear cuenta y entrar' : 'Entrar'}</span>
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </Button>
          </form>

          {/* Selector de modo Login / Registro */}
          <div className="mt-5 border-t border-line/70 pt-4 text-center text-13 text-inkMid">
            {mode === 'login' ? (
              <p>
                ¿Sos estudiante y todavía no tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                  className="font-semibold text-stamp hover:underline"
                >
                  Registrate acá
                </button>
              </p>
            ) : (
              <p>
                ¿Ya tenés una cuenta registrada?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                  className="font-semibold text-stamp hover:underline"
                >
                  Iniciá sesión
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Pie de pantalla */}
        <div className="mt-6 flex items-center justify-center gap-2 text-12 text-inkMute">
          <svg className="size-3.5 text-stamp" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Cliente offline-first con sincronización automática</span>
        </div>
      </div>
    </div>
  )
}
