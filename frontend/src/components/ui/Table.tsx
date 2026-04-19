import React from 'react'
import { cn } from '../../lib/utils'

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
interface TableSectionProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}
interface TableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }: TableSectionProps) {
  return <thead className={cn('border-b border-border bg-surface-raised/60', className)} {...props} />
}

export function TableBody({ className, ...props }: TableSectionProps) {
  return <tbody className={cn('divide-y divide-border-light', className)} {...props} />
}

export function TableRow({ className, ...props }: TableRowProps) {
  return <tr className={cn('hover:bg-surface-raised/50 transition-colors', className)} {...props} />
}

export function TableHead({ className, ...props }: TableHeadCellProps) {
  return (
    <th
      className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: TableCellProps) {
  return <td className={cn('px-4 py-3 text-foreground', className)} {...props} />
}
