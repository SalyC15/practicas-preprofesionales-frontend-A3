import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { type OfferApplication, type Tutor, createPlacement, listTutors } from '@/api/companies'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { GraduationCap } from 'lucide-react'

interface AssignTutorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: OfferApplication | null
  offerTitle?: string
  onPlacementCreated: () => void
}

export function AssignTutorDialog({
  open,
  onOpenChange,
  application,
  offerTitle,
  onPlacementCreated,
}: AssignTutorDialogProps) {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loadingTutors, setLoadingTutors] = useState(false)
  const [selectedTutorId, setSelectedTutorId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setSelectedTutorId('')
      setLoadingTutors(true)
      listTutors()
        .then((data) => {
          setTutors(data)
          if (data.length > 0) {
            setSelectedTutorId(String(data[0].id))
          }
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los tutores')
        })
        .finally(() => {
          setLoadingTutors(false)
        })
    }
  }, [open])

  async function handleConfirm() {
    if (!application || !selectedTutorId) return
    setSubmitting(true)
    setError(null)

    try {
      await createPlacement(application.id, Number(selectedTutorId))
      onPlacementCreated()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la práctica para este estudiante')
    } finally {
      setSubmitting(false)
    }
  }

  if (!application) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stamp/15 text-stamp">
              <GraduationCap className="h-4 w-4" />
            </span>
            <DialogTitle>Asignar Tutor y Crear Práctica</DialogTitle>
          </div>
          <DialogDescription>
            Crear la plaza de práctica oficial para{' '}
            <strong className="text-ink font-semibold">{application.student.fullName}</strong> en{' '}
            <strong className="text-ink font-semibold">{offerTitle ?? 'la oferta'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-soft/50 p-3 text-13">
              <p className="text-inkSoft">
                Estudiante:{' '}
                <strong className="text-ink">{application.student.fullName}</strong> ({application.student.email})
              </p>
              <p className="mt-1 text-inkSoft">
                Estado postulación:{' '}
                <span className="font-semibold text-stamp">{application.status}</span>
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tutor-select">Tutor Académico Asignado</Label>
              {loadingTutors ? (
                <p className="text-12 text-inkSoft">Cargando tutores disponibles…</p>
              ) : tutors.length === 0 ? (
                <p className="text-12 text-void">No hay tutores registrados en el sistema.</p>
              ) : (
                <select
                  id="tutor-select"
                  className="flex h-field w-full items-center justify-between rounded border border-line bg-surface px-3 text-14 text-ink focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/25"
                  value={selectedTutorId}
                  onChange={(e) => setSelectedTutorId(e.target.value)}
                  disabled={submitting}
                >
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.email})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-12 text-inkSoft">
                El tutor será responsable de revisar y validar las horas del estudiante.
              </p>
            </div>

            {error ? (
              <p role="alert" className="rounded-md bg-chipVoid px-3 py-2 text-13 text-void">
                {error}
              </p>
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !selectedTutorId || tutors.length === 0}
          >
            {submitting ? 'Creando práctica…' : 'Confirmar y Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
