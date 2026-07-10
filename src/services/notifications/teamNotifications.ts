import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { eventFieldDefinitions, eventTypeLabels, getPrimaryEventLocation, getPrimaryEventTime } from '../../lib/events/eventDetails'
import { formatDisplayDate } from '../../lib/formatters/date'
import { firestore } from '../../lib/firebase/client'
import type { InvoiceEventDetail, InvoiceRecord, TeamAssignmentMember } from '../../types/domain'

type SendChannel = 'whatsapp' | 'email'

function normalizeWhatsapp(value: string | null) {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

export function buildTeamMessage(invoice: InvoiceRecord, event: InvoiceEventDetail | null) {
  const location = getPrimaryEventLocation(event, invoice.eventLocation || '-')
  const time = getPrimaryEventTime(event) || '-'
  const fieldLabels = new Map((event ? eventFieldDefinitions[event.eventType] : []).map((field) => [field.key, field.label]))
  fieldLabels.set('locationLandmark', 'Patokan Alamat')
  const detailLines = event
    ? Object.entries(event.details)
        .filter(([, value]) => Boolean(value?.trim()))
        .map(([key, value]) => `${fieldLabels.get(key) ?? key}: ${value}`)
    : []

  return [
    `Detail Acara ${eventTypeLabels[invoice.eventType]}`,
    `Klien: ${invoice.clientName || '-'}`,
    `Tanggal: ${formatDisplayDate(invoice.eventDate)}`,
    `Jam: ${time}`,
    `Lokasi: ${location}`,
    event?.location.googleMapsUrl ? `Google Maps: ${event.location.googleMapsUrl}` : '',
    detailLines.length > 0 ? '' : '',
    ...detailLines,
  ].filter(Boolean).join('\n')
}

export async function logTeamNotification(userId: string, invoiceId: string, channel: SendChannel, recipients: TeamAssignmentMember[], status: 'sent' | 'failed', message: string) {
  await addDoc(collection(firestore, firestoreCollections.notificationLogs), {
    userId,
    invoiceId,
    channel,
    recipients: recipients.map((recipient) => ({
      freelanceId: recipient.freelanceId,
      fullName: recipient.fullName,
      whatsappNumber: recipient.whatsappNumber,
      email: recipient.email,
    })),
    status,
    message,
    createdAt: serverTimestamp(),
  })
}

export function buildTeamWhatsappUrls(invoice: InvoiceRecord, event: InvoiceEventDetail | null, recipients: TeamAssignmentMember[]) {
  const message = buildTeamMessage(invoice, event)
  return recipients
    .map((recipient) => ({
      recipient,
      url: `https://wa.me/${normalizeWhatsapp(recipient.whatsappNumber)}?text=${encodeURIComponent(message)}`,
    }))
    .filter((entry) => normalizeWhatsapp(entry.recipient.whatsappNumber))
}

export function buildTeamMailtoUrl(invoice: InvoiceRecord, event: InvoiceEventDetail | null, recipients: TeamAssignmentMember[]) {
  const message = buildTeamMessage(invoice, event)
  const emails = recipients.map((recipient) => recipient.email.trim()).filter(Boolean)
  const subject = `Detail Acara ${eventTypeLabels[invoice.eventType]} - ${invoice.clientName || invoice.invoiceNumber}`

  return emails.length > 0
    ? `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : ''
}
