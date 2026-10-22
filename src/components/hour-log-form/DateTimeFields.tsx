import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { renderFieldError } from './FieldError'
import type { HourLogFormController } from './useHourLogForm'

export function DateTimeFields({ form }: { form: HourLogFormController }) {
  const { date, startTime, endTime, errors, confirmationLabel, durationLabel, maxDate, handleDateChange, handleStartTimeChange, handleEndTimeChange } = form
  return (<>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlog-date">Fecha</Label>
        <Input
          id="hourlog-date"
          type="date"
          max={maxDate}
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

  </>)
}
