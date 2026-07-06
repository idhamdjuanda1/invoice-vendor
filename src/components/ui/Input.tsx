import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
}

export function Input({ className, id, label, hint, ...props }: InputProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor={id}>
      {label}
      <input
        id={id}
        className={cn(
          'min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none transition placeholder:text-neutral-400 focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm',
          className,
        )}
        {...props}
      />
      {hint ? <span className="text-xs font-normal text-neutral-500">{hint}</span> : null}
    </label>
  )
}
