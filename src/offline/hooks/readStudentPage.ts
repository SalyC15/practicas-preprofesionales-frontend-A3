import { db } from '@/offline/db'

export async function readStudentPage(tutorId: number, page: number, size: number) {
  return db.transaction('r', db.placements, db.hourLogs, async () => {
    const allIds = new Set(await db.placements.where('tutorId').equals(tutorId).primaryKeys())
    const effectivePage = Math.min(page, Math.max(1, Math.ceil(allIds.size / size)))
    const placements = await db.placements.where('tutorId').equals(tutorId).offset((effectivePage - 1) * size).limit(size).toArray()
    const selected = new Set(placements.map((p) => p.id))
    const approved = new Map<number, number>()
    const submitted = new Map<number, number>()
    const waiting = new Set<number>()
    let pendingHours = 0
    await db.hourLogs.where('status').equals('SUBMITTED').each((log) => {
      if (!allIds.has(log.placementId)) return
      pendingHours += log.hours
      waiting.add(log.placementId)
      if (selected.has(log.placementId)) submitted.set(log.placementId, (submitted.get(log.placementId) ?? 0) + log.hours)
    })
    await db.hourLogs.where('status').equals('APPROVED').each((log) => {
      if (selected.has(log.placementId)) approved.set(log.placementId, (approved.get(log.placementId) ?? 0) + log.hours)
    })
    return { total: allIds.size, waiting: waiting.size, pendingHours,
      items: placements.map((placement) => ({ placement, approvedHours: approved.get(placement.id) ?? 0, submittedHours: submitted.get(placement.id) ?? 0 })) }
  })
}
