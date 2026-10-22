import { Button } from '@/components/ui/button'
import { DateTimeFields } from './DateTimeFields'
import { ActivityFields } from './ActivityFields'
import type { HourLogFormController } from './useHourLogForm'

export function HourLogFormView({ form }: { form: HourLogFormController }) {
  const { submitError, submitting } = form
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); form.handleSubmit() }} noValidate>
      <DateTimeFields form={form} />
      <ActivityFields form={form} />
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
