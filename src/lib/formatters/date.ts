import { Timestamp } from 'firebase/firestore'
import type { FirestoreDate } from '../../types/domain'

export function toInputDate(value: FirestoreDate | string | undefined) {
  if (!value) return ''

  if (typeof value === 'string') return value.slice(0, 10)

  const date = value instanceof Timestamp ? value.toDate() : value
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

export function formatDisplayDate(value: FirestoreDate | string | undefined) {
  const inputDate = toInputDate(value)
  if (!inputDate) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${inputDate}T00:00:00`))
}

export function dateStringToTimestamp(value: string) {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`))
}
