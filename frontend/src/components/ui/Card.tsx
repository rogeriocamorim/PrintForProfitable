import React from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-white shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn('px-6 py-4 border-b border-border-light', className)} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-t border-border-light bg-surface-raised/50 rounded-b-xl', className)}
      {...props}
    />
  )
}
