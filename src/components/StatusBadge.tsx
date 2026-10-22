import { Chip, type ChipTone } from '@/components/Chip'

const STATUS_TONE: Record<string, ChipTone> = {
  // Aprobado / Exitoso / Activo / Validado
  APPROVED: 'stamp',
  APROBADO: 'stamp',
  ACCEPTED: 'stamp',
  ACEPTADA: 'stamp',
  ACEPTADO: 'stamp',
  ACTIVE: 'stamp',
  ACTIVA: 'stamp',
  ACTIVO: 'stamp',
  VALIDATED: 'stamp',
  VALIDADO: 'stamp',
  VALIDADA: 'stamp',
  PUBLISHED: 'stamp',
  PUBLICADA: 'stamp',
  PUBLICADO: 'stamp',
  COMPLETED: 'stamp',
  COMPLETADA: 'stamp',
  COMPLETADO: 'stamp',
  VERIFICADA: 'stamp',
  VERIFICADO: 'stamp',
  ACREDITADO: 'stamp',

  // Pendiente / En revisión / Por revisar / Borrador
  SUBMITTED: 'pending',
  ENVIADO: 'pending',
  ENVIADA: 'pending',
  PENDING: 'pending',
  PENDIENTE: 'pending',
  PENDING_DOCS: 'pending',
  INTERVIEW: 'pending',
  ENTREVISTA: 'pending',
  EN_ENTREVISTA: 'pending',
  DRAFT: 'pending',
  BORRADOR: 'pending',
  ACREDITADO_CON_OBSERVACIONES: 'pending',

  // Rechazado / Cancelado / Inactivo / Cerrado
  REJECTED: 'void',
  RECHAZADO: 'void',
  RECHAZADA: 'void',
  ABANDONED: 'void',
  ABANDONADA: 'void',
  ABANDONADO: 'void',
  SUSPENDED: 'void',
  SUSPENDIDA: 'void',
  SUSPENDIDO: 'void',
  CLOSED: 'void',
  CERRADA: 'void',
  CERRADO: 'void',
  WITHDRAWN: 'void',
  RETIRADA: 'void',
  RETIRADO: 'void',
  NO_ACREDITADO: 'void',
}

export const STATUS_LABEL: Record<string, string> = {
  // Estados de horas (HourLogStatus)
  APPROVED: 'APROBADO',
  SUBMITTED: 'ENVIADO',
  REJECTED: 'RECHAZADO',
  DRAFT: 'BORRADOR',

  // Estados de postulaciones (ApplicationStatus)
  ACCEPTED: 'ACEPTADA',
  INTERVIEW: 'EN ENTREVISTA',
  WITHDRAWN: 'RETIRADA',

  // Estados de ofertas (OfferStatus)
  PUBLISHED: 'PUBLICADA',
  CLOSED: 'CERRADA',

  // Estados de prácticas (PlacementStatus)
  ACTIVE: 'ACTIVA',
  PENDING_DOCS: 'DOCS PENDIENTES',
  COMPLETED: 'COMPLETADA',
  ABANDONED: 'ABANDONADA',
  SUSPENDED: 'SUSPENDIDA',

  // Estados de documentos (DocumentStatus)
  PENDING: 'PENDIENTE',
  VALIDATED: 'VALIDADO',

  // Acreditación y empresas
  ACREDITADO: 'ACREDITADO',
  ACREDITADO_CON_OBSERVACIONES: 'ACREDITADO CON OBS.',
  NO_ACREDITADO: 'NO ACREDITADO',
  VERIFICADA: 'VERIFICADA',
  PENDIENTE: 'PENDIENTE',
  APROBADO: 'APROBADO',
  ENVIADO: 'ENVIADO',
  RECHAZADO: 'RECHAZADO',
  BORRADOR: 'BORRADOR',
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  const label = STATUS_LABEL[status] ?? status
  return <Chip tone={tone}>{label}</Chip>
}
