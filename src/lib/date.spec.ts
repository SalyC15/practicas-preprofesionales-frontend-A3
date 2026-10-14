import { describe, expect, it } from 'vitest'
import {
  getCalendarDatePrefix,
  isValidCalendarDate,
  parseLocalDate,
  parseStoredCalendarDateUtc,
  validateHourLogCalendarDate,
} from './date'

describe('parseLocalDate', () => {
  it('parses a date-only ISO string as local midnight, not UTC midnight', () => {
    const parsed = parseLocalDate('2026-01-01')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(0)
    expect(parsed.getDate()).toBe(1)
  })

  it('ignores a time component and offset, preserving the legacy date prefix', () => {
    const parsed = parseLocalDate('2026-08-04T23:30:00-05:00')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(7)
    expect(parsed.getDate()).toBe(4)
  })

  it('preserves the original local Date overflow behavior for malformed calendar days', () => {
    const parsed = parseLocalDate('2026-02-30')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(2)
    expect(parsed.getDate()).toBe(2)
  })
})

describe('calendar-date helpers', () => {
  it('accepts real calendar dates and rejects impossible days and non-date input', () => {
    expect(isValidCalendarDate('2026-02-28')).toBe(true)
    expect(isValidCalendarDate('2026-02-30')).toBe(false)
    expect(isValidCalendarDate('2026-2-03')).toBe(false)
  })

  it('extracts valid legacy calendar prefixes without applying timestamp offsets', () => {
    expect(getCalendarDatePrefix('2026-10-13')).toBe('2026-10-13')
    expect(getCalendarDatePrefix('2026-10-13T00:00:00.000Z')).toBe('2026-10-13')
    expect(getCalendarDatePrefix('2026-10-13T23:30:00-05:00')).toBe('2026-10-13')
    expect(getCalendarDatePrefix('2026-02-30T00:00:00Z')).toBeNull()
    expect(getCalendarDatePrefix('not a date')).toBeNull()
  })

  it('parses stored legacy timestamps at UTC midnight using their date prefix', () => {
    expect(parseStoredCalendarDateUtc('2026-10-13T23:30:00-05:00').toISOString())
      .toBe('2026-10-13T00:00:00.000Z')
    expect(Number.isNaN(parseStoredCalendarDateUtc('not a date').getTime())).toBe(true)
  })

  it('rejects future dates with the server-aligned Spanish message', () => {
    expect(validateHourLogCalendarDate('2026-10-14', '2026-10-13', '2026-10-15', '2026-10-13'))
      .toBe('No se pueden registrar horas con fecha futura')
  })

  it('rejects dates outside inclusive placement bounds with the exact range', () => {
    expect(validateHourLogCalendarDate('2026-10-12', '2026-10-13', '2026-10-15', '2026-10-20'))
      .toBe('La fecha del registro (2026-10-12) está fuera del rango válido de la práctica (2026-10-13 a 2026-10-15).')
    expect(validateHourLogCalendarDate('2026-10-16', '2026-10-13', '2026-10-15', '2026-10-20'))
      .toBe('La fecha del registro (2026-10-16) está fuera del rango válido de la práctica (2026-10-13 a 2026-10-15).')
    expect(validateHourLogCalendarDate('2026-02-30', '2026-02-01', '2026-02-28', '2026-03-01'))
      .toBe('Ingresa una fecha válida')
    expect(validateHourLogCalendarDate('2026-10-14', 'invalid', '2026-10-15', '2026-10-20'))
      .toBe('No se pudo validar el período de la práctica en este dispositivo')
  })

  it.each(['2026-10-13', '2026-10-15'])('accepts inclusive placement boundary %s', (date) => {
    expect(validateHourLogCalendarDate(date, '2026-10-13', '2026-10-15', '2026-10-20')).toBeNull()
  })

  it.each([null, undefined, ''])('accepts the placement start when no end date is defined (%s)', (endDate) => {
    expect(validateHourLogCalendarDate('2026-10-13', '2026-10-13', endDate, '2026-10-13')).toBeNull()
  })

  it('rejects a day before an open-ended placement with the explicit open range', () => {
    expect(validateHourLogCalendarDate('2026-10-12', '2026-10-13', null, '2026-10-20'))
      .toBe('La fecha del registro (2026-10-12) está fuera del rango válido de la práctica (desde 2026-10-13, sin fecha de fin definida).')
  })

  it('still rejects a future day and an invalid supplied end for an open-ended placement', () => {
    expect(validateHourLogCalendarDate('2026-10-14', '2026-10-13', null, '2026-10-13'))
      .toBe('No se pueden registrar horas con fecha futura')
    expect(validateHourLogCalendarDate('2026-10-13', '2026-10-13', '2026-02-30', '2026-10-20'))
      .toBe('No se pudo validar el período de la práctica en este dispositivo')
  })
})
