import { usePageState } from '@/components/usePageState'
import { useState } from 'react'
import { Calendar, CheckCircle2, Clock, Check, Loader2, Sparkles } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { FilterTabs } from '@/components/FilterTabs'
import { parseStoredCalendarDateUtc } from '@/lib/date'
import type { ScheduleSummary, ScheduledSession } from '@/lib/schedule'

interface ScheduleAttendancePanelProps {
  summary: ScheduleSummary
  companyName?: string | null
  onConfirmAttendance: (session: ScheduledSession) => Promise<void>
}

function formatSessionDate(dateValue: string): string {
  const parsed = parseStoredCalendarDateUtc(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  const formatted = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
  // Capitalizar primera letra
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function ScheduleAttendancePanel({
  summary,
  companyName,
  onConfirmAttendance,
}: ScheduleAttendancePanelProps) {
  const pager = usePageState('Paginación del cronograma')
  const [filter, setFilter] = useState<'pending' | 'confirmed' | 'all'>('pending')
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const pendingSessions = summary.sessions.filter((s) => s.status === 'PENDING')
  const confirmedSessions = summary.sessions.filter(
    (s) => s.status === 'CONFIRMED' || s.status === 'APPROVED',
  )

  const visibleSessions =
    filter === 'pending'
      ? pendingSessions
      : filter === 'confirmed'
        ? confirmedSessions
        : summary.sessions

  async function handleConfirm(session: ScheduledSession) {
    try {
      setConfirmingDate(session.date)
      setActionMessage(null)
      await onConfirmAttendance(session)
      setActionMessage(`¡Asistencia del ${formatSessionDate(session.date)} confirmada exitosamente!`)
      setTimeout(() => setActionMessage(null), 4000)
    } catch {
      setActionMessage('No se pudo confirmar la asistencia. Intenta de nuevo.')
    } finally {
      setConfirmingDate(null)
    }
  }

  const completionPercent = summary.requiredHours > 0
    ? Math.min(100, Math.round((summary.confirmedHours / summary.requiredHours) * 100))
    : 0

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-divider/60 bg-white p-5 shadow-sm">
      {/* Encabezado del cronograma de la empresa */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stamp/10 text-stamp">
              <Calendar className="h-4 w-4" />
            </span>
            <h3 className="text-16 font-semibold text-ink">
              Cronograma de Prácticas de la Empresa
            </h3>
          </div>
          <p className="mt-1 text-13 text-inkSoft">
            {companyName ? <strong className="font-medium text-inkBody">{companyName}</strong> : 'La empresa'} planificó{' '}
            <span className="font-semibold text-stamp">{summary.totalSessions} sesiones</span> de{' '}
            <span className="font-semibold text-stamp">{summary.dailyHours} horas</span> (Lunes a Viernes) para justificar las{' '}
            <span className="font-semibold text-inkBody">{summary.requiredHours} h ofertadas</span>.
          </p>
        </div>

        {/* Indicador de progreso de sesiones */}
        <div className="flex items-center gap-3 rounded-lg border border-divider/50 bg-soft/50 px-3.5 py-2">
          <div className="flex flex-col text-right">
            <span className="font-data text-11 font-medium text-inkSoft uppercase tracking-wider">
              Asistencia
            </span>
            <span className="font-data text-14 font-bold text-ink">
              {summary.confirmedSessions} / {summary.totalSessions} <span className="text-12 font-normal text-inkSoft">sesiones</span>
            </span>
          </div>
          <div className="h-8 w-px bg-divider/60" />
          <div className="flex flex-col text-right">
            <span className="font-data text-11 font-medium text-inkSoft uppercase tracking-wider">
              Progreso
            </span>
            <span className="font-data text-14 font-bold text-stamp">
              {completionPercent}%
            </span>
          </div>
        </div>
      </div>

      {actionMessage ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-leaf/30 bg-chipLeaf/70 px-3 py-2 text-13 font-medium text-leaf transition-all"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      ) : null}

      {/* Barra de pestañas para filtrar sesiones */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider/40 pb-2">
        <FilterTabs
          label="Filtro de sesiones del cronograma"
          value={filter}
          onChange={(val) => { setFilter(val as 'pending' | 'confirmed' | 'all'); pager.setPage(1) }}
          options={[
            { value: 'pending', label: `Pendientes de asistencia (${pendingSessions.length})` },
            { value: 'confirmed', label: `Asistidas (${confirmedSessions.length})` },
            { value: 'all', label: `Todo el cronograma (${summary.totalSessions})` },
          ]}
        />
        <span className="text-12 text-inkSoft">
          {filter === 'pending'
            ? 'Solo haz clic en "Confirmar asistencia" en el día correspondiente'
            : filter === 'confirmed'
              ? 'Sesiones ya confirmadas por el estudiante'
              : 'Calendario completo planificado por la empresa'}
        </span>
      </div>

      {/* Lista de sesiones */}
      {visibleSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-divider/60 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-leaf/60" />
          <p className="mt-2 text-14 font-medium text-ink">
            {filter === 'pending'
              ? '¡Estás al día! No tienes sesiones pendientes de confirmar.'
              : 'No hay sesiones en esta vista.'}
          </p>
          <p className="text-12 text-inkSoft">
            {filter === 'pending'
              ? 'Todas las sesiones programadas hasta ahora ya tienen asistencia registrada.'
              : 'Cambia el filtro arriba para ver otras sesiones.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-divider/30">
          {visibleSessions.slice(pager.offset, pager.offset + pager.pageSize).map((session) => {
            const isConfirming = confirmingDate === session.date
            const isConfirmed = session.status === 'CONFIRMED' || session.status === 'APPROVED'

            return (
              <div
                key={session.date}
                className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center hover:bg-soft/20 px-2 rounded-lg transition-colors"
              >
                {/* Datos de la sesión */}
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center rounded bg-soft font-data text-12 font-medium text-inkSoft">
                    #{session.sessionIndex}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-data text-14 font-semibold text-ink">
                        {formatSessionDate(session.date)}
                      </span>
                      <span className="flex items-center gap-1 rounded bg-soft/60 px-2 py-0.5 font-data text-12 text-inkSoft">
                        <Clock className="h-3 w-3" />
                        {session.startTime}–{session.endTime} ({session.hours} h)
                      </span>
                    </div>
                    <p className="mt-0.5 text-13 text-inkBody">
                      {session.activity}
                    </p>
                  </div>
                </div>

                {/* Acción o estado de la asistencia */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isConfirmed ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 font-data text-12 font-medium text-leaf">
                        <Check className="h-3.5 w-3.5" />
                        Asistí
                      </span>
                      <StatusBadge status={session.existingLog?.status ?? 'SUBMITTED'} />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isConfirming}
                      onClick={() => handleConfirm(session)}
                      className="bg-stamp hover:bg-stamp/90 text-white shadow-xs font-medium text-13 gap-1.5 h-8 px-3.5"
                    >
                      {isConfirming ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Confirmando…
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Confirmar asistencia
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {pager.controls(visibleSessions.length)}
    </div>
  )
}
