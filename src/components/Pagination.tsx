import { Button } from '@/components/ui/button'

interface PaginationProps {
  label?: string
  page: number
  pageSize: number
  total: number
  busy?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination({ label = 'Paginación', page, pageSize, total, busy, onPageChange, onPageSizeChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 py-2 text-14 text-inkBody">
      <p aria-live="polite">{first}–{Math.min(page * pageSize, total)} de {total}</p>
      <label className="flex items-center gap-2">
        Por página
        <select value={pageSize} disabled={busy} onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="min-h-10 rounded-md border border-line bg-surface px-2" aria-label="Registros por página">
          {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</Button>
        <span>Página {page} de {pages}</span>
        <Button variant="outline" disabled={busy || page >= pages} onClick={() => onPageChange(page + 1)}>Siguiente</Button>
      </div>
    </nav>
  )
}
