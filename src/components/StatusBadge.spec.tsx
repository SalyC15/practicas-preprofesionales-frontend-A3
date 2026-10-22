import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('maps a status from each group to its tone class', () => {
    const { rerender } = render(<StatusBadge status="APROBADO" />)
    expect(screen.getByText('APROBADO').className).toContain('text-stamp')

    rerender(<StatusBadge status="ENVIADO" />)
    expect(screen.getByText('ENVIADO').className).toContain('text-pending')

    rerender(<StatusBadge status="RECHAZADO" />)
    expect(screen.getByText('RECHAZADO').className).toContain('text-void')

    rerender(<StatusBadge status="OTRO" />)
    expect(screen.getByText('OTRO').className).toContain('text-inkSoft')
  })

  it('translates English backend statuses into Spanish', () => {
    const { rerender } = render(<StatusBadge status="APPROVED" />)
    expect(screen.getByText('APROBADO')).toBeInTheDocument()

    rerender(<StatusBadge status="SUBMITTED" />)
    expect(screen.getByText('ENVIADO')).toBeInTheDocument()

    rerender(<StatusBadge status="REJECTED" />)
    expect(screen.getByText('RECHAZADO')).toBeInTheDocument()

    rerender(<StatusBadge status="PENDING" />)
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument()
  })
})
