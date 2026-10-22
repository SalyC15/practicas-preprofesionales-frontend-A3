import { api } from './client'
import { type Page, pageQuery } from './pagination'

export interface OfferCompany {
  id: number
  name: string
}

export interface Offer {
  id: number
  companyId: number
  title: string
  description: string
  modality: string
  seats: number
  requiredHours: number
  periodStart: string
  periodEnd: string
  status: string
  publishedAt: string | null
  company: OfferCompany
}

/** Ofertas publicadas. No sincronizable: siempre requiere red. */
export function listOffers(): Promise<Offer[]> {
  return api<Offer[]>('/offers')
}

export function listOffersPage(page: number, pageSize: number, modality = '', search = ''): Promise<Page<Offer> & { modalities: string[] }> {
  return api(`/offers/paged?${pageQuery(page, pageSize, { modality, search })}`)
}

export function getOffer(id: number): Promise<Offer> {
  return api<Offer>(`/offers/${id}`)
}
