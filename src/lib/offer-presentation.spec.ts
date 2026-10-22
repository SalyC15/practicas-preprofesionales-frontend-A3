import { describe, expect, it } from 'vitest'
import { isOfferExpired, modalityLabel, offerAvailability } from './offer-presentation'

describe('presentación de convocatorias', () => {
  it('mantiene abierto todo el último día del periodo institucional', () => {
    expect(isOfferExpired('2026-10-22T00:00:00.000Z', '2026-10-22')).toBe(false)
    expect(isOfferExpired('2026-10-22T00:00:00.000Z', '2026-10-23')).toBe(true)
  })
  it('distingue convocatoria cerrada, borrador y periodo finalizado', () => {
    expect(offerAvailability({ status: 'CLOSED', periodEnd: '2026-12-31' }, '2026-10-22')).toBe('Convocatoria cerrada')
    expect(offerAvailability({ status: 'DRAFT', periodEnd: '2026-12-31' }, '2026-10-22')).toBe('Borrador')
    expect(offerAvailability({ status: 'PUBLISHED', periodEnd: '2026-07-31' }, '2026-10-22')).toBe('Periodo finalizado')
    expect(offerAvailability({ status: 'PUBLISHED', periodEnd: '2026-12-31' }, '2026-10-22')).toBe('Convocatoria abierta')
  })
  it('presenta modalidades legibles sin perder valores personalizados', () => {
    expect(modalityLabel('HIBRIDA')).toBe('Híbrida')
    expect(modalityLabel('PRESENCIAL')).toBe('Presencial')
    expect(modalityLabel('Por turnos')).toBe('Por turnos')
  })
})
