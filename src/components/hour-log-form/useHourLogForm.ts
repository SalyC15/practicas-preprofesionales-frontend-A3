import { useReducer } from 'react'
import { getHourLogValidationErrorMessage, HourLogValidationError, validateHourLogTimes } from '@/lib/hour-log-validation'
import { computeDurationLabel, formatDateForConfirmation, todayAsInputValue } from './labels'
import { hourLogFormReducer, initialFormState, type FormValues } from './state'
import { submitHourLog } from './submit'

export function useHourLogForm(placementId: number, onSaved?: () => void) {
  const [state, dispatch] = useReducer(hourLogFormReducer, undefined, () => initialFormState())
  const { date, startTime, endTime, hours } = state
  let liveHoursWarning: string | null = null
  if (startTime && endTime) {
    try {
      validateHourLogTimes({ startTime, endTime })
      if (hours) liveHoursWarning = getHourLogValidationErrorMessage(hours, startTime, endTime)
    } catch (error) {
      if (error instanceof HourLogValidationError) liveHoursWarning = error.message
    }
  }
  function change(field: Exclude<keyof FormValues, 'hours'>, value: string) {
    dispatch({ type: 'change', field, value })
  }
  function handleSubmit() {
    void submitHourLog({ ...state, placementId }, {
      setErrors: (errors) => dispatch({ type: 'errors', errors }),
      setSubmitting: (submitting) => dispatch({ type: 'submitting', submitting }),
      setSubmitError: (error) => dispatch({ type: 'failure', error }),
      resetForm: () => dispatch({ type: 'reset', date: todayAsInputValue() }),
      onSaved,
    })
  }
  return { ...state, liveHoursWarning, maxDate: todayAsInputValue(),
    confirmationLabel: formatDateForConfirmation(date),
    durationLabel: computeDurationLabel(startTime, endTime),
    handleDateChange: (value: string) => change('date', value),
    handleStartTimeChange: (value: string) => change('startTime', value),
    handleEndTimeChange: (value: string) => change('endTime', value),
    handleActivityChange: (value: string) => change('activity', value),
    handleSubmit }
}
export type HourLogFormController = ReturnType<typeof useHourLogForm>
