import { describe, expect, it } from 'vitest'
import { generatePlacementSchedule } from './schedule'
import type { LocalHourLog, LocalPlacement } from '@/offline/db'

describe('generatePlacementSchedule', () => {
  const mockPlacement: LocalPlacement = {
    id: 1,
    studentId: 10,
    tutorId: 20,
    companyId: 30,
    startDate: '2026-03-02', // Lunes 2 de Marzo de 2026
    endDate: '2026-06-30',
    requiredHours: 160,
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-03-01T00:00:00.000Z',
    companyName: 'Tech Corp',
    offerTitle: 'Desarrollador Junior',
  }

  it('generates the exact number of daily sessions to fulfill requiredHours', () => {
    const summary = generatePlacementSchedule(mockPlacement, [])

    expect(summary.requiredHours).toBe(160)
    expect(summary.dailyHours).toBe(4)
    expect(summary.totalSessions).toBe(40) // 160 / 4 = 40 sesiones
    expect(summary.plannedHours).toBe(160)
    expect(summary.confirmedSessions).toBe(0)
    expect(summary.confirmedHours).toBe(0)

    // Primera sesión es el Lunes 2026-03-02
    expect(summary.sessions[0].date).toBe('2026-03-02')
    expect(summary.sessions[0].hours).toBe(4)
    expect(summary.sessions[0].status).toBe('PENDING')
  })

  it('excludes weekends by default', () => {
    const summary = generatePlacementSchedule(mockPlacement, [])
    for (const session of summary.sessions) {
      const [year, month, day] = session.date.split('-').map(Number)
      const d = new Date(Date.UTC(year, month - 1, day))
      const dayOfWeek = d.getUTCDay()
      // 0 es Domingo, 6 es Sábado
      expect(dayOfWeek).not.toBe(0)
      expect(dayOfWeek).not.toBe(6)
    }
  })

  it('marks existing registered logs as CONFIRMED or APPROVED', () => {
    const existingLogs: LocalHourLog[] = [
      {
        id: 101,
        placementId: 1,
        date: '2026-03-02',
        startTime: '08:00',
        endTime: '12:00',
        hours: 4,
        activity: 'Desarrollador Junior',
        status: 'SUBMITTED',
        version: 1,
        updatedAt: '2026-03-02T12:00:00.000Z',
        syncState: 'queued',
      },
      {
        id: 102,
        placementId: 1,
        date: '2026-03-03T00:00:00.000Z', // ISO string
        startTime: '08:00',
        endTime: '12:00',
        hours: 4,
        activity: 'Desarrollador Junior',
        status: 'APPROVED',
        version: 1,
        updatedAt: '2026-03-03T12:00:00.000Z',
        syncState: 'synced',
      },
    ]

    const summary = generatePlacementSchedule(mockPlacement, existingLogs)
    expect(summary.confirmedSessions).toBe(2)
    expect(summary.confirmedHours).toBe(8)
    expect(summary.sessions[0].status).toBe('CONFIRMED')
    expect(summary.sessions[1].status).toBe('APPROVED')
    expect(summary.sessions[2].status).toBe('PENDING')
  })

  it('handles partial hours on the final session if requiredHours is not a multiple of dailyHours', () => {
    const placementWith162Hours: LocalPlacement = {
      ...mockPlacement,
      requiredHours: 162,
    }

    const summary = generatePlacementSchedule(placementWith162Hours, [])
    expect(summary.totalSessions).toBe(41) // 40 de 4h + 1 de 2h
    expect(summary.plannedHours).toBe(162)
    expect(summary.sessions[40].hours).toBe(2)
  })
})
