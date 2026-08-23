import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/lib/pagination'

interface UsePaginationOptions {
  initialPageSize?: PageSize
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { initialPageSize = DEFAULT_PAGE_SIZE } = options
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(initialPageSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    setPage(1)
  }, [items.length, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalItems)

  const handlePageSizeChange = (next: PageSize) => {
    setPageSize(next)
    setPage(1)
  }

  return {
    page,
    setPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalItems,
    totalPages,
    paginatedItems,
    rangeStart,
    rangeEnd,
  }
}
