import React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  prefix?: string
  suffix?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, prefix, suffix, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-50',
              prefix && 'pl-7',
              suffix && 'pr-14',
              error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted select-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
