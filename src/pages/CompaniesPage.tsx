import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { type Company, type CreateCompanyDto, createCompany, listCompanies } from '@/api/companies'
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

function ColumnHeader() {
  return (
    <TableHeaderRow>
      <span className="w-56">Empresa</span>
      <span className="w-36 font-data text-12">RUC / Identificación</span>
      <span className="w-36">Sector</span>
      <span className="flex-1">Contacto RRHH</span>
      <span className="w-32 text-right">Estado</span>
    </TableHeaderRow>
  )
}

function CompanyRowItem({ company }: { company: Company }) {
  return (
    <div className={rowClass}>
      <div className="flex flex-col sm:w-56">
        <span className="text-14 font-semibold text-ink">{company.name}</span>
      </div>
      <span className="font-data text-13 text-inkSoft sm:w-36">{company.taxId}</span>
      <span className="text-13 text-inkMid sm:w-36">{company.sector}</span>
      <span className="flex-1 text-13 text-inkSoft truncate">{company.contactEmail}</span>
      <div className="flex justify-end sm:w-32">
        <StatusBadge status={company.verified ? 'VERIFICADA' : 'PENDIENTE'} />
      </div>
    </div>
  )
}

interface RegisterCompanyModalProps {
  open: boolean
  onClose: () => void
  onCreated: (company: Company) => void
}

function RegisterCompanyModal({ open, onClose, onCreated }: RegisterCompanyModalProps) {
  const [form, setForm] = useState<CreateCompanyDto>({
    taxId: '',
    name: '',
    sector: '',
    contactEmail: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleChange(field: keyof CreateCompanyDto, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.taxId.trim() || !form.name.trim() || !form.sector.trim() || !form.contactEmail.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }

    setSubmitting(true)
    try {
      const created = await createCompany({
        taxId: form.taxId.trim(),
        name: form.name.trim(),
        sector: form.sector.trim(),
        contactEmail: form.contactEmail.trim(),
      })
      onCreated(created)
      setForm({ taxId: '', name: '', sector: '', contactEmail: '' })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la empresa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar nueva empresa</DialogTitle>
          <DialogDescription>
            Agregá una contraparte empresarial para que pueda publicar ofertas de prácticas.
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
              <Label htmlFor="company-name">Razón social o Nombre</Label>
              <Input
                id="company-name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ej. Tech Solutions S.A."
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-taxId">RUC / Identificación tributaria</Label>
              <Input
                id="company-taxId"
                value={form.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
                placeholder="Ej. 1790012345001"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-sector">Sector económico</Label>
              <Input
                id="company-sector"
                value={form.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
                placeholder="Ej. Software, Salud, Manufactura, Agro"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-email">Correo de contacto (RRHH / Vinculación)</Label>
              <Input
                id="company-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="rrhh@empresa.com"
                required
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Registrar empresa'}
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
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const isCoordinator = role === 'COORDINATOR'

  useEffect(() => {
    let cancelled = false
    setError(null)
    listCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las empresas')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleCompanyCreated(newCompany: Company) {
    setCompanies((prev) => (prev ? [newCompany, ...prev] : [newCompany]))
  }

  const filteredCompanies = useMemo(() => {
    if (!companies) return undefined
    if (!search.trim()) return companies
    const term = search.toLowerCase().trim()
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.sector.toLowerCase().includes(term) ||
        c.taxId.includes(term),
    )
  }, [companies, search])

  const verifiedCount = companies?.filter((c) => c.verified).length ?? 0
  const sectorsCount = new Set(companies?.map((c) => c.sector) ?? []).size

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

      {companies && (
        <StatGrid>
          <StatCard label="Empresas registradas" value={String(companies.length)} note="en total" />
          <StatCard
            label="Empresas verificadas"
            value={String(verifiedCount)}
            note={`de ${companies.length}`}
            noteTone="stamp"
          />
          <StatCard
            label="Sectores activos"
            value={String(sectorsCount)}
            note="diversidad productiva"
          />
        </StatGrid>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, sector o RUC…"
            className="h-control"
          />
        </div>
        {filteredCompanies && (
          <span className="ml-auto font-data text-12 text-inkSoft">
            {plural(filteredCompanies.length, 'empresa encontrada', 'empresas encontradas')}
          </span>
        )}
      </div>

      <AsyncSection
        error={error}
        data={filteredCompanies}
        loadingLabel="Cargando empresas…"
        empty={
          <EmptyState
            title="No se encontraron empresas"
            description="Verificá el filtro de búsqueda o registrá una nueva empresa."
          />
        }
      >
        {(items) => (
          <Panel>
            <Ledger header={<ColumnHeader />}>
              {items.map((company) => (
                <CompanyRowItem key={company.id} company={company} />
              ))}
            </Ledger>
          </Panel>
        )}
      </AsyncSection>

      <RegisterCompanyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCompanyCreated}
      />
    </>
  )
}
