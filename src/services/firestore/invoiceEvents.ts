import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { calculateEventDataStatus } from '../../lib/events/eventDetails'
import { firestore } from '../../lib/firebase/client'
import type { EventLocationDetail, EventType, InvoiceEventDetail } from '../../types/domain'

export type InvoiceEventInput = {
  eventType: EventType
  location: EventLocationDetail
  details: Record<string, string>
}

const emptyLocation: EventLocationDetail = {
  venueName: '',
  address: '',
  googleMapsUrl: '',
  latitude: null,
  longitude: null,
}

function makePublicFormSlug() {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `form-${Date.now().toString(36)}-${randomPart}`
}

function normalizeLocation(value: unknown): EventLocationDetail {
  if (!value || typeof value !== 'object') return emptyLocation
  const location = value as Partial<EventLocationDetail>

  return {
    venueName: typeof location.venueName === 'string' ? location.venueName : '',
    address: typeof location.address === 'string' ? location.address : '',
    googleMapsUrl: typeof location.googleMapsUrl === 'string' ? location.googleMapsUrl : '',
    latitude: typeof location.latitude === 'number' ? location.latitude : null,
    longitude: typeof location.longitude === 'number' ? location.longitude : null,
  }
}

function normalizeDetails(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, typeof entry === 'string' ? entry : '']),
  )
}

function buildInvoiceEvent(id: string, data: Record<string, unknown>): InvoiceEventDetail {
  const eventType = (data.eventType as EventType) || 'WEDDING'

  return {
    id,
    userId: String(data.userId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    eventType,
    status: (data.status as InvoiceEventDetail['status']) ?? 'NOT_FILLED',
    publicFormSlug: String(data.publicFormSlug ?? ''),
    publicFormEnabled: data.publicFormEnabled !== false,
    location: normalizeLocation(data.location),
    details: normalizeDetails(data.details),
    submittedAt: (data.submittedAt as InvoiceEventDetail['submittedAt']) ?? null,
    createdAt: (data.createdAt as InvoiceEventDetail['createdAt']) ?? null,
    updatedAt: (data.updatedAt as InvoiceEventDetail['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as InvoiceEventDetail['deletedAt']) ?? null,
  }
}

export function normalizeEventLocation(input: Partial<EventLocationDetail>): EventLocationDetail {
  return {
    venueName: input.venueName?.trim() ?? '',
    address: input.address?.trim() ?? '',
    googleMapsUrl: input.googleMapsUrl?.trim() ?? '',
    latitude: typeof input.latitude === 'number' && Number.isFinite(input.latitude) ? input.latitude : null,
    longitude: typeof input.longitude === 'number' && Number.isFinite(input.longitude) ? input.longitude : null,
  }
}

export async function listInvoiceEvents(userId: string) {
  const eventsQuery = query(collection(firestore, firestoreCollections.invoiceEvents), where('userId', '==', userId))
  const snapshot = await getDocs(eventsQuery)

  return snapshot.docs
    .map((eventDoc) => buildInvoiceEvent(eventDoc.id, eventDoc.data()))
    .filter((event) => !event.deletedAt)
}

export async function getInvoiceEventByInvoiceId(userId: string, invoiceId: string) {
  const events = await listInvoiceEvents(userId)
  return events.find((event) => event.invoiceId === invoiceId) ?? null
}

export async function getInvoiceEventBySlug(slug: string) {
  const eventsQuery = query(
    collection(firestore, firestoreCollections.invoiceEvents),
    where('publicFormSlug', '==', slug),
    where('publicFormEnabled', '==', true),
  )
  const snapshot = await getDocs(eventsQuery)
  const firstDoc = snapshot.docs[0]
  if (!firstDoc) return null

  const event = buildInvoiceEvent(firstDoc.id, firstDoc.data())
  if (!event.publicFormEnabled || event.deletedAt) return null

  return event
}

export async function createInvoiceEvent(userId: string, invoiceId: string, eventType: EventType) {
  const existing = await getInvoiceEventByInvoiceId(userId, invoiceId)
  if (existing) {
    if (existing.eventType !== eventType) {
      const status = calculateEventDataStatus(eventType, existing.details, Boolean(existing.location.venueName || existing.location.address || existing.location.googleMapsUrl))
      await updateDoc(doc(firestore, firestoreCollections.invoiceEvents, existing.id), {
        userId,
        invoiceId,
        eventType,
        status,
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
        userId,
        eventType,
        eventDataStatus: status,
        updatedAt: serverTimestamp(),
      })

      return { ...existing, eventType, status }
    }

    return existing
  }

  const publicFormSlug = makePublicFormSlug()
  const eventRef = await addDoc(collection(firestore, firestoreCollections.invoiceEvents), {
    userId,
    invoiceId,
    eventType,
    status: 'NOT_FILLED',
    publicFormSlug,
    publicFormEnabled: false,
    location: emptyLocation,
    details: {},
    submittedAt: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
    userId,
    eventType,
    eventDataStatus: 'NOT_FILLED',
    publicFormSlug,
    publicFormEnabled: false,
    updatedAt: serverTimestamp(),
  })

  const snapshot = await getDoc(eventRef)
  return buildInvoiceEvent(snapshot.id, snapshot.data() ?? {})
}

export async function publishClientForm(userId: string, invoiceId: string, eventType: EventType) {
  const event = await createInvoiceEvent(userId, invoiceId, eventType)

  await updateDoc(doc(firestore, firestoreCollections.invoiceEvents, event.id), {
    userId,
    invoiceId,
    publicFormEnabled: true,
    updatedAt: serverTimestamp(),
  })
  await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
    userId,
    publicFormSlug: event.publicFormSlug,
    publicFormEnabled: true,
    updatedAt: serverTimestamp(),
  })

  return event.publicFormSlug
}

export async function upsertInvoiceEvent(userId: string, invoiceId: string, input: InvoiceEventInput) {
  const event = await createInvoiceEvent(userId, invoiceId, input.eventType)
  const location = normalizeEventLocation(input.location)
  const details = normalizeDetails(input.details)
  const hasLocation = Boolean(location.venueName || location.address || location.googleMapsUrl)
  const status = calculateEventDataStatus(input.eventType, details, hasLocation)

  await updateDoc(doc(firestore, firestoreCollections.invoiceEvents, event.id), {
    userId,
    invoiceId,
    eventType: input.eventType,
    location,
    details,
    status,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
    userId,
    eventType: input.eventType,
    eventLocation: location.venueName || location.address || location.googleMapsUrl,
    eventDataStatus: status,
    publicFormSlug: event.publicFormSlug,
    publicFormEnabled: event.publicFormEnabled,
    updatedAt: serverTimestamp(),
  })
}

export async function submitPublicInvoiceEvent(slug: string, input: InvoiceEventInput) {
  const event = await getInvoiceEventBySlug(slug)
  if (!event) throw new Error('CLIENT_FORM_NOT_FOUND')
  if (event.eventType !== input.eventType) throw new Error('CLIENT_FORM_EVENT_TYPE_LOCKED')

  const location = normalizeEventLocation(input.location)
  const details = normalizeDetails(input.details)
  const hasLocation = Boolean(location.venueName || location.address || location.googleMapsUrl)
  const status = calculateEventDataStatus(input.eventType, details, hasLocation)

  await updateDoc(doc(firestore, firestoreCollections.invoiceEvents, event.id), {
    location,
    details,
    status,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await updateDoc(doc(firestore, firestoreCollections.invoices, event.invoiceId), {
    userId: event.userId,
    eventLocation: location.venueName || location.address || location.googleMapsUrl,
    eventDataStatus: status,
    updatedAt: serverTimestamp(),
  })
}
