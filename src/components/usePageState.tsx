import { useState } from 'react'
import { Pagination } from './Pagination'

export function usePageState(label = 'Paginación') {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  return { page, pageSize, setPage, offset: (page - 1) * pageSize,
    controls: (total: number, busy = false) => <Pagination label={label} page={Math.min(page, Math.max(1, Math.ceil(total / pageSize)))} pageSize={pageSize} total={total} busy={busy}
      onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} /> }
}
