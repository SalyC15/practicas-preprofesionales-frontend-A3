import { useState } from 'react'
import { Calendar, Clock, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Building2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { parseStoredCalendarDateUtc } from '@/lib/date'
import { generatePlacementSchedule, type ScheduledSession } from '@/lib/schedule'
import type { LocalPlacement } from '@/offline/db'

interface CompanyScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offerTitle: string
  companyName?: string
  requiredHours: number
  startDate?: string
  dailyHours?: number
  startTime?: string
  endTime?: string
  activity?: string
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
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function CompanyScheduleDialog({
  open,
  onOpenChange,
  offerTitle,
  companyName,
  requiredHours,
  startDate,
  dailyHours = 4,
  startTime = '08:00',
  endTime = '12:00',
  activity,
}: CompanyScheduleDialogProps) {
  const [showAllSessions, setShowAllSessions] = useState(false)

  // Crear un mock placement representativo para alimentar el generador
  const safeHours = Math.max(1, requiredHours || 300)
  const safeStartDate = startDate && startDate.trim() ? startDate : new Date().toISOString().split('T')[0]

  const mockPlacement: LocalPlacement = {
    id: 0,
    studentId: 0,
    tutorId: 0,
    companyId: 0,
    startDate: safeStartDate,
    endDate: safeStartDate,
    requiredHours: safeHours,
    status: 'ACTIVE',
    companyName: companyName ?? 'Empresa',
    offerTitle,
    updatedAt: new Date().toISOString(),
    version: 1,
  }

  const schedule = generatePlacementSchedule(mockPlacement, [], {
    dailyHours,
    startTime,
    endTime,
    workDays: [1, 2, 3, 4, 5],
    activity: activity || `Práctica preprofesional: ${offerTitle}`,
  })

  const visibleSessions: ScheduledSession[] = showAllSessions
    ? schedule.sessions
    : schedule.sessions.slice(0, 15)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stamp/15 text-stamp">
              <Calendar className="h-4 w-4" />
            </span>
            <DialogTitle>Cronograma de {safeHours} Horas · Empresa</DialogTitle>
          </div>
          <DialogDescription>
            Justificación automática de horas planificadas para{' '}
            <strong className="text-inkBody font-semibold">{offerTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            {/* Banner explicativo de la empresa y confirmación del estudiante */}
            <div className="rounded-xl border border-stamp/20 bg-stamp/5 p-4 text-13 text-inkDeep">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 flex-none text-stamp" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">
                    Justificación de {safeHours} horas laborables
                  </span>
                  <p className="text-12 text-inkSoft leading-relaxed">
                    Este cronograma distribuye automáticamente las{' '}
                    <strong className="text-stamp font-medium">{safeHours} horas</strong> en{' '}
                    <strong className="text-stamp font-medium">{schedule.totalSessions} sesiones</strong> de{' '}
                    <strong className="text-inkBody font-medium">{dailyHours} horas diarias</strong> (Lunes a Viernes de {startTime} a {endTime}).
                    Cuando el estudiante sea aceptado en la plaza, el sistema le cargará estas fechas y el estudiante{' '}
                    <span className="font-semibold text-forest">solo confirmará su asistencia con 1 clic</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Métricas del cronograma */}
            <div className="grid grid-cols-2 gap-3 text-13 sm:grid-cols-4">
              <div className="rounded-lg border border-divider/60 bg-soft/60 p-3">
                <span className="block text-11 font-medium uppercase tracking-wider text-inkSoft">
                  Horas Justificadas
                </span>
                <span className="font-data text-18 font-bold text-ink">
                  {schedule.plannedHours} h
                </span>
              </div>
              <div className="rounded-lg border border-divider/60 bg-soft/60 p-3">
                <span className="block text-11 font-medium uppercase tracking-wider text-inkSoft">
                  Sesiones Planificadas
                </span>
                <span className="font-data text-18 font-bold text-stamp">
                  {schedule.totalSessions}
                </span>
              </div>
              <div className="rounded-lg border border-divider/60 bg-soft/60 p-3">
                <span className="block text-11 font-medium uppercase tracking-wider text-inkSoft">
                  Horario Diario
                </span>
                <span className="font-data text-15 font-semibold text-ink">
                  {dailyHours} h/día
                </span>
                <span className="block text-10 text-inkSoft">{startTime}–{endTime}</span>
              </div>
              <div className="rounded-lg border border-divider/60 bg-soft/60 p-3">
                <span className="block text-11 font-medium uppercase tracking-wider text-inkSoft">
                  Jornada
                </span>
                <span className="text-13 font-semibold text-forest">
                  Lun a Vie
                </span>
                <span className="block text-10 text-inkSoft">Sin fines de semana</span>
              </div>
            </div>

            {/* Listado de sesiones planificadas */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-13 font-semibold text-ink">
                  Desglose de sesiones ({schedule.sessions.length} programadas)
                </h4>
                <span className="text-11 font-data text-inkSoft">
                  Fecha inicio: {formatSessionDate(safeStartDate)}
                </span>
              </div>

              <div className="max-h-[280px] overflow-y-auto rounded-lg border border-divider/60 bg-white">
                <ul className="divide-y divide-divider/40">
                  {visibleSessions.map((session) => (
                    <li
                      key={session.date}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-12 hover:bg-soft/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-soft font-data text-10 font-medium text-inkSoft">
                          {session.sessionIndex}
                        </span>
                        <div>
                          <span className="font-medium text-ink">
                            {formatSessionDate(session.date)}
                          </span>
                          <span className="ml-2 font-data text-inkSoft">
                            {session.startTime} – {session.endTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-data font-semibold text-ink">
                          {session.hours} h
                        </span>
                        <span className="rounded bg-stamp/10 px-1.5 py-0.5 text-10 font-medium text-stamp">
                          Planificada
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {schedule.sessions.length > 15 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-center text-12 text-stamp"
                  onClick={() => setShowAllSessions((prev) => !prev)}
                >
                  {showAllSessions ? (
                    <>
                      <ChevronUp className="mr-1 h-3.5 w-3.5" />
                      Ver menos sesiones
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3.5 w-3.5" />
                      Ver las {schedule.sessions.length - 15} sesiones restantes
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
