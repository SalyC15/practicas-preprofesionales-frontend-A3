import { HourLogFormView } from './hour-log-form/View'
import { useHourLogForm } from './hour-log-form/useHourLogForm'

interface HourLogFormProps {
  placementId: number
  onSaved?: () => void
}

export function HourLogForm({ placementId, onSaved }: HourLogFormProps) {
  const form = useHourLogForm(placementId, onSaved)
  return <HourLogFormView form={form} />
}
