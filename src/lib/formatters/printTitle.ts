import type { FirestoreDate } from '../../types/domain'
import { toInputDate } from './date'

export function sanitizePrintTitle(value: string) {
  return value
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function makePrintTitle(parts: Array<string | FirestoreDate | null | undefined>) {
  return sanitizePrintTitle(
    parts
      .map((part) => {
        if (!part) return ''
        if (typeof part === 'string') return part
        return toInputDate(part)
      })
      .filter(Boolean)
      .join(' - '),
  )
}
