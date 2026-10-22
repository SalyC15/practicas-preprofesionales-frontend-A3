import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as companiesApi from '@/api/companies'
import { CompaniesPage } from './CompaniesPage'

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    role: 'COORDINATOR',
    user: { id: 1, role: 'COORDINATOR' },
  }),
}))

vi.mock('@/api/companies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/companies')>()
  return {
    ...actual,
    listCompaniesPage: vi.fn(),
    createCompany: vi.fn(),
    verifyCompany: vi.fn(),
  }
})

describe('CompaniesPage', () => {
  const mockCompanies: companiesApi.Company[] = [
    {
      id: 1,
      taxId: '1790012345001',
      name: 'Empresa Pendiente',
      sector: 'Tecnología',
      contactEmail: 'rrhh@pendiente.com',
      verified: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      taxId: '1790098765001',
      name: 'Empresa Aprobada',
      sector: 'Finanzas',
      contactEmail: 'rrhh@aprobada.com',
      verified: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.mocked(companiesApi.listCompaniesPage).mockResolvedValue({
      items: mockCompanies, total: 2, page: 1, pageSize: 25, totalPages: 1,
      summary: { registered: 2, verified: 1, sectors: 2 },
    })
    vi.mocked(companiesApi.verifyCompany).mockImplementation(async (id, verified) => {
      const found = mockCompanies.find((c) => c.id === id)
      return { ...found!, verified }
    })
    vi.mocked(companiesApi.createCompany).mockImplementation(async (dto) => {
      return {
        id: 3,
        taxId: dto.taxId,
        name: dto.name,
        sector: dto.sector,
        contactEmail: dto.contactEmail,
        verified: dto.verified ?? true,
        createdAt: '2026-01-02T00:00:00Z',
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders company list and validation status', async () => {
    render(<CompaniesPage />)

    expect(await screen.findByText('Empresa Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Empresa Aprobada')).toBeInTheDocument()
    expect(screen.getByText('Validar')).toBeInTheDocument()
    expect(screen.getByText('Revocar')).toBeInTheDocument()
  })

  it('requests a new server page and resets to page one when searching', async () => {
    vi.mocked(companiesApi.listCompaniesPage).mockImplementation(async (page, pageSize) => ({
      items: mockCompanies, total: 10000, page, pageSize, totalPages: 400,
      summary: { registered: 10000, verified: 5000, sectors: 2 },
    }))
    render(<CompaniesPage />)
    await screen.findByText('Empresa Pendiente')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(companiesApi.listCompaniesPage).toHaveBeenCalledWith(2, 25, ''))
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, sector o RUC…'), { target: { value: 'Finanzas' } })
    await waitFor(() => expect(companiesApi.listCompaniesPage).toHaveBeenCalledWith(1, 25, 'Finanzas'))
  })

  it('allows coordinator to validate a pending company', async () => {
    render(<CompaniesPage />)

    const validateBtn = await screen.findByText('Validar')
    fireEvent.click(validateBtn)

    await waitFor(() => {
      expect(companiesApi.verifyCompany).toHaveBeenCalledWith(1, true)
    })
  })

  it('allows registering a company with login password and auto-verification', async () => {
    render(<CompaniesPage />)

    const openModalBtn = await screen.findByText('+ Registrar empresa')
    fireEvent.click(openModalBtn)

    fireEvent.change(screen.getByLabelText(/Razón social o Nombre/i), {
      target: { value: 'Nueva Empresa S.A.' },
    })
    fireEvent.change(screen.getByLabelText(/RUC \/ Identificación tributaria/i), {
      target: { value: '1799999999001' },
    })
    fireEvent.change(screen.getByLabelText(/Sector económico/i), {
      target: { value: 'Comercio' },
    })
    fireEvent.change(screen.getByLabelText(/Correo de contacto institucional y login/i), {
      target: { value: 'admin@nuevaempresa.com' },
    })
    fireEvent.change(screen.getByLabelText(/Contraseña de acceso inicial/i), {
      target: { value: 'miPasswordSegura123' },
    })

    const submitBtn = screen.getByRole('button', { name: /Registrar empresa y crear cuenta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(companiesApi.createCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nueva Empresa S.A.',
          taxId: '1799999999001',
          contactEmail: 'admin@nuevaempresa.com',
          password: 'miPasswordSegura123',
          verified: true,
        }),
      )
    })

    expect(await screen.findByText(/Credenciales de acceso generadas/i)).toBeInTheDocument()
  })
})
