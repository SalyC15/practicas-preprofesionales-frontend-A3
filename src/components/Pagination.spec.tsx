import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('navigates 10000 records without rendering every page number', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} pageSize={25} total={10000} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />)
    expect(screen.getByText('1–25 de 10000')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 400')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
  it('stops at the last partial page and allows changing the size', () => {
    const onPageSizeChange = vi.fn()
    render(<Pagination page={2} pageSize={25} total={30} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />)
    expect(screen.getByText('26–30 de 30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: 'Registros por página' }), { target: { value: '50' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })
  it('represents an empty result and blocks navigation while loading', () => {
    render(<Pagination page={1} pageSize={25} total={0} busy onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />)
    expect(screen.getByText('0–0 de 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })
})
