import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { renderFieldError } from './FieldError'
import type { HourLogFormController } from './useHourLogForm'
import { Textarea } from '@/components/ui/textarea'

export function ActivityFields({ form }: { form: HourLogFormController }) {
  const { hours, activity, errors, liveHoursWarning, handleActivityChange } = form
  return (<>
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

  </>)
}
