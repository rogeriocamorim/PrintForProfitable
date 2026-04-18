import React from 'react'
import { cn } from '../../lib/utils'

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
interface TableSectionProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}
interface TableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }: TableSectionProps) {
  return <thead className={cn('border-b border-gray-200 bg-gray-50/50', className)} {...props} />
}

export function TableBody({ className, ...props }: TableSectionProps) {
  return <tbody className={cn('divide-y divide-gray-100', className)} {...props} />
}

export function TableRow({ className, ...props }: TableRowProps) {
  return <tr className={cn('hover:bg-gray-50/50 transition-colors', className)} {...props} />
}

export function TableHead({ className, ...props }: TableHeadCellProps) {
  return (
    <th
      className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: TableCellProps) {
  return <td className={cn('px-4 py-3 text-gray-700', className)} {...props} />
}
