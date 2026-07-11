import { addDoc, collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { dateStringToTimestamp, toInputDate } from '../../lib/formatters/date'
import { firestore } from '../../lib/firebase/client'
import type { PartnerCategory, PartnerCommissionPaymentRecord, PartnerCommissionStatus, PartnerRecord, PaymentMethod } from '../../types/domain'

export type PartnerInput = {
  name: string
  category: PartnerCategory
  picName: string
  whatsappNumber: string
  email: string
  address: string
  notes: string
  isActive: boolean
}

export type PartnerCommissionPaymentInput = {
  partnerId: string
  invoiceId: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  notes: string
}

export const partnerCategoryLabels: Record<PartnerCategory, string> = {
  WEDDING_ORGANIZER: 'Wedding Organizer',
  DEKORASI: 'Dekorasi',
  MAKE_UP_ARTIST: 'Make Up Artist',
  EVENT_ORGANIZER: 'Event Organizer',
  VENUE: 'Venue',
  VENDOR_LAINNYA: 'Vendor Lainnya',
}

export const partnerCommissionStatusLabels: Record<PartnerCommissionStatus, string> = {
  UNPAID: 'Belum Dibayar',
  PARTIAL: 'Dibayar Sebagian',
  PAID: 'Lunas',
}

function buildPartner(id: string, data: Record<string, unknown>): PartnerRecord {
  const category = Object.keys(partnerCategoryLabels).includes(String(data.category))
    ? data.category as PartnerCategory
    : 'VENDOR_LAINNYA'

  return {
    id,
    userId: String(data.userId ?? ''),
    name: String(data.name ?? ''),
    category,
    picName: typeof data.picName === 'string' ? data.picName : null,
    whatsappNumber: typeof data.whatsappNumber === 'string' ? data.whatsappNumber : null,
    email: typeof data.email === 'string' ? data.email : null,
    address: typeof data.address === 'string' ? data.address : null,
    notes: typeof data.notes === 'string' ? data.notes : null,
    isActive: data.isActive !== false,
    createdAt: (data.createdAt as PartnerRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as PartnerRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as PartnerRecord['deletedAt']) ?? null,
  }
}

function buildCommissionPayment(id: string, data: Record<string, unknown>): PartnerCommissionPaymentRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    partnerId: String(data.partnerId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    amount: Number(data.amount ?? 0),
    paymentDate: (data.paymentDate as PartnerCommissionPaymentRecord['paymentDate']) ?? null,
    paymentMethod: (data.paymentMethod as PaymentMethod) ?? 'TRANSFER_BANK',
    notes: typeof data.notes === 'string' ? data.notes : null,
    createdAt: (data.createdAt as PartnerCommissionPaymentRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as PartnerCommissionPaymentRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as PartnerCommissionPaymentRecord['deletedAt']) ?? null,
  }
}

function normalizePartnerInput(input: PartnerInput) {
  if (!input.name.trim()) throw new Error('PARTNER_NAME_REQUIRED')

  return {
    name: input.name.trim(),
    category: input.category,
    picName: input.picName.trim() || null,
    whatsappNumber: input.whatsappNumber.trim() || null,
    email: input.email.trim() || null,
    address: input.address.trim() || null,
    notes: input.notes.trim() || null,
    isActive: input.isActive,
  }
}

export async function listPartners(userId: string, includeInactive = true) {
  const snapshot = await getDocs(query(collection(firestore, firestoreCollections.partners), where('userId', '==', userId)))
  return snapshot.docs
    .map((partnerDoc) => buildPartner(partnerDoc.id, partnerDoc.data()))
    .filter((partner) => !partner.deletedAt && (includeInactive || partner.isActive))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getPartner(userId: string, partnerId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.partners, partnerId))
  if (!snapshot.exists()) return null
  const partner = buildPartner(snapshot.id, snapshot.data())
  return partner.userId === userId && !partner.deletedAt ? partner : null
}

export async function createPartner(userId: string, input: PartnerInput) {
  const normalized = normalizePartnerInput(input)
  await addDoc(collection(firestore, firestoreCollections.partners), {
    userId,
    ...normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function updatePartner(userId: string, partnerId: string, input: PartnerInput) {
  const existing = await getPartner(userId, partnerId)
  if (!existing) throw new Error('PARTNER_NOT_FOUND')
  const normalized = normalizePartnerInput(input)
  await updateDoc(doc(firestore, firestoreCollections.partners, partnerId), {
    userId,
    ...normalized,
    updatedAt: serverTimestamp(),
  })
}

export async function listPartnerCommissionPayments(userId: string) {
  const snapshot = await getDocs(query(collection(firestore, firestoreCollections.partnerCommissionPayments), where('userId', '==', userId)))
  return snapshot.docs
    .map((paymentDoc) => buildCommissionPayment(paymentDoc.id, paymentDoc.data()))
    .filter((payment) => !payment.deletedAt)
    .sort((a, b) => (toInputDate(b.paymentDate) || '').localeCompare(toInputDate(a.paymentDate) || ''))
}

export async function createPartnerCommissionPayment(userId: string, input: PartnerCommissionPaymentInput) {
  if (!input.partnerId || !input.invoiceId) throw new Error('PARTNER_COMMISSION_TARGET_REQUIRED')
  if (!input.amount || input.amount <= 0) throw new Error('PARTNER_COMMISSION_AMOUNT_INVALID')
  if (!input.paymentDate) throw new Error('PARTNER_COMMISSION_DATE_REQUIRED')

  await runTransaction(firestore, async (transaction) => {
    const invoiceRef = doc(firestore, firestoreCollections.invoices, input.invoiceId)
    const invoiceSnapshot = await transaction.get(invoiceRef)
    if (!invoiceSnapshot.exists()) throw new Error('INVOICE_NOT_FOUND')
    const invoice = invoiceSnapshot.data()
    if (invoice.userId !== userId || invoice.partnerId !== input.partnerId || invoice.deletedAt) throw new Error('INVOICE_NOT_FOUND')

    const commissionAmount = Number(invoice.partnerCommissionAmount ?? 0)
    const currentPaid = Number(invoice.partnerCommissionPaid ?? 0)
    const remainingCommission = Math.max(commissionAmount - currentPaid, 0)
    if (remainingCommission <= 0) throw new Error('PARTNER_COMMISSION_ALREADY_PAID')

    const nextPaid = Math.min(currentPaid + input.amount, commissionAmount)
    const nextStatus: PartnerCommissionStatus = nextPaid <= 0 ? 'UNPAID' : nextPaid >= commissionAmount ? 'PAID' : 'PARTIAL'
    const paymentRef = doc(collection(firestore, firestoreCollections.partnerCommissionPayments))

    transaction.set(paymentRef, {
      userId,
      partnerId: input.partnerId,
      invoiceId: input.invoiceId,
      amount: Math.min(input.amount, remainingCommission),
      paymentDate: dateStringToTimestamp(input.paymentDate),
      paymentMethod: input.paymentMethod,
      notes: input.notes.trim() || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
    })

    transaction.update(invoiceRef, {
      partnerCommissionPaid: nextPaid,
      partnerCommissionStatus: nextStatus,
      updatedAt: serverTimestamp(),
    })
  })
}

export function calculateCommission(totalAmount: number, type: 'NOMINAL' | 'PERCENTAGE' | null, value: number) {
  if (!type || value <= 0) return 0
  if (type === 'PERCENTAGE') return Math.round(totalAmount * (Math.min(value, 100) / 100))
  return Math.min(value, totalAmount)
}
