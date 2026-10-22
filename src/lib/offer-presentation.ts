import { getCurrentDateInInstitutionTz } from './institution-timezone'

export function modalityLabel(modality: string): string {
  const labels: Record<string, string> = { HIBRIDA: 'Híbrida', 'HÍBRIDA': 'Híbrida', PRESENCIAL: 'Presencial', REMOTA: 'Remota', REMOTO: 'Remota', VIRTUAL: 'Virtual' }
  return labels[modality.toUpperCase()] ?? modality
}

export function isOfferExpired(periodEnd: string, today = getCurrentDateInInstitutionTz()): boolean {
  return periodEnd.slice(0, 10) < today
}

export function offerAvailability(offer: { status: string; periodEnd: string }, today?: string): string {
  if (offer.status === 'CLOSED') return 'Convocatoria cerrada'
  if (offer.status === 'DRAFT') return 'Borrador'
  return isOfferExpired(offer.periodEnd, today) ? 'Periodo finalizado' : 'Convocatoria abierta'
}
