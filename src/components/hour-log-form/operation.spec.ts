import { expect, it } from 'vitest'
import { buildHourLogOperation } from './operation'

it('builds the local row and matching create operation without UI or writes', () => {
  const values = { placementId: 7, date: '2026-10-13', startTime: '08:00',
    endTime: '11:30', hours: '3.5', activity: '  Apoyo  ' }
  const now = new Date('2026-10-13T17:00:00Z')
  const { row, operation } = buildHourLogOperation(values, now)
  expect(row).toEqual({ ...values, id: -now.getTime(), hours: 3.5, activity: 'Apoyo',
    status: 'SUBMITTED', reviewNote: null, version: 1, updatedAt: now.toISOString(), syncState: 'local' })
  const payload = { ...row } as Partial<typeof row>
  delete payload.syncState
  expect(operation).toEqual({ entity: 'hourLog', op: 'create', payload, baseVersion: null })
  expect(values.activity).toBe('  Apoyo  ')
})
