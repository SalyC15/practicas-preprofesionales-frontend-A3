import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as companiesApi from '@/api/companies'
import { CompanyProfilePage } from './CompanyProfilePage'

vi.mock('@/api/companies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/companies')>()
  return {
    ...actual,
    getMyCompany: vi.fn(),
    updateMyCompany: vi.fn(),
  }
})

describe('CompanyProfilePage', () => {
  const mockCompany: companiesApi.Company = {
    id: 1,
    taxId: '1790012345001',
    name: 'Corporación Alfa',
    sector: 'Tecnología',
    contactEmail: 'contacto@alfa.com',
    phone: '0987654321',
    address: 'Av. República 500',
    logoUrl: 'https://alfa.com/logo.png',
    description: 'Empresa líder en desarrollo de soluciones tecnológicas.',
    website: 'https://alfa.com',
    verified: true,
    createdAt: '2026-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.mocked(companiesApi.getMyCompany).mockResolvedValue(mockCompany)
    vi.mocked(companiesApi.updateMyCompany).mockResolvedValue(mockCompany)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders company information when loaded', async () => {
    render(<CompanyProfilePage />)

    expect(screen.getByText('Cargando perfil de la empresa...')).toBeInTheDocument()

    expect(await screen.findByDisplayValue('Corporación Alfa')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Tecnología')).toBeInTheDocument()
    expect(screen.getByDisplayValue('contacto@alfa.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0987654321')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Av. República 500')).toBeInTheDocument()
    expect(screen.getByText('Verificada')).toBeInTheDocument()
    expect(screen.getByText('RUC / ID: 1790012345001')).toBeInTheDocument()
  })

  it('allows editing fields and submitting updates', async () => {
    render(<CompanyProfilePage />)

    const nameInput = await screen.findByDisplayValue('Corporación Alfa')
    fireEvent.change(nameInput, { target: { value: 'Corporación Alfa Internacional' } })

    expect(screen.getByText('* Tenés cambios sin guardar')).toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: 'Guardar cambios' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(companiesApi.updateMyCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Corporación Alfa Internacional',
          sector: 'Tecnología',
          contactEmail: 'contacto@alfa.com',
        }),
      )
    })

    expect(
      await screen.findByText('¡Los datos de tu empresa fueron guardados y actualizados exitosamente!'),
    ).toBeInTheDocument()
  })

  it('allows resetting changes back to loaded company values', async () => {
    render(<CompanyProfilePage />)

    const nameInput = await screen.findByDisplayValue('Corporación Alfa')
    fireEvent.change(nameInput, { target: { value: 'Nombre Cambiado' } })

    const resetButton = screen.getByRole('button', { name: 'Restablecer' })
    fireEvent.click(resetButton)

    expect(screen.getByDisplayValue('Corporación Alfa')).toBeInTheDocument()
    expect(screen.getByText('Todos los datos están sincronizados')).toBeInTheDocument()
  })
})
