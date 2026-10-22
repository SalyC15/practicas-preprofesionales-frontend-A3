import { calculateHoursFromTimes } from '@/lib/hour-log-validation'
import { todayAsInputValue } from './labels'
import type { FormErrors } from './types'

export interface FormValues {
  date: string
  startTime: string
  endTime: string
  hours: string
  activity: string
}
export interface FormState extends FormValues {
  errors: FormErrors
  submitting: boolean
  submitError: string | null
}
export type FormAction =
  | { type: 'change'; field: Exclude<keyof FormValues, 'hours'>; value: string }
  | { type: 'errors'; errors: FormErrors }
  | { type: 'submitting'; submitting: boolean }
  | { type: 'failure'; error: string | null }
  | { type: 'reset'; date: string }

export function initialFormState(date = todayAsInputValue()): FormState {
  return { date, startTime: '', endTime: '', hours: '', activity: '',
    errors: {}, submitting: false, submitError: null }
}

export function hourLogFormReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'change': {
      const next = { ...state, [action.field]: action.value,
        errors: { ...state.errors, [action.field]: undefined }, submitError: null }
      if (action.field === 'startTime' || action.field === 'endTime') {
        const auto = calculateHoursFromTimes(next.startTime, next.endTime)
        next.hours = auto ?? ''
        if (auto) next.errors.hours = undefined
      }
      return next
    }
    case 'errors': return { ...state, errors: action.errors }
    case 'submitting': return { ...state, submitting: action.submitting }
    case 'failure': return { ...state, submitError: action.error }
    case 'reset': return { ...initialFormState(action.date), submitting: state.submitting }
  }
}
