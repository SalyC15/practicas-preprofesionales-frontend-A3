import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/offline/db'
import { HourLogForm } from './HourLogForm'

const INSTITUTION_MIDNIGHT_EDGE = new Date('2026-10-14T01:00:00.000Z')

async function seedPlacement() {
  await db.placements.put({
    id: 1,
    studentId: 4,
    tutorId: 5,
    companyId: 6,
    startDate: '2026-10-13T00:00:00.000Z',
    endDate: '2026-10-15T00:00:00.000Z',
    requiredHours: 120,
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-10-01T00:00:00.000Z',
  })
}

function fillForm(date: string) {
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: date } })
  fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '08:00' } })
  fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '12:00' } })
  fireEvent.change(screen.getByLabelText('Actividad'), { target: { value: 'Apoyo en laboratorio' } })
}

async function seedExistingLocalState() {
  const row = {
    id: 77,
    placementId: 1,
    date: '2026-10-13',
    startTime: '08:00',
    endTime: '09:00',
    hours: 1,
    activity: 'Registro previo',
    status: 'SUBMITTED' as const,
    reviewNote: null,
    version: 1,
    updatedAt: '2026-10-13T09:00:00.000Z',
    syncState: 'queued' as const,
  }
  const entry = {
    clientOpId: 'already-queued',
    entity: 'hourLog' as const,
    op: 'create' as const,
    payload: { id: row.id, date: row.date },
    baseVersion: null,
    createdAt: '2026-10-13T09:00:00.000Z',
    attempts: 0,
    lastError: null,
  }
  await db.hourLogs.put(row)
  await db.outbox.put(entry)
  return {
    rows: await db.hourLogs.toArray(),
    entries: await db.outbox.toArray(),
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'))
  await db.delete()
  await db.open()
  await seedPlacement()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HourLogForm calendar dates', () => {
  it('defaults and caps the date at institution today, then stores the exact day in Dexie and outbox', async () => {
    vi.setSystemTime(INSTITUTION_MIDNIGHT_EDGE)
    const onSaved = vi.fn()
    render(<HourLogForm placementId={1} onSaved={onSaved} />)

    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement
    expect(dateInput.value).toBe('2026-10-13')
    expect(dateInput.max).toBe('2026-10-13')

    fillForm('2026-10-13')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    await waitFor(async () => expect(await db.hourLogs.count()).toBe(1))
    const [row] = await db.hourLogs.toArray()
    const [entry] = await db.outbox.toArray()
    expect(row.date).toBe('2026-10-13')
    expect(entry.payload.date).toBe('2026-10-13')
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('requires a selected date before making any local writes', async () => {
    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    expect(await screen.findByText('La fecha es obligatoria')).toBeInTheDocument()
    expect(await db.hourLogs.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps required-field validation before making any local writes', async () => {
    render(<HourLogForm placementId={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    expect(await screen.findByText('La hora de inicio es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('La hora de fin es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('Describe la actividad realizada')).toBeInTheDocument()
    expect(screen.getByText('Ingresa un número de horas válido')).toBeInTheDocument()
    expect(await db.hourLogs.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it.each([
    ['hours below minimum boundary', '08:00', '08:20', 'las horas deben estar entre 0.5 y 10'],
    ['hours above maximum boundary', '08:00', '19:00', 'las horas deben estar entre 0.5 y 10'],
    ['a non-increasing time range', '13:00', '12:00', 'la hora de inicio debe ser anterior a la de fin'],
    ['same start and end time', '10:00', '10:00', 'la hora de inicio debe ser anterior a la de fin'],
  ])('validates hour log input and displays unified message for %s', async (_scenario, startTime, endTime, message) => {
    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: startTime } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: endTime } })
    expect(screen.getByText(message)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(await db.hourLogs.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it.each([
    ['0.5', '08:00', '08:30'],
    ['9', '08:00', '17:00'],
    ['10', '08:00', '18:00'],
  ])(
    'accepts valid hour values including boundaries and previously capped values (%s h)',
    async (hours, startTime, endTime) => {
      render(<HourLogForm placementId={1} />)
      fillForm('2026-10-13')
      fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: startTime } })
      fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: endTime } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

      await waitFor(async () => expect(await db.hourLogs.count()).toBe(1))
      const [row] = await db.hourLogs.toArray()
      expect(row.hours).toBe(Number(hours))
    },
  )

  it('fails closed when the placement is unavailable locally', async () => {
    await db.placements.delete(1)
    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('No se pudo validar el período de la práctica en este dispositivo')
    expect(await db.hourLogs.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('rejects an institution-future date before changing existing local rows or outbox entries', async () => {
    vi.setSystemTime(INSTITUTION_MIDNIGHT_EDGE)
    const before = await seedExistingLocalState()
    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-14')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pueden registrar horas con fecha futura')
    expect(await db.hourLogs.toArray()).toEqual(before.rows)
    expect(await db.outbox.toArray()).toEqual(before.entries)
    expect(await db.outbox.count()).toBe(before.entries.length)
  })

  it.each([
    ['before the placement', '2026-10-12', 'La fecha del registro (2026-10-12) está fuera del rango válido de la práctica (2026-10-13 a 2026-10-15).'],
    ['after the placement', '2026-10-16', 'La fecha del registro (2026-10-16) está fuera del rango válido de la práctica (2026-10-13 a 2026-10-15).'],
  ])('rejects a date %s before changing local data', async (_scenario, date, message) => {
    const before = await seedExistingLocalState()
    render(<HourLogForm placementId={1} />)
    fillForm(date)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(await db.hourLogs.toArray()).toEqual(before.rows)
    expect(await db.outbox.toArray()).toEqual(before.entries)
    expect(await db.outbox.count()).toBe(before.entries.length)
  })

  it.each(['2026-10-13', '2026-10-15'])('allows the inclusive placement boundary %s', async (date) => {
    render(<HourLogForm placementId={1} />)
    fillForm(date)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    await waitFor(async () => expect(await db.hourLogs.count()).toBe(1))
    const [row] = await db.hourLogs.toArray()
    const [entry] = await db.outbox.toArray()
    expect(row.date).toBe(date)
    expect(entry.payload.date).toBe(date)
  })

  it('calculates hours automatically when start and end times are entered', async () => {
    render(<HourLogForm placementId={1} />)
    const hoursInput = screen.getByLabelText('Horas') as HTMLInputElement

    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '11:30' } })
    expect(hoursInput.value).toBe('2.5')

    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '08:30' } })
    expect(hoursInput.value).toBe('3')
  })

  it('marks the hours field as read-only and calculates hours strictly from start and end times', async () => {
    render(<HourLogForm placementId={1} />)
    const hoursInput = screen.getByLabelText('Horas') as HTMLInputElement
    expect(hoursInput).toHaveAttribute('readonly')

    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '12:00' } })
    expect(hoursInput.value).toBe('4')

    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '13:30' } })
    expect(hoursInput.value).toBe('5.5')

    // Si el horario es inválido (fin antes de inicio), limpia las horas
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '07:00' } })
    expect(hoursInput.value).toBe('')
  })

  it('prevents saving duplicate hour logs with the same date, times, and activity', async () => {
    await db.hourLogs.put({
      id: 99,
      placementId: 1,
      date: '2026-10-13',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Apoyo en laboratorio',
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: '2026-10-13T12:00:00.000Z',
      syncState: 'local',
    })

    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    const alerts = await screen.findAllByText('Ya existe un registro con la misma fecha, horario y actividad.')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(await db.hourLogs.count()).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('prevents saving overlapping hour logs with identical time slot even with different activity', async () => {
    await db.hourLogs.put({
      id: 99,
      placementId: 1,
      date: '2026-10-13',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Otra tarea previa',
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: '2026-10-13T12:00:00.000Z',
      syncState: 'local',
    })

    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    const alerts = await screen.findAllByText('Ya tienes horas registradas en este mismo horario (08:00–12:00).')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(await db.hourLogs.count()).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('allows saving if the existing hour log for that time slot was REJECTED', async () => {
    await db.hourLogs.put({
      id: 99,
      placementId: 1,
      date: '2026-10-13',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Apoyo en laboratorio',
      status: 'REJECTED',
      reviewNote: 'Corregir detalles',
      version: 1,
      updatedAt: '2026-10-13T12:00:00.000Z',
      syncState: 'synced',
    })

    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    await waitFor(async () => expect(await db.hourLogs.count()).toBe(2))
    expect(await db.outbox.count()).toBe(1)
  })

  it('detects duplicates even when the existing record has an ISO date string from server sync', async () => {
    await db.hourLogs.put({
      id: 99,
      placementId: 1,
      date: '2026-10-13T00:00:00.000Z',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      activity: 'Apoyo en laboratorio',
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: '2026-10-13T12:00:00.000Z',
      syncState: 'synced',
    })

    render(<HourLogForm placementId={1} />)
    fillForm('2026-10-13')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    const alerts = await screen.findAllByText('Ya existe un registro con la misma fecha, horario y actividad.')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(await db.hourLogs.count()).toBe(1)
  })

  it('prevents saving when the time slot overlaps with an existing registered block', async () => {
    await db.hourLogs.put({
      id: 99,
      placementId: 1,
      date: '2026-10-13',
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
      activity: 'Actividad previa',
      status: 'SUBMITTED',
      reviewNote: null,
      version: 1,
      updatedAt: '2026-10-13T12:00:00.000Z',
      syncState: 'synced',
    })

    render(<HourLogForm placementId={1} />)
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-13' } })
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '11:00' } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '13:00' } })
    fireEvent.change(screen.getByLabelText('Actividad'), { target: { value: 'Nueva actividad solapada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas' }))

    const alerts = await screen.findAllByText('El horario (11:00–13:00) se solapa con otro registro existente (10:00–12:00).')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(await db.hourLogs.count()).toBe(1)
  })
})


