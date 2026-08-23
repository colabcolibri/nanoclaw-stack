import React from 'react'
import { cn } from '@/lib/utils'
import {
  ListPaginationBar,
  type ListPaginationBarProps,
} from '@/components/common/ListPaginationBar'

type PaginatedListSectionProps = Omit<ListPaginationBarProps, 'placement' | 'className'> & {
  children: React.ReactNode
  className?: string
  listClassName?: string
}

export const PaginatedListSection: React.FC<PaginatedListSectionProps> = ({
  children,
  className,
  listClassName,
  ...pagination
}) => {
  if (pagination.totalItems === 0) {
    return <>{children}</>
  }

  const barProps = pagination as ListPaginationBarProps

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ListPaginationBar {...barProps} placement="top" />
      <div className={listClassName}>{children}</div>
      <ListPaginationBar {...barProps} placement="bottom" />
    </div>
  )
}

export type { PaginatedListSectionProps }
