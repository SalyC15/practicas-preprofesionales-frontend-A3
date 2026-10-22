import { type FormEvent, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { type Company, type UpdateCompanyProfileDto, getMyCompany, updateMyCompany } from '@/api/companies'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

export function CompanyProfilePage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')

  // Submission & feedback state
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  function populateForm(data: Company) {
    setName(data.name || '')
    setSector(data.sector || '')
    setContactEmail(data.contactEmail || '')
    setPhone(data.phone || '')
    setAddress(data.address || '')
    setLogoUrl(data.logoUrl || '')
    setDescription(data.description || '')
    setWebsite(data.website || '')
    setLogoFailed(false)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    getMyCompany()
      .then((data) => {
        if (!cancelled) {
          setCompany(data)
          populateForm(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError ? err.message : 'No se pudo cargar el perfil de la empresa.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const hasChanges =
    company &&
    (name !== (company.name || '') ||
      sector !== (company.sector || '') ||
      contactEmail !== (company.contactEmail || '') ||
      phone !== (company.phone || '') ||
      address !== (company.address || '') ||
      logoUrl !== (company.logoUrl || '') ||
      description !== (company.description || '') ||
      website !== (company.website || ''))

  function handleReset() {
    if (company) {
      populateForm(company)
      setSaveSuccess(false)
      setSaveError(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setSaveError('El nombre de la empresa no puede estar vacío.')
      return
    }
    if (!contactEmail.trim()) {
      setSaveError('El correo de contacto no puede estar vacío.')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const dto: UpdateCompanyProfileDto = {
      name: name.trim(),
      sector: sector.trim(),
      contactEmail: contactEmail.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      description: description.trim() || undefined,
      website: website.trim() || undefined,
    }

    try {
      const updated = await updateMyCompany(dto)
      setCompany(updated)
      populateForm(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 5000)
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error al intentar guardar los datos de la empresa.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-stamp" />
        <p className="text-14 font-medium text-inkMid">Cargando perfil de la empresa...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-void/30 bg-void/5 p-6 text-center">
        <p className="text-15 font-semibold text-void">{loadError}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Perfil de Empresa"
        subtitle="Administrá la información institucional, logo de marca, sede física y canales de contacto directo."
      />

      {/* Tarjeta de Resumen y Encabezado de Marca */}
      <div className="relative overflow-hidden rounded-3xl border border-line/90 bg-surface/90 p-6 shadow-sm backdrop-blur-md sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Logo de la empresa o avatar inicial */}
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-paper via-surface to-hero/30 shadow-inner">
              {logoUrl.trim() && !logoFailed ? (
                <img
                  src={logoUrl.trim()}
                  alt={`Logo de ${name || 'la empresa'}`}
                  className="size-full object-contain p-2"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <Building2 className="size-10 text-stamp/60" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-20 font-bold text-ink sm:text-24">
                  {name || company?.name || 'Mi Empresa'}
                </h2>
                {company?.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-12 font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                    <ShieldCheck className="size-3.5" />
                    Verificada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-12 font-medium text-amber-700 ring-1 ring-amber-600/20">
                    Validación pendiente
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-13 text-inkMid">
                <span className="font-data font-medium text-ink">
                  RUC / ID: {company?.taxId}
                </span>
                {sector ? <span>• Rubro: {sector}</span> : null}
                {website ? (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-stamp hover:underline"
                  >
                    <Globe className="size-3.5" />
                    Sitio web
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Éxito / Error */}
      {saveSuccess ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-4 text-emerald-900 shadow-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <p className="text-14 font-medium">
            ¡Los datos de tu empresa fueron guardados y actualizados exitosamente!
          </p>
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-2xl border border-void/30 bg-void/10 p-4 text-void">
          <p className="text-14 font-medium">{saveError}</p>
        </div>
      ) : null}

      {/* Formulario de Actualización */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección 1: Identidad y Marca */}
        <div className="rounded-2xl border border-line/80 bg-surface p-6 shadow-xs sm:p-7">
          <div className="mb-5 flex items-center gap-2 border-b border-paperRule pb-4">
            <Building2 className="size-5 text-stamp" />
            <div>
              <h3 className="font-display text-16 font-semibold text-ink">Identidad y Marca</h3>
              <p className="text-13 text-inkMid">Datos institucionales y apariencia visual de la empresa.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="company-name" className="text-13 font-semibold text-ink">
                Nombre de la Empresa *
              </Label>
              <Input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. ACME Corporation"
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="company-sector" className="text-13 font-semibold text-ink">
                Sector o Rubro
              </Label>
              <Input
                id="company-sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ej. Tecnología, Software, Finanzas"
                className="mt-1.5"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="company-logo" className="text-13 font-semibold text-ink">
                URL del Logo o Imagen Institucional
              </Label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="company-logo"
                    type="url"
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.target.value)
                      setLogoFailed(false)
                    }}
                    placeholder="https://ejemplo.com/logo.png"
                    className="pr-9"
                  />
                  <ImageIcon className="pointer-events-none absolute right-3 top-2.5 size-4 text-inkSoft" />
                </div>
              </div>
              <p className="mt-1 text-12 text-inkMid">
                Pegá la dirección web directa (URL pública) de tu logotipo en formato PNG, SVG o JPG.
              </p>
            </div>
          </div>
        </div>

        {/* Sección 2: Contacto y Ubicación */}
        <div className="rounded-2xl border border-line/80 bg-surface p-6 shadow-xs sm:p-7">
          <div className="mb-5 flex items-center gap-2 border-b border-paperRule pb-4">
            <MapPin className="size-5 text-stamp" />
            <div>
              <h3 className="font-display text-16 font-semibold text-ink">Contacto y Ubicación</h3>
              <p className="text-13 text-inkMid">Canales de comunicación directa y dirección de las instalaciones.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="company-email" className="text-13 font-semibold text-ink">
                Correo Electrónico de Contacto *
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="company-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="recursoshumanos@empresa.com"
                  className="pr-9"
                  required
                />
                <Mail className="pointer-events-none absolute right-3 top-2.5 size-4 text-inkSoft" />
              </div>
            </div>

            <div>
              <Label htmlFor="company-phone" className="text-13 font-semibold text-ink">
                Teléfono o Celular de Contacto
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="company-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. +593 99 123 4567"
                  className="pr-9"
                />
                <Phone className="pointer-events-none absolute right-3 top-2.5 size-4 text-inkSoft" />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="company-address" className="text-13 font-semibold text-ink">
                Dirección Física / Sede Principal
              </Label>
              <Input
                id="company-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Av. Amazonas N34-123 y Pereira, Edificio Corporativo, Piso 5"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Presencia Web y Presentación */}
        <div className="rounded-2xl border border-line/80 bg-surface p-6 shadow-xs sm:p-7">
          <div className="mb-5 flex items-center gap-2 border-b border-paperRule pb-4">
            <Globe className="size-5 text-stamp" />
            <div>
              <h3 className="font-display text-16 font-semibold text-ink">Presencia Web y Reseña</h3>
              <p className="text-13 text-inkMid">
                Información que conocerán los estudiantes antes de postular a tus ofertas de prácticas.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label htmlFor="company-website" className="text-13 font-semibold text-ink">
                Sitio Web o Portal Corporativo
              </Label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="company-website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://www.miempresa.com"
                    className="pr-9"
                  />
                  <Globe className="pointer-events-none absolute right-3 top-2.5 size-4 text-inkSoft" />
                </div>
                {website.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const url = website.startsWith('http') ? website : `https://${website}`
                      window.open(url, '_blank', 'noreferrer')
                    }}
                    className="gap-1.5"
                  >
                    Probar link
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="company-description" className="text-13 font-semibold text-ink">
                Descripción Institucional de la Empresa
              </Label>
              <Textarea
                id="company-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contá de qué se trata la empresa, su visión, proyectos de innovación y qué aprenderán los practicantes en su pasantía..."
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line/90 bg-surface/95 p-4 shadow-lg backdrop-blur-md">
          {hasChanges ? (
            <span className="mr-auto text-13 font-medium text-amber-700">
              * Tenés cambios sin guardar
            </span>
          ) : (
            <span className="mr-auto text-13 text-inkSoft">Todos los datos están sincronizados</span>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Restablecer
          </Button>

          <Button
            type="submit"
            disabled={!hasChanges || saving}
            className="min-w-[150px] shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
