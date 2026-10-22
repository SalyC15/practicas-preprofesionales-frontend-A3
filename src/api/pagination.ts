export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function pageQuery(page: number, pageSize: number, filters: Record<string, string> = {}): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim())
  return params.toString()
}
