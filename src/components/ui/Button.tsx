import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-app-gold text-app-text hover:bg-[#b89321]',
  secondary: 'border border-app-border bg-white text-app-text hover:bg-app-muted',
  ghost: 'text-app-text hover:bg-app-muted',
  danger: 'bg-app-danger text-white hover:bg-red-700',
}

export function Button({ className, variant = 'primary', icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:py-2',
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
