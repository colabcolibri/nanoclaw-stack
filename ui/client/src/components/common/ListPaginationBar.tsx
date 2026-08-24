import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCount } from '@/lib/format-count'
import { cn } from '@/lib/utils'
import { getPageNumbers, PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/pagination'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ListPaginationBarProps {
  page: number
  totalPages: number
  totalItems: number
  rangeStart: number
  rangeEnd: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  placement?: 'top' | 'bottom'
  className?: string
}

const paginationLinkClass = (disabled: boolean) =>
  cn(disabled && 'pointer-events-none opacity-40')

export const ListPaginationBar: React.FC<ListPaginationBarProps> = ({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  pageSize,
  onPageChange,
  onPageSizeChange,
  placement = 'bottom',
  className,
}) => {
  const { t } = useTranslation('common')
  const pageNumbers = getPageNumbers(page, totalPages)

  if (totalItems === 0) return null

  const goToPage = (nextPage: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onPageChange(nextPage)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        placement === 'top'
          ? 'border-b border-(--border-main) pb-4'
          : 'border-t border-(--border-main) pt-4',
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="font-mono text-xs tabular-nums text-(--text-muted)">
          {formatCount(rangeStart)}–{formatCount(rangeEnd)} de {formatCount(totalItems)}
        </p>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">
            {t('pagination.perPage')}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
          >
            <SelectTrigger className="h-8 w-20 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)} className="font-mono text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                size="default"
                onClick={goToPage(page - 1)}
                aria-disabled={page <= 1}
                className={paginationLinkClass(page <= 1)}
                text={t('pagination.previous')}
              />
            </PaginationItem>

            {pageNumbers.map((pageNumber, index) => (
              <PaginationItem key={`${pageNumber}-${index}`}>
                {pageNumber === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href="#"
                    size="icon"
                    isActive={pageNumber === page}
                    onClick={goToPage(pageNumber)}
                  >
                    {pageNumber}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                size="default"
                onClick={goToPage(page + 1)}
                aria-disabled={page >= totalPages}
                className={paginationLinkClass(page >= totalPages)}
                text={t('pagination.next')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

export type { ListPaginationBarProps }
