import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_HOUR_LOG_HOURS,
  DEFAULT_MIN_HOUR_LOG_HOURS,
  getHourLogValidationErrorMessage,
  HourLogValidationError,
  MAX_HOUR_LOG_HOURS,
  MIN_HOUR_LOG_HOURS,
  resolveHourLogBounds,
  validateHourLogHours,
  validateHourLogInput,
  validateHourLogTime,
  validateHourLogTimes,
} from './hour-log-validation'

describe('hour log validation rules and limits', () => {
  describe('bounds resolution and configuration', () => {
    it('uses default bounds matching the backend (0.5 to 10) when no overrides are given', () => {
      expect(DEFAULT_MIN_HOUR_LOG_HOURS).toBe(0.5)
      expect(DEFAULT_MAX_HOUR_LOG_HOURS).toBe(10)
      expect(MIN_HOUR_LOG_HOURS).toBe(0.5)
      expect(MAX_HOUR_LOG_HOURS).toBe(10)

      const bounds = resolveHourLogBounds(undefined, undefined)
      expect(bounds.minHours).toBe(0.5)
      expect(bounds.maxHours).toBe(10)
    })

    it('resolves configured bounds from valid numeric strings or numbers', () => {
      const bounds = resolveHourLogBounds('1', '8')
      expect(bounds.minHours).toBe(1)
      expect(bounds.maxHours).toBe(8)

      const numericBounds = resolveHourLogBounds(2, 6)
      expect(numericBounds.minHours).toBe(2)
      expect(numericBounds.maxHours).toBe(6)
    })

    it('falls back to defaults when configured values are invalid or contradictory', () => {
      expect(resolveHourLogBounds('invalid', 'bad')).toEqual({ minHours: 0.5, maxHours: 10 })
      expect(resolveHourLogBounds(-1, 0)).toEqual({ minHours: 0.5, maxHours: 10 })
      // maxHours cannot be less than minHours
      expect(resolveHourLogBounds(5, 4)).toEqual({ minHours: 5, maxHours: 10 })
    })
  })

  describe('hour duration limits and edge cases', () => {
    it('accepts exact lower and upper boundaries (0.5 and 10)', () => {
      expect(() => validateHourLogHours(0.5)).not.toThrow()
      expect(() => validateHourLogHours(10)).not.toThrow()
      expect(() => validateHourLogHours(MIN_HOUR_LOG_HOURS)).not.toThrow()
      expect(() => validateHourLogHours(MAX_HOUR_LOG_HOURS)).not.toThrow()
    })

    it('accepts valid intermediate hours', () => {
      expect(() => validateHourLogHours(1)).not.toThrow()
      expect(() => validateHourLogHours(4.5)).not.toThrow()
      expect(() => validateHourLogHours(8)).not.toThrow()
      expect(() => validateHourLogHours(9.5)).not.toThrow()
    })

    it.each([0.49, 0.4, 0, -0.5, -1])(
      'rejects values below the lower boundary %s with the exact unified message',
      (hours) => {
        expect(() => validateHourLogHours(hours)).toThrow(
          'las horas deben estar entre 0.5 y 10',
        )
      },
    )

    it.each([10.01, 10.5, 11, 12, 24])(
      'rejects values above the upper boundary %s with the exact unified message',
      (hours) => {
        expect(() => validateHourLogHours(hours)).toThrow(
          'las horas deben estar entre 0.5 y 10',
        )
      },
    )

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'rejects non-finite number %s',
      (value) => {
        expect(() => validateHourLogHours(value)).toThrow(HourLogValidationError)
      },
    )

    it('supports custom bounds when passed to validation', () => {
      const customBounds = { minHours: 1, maxHours: 6 }
      expect(() => validateHourLogHours(1, customBounds)).not.toThrow()
      expect(() => validateHourLogHours(6, customBounds)).not.toThrow()
      expect(() => validateHourLogHours(0.5, customBounds)).toThrow(
        'las horas deben estar entre 1 y 6',
      )
      expect(() => validateHourLogHours(7, customBounds)).toThrow(
        'las horas deben estar entre 1 y 6',
      )
    })
  })

  describe('time format and range validation', () => {
    it.each(['08:00', '00:00', '12:30', '23:59'])(
      'accepts valid HH:mm time format %s',
      (time) => {
        expect(() => validateHourLogTime(time)).not.toThrow()
      },
    )

    it.each(['8:00', '24:00', '12:60', 'abc', '12:0', ''])(
      'rejects invalid time format %s with the exact unified message',
      (time) => {
        expect(() => validateHourLogTime(time)).toThrow(
          'las horas deben tener el formato HH:mm',
        )
      },
    )

    it('accepts start time strictly earlier than end time', () => {
      expect(() =>
        validateHourLogTimes({ startTime: '08:00', endTime: '12:00' }),
      ).not.toThrow()
      expect(() =>
        validateHourLogTimes({ startTime: '13:00', endTime: '13:30' }),
      ).not.toThrow()
    })

    it('rejects start time equal to end time with the exact unified message', () => {
      expect(() =>
        validateHourLogTimes({ startTime: '08:00', endTime: '08:00' }),
      ).toThrow('la hora de inicio debe ser anterior a la de fin')
    })

    it('rejects start time later than end time with the exact unified message', () => {
      expect(() =>
        validateHourLogTimes({ startTime: '13:00', endTime: '12:00' }),
      ).toThrow('la hora de inicio debe ser anterior a la de fin')
    })
  })

  describe('validateHourLogInput', () => {
    it('accepts valid input combination', () => {
      expect(() =>
        validateHourLogInput({ hours: 4, startTime: '08:00', endTime: '12:00' }),
      ).not.toThrow()
    })

    it('rejects invalid duration before or alongside times', () => {
      expect(() =>
        validateHourLogInput({ hours: 0, startTime: '08:00', endTime: '12:00' }),
      ).toThrow('las horas deben estar entre 0.5 y 10')
    })

    it('rejects inverted times even with valid duration', () => {
      expect(() =>
        validateHourLogInput({ hours: 4, startTime: '13:00', endTime: '12:00' }),
      ).toThrow('la hora de inicio debe ser anterior a la de fin')
    })
  })

  describe('getHourLogValidationErrorMessage UI helper', () => {
    it('returns error when hours string is empty or not numeric', () => {
      expect(getHourLogValidationErrorMessage('')).toBe('Ingresa un número de horas válido')
      expect(getHourLogValidationErrorMessage('   ')).toBe('Ingresa un número de horas válido')
      expect(getHourLogValidationErrorMessage('abc')).toBe('Ingresa un número de horas válido')
    })

    it('returns out of bounds message for numbers below min or above max', () => {
      expect(getHourLogValidationErrorMessage('0')).toBe('las horas deben estar entre 0.5 y 10')
      expect(getHourLogValidationErrorMessage(0.4)).toBe('las horas deben estar entre 0.5 y 10')
      expect(getHourLogValidationErrorMessage('11')).toBe('las horas deben estar entre 0.5 y 10')
      expect(getHourLogValidationErrorMessage(12)).toBe('las horas deben estar entre 0.5 y 10')
    })

    it('returns time range error when start is not before end', () => {
      expect(
        getHourLogValidationErrorMessage('4', '13:00', '12:00'),
      ).toBe('la hora de inicio debe ser anterior a la de fin')
      expect(
        getHourLogValidationErrorMessage('4', '09:00', '09:00'),
      ).toBe('la hora de inicio debe ser anterior a la de fin')
    })

    it('returns null when all hour and time values are valid', () => {
      expect(getHourLogValidationErrorMessage('0.5', '08:00', '08:30')).toBeNull()
      expect(getHourLogValidationErrorMessage('10', '08:00', '18:00')).toBeNull()
      expect(getHourLogValidationErrorMessage('4', '08:00', '12:00')).toBeNull()
      expect(getHourLogValidationErrorMessage('4')).toBeNull()
    })
  })
})
