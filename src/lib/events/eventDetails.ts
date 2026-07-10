import type { EventDataStatus, EventType, InvoiceEventDetail } from '../../types/domain'

export const eventTypeLabels: Record<EventType, string> = {
  WEDDING: 'Wedding',
  PREWEDDING: 'Prewedding',
  LAMARAN: 'Lamaran',
  CORPORATE: 'Event Corporate',
}

export const eventStatusLabels: Record<EventDataStatus, string> = {
  NOT_FILLED: 'Belum Diisi',
  PARTIAL: 'Sebagian Terisi',
  COMPLETE: 'Lengkap',
}

export const eventStatusStyles: Record<EventDataStatus, string> = {
  NOT_FILLED: 'border-red-200 bg-red-50 text-red-700',
  PARTIAL: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETE: 'border-green-200 bg-green-50 text-green-700',
}

export type EventFieldDefinition = {
  key: string
  label: string
  type?: 'text' | 'time' | 'textarea'
}

export const eventFieldDefinitions: Record<EventType, EventFieldDefinition[]> = {
  WEDDING: [
    { key: 'groomName', label: 'Nama CPP' },
    { key: 'brideName', label: 'Nama CPW' },
    { key: 'ceremonyTime', label: 'Jam Akad / Pemberkatan', type: 'time' },
    { key: 'receptionTime', label: 'Jam Resepsi', type: 'time' },
    { key: 'ceremonyVenue', label: 'Tempat Akad' },
    { key: 'receptionVenue', label: 'Tempat Resepsi' },
  ],
  PREWEDDING: [
    { key: 'manName', label: 'Nama Pria' },
    { key: 'womanName', label: 'Nama Wanita' },
    { key: 'startTime', label: 'Jam Mulai', type: 'time' },
    { key: 'endTime', label: 'Jam Selesai', type: 'time' },
    { key: 'preweddingLocation', label: 'Lokasi Prewedding' },
  ],
  LAMARAN: [
    { key: 'groomName', label: 'Nama CPP' },
    { key: 'brideName', label: 'Nama CPW' },
    { key: 'proposalTime', label: 'Jam Lamaran', type: 'time' },
    { key: 'proposalVenue', label: 'Tempat Lamaran' },
  ],
  CORPORATE: [
    { key: 'organizationName', label: 'Nama PT / Organisasi' },
    { key: 'picName', label: 'Nama PIC' },
    { key: 'startTime', label: 'Jam Mulai', type: 'time' },
    { key: 'endTime', label: 'Jam Selesai', type: 'time' },
    { key: 'eventVenue', label: 'Tempat Acara' },
    { key: 'eventDescription', label: 'Keterangan Acara', type: 'textarea' },
  ],
}

export function calculateEventDataStatus(eventType: EventType, details: Record<string, string>, hasLocation: boolean): EventDataStatus {
  const requiredKeys = eventFieldDefinitions[eventType].map((field) => field.key)
  const filledCount = requiredKeys.filter((key) => Boolean(details[key]?.trim())).length + (hasLocation ? 1 : 0)
  const totalCount = requiredKeys.length + 1

  if (filledCount <= 0) return 'NOT_FILLED'
  return filledCount >= totalCount ? 'COMPLETE' : 'PARTIAL'
}

export function getPrimaryEventTime(event: InvoiceEventDetail | null) {
  if (!event) return ''

  const keysByType: Record<EventType, string[]> = {
    WEDDING: ['ceremonyTime', 'receptionTime'],
    PREWEDDING: ['startTime', 'endTime'],
    LAMARAN: ['proposalTime'],
    CORPORATE: ['startTime', 'endTime'],
  }

  return keysByType[event.eventType].map((key) => event.details[key]).filter(Boolean).join(' - ')
}

export function getPrimaryEventLocation(event: InvoiceEventDetail | null, fallback = '') {
  if (!event) return fallback

  return event.location.venueName || event.location.address || event.location.googleMapsUrl || fallback
}
