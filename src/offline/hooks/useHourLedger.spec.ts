import { beforeEach, describe, expect, it } from 'vitest'
import { db, type LocalHourLog, type LocalPlacement } from '@/offline/db'
import { readHourLedger } from './useHourLedger'
import { readStudentPage } from './readStudentPage'

const placement: LocalPlacement = { id: 1, studentId: 10, tutorId: 20, companyId: 30, requiredHours: 240,
  startDate: '2026-10-01', endDate: '2026-12-31', status: 'ACTIVE', version: 1, updatedAt: '2026-10-01' }
beforeEach(async () => { await db.delete(); await db.open() })

describe('bounded offline pages', () => {
  it('pages 10000 logs without truncating totals or losing older calendar formats', async () => {
    await db.hourLogs.bulkPut(Array.from({ length: 10000 }, (_, i): LocalHourLog => ({
      id: i + 1, placementId: 1, date: i % 2 === 0 ? '2026-10-01' : '2026-10-01T00:00:00.000Z',
      startTime: '08:00', endTime: '09:00', hours: 1, activity: `QA ${i}`, status: i % 2 === 0 ? 'APPROVED' : 'SUBMITTED',
      version: 1, updatedAt: '2026-10-01', syncState: 'synced',
    })))
    const first = await readHourLedger(placement, 1, 25)
    const second = await readHourLedger(placement, 2, 25)
    expect(first.items).toHaveLength(25)
    expect(first.total).toBe(10000)
    expect(first.hours).toMatchObject({ approvedHours: 5000, submittedHours: 5000 })
    expect(first.pendingCount).toBe(5000)
    expect(first.attendance).toHaveLength(1)
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(50)
    expect((await readHourLedger(placement, 400, 25)).items).toHaveLength(25)
  }, 120000)

  it('paginates practitioners and keeps summary values outside the visible page', async () => {
    await db.placements.bulkPut(Array.from({ length: 30 }, (_, i) => ({ ...placement, id: i + 1 })))
    await db.hourLogs.put({ id: 1, placementId: 30, date: '2026-10-01', startTime: '08:00', endTime: '09:00', hours: 1,
      activity: 'Último practicante', status: 'SUBMITTED', version: 1, updatedAt: '2026-10-01', syncState: 'queued' })
    const first = await readStudentPage(20, 1, 25)
    expect(first.items).toHaveLength(25)
    expect(first).toMatchObject({ total: 30, pendingHours: 1, waiting: 1 })
    const last = await readStudentPage(20, 2, 25)
    expect(last.items).toHaveLength(5)
    expect(last.items[4].submittedHours).toBe(1)
  })
})
