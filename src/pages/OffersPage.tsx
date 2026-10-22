import { Pagination } from '@/components/Pagination'
import { Input } from '@/components/ui/input'
import type { Page } from '@/api/pagination'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { type Offer, listOffersPage } from '@/api/offers'
import { useAuth } from '@/auth/AuthContext'
import { FilterTabs } from '@/components/FilterTabs'
import { OfferCard, OfferGrid } from '@/components/OfferCard'
import { PageHeader } from '@/components/PageHeader'
import { AsyncSection, EmptyState } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { parseLocalDate } from '@/lib/date'
import { plural } from '@/lib/utils'
import { isOfferExpired, modalityLabel, offerAvailability } from '@/lib/offer-presentation'
import { Chip } from '@/components/Chip'

const ALL_MODALITIES = 'TODAS'

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  return `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
}

interface ToolbarProps {
  modalities: string[]
  value: string
  onChange: (value: string) => void
  count: number
}

function OffersToolbar({ modalities, value, onChange, count }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterTabs
        label="Filtrar por modalidad"
        value={value}
        onChange={onChange}
        options={[
          { value: ALL_MODALITIES, label: 'Todas' },
          ...modalities.map((modality) => ({ value: modality, label: modalityLabel(modality) })),
        ]}
      />
      <span className="ml-auto font-data text-12 text-inkSoft">
        {plural(count, 'oferta publicada', 'ofertas publicadas')}
      </span>
    </div>
  )
}

function OffersList({ offers }: { offers: Offer[] }) {
  const { role } = useAuth()
  const isStudent = role === 'STUDENT'

  return (
    <OfferGrid>
      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          title={offer.title}
          subtitle={offer.company.name}
          status={<Chip tone={isOfferExpired(offer.periodEnd) ? 'neutral' : 'stamp'}>{offerAvailability(offer)}</Chip>}
          tags={[
            modalityLabel(offer.modality),
            `${offer.seats} cupos totales`,
            `${offer.requiredHours} h`,
          ]}
          description={offer.description}
          meta={formatPeriod(offer.periodStart, offer.periodEnd)}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant={isStudent ? 'default' : 'outline'}>
                <Link
                  to={`/ofertas/${offer.id}`}
                  className={isStudent ? 'text-white hover:text-white' : undefined}
                >
                  {isStudent && !isOfferExpired(offer.periodEnd) ? 'Ver y postular' : 'Ver detalle'}
                </Link>
              </Button>
              {role === 'COORDINATOR' ? (
                <Button asChild size="sm">
                  <Link to={`/ofertas/${offer.id}/postulaciones`}>
                    Postulaciones
                  </Link>
                </Button>
              ) : null}
            </div>
          }
        />
      ))}
    </OfferGrid>
  )
}

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [modalityFilter, setModalityFilter] = useState(ALL_MODALITIES)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<Page<Offer> & { modalities: string[] }>()

  useEffect(() => {
    let cancelled = false
    setError(null)
    setOffers(undefined)
    const timer = window.setTimeout(() => {
    listOffersPage(page, pageSize, modalityFilter === ALL_MODALITIES ? '' : modalityFilter, search)
      .then((data) => {
        if (cancelled) return
        const lastPage = Math.max(1, data.totalPages)
        if (page > lastPage) { setPage(lastPage); return }
        setResult(data)
        setOffers(data.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ofertas')
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [page, pageSize, modalityFilter, search])

  const modalities = result?.modalities ?? []

  return (
    <>
      <PageHeader
        title="Ofertas de práctica"
        subtitle="Consulta las convocatorias publicadas y su periodo de prácticas."
      />

      <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }}
        placeholder="Buscar por oferta o empresa…" aria-label="Buscar ofertas" className="max-w-sm" />
      {modalities.length > 0 ? (
        <OffersToolbar
          modalities={modalities}
          value={modalityFilter}
          onChange={(value) => { setModalityFilter(value); setPage(1) }}
          count={result?.total ?? 0}
        />
      ) : null}

      <AsyncSection
        error={error}
        data={offers}
        loadingLabel="Cargando ofertas…"
        empty={
          <EmptyState
            title="No hay ofertas publicadas para este periodo"
            description="Vuelve a revisar más adelante."
          />
        }
      >
        {(items) => <OffersList offers={items} />}
      </AsyncSection>
      {result && !error && <Pagination page={page} pageSize={pageSize} total={result.total} busy={offers === undefined}
        onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
    </>
  )
}
