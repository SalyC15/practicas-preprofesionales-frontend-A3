export interface FormErrors {
  date?: string
  startTime?: string
  endTime?: string
  hours?: string
  activity?: string
}


export interface HourLogSubmitValues {
  placementId: number
  date: string
  startTime: string
  endTime: string
  hours: string
  activity: string
}

export interface HourLogSubmitActions {
  setErrors: (errors: FormErrors) => void
  setSubmitting: (submitting: boolean) => void
  setSubmitError: (error: string | null) => void
  resetForm: () => void
  onSaved?: () => void
}
