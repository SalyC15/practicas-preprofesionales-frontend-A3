import { Calendar, CheckCircle2, Clock } from 'lucide-react'
import { generatePlacementSchedule, type ScheduleConfig, type ScheduleSummary } from '@/lib/schedule'
import { parseStoredCalendarDateUtc } from '@/lib/date'
import { usePlacement } from '@/offline/hooks/usePlacement'
import { useHourLogs } from '@/offline/hooks/useHourLogs'
import type { LocalHourLog, LocalPlacement } from '@/offline/db'

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
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

interface PlacementScheduleProps {
  placement?: LocalPlacement | null
  hourLogs?: LocalHourLog[]
  config?: ScheduleConfig
  title?: string
}

export function PlacementSchedule({
  placement: propPlacement,
  hourLogs: propLogs,
  config,
  title = 'Cronograma de Prácticas de la Empresa',
}: PlacementScheduleProps) {
  const hookPlacement = usePlacement()
  const activePlacement = propPlacement !== undefined ? propPlacement : hookPlacement
  const hookLogs = useHourLogs(activePlacement?.id ?? 0)
  const activeLogs = propLogs !== undefined ? propLogs : hookLogs

  if (!activePlacement) {
    return null
  }

  const schedule: ScheduleSummary = generatePlacementSchedule(
    activePlacement,
    activeLogs,
    config,
  )

  const progressPercent = schedule.requiredHours > 0
    ? Math.min(100, Math.round((schedule.confirmedHours / schedule.requiredHours) * 100))
    : 0

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-divider/60 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stamp/10 text-stamp">
              <Calendar className="h-4 w-4" />
            </span>
            <h2 className="text-18 font-bold text-ink">{title}</h2>
          </div>
          <p className="mt-1 text-13 text-inkSoft">
            {activePlacement.companyName ? (
              <strong className="font-medium text-inkBody">{activePlacement.companyName}</strong>
            ) : (
              'La empresa'
            )}{' '}
            planificó <strong className="text-stamp">{schedule.totalSessions} sesiones</strong> de{' '}
            <strong className="text-stamp">{schedule.dailyHours} horas</strong> para justificar las{' '}
            <strong className="text-inkBody">{schedule.requiredHours} h requeridas</strong>.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-divider/50 bg-soft/60 px-4 py-2.5">
          <div className="flex flex-col text-right">
            <span className="font-data text-11 uppercase tracking-wider text-inkSoft">Progreso</span>
            <span className="font-data text-15 font-bold text-ink">
              {schedule.confirmedHours} / {schedule.requiredHours} h
            </span>
          </div>
          <div className="h-8 w-8 rounded-full border-2 border-stamp/20 flex items-center justify-center font-data text-11 font-bold text-stamp">
            {progressPercent}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-13 sm:grid-cols-4">
        <div className="rounded-lg bg-soft/40 p-3">
          <span className="block text-11 text-inkSoft">Horas Requeridas</span>
          <span className="font-data text-16 font-semibold text-ink">{schedule.requiredHours} h</span>
        </div>
        <div className="rounded-lg bg-soft/40 p-3">
          <span className="block text-11 text-inkSoft">Horas Planificadas</span>
          <span className="font-data text-16 font-semibold text-stamp">{schedule.plannedHours} h</span>
        </div>
        <div className="rounded-lg bg-soft/40 p-3">
          <span className="block text-11 text-inkSoft">Sesiones Totales</span>
          <span className="font-data text-16 font-semibold text-ink">{schedule.totalSessions}</span>
        </div>
        <div className="rounded-lg bg-soft/40 p-3">
          <span className="block text-11 text-inkSoft">Sesiones Confirmadas</span>
          <span className="font-data text-16 font-semibold text-forest">{schedule.confirmedSessions}</span>
        </div>
      </div>

      <div className="mt-2 max-h-[380px] overflow-y-auto rounded-lg border border-divider/50">
        <ul className="divide-y divide-divider/40">
          {schedule.sessions.map((s) => {
            const isDone = s.status === 'CONFIRMED' || s.status === 'APPROVED'
            return (
              <li
                key={s.date}
                className="flex items-center justify-between gap-3 p-3 text-13 transition hover:bg-soft/40"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-11 font-semibold ${
                      isDone ? 'bg-forest/10 text-forest' : 'bg-soft text-inkSoft'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.sessionIndex}
                  </span>
                  <div>
                    <span className="font-medium text-ink">{formatSessionDate(s.date)}</span>
                    <div className="flex items-center gap-2 text-12 text-inkSoft">
                      <span className="flex items-center gap-1 font-data">
                        <Clock className="h-3 w-3" />
                        {s.startTime} – {s.endTime} ({s.hours} h)
                      </span>
                      <span>·</span>
                      <span className="truncate max-w-[280px]">{s.activity}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-11 font-medium ${
                    s.status === 'APPROVED'
                      ? 'bg-forest/15 text-forest'
                      : s.status === 'CONFIRMED'
                        ? 'bg-stamp/15 text-stamp'
                        : s.status === 'REJECTED'
                          ? 'bg-void/15 text-void'
                          : 'bg-pending/15 text-pending'
                  }`}
                >
                  {s.status === 'CONFIRMED'
                    ? 'Confirmada'
                    : s.status === 'APPROVED'
                      ? 'Aprobada'
                      : s.status === 'REJECTED'
                        ? 'Rechazada'
                        : 'Pendiente'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

