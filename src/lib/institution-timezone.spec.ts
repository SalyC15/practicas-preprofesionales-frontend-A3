import { env } from 'node:process'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INSTITUTION_TIMEZONE,
  getCurrentDateInInstitutionTz,
  resolveInstitutionTimezone,
} from './institution-timezone'

describe('institution timezone configuration', () => {
  it('defaults to the backend institution timezone when no Vite value is configured', () => {
    expect(DEFAULT_INSTITUTION_TIMEZONE).toBe('America/Guayaquil')
    expect(resolveInstitutionTimezone(undefined)).toBe('America/Guayaquil')
    expect(resolveInstitutionTimezone('   ')).toBe('America/Guayaquil')
  })

  it('uses an explicitly configured timezone', () => {
    expect(resolveInstitutionTimezone(' Europe/Madrid ')).toBe('Europe/Madrid')
  })

  it('derives institution days for explicit zones at the same instant', () => {
    const instant = new Date('2026-10-14T01:00:00.000Z')

    expect(getCurrentDateInInstitutionTz('America/Guayaquil', instant)).toBe('2026-10-13')
    expect(getCurrentDateInInstitutionTz('Europe/Madrid', instant)).toBe('2026-10-14')
    expect(getCurrentDateInInstitutionTz('Asia/Tokyo', instant)).toBe('2026-10-14')
  })

  it('keeps the institution day unchanged when the device timezone changes', () => {
    const originalTimezone = env.TZ
    const instant = new Date('2026-10-14T01:00:00.000Z')

    try {
      env.TZ = 'Pacific/Honolulu'
      const deviceDayOne = getCurrentDateInInstitutionTz('America/Guayaquil', instant)
      env.TZ = 'Pacific/Kiritimati'
      const deviceDayTwo = getCurrentDateInInstitutionTz('America/Guayaquil', instant)
      expect(deviceDayOne).toBe('2026-10-13')
      expect(deviceDayTwo).toBe(deviceDayOne)
    } finally {
      if (originalTimezone === undefined) delete env.TZ
      else env.TZ = originalTimezone
    }
  })
})
