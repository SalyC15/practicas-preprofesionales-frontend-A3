import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Chip } from '@/components/Chip'
import { HeroCard, HeroPanel } from '@/components/HeroPanel'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Section } from '@/components/Panel'
import { ProgressBar } from '@/components/ProgressBar'
import { StatCard, StatGrid } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Ledger } from '@/components/ledger/Ledger'
import { LedgerRow } from '@/components/ledger/LedgerRow'
import { parseLocalDate } from '@/lib/date'
import { type HoursSummary, summarizeHours } from '@/lib/hours'
import { plural } from '@/lib/utils'
import { db, type LocalDocument, type LocalHourLog } from '@/offline/db'
import { useHourLogs } from '@/offline/hooks/useHourLogs'
import { usePlacement } from '@/offline/hooks/usePlacement'
import { type DocumentKind, KIND_LABEL, REQUIRED_KINDS, latestStatus } from '@/pages/DocumentsPage'

function formatDate(dateValue: string): string {
  const parsed = parseLocalDate(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatPeriod(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-[18px] py-3">
      <dt className="text-14 text-inkSoft">{label}</dt>
      <dd className="text-14 text-ink">{children}</dd>
    </div>
  )
}

function PlacementHero({
  hours,
  pendingDocuments,
}: {
  hours: HoursSummary
  pendingDocuments: number
}) {
  const remaining = Math.max(0, hours.requiredHours - hours.approvedHours)

  return (
    <HeroPanel
      title={`Te faltan ${remaining.toFixed(1)} horas aprobadas`}
      description="Registrá tus horas el mismo día. Tu tutor las revisa y lo que apruebe cuenta para el acta final."
      aside={
        <>
          <HeroCard label="Sin aprobar">
            {hours.submittedHours.toFixed(1)} h esperando a tu tutor
          </HeroCard>
          <HeroCard label="Documentos">
            {plural(pendingDocuments, 'documento pendiente', 'documentos pendientes')}
          </HeroCard>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <ProgressBar
          value={hours.approvedPct}
          pendingValue={hours.submittedPct}
          label="Progreso de horas aprobadas"
          onTint
        />
        <span className="inline-flex h-[26px] flex-none items-center rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-2.5 font-data text-12 font-semibold text-white">
          {Math.round(hours.approvedPct)}%
        </span>
      </div>
    </HeroPanel>
  )
}

function PlacementStats({
  hours,
  pendingDocuments,
  missingRequiredCount,
  logCount,
}: {
  hours: HoursSummary
  pendingDocuments: number
  missingRequiredCount: number
  logCount: number
}) {
  return (
    <StatGrid>
      <StatCard
        label="Horas aprobadas"
        value={hours.approvedHours.toFixed(1)}
        note={`de ${hours.requiredHours}`}
      />
      <StatCard
        label="Sin revisar"
        value={hours.submittedHours.toFixed(1)}
        note="con tu tutor"
        noteTone="pending"
      />
      <StatCard
        label="Documentos pendientes"
        value={String(pendingDocuments)}
        note={
          missingRequiredCount > 0
            ? 'por subir'
            : pendingDocuments > 0
              ? 'por validar'
              : 'al día'
        }
        noteTone={pendingDocuments > 0 ? 'pending' : 'neutral'}
      />
      <StatCard label="Registros" value={String(logCount)} note="en el libro" />
    </StatGrid>
  )
}

function PendingDocuments({ documents }: { documents: LocalDocument[] | undefined }) {
  const aside = (
    <Link to="/documentos" className="text-13 font-semibold text-stamp hover:underline">
      Ir a documentos
    </Link>
  )

  if (documents === undefined) {
    return (
      <Section title="Documentos pendientes" aside={aside}>
        <LoadingState>Cargando documentos…</LoadingState>
      </Section>
    )
  }

  const missingRequired = REQUIRED_KINDS.filter((kind) => {
    const status = latestStatus(documents, kind)
    return status === null || status === 'REJECTED'
  })

  const pendingReview = documents.filter((doc) => doc.status === 'PENDING')

  if (missingRequired.length === 0 && pendingReview.length === 0) {
    return (
      <Section title="Documentos pendientes" aside={aside}>
        <EmptyState
          title="No tienes documentos pendientes"
          description="Todos tus documentos obligatorios están al día y revisados."
        />
      </Section>
    )
  }

  return (
    <Section title="Documentos pendientes" aside={aside}>
      <div className="divide-y divide-paperRule">
        {missingRequired.map((kind) => {
          const status = latestStatus(documents, kind)
          const isRejected = status === 'REJECTED'
          return (
            <div
              key={kind}
              className="flex min-h-row items-center justify-between gap-4 px-[18px] py-3 bg-chipVoid/15"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-14 font-semibold text-ink">{KIND_LABEL[kind]}</span>
                  <span className="rounded bg-chipVoid px-1.5 py-0.5 text-11 font-medium text-void">
                    Obligatorio
                  </span>
                </div>
                <div className="mt-0.5 text-12 text-inkSoft">
                  {isRejected
                    ? 'El documento fue rechazado por el revisor. Debes subir una versión corregida.'
                    : 'Requerido para activar tu práctica preprofesional.'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Chip tone="void">{isRejected ? 'Rechazado' : 'Falta subir'}</Chip>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link to="/documentos">Subir</Link>
                </Button>
              </div>
            </div>
          )
        })}

        {pendingReview.map((doc, index) => (
          <div
            key={doc.id ?? index}
            className="flex min-h-row items-center justify-between gap-4 px-[18px] py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate text-14 font-semibold text-ink">{doc.filename}</div>
              <div className="mt-0.5 text-12 text-inkSoft">
                {KIND_LABEL[doc.kind as DocumentKind] ?? doc.kind} · En revisión
              </div>
            </div>
            <StatusBadge status={doc.status} />
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && (
        <div className="p-4 bg-soft/40 border-t border-paperRule flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-13 text-inkBody">
            Para activar y convalidar tu práctica debes subir el convenio y seguro obligatorio.
          </p>
          <Button asChild size="sm" className="self-start sm:self-auto shrink-0">
            <Link to="/documentos">Ir a subir documentos</Link>
          </Button>
        </div>
      )}
    </Section>
  )
}

function RecentLogs({ logs }: { logs: LocalHourLog[] | undefined }) {
  const aside = (
    <Link to="/horas" className="text-13 font-semibold text-stamp hover:underline">
      Ver el libro de horas
    </Link>
  )

  if (logs === undefined) {
    return (
      <Section title="Últimos registros de horas" aside={aside}>
        <LoadingState>Cargando registros…</LoadingState>
      </Section>
    )
  }

  const recent = logs.slice(-5).reverse()
  if (recent.length === 0) {
    return (
      <Section title="Últimos registros de horas" aside={aside}>
        <EmptyState
          title="Todavía no has registrado horas"
          description="Puedes hacerlo sin conexión."
        />
      </Section>
    )
  }

  return (
    <Section title="Últimos registros de horas" aside={aside}>
      <Ledger>
        {recent.map((log, index) => (
          <LedgerRow key={index} syncState={log.syncState}>
            <span className="font-data text-14 text-ink sm:w-28">{formatDate(log.date)}</span>
            <span className="font-data text-13 text-inkSoft sm:w-28">
              {log.startTime}–{log.endTime}
            </span>
            <span className="font-data text-14 text-ink sm:w-14">{log.hours}</span>
            <span className="flex-1 text-14 text-inkBody">{log.activity}</span>
            <span className="sm:w-32 sm:text-right">
              <StatusBadge status={log.status} />
            </span>
          </LedgerRow>
        ))}
      </Ledger>
    </Section>
  )
}

export function MyPlacementPage() {
  const placement = usePlacement()
  const logs = useHourLogs(placement?.id ?? -1)
  const documents = useLiveQuery<LocalDocument[] | undefined>(async () => {
    if (!placement) return undefined
    return db.documents.where('placementId').equals(placement.id).toArray()
  }, [placement?.id])

  if (placement === undefined) {
    return <LoadingState>Cargando tu práctica…</LoadingState>
  }

  if (placement === null) {
    return (
      <EmptyState
        title="No tienes una práctica activa todavía"
        description="Cuando la coordinación active tu plaza, la vas a ver acá."
      />
    )
  }

  const missingRequired = REQUIRED_KINDS.filter((kind) => {
    const status = latestStatus(documents ?? [], kind)
    return status === null || status === 'REJECTED'
  })
  const pendingReview = documents?.filter((doc) => doc.status === 'PENDING') ?? []
  const pendingDocuments = missingRequired.length + pendingReview.length
  const hours = summarizeHours(logs, placement.requiredHours)

  return (
    <>
      <PageHeader
        title={placement.offerTitle ?? 'Mi práctica'}
        subtitle={`${placement.companyName ?? `Empresa #${placement.companyId}`} · ${formatPeriod(placement.startDate, placement.endDate)}`}
        actions={
          <Button asChild>
            <Link to="/horas">Registrar horas</Link>
          </Button>
        }
      />

      <PlacementHero hours={hours} pendingDocuments={pendingDocuments} />

      <PlacementStats
        hours={hours}
        pendingDocuments={pendingDocuments}
        missingRequiredCount={missingRequired.length}
        logCount={logs?.length ?? 0}
      />

      <Section title="Datos de la práctica">
        <dl className="divide-y divide-paperRule">
          {placement.offerTitle ? (
            <DataRow label="Cargo / Práctica">{placement.offerTitle}</DataRow>
          ) : null}
          <DataRow label="Empresa">{placement.companyName ?? `Empresa #${placement.companyId}`}</DataRow>
          <DataRow label="Tutor">{placement.tutorName ?? `Tutor #${placement.tutorId}`}</DataRow>
          <DataRow label="Horas requeridas">
            <span className="font-data font-semibold">{placement.requiredHours} h</span>
          </DataRow>
          <DataRow label="Periodo">
            <span className="font-data">{formatPeriod(placement.startDate, placement.endDate)}</span>
          </DataRow>
          <DataRow label="Estado">
            <StatusBadge status={placement.status} />
          </DataRow>
        </dl>
      </Section>

      <PendingDocuments documents={documents} />

      <RecentLogs logs={logs} />
    </>
  )
}
