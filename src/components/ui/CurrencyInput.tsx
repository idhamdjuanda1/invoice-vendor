import type { InputHTMLAttributes } from 'react'
import { formatCurrencyInput, parseCurrencyInput } from '../../lib/formatters/currency'
import { Input } from './Input'

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  label?: string
  hint?: string
  value: string | number
  onValueChange: (formattedValue: string, numericValue: number) => void
}

export function CurrencyInput({ inputMode = 'numeric', onValueChange, value, ...props }: CurrencyInputProps) {
  return (
    <Input
      {...props}
      inputMode={inputMode}
      type="text"
      value={formatCurrencyInput(value)}
      onChange={(event) => {
        const formattedValue = formatCurrencyInput(event.target.value)
        onValueChange(formattedValue, parseCurrencyInput(formattedValue))
      }}
    />
  )
}