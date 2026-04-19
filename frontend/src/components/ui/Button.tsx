import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover shadow-xs hover:shadow-card',
        secondary: 'bg-surface-raised text-foreground hover:bg-surface-raised/80',
        outline: 'border border-border bg-white text-foreground hover:bg-surface-raised hover:text-foreground',
        ghost: 'text-muted hover:bg-surface-raised hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xs',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
)
Button.displayName = 'Button'

export { buttonVariants }
