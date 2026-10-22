import { describe, expect, it } from 'vitest'
import { hourLogFormReducer as reduce, initialFormState } from './state'

describe('hour log form transitions without rendering', () => {
  it('calculates hours, clears field errors and preserves unrelated errors', () => {
    let state = { ...initialFormState('2026-10-13'),
      errors: { startTime: 'required', hours: 'invalid', activity: 'required' }, submitError: 'failed' }
    state = reduce(state, { type: 'change', field: 'startTime', value: '08:00' }) as typeof state
    expect(state.hours).toBe('')
    expect(state.submitError).toBeNull()
    expect(state.errors.startTime).toBeUndefined()
    state = reduce(state, { type: 'change', field: 'endTime', value: '11:30' }) as typeof state
    expect(state.hours).toBe('3.5')
    expect(state.errors.hours).toBeUndefined()
    expect(state.errors.activity).toBe('required')
    expect(reduce(state, { type: 'change', field: 'endTime', value: '07:00' }).hours).toBe('')
  })
  it('handles submission, validation, failure and reset', () => {
    let state = reduce(initialFormState(), { type: 'submitting', submitting: true })
    state = reduce(state, { type: 'errors', errors: { activity: 'required' } })
    expect(state.errors).toEqual({ activity: 'required' })
    state = reduce(state, { type: 'failure', error: 'failed' })
    expect(state.submitError).toBe('failed')
    state = reduce(state, { type: 'reset', date: '2026-10-14' })
    expect(state).toEqual({ ...initialFormState('2026-10-14'), submitting: true })
    expect(reduce(state, { type: 'submitting', submitting: false }).submitting).toBe(false)
  })
})
