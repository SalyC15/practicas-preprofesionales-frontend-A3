import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { db, type LocalHourLog } from '@/offline/db'
import { enqueue } from '@/offline/sync/push'
import { getCalendarDatePrefix, validateHourLogCalendarDate } from '@/lib/date'
import { getCurrentDateInInstitutionTz, INSTITUTION_TIMEZONE } from '@/lib/institution-timezone'
import {
  calculateHoursFromTimes,
  getHourLogValidationErrorMessage,
  HourLogValidationError,
  validateHourLogTimes,
} from '@/lib/hour-log-validation'

interface HourLogFormProps {
  placementId: number
  onSaved?: () => void
}

interface FormErrors {
  date?: string
  startTime?: string
  endTime?: string
  hours?: string
  activity?: string
}

// Fecha de hoy en formato YYYY-MM-DD, tal como la espera un <input type="date">.
function todayAsInputValue(): string {
  return getCurrentDateInInstitutionTz(INSTITUTION_TIMEZONE)
}

// Convierte la fecha elegida (YYYY-MM-DD) a una etiqueta legible en español
// para que el estudiante confirme, de un vistazo, qué día está registrando
// antes de guardar. Se recalcula en cada render: no hay useMemo aquí porque
// es una operación barata y el formulario no necesita esa complejidad.
function formatDateForConfirmation(dateValue: string): string {
  if (!dateValue) return ''
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return ''
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

// Duración calculada a partir de la hora de inicio y de fin, para que el
// estudiante pueda comparar contra lo que va a escribir en "Horas" antes de
// guardar. Puramente informativo: no toca las horas que finalmente se
// registran, esas siempre vienen del campo "Horas".
function computeDurationLabel(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) {
    return null
  }
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  const diffMinutes = endMinutes - startMinutes
  if (diffMinutes <= 0) return null
  const diffHours = diffMinutes / 60
  return `Duración calculada: ${diffHours.toFixed(1)} h`
}

async function validateDateForPlacement(placementId: number, date: string): Promise<string | null> {
  if (!date) return 'La fecha es obligatoria'

  const placement = await db.placements.get(placementId)
  return placement
    ? validateHourLogCalendarDate(
        date,
        placement.startDate,
        placement.endDate,
        getCurrentDateInInstitutionTz(INSTITUTION_TIMEZONE),
      )
    : 'No se pudo validar el período de la práctica en este dispositivo'
}

async function checkDuplicateHourLog(
  placementId: number,
  date: string,
  startTime: string,
  endTime: string,
  activity: string,
): Promise<{ field: 'activity' | 'startTime'; message: string } | null> {
  if (!date || !startTime || !endTime) return null
  const normalizedActivity = activity.trim().toLowerCase()

  const existingLogs = await db.hourLogs
    .where('placementId')
    .equals(placementId)
    .toArray()

  for (const log of existingLogs) {
    if (log.status === 'REJECTED') continue

    // Si la fila quedó varada en 'local' con id temporal negativo y no llegó al outbox
    // (por un fallo previo o cierre abortado), la purgamos para no bloquear al usuario
    // con falsos duplicados ni dejar registros fantasmas.
    if (log.syncState === 'local' && log.id < 0) {
      const outboxEntries = await db.outbox.toArray()
      const isEnqueued = outboxEntries.some((e) => (e.payload as { id?: number })?.id === log.id)
      if (!isEnqueued) {
        await db.hourLogs.delete(log.id).catch(() => {})
        continue
      }
    }

    const logDate = getCalendarDatePrefix(log.date) ?? log.date
    if (logDate === date) {
      if (log.startTime === startTime && log.endTime === endTime) {
        if (log.activity.trim().toLowerCase() === normalizedActivity) {
          return {
            field: 'activity',
            message: 'Ya existe un registro con la misma fecha, horario y actividad.',
          }
        }
        return {
          field: 'startTime',
          message: `Ya tienes horas registradas en este mismo horario (${startTime}–${endTime}).`,
        }
      }

      // Detecta solapamiento de horario en la misma fecha (ej: 10:00–12:00 vs 11:00–13:00)
      if (startTime < log.endTime && endTime > log.startTime) {
        return {
          field: 'startTime',
          message: `El horario (${startTime}–${endTime}) se solapa con otro registro existente (${log.startTime}–${log.endTime}).`,
        }
      }
    }
  }

  return null
}

async function buildFormErrors(
  placementId: number,
  date: string,
  startTime: string,
  endTime: string,
  hours: string,
  activity: string,
): Promise<FormErrors> {
  const nextErrors: FormErrors = {}
  const dateMessage = await validateDateForPlacement(placementId, date)
  if (dateMessage) nextErrors.date = dateMessage

  if (!startTime) {
    nextErrors.startTime = 'La hora de inicio es obligatoria'
  }
  if (!endTime) {
    nextErrors.endTime = 'La hora de fin es obligatoria'
  }
  if (!activity.trim()) {
    nextErrors.activity = 'Describe la actividad realizada'
  }

  let hasTimeOrderError = false
  if (startTime && endTime) {
    try {
      validateHourLogTimes({ startTime, endTime })
    } catch (error) {
      if (error instanceof HourLogValidationError) {
        nextErrors.startTime = error.message
        hasTimeOrderError = true
      }
    }
  }

  if (!hasTimeOrderError) {
    if (!hours) {
      nextErrors.hours = 'Ingresa un número de horas válido'
    } else {
      const hoursMessage = getHourLogValidationErrorMessage(hours, startTime, endTime)
      if (hoursMessage) {
        nextErrors.hours = hoursMessage
      }
    }
  }

  // Comprobar que no sea un registro duplicado si no hay errores básicos
  if (!nextErrors.date && !nextErrors.startTime && !nextErrors.endTime && !nextErrors.hours && !nextErrors.activity) {
    const duplicate = await checkDuplicateHourLog(placementId, date, startTime, endTime, activity)
    if (duplicate) {
      nextErrors[duplicate.field] = duplicate.message
    }
  }

  return nextErrors
}

interface HourLogSubmitValues {
  placementId: number
  date: string
  startTime: string
  endTime: string
  hours: string
  activity: string
}

interface HourLogSubmitActions {
  setErrors: (errors: FormErrors) => void
  setSubmitting: (submitting: boolean) => void
  setSubmitError: (error: string | null) => void
  resetForm: () => void
  onSaved?: () => void
}

function renderFieldError(message: string | undefined, id: string) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-12 text-void">
      {message}
    </p>
  )
}

async function submitHourLog(
  event: FormEvent<HTMLFormElement>,
  values: HourLogSubmitValues,
  actions: HourLogSubmitActions,
) {
  event.preventDefault()
  actions.setSubmitError(null)
  actions.setSubmitting(true)

  try {
    const nextErrors = await buildFormErrors(
      values.placementId,
      values.date,
      values.startTime,
      values.endTime,
      values.hours,
      values.activity,
    )
    actions.setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      // Los errores ya se renderizan contextualizados debajo del campo correspondiente.
      // No duplicamos el mensaje en el banner general de submitError.
      return
    }

    // Id local temporal: negativo para no chocar jamás con un id real del
    // servidor (que siempre es positivo). Cuando el servidor confirme el
    // registro, applyResults lo reemplaza; hasta entonces vive solo aquí,
    // en este dispositivo, y la UI nunca lo muestra tal cual.
    const localId = -Date.now()
    const nowIso = new Date().toISOString()
    const hoursValue = Number(values.hours)
    const trimmedActivity = values.activity.trim()

    const row: LocalHourLog = {
      id: localId,
      placementId: values.placementId,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      hours: hoursValue,
      activity: trimmedActivity,
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: nowIso,
      syncState: 'local',
    }

    // 1) Escribe local primero:
    await db.hourLogs.add(row)

    // 2) Encola la operación para cuando haya conexión.
    // enqueue() gestiona internamente withSyncLock y su propia transacción
    // sobre db.outbox y db.hourLogs, actualizando syncState a 'queued'.
    // NOTA: No envolver enqueue() en un db.transaction() externo porque
    // navigator.locks dentro de una transacción activa de IndexedDB aborta
    // la transacción en navegadores reales (PrematureCommitError / TransactionInactiveError).
    try {
      await enqueue({
        entity: 'hourLog',
        op: 'create',
        payload: {
          id: row.id,
          placementId: row.placementId,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          hours: row.hours,
          activity: row.activity,
          status: row.status,
          reviewNote: row.reviewNote,
          version: row.version,
          updatedAt: row.updatedAt,
        },
        baseVersion: null,
      })
    } catch (enqueueError) {
      // Si enqueue falla, limpiamos la fila local para no dejar rezagos huérfanos ni falsos duplicados
      await db.hourLogs.delete(row.id).catch(() => {})
      throw enqueueError
    }

    actions.resetForm()
    actions.onSaved?.()
  } catch (error) {
    console.error('Error al guardar horas en el dispositivo:', error)
    actions.setSubmitError('No se pudo guardar el registro en este dispositivo. Intenta de nuevo.')
  } finally {
    actions.setSubmitting(false)
  }
}

export function HourLogForm({ placementId, onSaved }: HourLogFormProps) {
  const [date, setDate] = useState(todayAsInputValue())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hours, setHours] = useState('')
  const [activity, setActivity] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const confirmationLabel = formatDateForConfirmation(date)
  const durationLabel = computeDurationLabel(startTime, endTime)
  let liveHoursWarning: string | null = null
  if (startTime && endTime) {
    try {
      validateHourLogTimes({ startTime, endTime })
      if (hours) {
        liveHoursWarning = getHourLogValidationErrorMessage(hours, startTime, endTime)
      }
    } catch (error) {
      if (error instanceof HourLogValidationError) {
        liveHoursWarning = error.message
      }
    }
  }

  function resetForm() {
    setDate(todayAsInputValue())
    setStartTime('')
    setEndTime('')
    setHours('')
    setActivity('')
    setErrors({})
    setSubmitError(null)
  }

  function handleDateChange(value: string) {
    setDate(value)
    if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }))
    if (submitError) setSubmitError(null)
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value)
    if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: undefined }))
    if (submitError) setSubmitError(null)
    const auto = calculateHoursFromTimes(value, endTime)
    setHours(auto ?? '')
    if (auto && errors.hours) setErrors((prev) => ({ ...prev, hours: undefined }))
  }

  function handleEndTimeChange(value: string) {
    setEndTime(value)
    if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: undefined }))
    if (submitError) setSubmitError(null)
    const auto = calculateHoursFromTimes(startTime, value)
    setHours(auto ?? '')
    if (auto && errors.hours) setErrors((prev) => ({ ...prev, hours: undefined }))
  }

  function handleActivityChange(value: string) {
    setActivity(value)
    if (errors.activity) setErrors((prev) => ({ ...prev, activity: undefined }))
    if (submitError) setSubmitError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submitHourLog(
      event,
      { placementId, date, startTime, endTime, hours, activity },
      { setErrors, setSubmitting, setSubmitError, resetForm, onSaved },
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-date">Fecha</Label>
        <Input
          id="hourlog-date"
          type="date"
          max={todayAsInputValue()}
          value={date}
          onChange={(event) => handleDateChange(event.target.value)}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? 'hourlog-date-error' : undefined}
          className="font-data"
        />
        {confirmationLabel ? (
          <p className="font-data text-12 text-inkSoft">{confirmationLabel}</p>
        ) : null}
        {renderFieldError(errors.date, 'hourlog-date-error')}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hourlog-start">Hora de inicio</Label>
          <Input
            id="hourlog-start"
            type="time"
            value={startTime}
            onChange={(event) => handleStartTimeChange(event.target.value)}
            aria-invalid={Boolean(errors.startTime)}
            aria-describedby={errors.startTime ? 'hourlog-start-error' : undefined}
            className="font-data"
          />
          {renderFieldError(errors.startTime, 'hourlog-start-error')}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hourlog-end">Hora de fin</Label>
          <Input
            id="hourlog-end"
            type="time"
            value={endTime}
            onChange={(event) => handleEndTimeChange(event.target.value)}
            aria-invalid={Boolean(errors.endTime)}
            aria-describedby={errors.endTime ? 'hourlog-end-error' : undefined}
            className="font-data"
          />
          {renderFieldError(errors.endTime, 'hourlog-end-error')}
        </div>
      </div>

      {durationLabel ? (
        <p className="-mt-2 font-data text-12 text-inkSoft">{durationLabel}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-hours">Horas</Label>
        <Input
          id="hourlog-hours"
          type="number"
          readOnly
          value={hours}
          placeholder="Calculado automáticamente"
          aria-readonly="true"
          aria-invalid={Boolean(errors.hours)}
          aria-describedby={errors.hours ? 'hourlog-hours-error' : 'hourlog-hours-hint'}
          className="font-data tabular-nums bg-soft/50 text-ink cursor-not-allowed select-none"
        />
        <p id="hourlog-hours-hint" className="text-12 text-inkSoft">
          Calculado automáticamente según la hora de inicio y fin.
        </p>
        {liveHoursWarning && !errors.hours && !errors.startTime ? (
          <p className="text-12 text-pending">{liveHoursWarning}</p>
        ) : null}
        {renderFieldError(errors.hours, 'hourlog-hours-error')}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-activity">Actividad</Label>
        <Textarea
          id="hourlog-activity"
          value={activity}
          onChange={(event) => handleActivityChange(event.target.value)}
          aria-invalid={Boolean(errors.activity)}
          aria-describedby={errors.activity ? 'hourlog-activity-error' : undefined}
          rows={3}
          placeholder="Qué hiciste durante este bloque de horas"
        />
        {renderFieldError(errors.activity, 'hourlog-activity-error')}
      </div>

      {submitError ? (
        <div role="alert" className="rounded-lg border border-void/30 bg-chipVoid/80 px-3.5 py-2.5 text-13 font-medium text-void">
          {submitError}
        </div>
      ) : null}

      <p className="text-12 text-inkSoft">
        Se guarda en este dispositivo aunque no tengas conexión. Se sincroniza solo cuando vuelvas a estar en línea
      </p>

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar horas'}
      </Button>
    </form>
  )
}
