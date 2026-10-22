import { Pagination } from '@/components/Pagination'
import { type FormEvent, useEffect, useState } from 'react'
import {
  type Company,
  type CreateCompanyDto,
  createCompany,
  listCompaniesPage,
  type CompanyPage,
  verifyCompany,
} from '@/api/companies'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/PageHeader'
import { AsyncSection, EmptyState, Panel, TableHeaderRow, rowClass } from '@/components/Panel'
import { StatCard, StatGrid } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ledger } from '@/components/ledger/Ledger'
import { plural } from '@/lib/utils'
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react'

function ColumnHeader({ isCoordinator }: { isCoordinator: boolean }) {
  return (
    <TableHeaderRow>
      <span className="w-52">Empresa</span>
      <span className="w-36 font-data text-12">RUC / Identificación</span>
      <span className="w-32">Sector</span>
      <span className="flex-1">Contacto RRHH</span>
      <span className="w-32 text-center">Estado</span>
      {isCoordinator && <span className="w-28 text-right">Validación</span>}
    </TableHeaderRow>
  )
}

interface CompanyRowItemProps {
  company: Company
  isCoordinator: boolean
  onToggleVerify?: (id: number, verified: boolean) => void
  isVerifying?: boolean
}

function CompanyRowItem({ company, isCoordinator, onToggleVerify, isVerifying }: CompanyRowItemProps) {
  return (
    <div className={rowClass}>
      <div className="flex flex-col sm:w-52">
        <span className="text-14 font-semibold text-ink">{company.name}</span>
      </div>
      <span className="font-data text-13 text-inkSoft sm:w-36">{company.taxId}</span>
      <span className="text-13 text-inkMid sm:w-32">{company.sector}</span>
      <span className="flex-1 text-13 text-inkSoft truncate">{company.contactEmail}</span>
      <div className="flex justify-center sm:w-32">
        <StatusBadge status={company.verified ? 'VERIFICADA' : 'PENDIENTE'} />
      </div>
      {isCoordinator && (
        <div className="flex justify-end sm:w-28">
          {company.verified ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isVerifying}
              onClick={() => onToggleVerify?.(company.id, false)}
              className="h-7 text-11 text-inkMid hover:border-void/40 hover:text-void"
              title="Revocar validación"
            >
              {isVerifying ? <Loader2 className="size-3 animate-spin" /> : 'Revocar'}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isVerifying}
              onClick={() => onToggleVerify?.(company.id, true)}
              className="h-7 gap-1 bg-emerald-600 px-2.5 text-11 font-medium text-white shadow-xs hover:bg-emerald-700"
              title="Acreditar y validar empresa institucionalmente"
            >
              {isVerifying ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="size-3.5" />
                  Validar
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

interface RegisterCompanyModalProps {
  open: boolean
  onClose: () => void
  onCreated: (company: Company, defaultPasswordUsed: string) => void
}

function RegisterCompanyModal({ open, onClose, onCreated }: RegisterCompanyModalProps) {
  const [form, setForm] = useState<CreateCompanyDto>({
    taxId: '',
    name: '',
    sector: '',
    contactEmail: '',
    password: '',
    verified: true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleChange<K extends keyof CreateCompanyDto>(field: K, value: CreateCompanyDto[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.taxId.trim() || !form.name.trim() || !form.sector.trim() || !form.contactEmail.trim()) {
      setError('RUC, nombre, sector y correo de contacto son campos obligatorios.')
      return
    }

    if (form.password && form.password.trim().length > 0 && form.password.trim().length < 6) {
      setError('La contraseña de acceso debe tener al menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    const usedPassword = form.password?.trim() || 'yura1234'

    try {
      const created = await createCompany({
        taxId: form.taxId.trim(),
        name: form.name.trim(),
        sector: form.sector.trim(),
        contactEmail: form.contactEmail.trim(),
        password: usedPassword,
        verified: form.verified ?? true,
      })
      onCreated(created, usedPassword)
      setForm({ taxId: '', name: '', sector: '', contactEmail: '', password: '', verified: true })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la empresa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Registrar nueva empresa</DialogTitle>
          <DialogDescription>
            Agregá una contraparte institucional. Se creará automáticamente la cuenta de acceso para que la empresa pueda iniciar sesión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <DialogBody className="flex flex-col gap-3.5">
            {error && (
              <p role="alert" className="rounded-md bg-chipVoid px-3 py-2 text-13 text-void">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-name">Razón social o Nombre *</Label>
              <Input
                id="company-name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ej. Tech Solutions S.A."
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-taxId">RUC / Identificación tributaria *</Label>
              <Input
                id="company-taxId"
                value={form.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
                placeholder="Ej. 1790012345001"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-sector">Sector económico *</Label>
              <Input
                id="company-sector"
                value={form.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
                placeholder="Ej. Software, Finanzas, Salud"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-email">Correo de contacto institucional y login *</Label>
              <Input
                id="company-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="rrhh@empresa.com"
                required
              />
              <p className="text-11 text-inkSoft">
                Este correo servirá como usuario para que la empresa inicie sesión en la plataforma.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper/60 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="company-password" className="flex items-center gap-1.5 text-13 font-semibold text-ink">
                  <Lock className="size-3.5 text-stamp" />
                  Contraseña de acceso inicial
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1 text-12 text-inkMid hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <Input
                id="company-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password || ''}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Por defecto: yura1234"
                className="mt-1 bg-surface"
              />
              <p className="text-11 text-inkMid">
                Puedes ingresar una contraseña personalizada (mínimo 6 caracteres) o dejarla en blanco para asignar <code className="rounded bg-muted px-1 py-0.5 font-mono text-11">yura1234</code> por defecto.
              </p>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <input
                id="company-verified"
                type="checkbox"
                checked={form.verified ?? true}
                onChange={(e) => handleChange('verified', e.target.checked)}
                className="size-4 rounded border-line text-stamp focus:ring-stamp/20"
              />
              <Label htmlFor="company-verified" className="cursor-pointer text-13 font-normal text-ink">
                Acreditar y validar empresa inmediatamente al crearla
              </Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Registrar empresa y crear cuenta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CompaniesPage() {
  const { role } = useAuth()
  const [companies, setCompanies] = useState<Company[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [result, setResult] = useState<CompanyPage>()
  const [revision, setRevision] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [verifyingId, setVerifyingId] = useState<number | null>(null)

  const isCoordinator = role === 'COORDINATOR'

  useEffect(() => {
    let cancelled = false
    setError(null)
    setCompanies(undefined)
    const timer = window.setTimeout(() => {
    listCompaniesPage(page, pageSize, search)
      .then((data) => {
        if (cancelled) return
        const lastPage = Math.max(1, data.totalPages)
        if (page > lastPage) { setPage(lastPage); return }
        setResult(data)
        setCompanies(data.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las empresas')
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [page, pageSize, search, revision])

  function handleCompanyCreated(newCompany: Company, defaultPasswordUsed: string) {
    setPage(1)
    setRevision((value) => value + 1)
    setSuccessNotice(
      `¡Empresa "${newCompany.name}" registrada con éxito! Credenciales de acceso generadas: Correo: ${newCompany.contactEmail} · Contraseña: ${defaultPasswordUsed}`,
    )
  }

  async function handleToggleVerify(companyId: number, nextStatus: boolean) {
    setVerifyingId(companyId)
    setError(null)
    try {
      await verifyCompany(companyId, nextStatus)
      setRevision((value) => value + 1)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo actualizar el estado de validación de la empresa',
      )
    } finally {
      setVerifyingId(null)
    }
  }


  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Empresas con convenio"
          subtitle="Directorio institucional de empresas acreditadas para ofertar prácticas preprofesionales."
        />
        {isCoordinator && (
          <Button onClick={() => setModalOpen(true)} className="self-start sm:self-auto">
            + Registrar empresa
          </Button>
        )}
      </div>

      {successNotice ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50/90 p-4 text-emerald-900 shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <p className="text-13 font-medium">{successNotice}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-12 font-medium text-emerald-700 hover:underline"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {result && (
        <StatGrid>
          <StatCard label="Empresas registradas" value={String(result.summary.registered)} note="en total" />
          <StatCard
            label="Empresas verificadas"
            value={String(result.summary.verified)}
            note={`de ${result.summary.registered}`}
            noteTone="stamp"
          />
          <StatCard
            label="Sectores activos"
            value={String(result.summary.sectors)}
            note="diversidad productiva"
          />
        </StatGrid>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, sector o RUC…"
            className="h-control"
          />
        </div>
        {result && (
          <span className="ml-auto font-data text-12 text-inkSoft">
            {plural(result.total, 'empresa encontrada', 'empresas encontradas')}
          </span>
        )}
      </div>

      <AsyncSection
        error={error}
        data={companies}
        loadingLabel="Cargando empresas…"
        empty={
          <EmptyState
            title="No se encontraron empresas"
            description="Verifica el filtro de búsqueda o registra una nueva empresa."
          />
        }
      >
        {(items) => (
          <Panel>
            <Ledger header={<ColumnHeader isCoordinator={isCoordinator} />}>
              {items.map((company) => (
                <CompanyRowItem
                  key={company.id}
                  company={company}
                  isCoordinator={isCoordinator}
                  onToggleVerify={handleToggleVerify}
                  isVerifying={verifyingId === company.id}
                />
              ))}
            </Ledger>
          </Panel>
        )}
      </AsyncSection>

      {result && !error && <Pagination page={page} pageSize={pageSize} total={result.total} busy={companies === undefined}
        onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}

      <RegisterCompanyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCompanyCreated}
      />
    </>
  )
}
