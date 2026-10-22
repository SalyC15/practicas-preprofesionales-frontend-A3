import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalHourLog, LocalPlacement } from '@/offline/db'

const hooks = vi.hoisted(() => ({
  usePlacement: vi.fn(),
  useHourLogs: vi.fn(),
}))

vi.mock('@/offline/hooks/usePlacement', () => ({ usePlacement: hooks.usePlacement }))
vi.mock('@/offline/hooks/useHourLedger', async () => {
  const { summarizeHours } = await import('@/lib/hours')
  return { useHourLedger: () => {
    const items = hooks.useHourLogs() as LocalHourLog[]
    return { items, attendance: items, total: items.length, pendingCount: 0, hours: summarizeHours(items, 120) }
  } }
})

import { HourLogsPage } from './HourLogsPage'

const placement: LocalPlacement = {
  id: 3,
  studentId: 4,
  tutorId: 5,
  companyId: 6,
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  requiredHours: 120,
  status: 'ACTIVE',
  version: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const hourLog = (overrides: Partial<LocalHourLog>): LocalHourLog => ({
  id: 10,
  placementId: placement.id,
  date: '2026-10-13',
  startTime: '08:00',
  endTime: '12:00',
  hours: 4,
  activity: 'Apoyo en laboratorio',
  status: 'SUBMITTED',
  reviewNote: null,
  version: 1,
  updatedAt: '2026-10-13T12:00:00.000Z',
  syncState: 'synced',
  ...overrides,
})

beforeEach(() => {
  hooks.usePlacement.mockReturnValue(placement)
  hooks.useHourLogs.mockReturnValue([
    hourLog({ id: 10, date: '2026-10-13T00:00:00.000Z' }),
    hourLog({ id: 11, date: '2026-10-14T04:30:00.000Z' }),
  ])
})

describe('HourLogsPage calendar dates', () => {
  it('renders legacy midnight and non-midnight stored dates by their date prefixes', () => {
    render(<HourLogsPage />)

    expect(screen.getByText(/13 oct 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/14 oct 2026/i)).toBeInTheDocument()
  })

  it('shows the saved server rejection reason for a failed sync row without hiding tutor status', () => {
    const reason = 'La fecha del registro (2026-10-16) está fuera del rango válido de la práctica (2026-10-01 a 2026-12-31).'
    hooks.useHourLogs.mockReturnValue([
      hourLog({ id: 12, syncState: 'failed', reviewNote: reason }),
    ])

    render(<HourLogsPage />)

    expect(screen.getByText(`Motivo de rechazo: ${reason}`)).toBeInTheDocument()
    expect(screen.getByText('ENVIADO')).toBeInTheDocument()
  })

  it('opens the dialog when clicking the register hours button', async () => {
    render(<HourLogsPage />)
    const button = screen.getByRole('button', { name: /Registrar horas/i })
    fireEvent.click(button)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
