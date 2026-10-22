import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type Application, apply, getMineForOffer } from '@/api/applications'
import { ApiError } from '@/api/client'
import { type Offer, getOffer } from '@/api/offers'
import { useAuth } from '@/auth/AuthContext'
import { Chip, Tag } from '@/components/Chip'
import { PageHeader } from '@/components/PageHeader'
import { LoadingState, Panel, Section } from '@/components/Panel'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseLocalDate } from '@/lib/date'
import { isOfferExpired, modalityLabel, offerAvailability } from '@/lib/offer-presentation'

// El DTO del backend exige @MinLength(20) en la motivación.
const MIN_MOTIVATION_LENGTH = 20

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  return `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
}

function BackLink() {
  return (
    <Link to="/ofertas" className="self-start text-13 font-semibold text-stamp hover:underline">
      ← Volver a ofertas
    </Link>
  )
}

/** Cuántos caracteres faltan para llegar al mínimo que exige el backend. */
function motivationHint(motivation: string): string {
  const remaining = MIN_MOTIVATION_LENGTH - motivation.trim().length
  if (remaining <= 0) return 'Longitud suficiente'
  return `Faltan ${remaining} caracteres (mínimo ${MIN_MOTIVATION_LENGTH})`
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-13">
      <span className="text-inkSoft">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  )
}

interface ApplicationSectionProps {
  /** `undefined` mientras se comprueba, `null` si todavía no postuló. */
  application: Application | null | undefined
  /** Formulario de postulación, para cuando aún no hay una enviada. */
  form: React.ReactNode
  unavailable?: string
}

function ApplicationSection({ application, form, unavailable }: ApplicationSectionProps) {
  if (application === undefined) {
    return (
      <Section title="Tu postulación">
        <p className="px-[18px] py-4 text-14 text-inkSoft">Comprobando si ya postulaste…</p>
      </Section>
    )
  }

  if (application) {
    return (
      <Section title="Tu postulación">
        <div className="flex flex-wrap items-center gap-3 px-[18px] py-4">
          <StatusBadge status={application.status} />
          <span className="font-data text-12 text-inkSoft">
            Enviada el {formatDate(application.submittedAt)}
          </span>
        </div>
      </Section>
    )
  }

  if (unavailable) {
    return (
      <Panel className="p-5">
        <p className="font-semibold text-ink">{unavailable}</p>
        <p className="mt-1 text-14 text-inkMid">Esta oferta se conserva como referencia y ya no recibe postulaciones.</p>
      </Panel>
    )
  }

  return (
    <Section title="Postular a esta oferta">
      <div className="px-[18px] py-4">{form}</div>
    </Section>
  )
}

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const offerId = Number(id)

  const [offer, setOffer] = useState<Offer | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [existingApplication, setExistingApplication] = useState<Application | null | undefined>(undefined)

  const [motivation, setMotivation] = useState('')
  const [motivationError, setMotivationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { role } = useAuth()
  const isStudent = role === 'STUDENT'

  useEffect(() => {
    let cancelled = false

    getOffer(offerId)
      .then((data) => {
        if (!cancelled) setOffer(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setOffer(null)
          setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la oferta')
        }
      })

    if (isStudent) {
      getMineForOffer(offerId)
        .then((application) => {
          if (!cancelled) setExistingApplication(application)
        })
        .catch(() => {
          // Si no se puede confirmar el estado de la postulación, se deja el
          // formulario disponible: es preferible dejar postular de más que
          // esconder el botón por un error de red al consultar el historial.
          if (!cancelled) setExistingApplication(null)
        })
    } else {
      setExistingApplication(null)
    }

    return () => {
      cancelled = true
    }
  }, [offerId, isStudent])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    if (!offer || offer.status !== 'PUBLISHED' || isOfferExpired(offer.periodEnd)) {
      setSubmitError('Esta convocatoria ya no está disponible para postular.')
      return
    }

    const trimmed = motivation.trim()
    if (trimmed.length < MIN_MOTIVATION_LENGTH) {
      setMotivationError(`Escribe al menos ${MIN_MOTIVATION_LENGTH} caracteres`)
      return
    }
    setMotivationError(null)
    setSubmitting(true)

    try {
      const created = await apply(offerId, trimmed)
      setExistingApplication(created)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'No se pudo enviar la postulación')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <>
        <BackLink />
        <Panel>
          <p role="alert" className="px-5 py-14 text-center text-14 text-void">
            {loadError}
          </p>
        </Panel>
      </>
    )
  }

  if (offer === undefined) {
    return <LoadingState>Cargando oferta…</LoadingState>
  }

  if (offer === null) {
    return null
  }

  const remainingHint = motivationHint(motivation)

  return (
    <>
      <BackLink />

      <PageHeader title={offer.title} subtitle={offer.company.name} />

      <div className="flex flex-wrap gap-1.5">
        <Chip>{offerAvailability(offer)}</Chip>
        <Tag>{modalityLabel(offer.modality)}</Tag>
        <Tag>{offer.seats} cupos totales</Tag>
        <Tag>{offer.requiredHours} h</Tag>
      </div>

      <Section title="Descripción">
        <div className="px-[18px] py-4">
          <p className="whitespace-pre-line text-14 leading-relaxed text-inkDeep">
            {offer.description}
          </p>
          <div className="mt-4 flex flex-col gap-2 rounded-lg bg-well px-4 py-3.5">
            <SummaryRow label="Cupos totales" value={String(offer.seats)} />
            <SummaryRow label="Horas requeridas" value={`${offer.requiredHours} h`} />
            <SummaryRow
              label="Periodo"
              value={formatPeriod(offer.periodStart, offer.periodEnd)}
            />
          </div>
        </div>
      </Section>

      {isStudent && (
        <ApplicationSection
          application={existingApplication}
          unavailable={offerAvailability(offer) === 'Convocatoria abierta' ? undefined : offerAvailability(offer)}
          form={
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="motivation">Cuéntale por qué te interesa</Label>
                <p className="text-12 text-inkSoft">
                  Las empresas responden antes a quien escribe dos líneas.
                </p>
                <Textarea
                  id="motivation"
                  value={motivation}
                  onChange={(event) => {
                    setMotivation(event.target.value)
                    if (motivationError) setMotivationError(null)
                  }}
                  rows={4}
                  placeholder="Ej. Estoy en octavo ciclo y trabajé en mantenimiento de bombas en el laboratorio."
                  aria-invalid={Boolean(motivationError)}
                  aria-describedby="motivation-hint"
                />
                <p id="motivation-hint" className="self-end font-data text-12 text-inkSoft">
                  {remainingHint}
                </p>
                {motivationError ? (
                  <p role="alert" className="text-12 text-void">
                    {motivationError}
                  </p>
                ) : null}
              </div>

              {submitError ? (
                <p role="alert" className="rounded-md bg-chipVoid px-3 py-2.5 text-13 text-void">
                  {submitError}
                </p>
              ) : null}

              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? 'Enviando…' : 'Enviar postulación'}
              </Button>
            </form>
          }
        />
      )}
      {role === 'COORDINATOR' && (
        <Panel className="p-5 text-13 text-inkMid flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink text-14">Postulaciones a esta oferta</p>
            <p className="text-inkSoft">
              Revisa los estudiantes postulados, revisa sus postulaciones y asigna tutores académicos para iniciar sus prácticas.
            </p>
          </div>
          <Button asChild>
            <Link to={`/ofertas/${offer.id}/postulaciones`}>
              Ver y gestionar postulaciones
            </Link>
          </Button>
        </Panel>
      )}
    </>
  )
}
