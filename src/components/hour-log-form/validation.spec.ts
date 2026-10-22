import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { checkDuplicateHourLog } from './duplicates'
import { buildFormErrors } from './validation'

vi.mock('@/lib/institution-timezone', () => ({
  getCurrentDateInInstitutionTz: () => '2026-10-20', INSTITUTION_TIMEZONE: 'America/Guayaquil',
}))
vi.mock('@/offline/db', () => ({ db: { placements: { get: vi.fn() } } }))
vi.mock('./duplicates', () => ({ checkDuplicateHourLog: vi.fn() }))
const validate = (date = '2026-10-13', start = '08:00', end = '12:00', hours = '4', activity = 'Apoyo') =>
  buildFormErrors(1, date, start, end, hours, activity)

beforeEach(() => {
  vi.mocked(db.placements.get).mockResolvedValue({ startDate: '2026-10-01', endDate: '2026-10-15' } as Awaited<ReturnType<typeof db.placements.get>>)
  vi.mocked(checkDuplicateHourLog).mockReset().mockResolvedValue(null)
})
describe('extracted form validation', () => {
  it('requires fields and skips duplicate lookup for invalid input', async () => {
    expect(await validate('', '', '', '', ' ')).toEqual({ date: 'La fecha es obligatoria',
      startTime: 'La hora de inicio es obligatoria', endTime: 'La hora de fin es obligatoria',
      hours: 'Ingresa un número de horas válido', activity: 'Describe la actividad realizada' })
    expect(checkDuplicateHourLog).not.toHaveBeenCalled()
  })
  it.each([
    ['12:00', '08:00', '4', 'startTime', 'la hora de inicio debe ser anterior a la de fin'],
    ['08:00', '08:20', '0.33', 'hours', 'las horas deben estar entre 0.5 y 10'],
    ['08:00', '19:00', '11', 'hours', 'las horas deben estar entre 0.5 y 10'],
  ])('validates %s to %s', async (start, end, hours, field, message) => {
    expect(await validate('2026-10-13', start, end, hours)).toEqual({ [field]: message })
  })
  it('rejects dates outside the placement and unavailable placements', async () => {
    expect((await validate('2026-09-30')).date).toContain('fuera del rango')
    vi.mocked(db.placements.get).mockResolvedValue(undefined)
    expect((await validate()).date).toContain('No se pudo validar')
  })
  it('accepts valid values and propagates duplicate errors', async () => {
    expect(await validate()).toEqual({})
    expect(checkDuplicateHourLog).toHaveBeenCalledWith(1, '2026-10-13', '08:00', '12:00', 'Apoyo')
    vi.mocked(checkDuplicateHourLog).mockResolvedValue({ field: 'activity', message: 'duplicado' })
    expect(await validate()).toEqual({ activity: 'duplicado' })
  })
})
