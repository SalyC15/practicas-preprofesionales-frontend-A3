import { db } from '@/offline/db'
import { validateHourLogCalendarDate } from '@/lib/date'
import { getCurrentDateInInstitutionTz, INSTITUTION_TIMEZONE } from '@/lib/institution-timezone'
import { getHourLogValidationErrorMessage, HourLogValidationError, validateHourLogTimes } from '@/lib/hour-log-validation'
import { checkDuplicateHourLog } from './duplicates'
import type { FormErrors } from './types'
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

export async function buildFormErrors(
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

  Object.assign(nextErrors, validateTimeFields(startTime, endTime, hours))

  // Comprobar que no sea un registro duplicado si no hay errores básicos
  if (Object.keys(nextErrors).length === 0) {
    const duplicate = await checkDuplicateHourLog(placementId, date, startTime, endTime, activity)
    if (duplicate) {
      nextErrors[duplicate.field] = duplicate.message
    }
  }

  return nextErrors
}

function validateTimeFields(startTime: string, endTime: string, hours: string): FormErrors {
  if (startTime && endTime) {
    try {
      validateHourLogTimes({ startTime, endTime })
    } catch (error) {
      if (error instanceof HourLogValidationError) return { startTime: error.message }
    }
  }
  const message = getHourLogValidationErrorMessage(hours, startTime, endTime)
  return message ? { hours: message } : {}
}
