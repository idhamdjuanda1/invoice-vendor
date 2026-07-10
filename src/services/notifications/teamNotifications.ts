import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { env } from '../../config/env'
import { firestoreCollections } from '../../constants/firestore'
import { eventFieldDefinitions, eventTypeLabels, getPrimaryEventLocation, getPrimaryEventTime } from '../../lib/events/eventDetails'
import { formatDisplayDate } from '../../lib/formatters/date'
import { firestore } from '../../lib/firebase/client'
import type { InvoiceEventDetail, InvoiceRecord, TeamAssignmentMember } from '../../types/domain'

type SendChannel = 'whatsapp' | 'email'

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

async function logNotification(userId: string, invoiceId: string, channel: SendChannel, recipients: TeamAssignmentMember[], status: 'sent' | 'failed', message: string) {
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

async function sendViaApi(userId: string, invoiceId: string, channel: SendChannel, recipients: TeamAssignmentMember[], message: string) {
  if (!env.vendorNotificationApiUrl) {
    throw new Error('NOTIFICATION_API_NOT_CONFIGURED')
  }

  const response = await fetch(env.vendorNotificationApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      invoiceId,
      channel,
      recipients,
      message,
    }),
  })

  if (!response.ok) throw new Error('NOTIFICATION_SEND_FAILED')
}

export async function sendTeamNotification(userId: string, invoice: InvoiceRecord, event: InvoiceEventDetail | null, recipients: TeamAssignmentMember[], channel: SendChannel) {
  if (recipients.length === 0) throw new Error('TEAM_RECIPIENTS_REQUIRED')
  const message = buildTeamMessage(invoice, event)

  try {
    await sendViaApi(userId, invoice.id, channel, recipients, message)
    await logNotification(userId, invoice.id, channel, recipients, 'sent', message)
  } catch (error) {
    await logNotification(userId, invoice.id, channel, recipients, 'failed', message).catch(() => undefined)
    throw error
  }
}
