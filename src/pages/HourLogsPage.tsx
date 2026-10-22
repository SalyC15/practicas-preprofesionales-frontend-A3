import { useState } from 'react'
import { HourLogForm } from '@/components/HourLogForm'
import { HoursProgressPanel } from '@/components/HoursProgressPanel'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, LoadingState, Section } from '@/components/Panel'
import { ScheduleAttendancePanel } from '@/components/ScheduleAttendancePanel'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Ledger, LedgerHeaderRow } from '@/components/ledger/Ledger'
import { LedgerRow } from '@/components/ledger/LedgerRow'
import { parseStoredCalendarDateUtc } from '@/lib/date'
import { type HoursSummary, summarizeHours } from '@/lib/hours'
import { generatePlacementSchedule, type ScheduledSession } from '@/lib/schedule'
import { plural } from '@/lib/utils'
import { confirmAttendance } from '@/offline/attendance'
import type { LocalHourLog } from '@/offline/db'
import { useHourLogs } from '@/offline/hooks/useHourLogs'
import { usePlacement } from '@/offline/hooks/usePlacement'

function formatDate(dateValue: string): string {
  const parsed = parseStoredCalendarDateUtc(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function LedgerColumnHeader() {
  return (
    <LedgerHeaderRow>
      <span className="w-28">Fecha</span>
      <span className="w-28">Horario</span>
      <span className="w-14">Horas</span>
      <span className="flex-1">Actividad</span>
      <span className="w-32 text-right">Estado</span>
    </LedgerHeaderRow>
  )
}

function submittedNote(hours: HoursSummary) {
  if (hours.submittedHours <= 0) return null
  return <span className="text-pending"> · {hours.submittedHours.toFixed(1)} sin aprobar</span>
}

function HourLogsList({ logs }: { logs: LocalHourLog[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        title="Todavía no has registrado horas"
        description="Puedes hacerlo sin conexión: se sincroniza cuando vuelva la señal."
      />
    )
  }

  return (
    <Ledger header={<LedgerColumnHeader />}>
      {logs
        .slice()
        .reverse()
        .map((log) => (
          <LedgerRow key={log.id} syncState={log.syncState}>
            <span className="font-data text-14 text-ink sm:w-28">{formatDate(log.date)}</span>
            <span className="font-data text-13 text-inkSoft sm:w-28">
              {log.startTime}–{log.endTime}
            </span>
            <span className="font-data text-14 text-ink sm:w-14">{log.hours}</span>
            <span className="flex flex-1 flex-col text-14 text-inkBody">
              <span>{log.activity}</span>
              {log.syncState === 'failed' && log.reviewNote ? (
                <span role="note" className="mt-1 text-12 text-void">
                  Motivo de rechazo: {log.reviewNote}
                </span>
              ) : null}
            </span>
            <span className="sm:w-32 sm:text-right">
              <StatusBadge status={log.status} />
            </span>
          </LedgerRow>
        ))}
    </Ledger>
  )
}

function NewHourLogDialog({ placementId }: { placementId: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Registrar horas
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar horas</DialogTitle>
            <DialogDescription>
              Se guardan en este dispositivo y se sincronizan cuando haya conexión.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <HourLogForm placementId={placementId} onSaved={() => setOpen(false)} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function HourLogsPage() {
  const placement = usePlacement()
  const logs = useHourLogs(placement?.id ?? -1)

  async function handleConfirmAttendance(session: ScheduledSession) {
    if (!placement) return
    await confirmAttendance(placement.id, session)
  }

  if (placement === undefined) {
    return <LoadingState>Cargando tu práctica…</LoadingState>
  }

  if (placement === null) {
    return (
      <EmptyState
        title="No tienes una práctica activa todavía"
        description="Cuando la coordinación active tu plaza, vas a poder registrar horas."
      />
    )
  }

  if (logs === undefined) {
    return <LoadingState>Cargando registros de horas…</LoadingState>
  }

  // Totales recalculados en cada render a propósito: con esta pantalla no
  // hace falta más que sumar un arreglo, así que no se envuelve en useMemo.
  const hours = summarizeHours(logs, placement.requiredHours)
  const scheduleSummary = generatePlacementSchedule(placement, logs)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Libro de horas y asistencia"
        subtitle={
          placement.companyName
            ? `${placement.offerTitle ? `${placement.offerTitle} · ` : ''}${placement.companyName} · ${placement.requiredHours} h ofertadas`
            : 'Todo lo que registraste este período. Se guarda en este dispositivo aunque no haya señal.'
        }
        actions={<NewHourLogDialog placementId={placement.id} />}
      />

      <HoursProgressPanel hours={hours} note={submittedNote(hours)} />

      {scheduleSummary ? (
        <ScheduleAttendancePanel
          summary={scheduleSummary}
          companyName={placement.companyName}
          onConfirmAttendance={handleConfirmAttendance}
        />
      ) : null}

      <Section
        title="Historial de horas registradas"
        aside={
          <span className="font-data text-12 text-inkSoft">
            {plural(logs.length, 'registro', 'registros')}
          </span>
        }
      >
        <HourLogsList logs={logs} />
      </Section>
    </div>
  )
}
