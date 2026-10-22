import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LocalHourLog, type LocalPlacement } from '@/offline/db'
import { generatePlacementSchedule } from '@/lib/schedule'
import type { HoursSummary } from '@/lib/hours'

export async function readHourLedger(placement: LocalPlacement, page: number, size: number) {
  return db.transaction('r', db.hourLogs, async () => {
    const schedule = generatePlacementSchedule(placement, [])
    const dates = new Set(schedule.sessions.map((session) => session.date))
    const attendance = new Map<string, LocalHourLog>()
    let approvedHours = 0
    let submittedHours = 0
    let pendingCount = 0
    let total = 0
    await db.hourLogs.where('placementId').equals(placement.id).each((log) => {
      total++
      if (log.status === 'APPROVED') approvedHours += log.hours
      if (log.status === 'SUBMITTED') { submittedHours += log.hours; pendingCount++ }
      const date = log.date.slice(0, 10)
      if (dates.has(date) && log.status !== 'REJECTED' && !attendance.has(date)) attendance.set(date, log)
    })
    const effectivePage = Math.min(page, Math.max(1, Math.ceil(total / size)))
    const items = await db.hourLogs.where('[placementId+date+id]')
      .between([placement.id, '', -Infinity], [placement.id, '\uffff', Infinity])
      .reverse().offset((effectivePage - 1) * size).limit(size).toArray()
    const requiredHours = placement.requiredHours
    const approvedPct = requiredHours > 0 ? Math.min(100, approvedHours / requiredHours * 100) : 0
    const hours: HoursSummary = { approvedHours, submittedHours, requiredHours, approvedPct,
      submittedPct: requiredHours > 0 ? Math.min(100 - approvedPct, submittedHours / requiredHours * 100) : 0 }
    return { items: items.reverse(), total, pendingCount, hours, attendance: [...attendance.values()] }
  })
}

export function useHourLedger(placement: LocalPlacement | null | undefined, page: number, size: number) {
  return useLiveQuery(() => placement ? readHourLedger(placement, page, size) : undefined,
    [placement?.id, placement?.requiredHours, placement?.startDate, page, size])
}

