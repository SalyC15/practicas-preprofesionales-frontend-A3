import { beforeEach, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { enqueue } from '@/offline/sync/push'
import { buildFormErrors } from './validation'
import { submitHourLog } from './submit'

vi.mock('@/offline/db', () => ({ db: { hourLogs: { add: vi.fn(), delete: vi.fn() } } }))
vi.mock('@/offline/sync/push', () => ({ enqueue: vi.fn() }))
vi.mock('./validation', () => ({ buildFormErrors: vi.fn() }))
const values = { placementId: 1, date: '2026-10-13', startTime: '08:00',
  endTime: '12:00', hours: '4', activity: 'Apoyo' }
const actions = { setErrors: vi.fn(), setSubmitting: vi.fn(), setSubmitError: vi.fn(),
  resetForm: vi.fn(), onSaved: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(buildFormErrors).mockResolvedValue({})
  vi.mocked(db.hourLogs.add).mockResolvedValue(1)
  vi.mocked(db.hourLogs.delete).mockResolvedValue(undefined)
  vi.mocked(enqueue).mockResolvedValue(undefined)
})
it('writes locally before enqueuing and only resets after successful enqueue', async () => {
  await submitHourLog(values, actions)
  expect(db.hourLogs.add).toHaveBeenCalledOnce()
  expect(enqueue).toHaveBeenCalledOnce()
  expect(vi.mocked(db.hourLogs.add).mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(enqueue).mock.invocationCallOrder[0])
  expect(actions.resetForm).toHaveBeenCalledOnce()
  expect(actions.onSaved).toHaveBeenCalledOnce()
  expect(actions.setSubmitting.mock.calls).toEqual([[true], [false]])
})
it('does not persist invalid values or reset the form', async () => {
  vi.mocked(buildFormErrors).mockResolvedValue({ activity: 'required' })
  await submitHourLog(values, actions)
  expect(db.hourLogs.add).not.toHaveBeenCalled()
  expect(enqueue).not.toHaveBeenCalled()
  expect(actions.resetForm).not.toHaveBeenCalled()
  expect(actions.setErrors).toHaveBeenCalledWith({ activity: 'required' })
  expect(actions.setSubmitting).toHaveBeenLastCalledWith(false)
})
it('removes an orphan row and preserves entered values when enqueue fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(enqueue).mockRejectedValueOnce(new Error('enqueue failed'))
  await submitHourLog(values, actions)
  const row = vi.mocked(db.hourLogs.add).mock.calls[0][0]
  expect(db.hourLogs.delete).toHaveBeenCalledWith(row.id)
  expect(actions.resetForm).not.toHaveBeenCalled()
  expect(actions.onSaved).not.toHaveBeenCalled()
  expect(actions.setSubmitError).toHaveBeenLastCalledWith(
    'No se pudo guardar el registro en este dispositivo. Intenta de nuevo.')
  expect(actions.setSubmitting).toHaveBeenLastCalledWith(false)
  log.mockRestore()
})
it('reports a local storage failure without enqueuing', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(db.hourLogs.add).mockRejectedValueOnce(new Error('storage failed'))
  await submitHourLog(values, actions)
  expect(enqueue).not.toHaveBeenCalled()
  expect(actions.resetForm).not.toHaveBeenCalled()
  expect(actions.setSubmitting).toHaveBeenLastCalledWith(false)
  log.mockRestore()
})
