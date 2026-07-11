import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { dateStringToTimestamp } from '../../lib/formatters/date'
import { getPaymentPercentage, getPaymentStatus } from '../../lib/formatters/invoice'
import { firestore } from '../../lib/firebase/client'
import type {
  ClientRecord,
  DiscountType,
  EventType,
  InvoicePackageItem,
  InvoicePaymentEntry,
  InvoiceRecord,
  LeadSourceType,
  PartnerRecord,
  PaymentMethod,
  ServicePackage,
} from '../../types/domain'
import { createClient, updateClient, type ClientInput } from './clients'
import { getBusinessProfile } from './businessProfiles'
import { createInvoiceEvent } from './invoiceEvents'
import { listPayments, recalculateInvoicePayments } from './payments'
import { createReceiptForPayment } from './receipts'
import { calculateCommission } from './partners'

export type InvoiceMutationInput = {
  clientMode: 'existing' | 'new'
  clientId: string
  existingClient: ClientInput
  newClient: ClientInput
  eventType: EventType
  eventDate: string
  eventLocation: string
  additionalNote: string
  packageIds: string[]
  discountType: DiscountType | null
  discountValue: number
  discountLabel: string
  discountSourcePricelistId: string
  leadSourceType: LeadSourceType
  partnerId: string
  partnerCommissionType: DiscountType | null
  partnerCommissionValue: number
  paymentAmount: number
  paymentMethod: PaymentMethod
}

export type InvoiceMutationDependencies = {
  clients: ClientRecord[]
  packages: ServicePackage[]
  partners?: PartnerRecord[]
}

function buildInvoiceRecord(id: string, data: Record<string, unknown>): InvoiceRecord {
  const subtotal = Number(data.subtotal ?? 0)
  const totalAmount = Number(data.totalAmount ?? subtotal)

  return {
    id,
    userId: String(data.userId ?? ''),
    clientId: String(data.clientId ?? ''),
    clientName: String(data.clientName ?? ''),
    clientWhatsappNumber: typeof data.clientWhatsappNumber === 'string' ? data.clientWhatsappNumber : null,
    clientEmail: typeof data.clientEmail === 'string' ? data.clientEmail : null,
    clientAddress: typeof data.clientAddress === 'string' ? data.clientAddress : null,
    invoiceNumber: String(data.invoiceNumber ?? ''),
    invoiceDate: (data.invoiceDate as InvoiceRecord['invoiceDate']) ?? null,
    eventType: (data.eventType as EventType) ?? 'WEDDING',
    eventDataStatus: (data.eventDataStatus as InvoiceRecord['eventDataStatus']) ?? 'NOT_FILLED',
    publicFormSlug: typeof data.publicFormSlug === 'string' ? data.publicFormSlug : null,
    publicFormEnabled: Boolean(data.publicFormEnabled),
    eventDate: (data.eventDate as InvoiceRecord['eventDate']) ?? null,
    eventLocation: String(data.eventLocation ?? ''),
    additionalNote: typeof data.additionalNote === 'string' ? data.additionalNote : null,
    subtotal,
    discountType:
      data.discountType === 'NOMINAL' || data.discountType === 'PERCENTAGE'
        ? data.discountType
        : null,
    discountValue: Number(data.discountValue ?? 0),
    discountAmount: Number(data.discountAmount ?? Math.max(subtotal - totalAmount, 0)),
    discountLabel: typeof data.discountLabel === 'string' ? data.discountLabel : null,
    discountSourcePricelistId:
      typeof data.discountSourcePricelistId === 'string' ? data.discountSourcePricelistId : null,
    leadSourceType: data.leadSourceType === 'PARTNER' ? 'PARTNER' : 'DIRECT',
    partnerId: typeof data.partnerId === 'string' ? data.partnerId : null,
    partnerName: typeof data.partnerName === 'string' ? data.partnerName : null,
    partnerCategory: typeof data.partnerCategory === 'string' ? data.partnerCategory as InvoiceRecord['partnerCategory'] : null,
    partnerCommissionType:
      data.partnerCommissionType === 'NOMINAL' || data.partnerCommissionType === 'PERCENTAGE'
        ? data.partnerCommissionType
        : null,
    partnerCommissionValue: Number(data.partnerCommissionValue ?? 0),
    partnerCommissionAmount: Number(data.partnerCommissionAmount ?? 0),
    partnerCommissionPaid: Number(data.partnerCommissionPaid ?? 0),
    partnerCommissionStatus: (data.partnerCommissionStatus as InvoiceRecord['partnerCommissionStatus']) ?? 'UNPAID',
    totalAmount,
    totalPaid: Number(data.totalPaid ?? 0),
    remainingAmount: Number(data.remainingAmount ?? 0),
    paymentPercentage: Number(data.paymentPercentage ?? 0),
    paymentStatus: (data.paymentStatus as InvoiceRecord['paymentStatus']) ?? 'BELUM_BAYAR',
    paymentMethod: (data.paymentMethod as InvoiceRecord['paymentMethod']) ?? null,
    items: Array.isArray(data.items) ? (data.items as InvoicePackageItem[]) : [],
    payments: Array.isArray(data.payments) ? (data.payments as InvoicePaymentEntry[]) : [],
    isPublic: Boolean(data.isPublic),
    deletedAt: (data.deletedAt as InvoiceRecord['deletedAt']) ?? null,
    createdAt: (data.createdAt as InvoiceRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as InvoiceRecord['updatedAt']) ?? null,
  }
}

function makeVendorCode(value: string) {
  const code = value
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 4)
    .toUpperCase()

  return code || 'VND'
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

function normalizeInvoiceInput(input: InvoiceMutationInput, dependencies: InvoiceMutationDependencies) {
  const selectedPackages = dependencies.packages.filter((servicePackage) => input.packageIds.includes(servicePackage.id))
  if (selectedPackages.length === 0) throw new Error('INVOICE_PACKAGES_REQUIRED')
  if (!input.eventDate) throw new Error('INVOICE_EVENT_DATE_REQUIRED')

  const client =
    input.clientMode === 'existing'
      ? dependencies.clients.find((clientRecord) => clientRecord.id === input.clientId)
      : null

  if (input.clientMode === 'existing' && !client) throw new Error('INVOICE_CLIENT_REQUIRED')
  if (input.clientMode === 'existing' && !input.existingClient.name.trim()) throw new Error('CLIENT_NAME_REQUIRED')
  if (input.clientMode === 'new' && !input.newClient.name.trim()) throw new Error('CLIENT_NAME_REQUIRED')

  const items = selectedPackages.map((servicePackage) => ({
    id: servicePackage.id,
    packageId: servicePackage.id,
    categoryId: servicePackage.categoryId,
    categoryName: servicePackage.categoryName,
    packageName: servicePackage.name,
    description: servicePackage.description,
    quantity: 1,
    unitPrice: Number(servicePackage.price),
    totalPrice: Number(servicePackage.price),
  }))
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const rawDiscountValue = Math.max(Number(input.discountValue) || 0, 0)
  const discountValue =
    input.discountType === 'PERCENTAGE' ? Math.min(rawDiscountValue, 100) : rawDiscountValue
  const discountAmount =
    input.discountType === 'PERCENTAGE'
      ? Math.round(subtotal * (discountValue / 100))
      : input.discountType === 'NOMINAL'
        ? Math.min(discountValue, subtotal)
        : 0
  const totalAmount = Math.max(subtotal - discountAmount, 0)
  const partner = input.leadSourceType === 'PARTNER'
    ? dependencies.partners?.find((partnerRecord) => partnerRecord.id === input.partnerId)
    : null
  if (input.leadSourceType === 'PARTNER' && !partner) throw new Error('INVOICE_PARTNER_REQUIRED')
  const partnerCommissionAmount = partner
    ? calculateCommission(totalAmount, input.partnerCommissionType, Math.max(Number(input.partnerCommissionValue) || 0, 0))
    : 0
  const paidAmount = Math.min(Math.max(Number(input.paymentAmount) || 0, 0), totalAmount)
  const initialPayment =
    paidAmount > 0
      ? {
          amount: paidAmount,
          paymentDate: Timestamp.now(),
          paymentMethod: input.paymentMethod,
          notes: 'Pembayaran awal',
        }
      : null

  return {
    client,
    items,
    subtotal,
    discountType: discountAmount > 0 ? input.discountType : null,
    discountValue: discountAmount > 0 ? discountValue : 0,
    discountAmount,
    discountLabel: discountAmount > 0 ? input.discountLabel.trim() || 'Potongan harga' : null,
    discountSourcePricelistId:
      discountAmount > 0 && input.discountType === 'PERCENTAGE'
        ? input.discountSourcePricelistId.trim() || null
        : null,
    leadSourceType: partner ? 'PARTNER' as const : 'DIRECT' as const,
    partnerId: partner?.id ?? null,
    partnerName: partner?.name ?? null,
    partnerCategory: partner?.category ?? null,
    partnerCommissionType: partnerCommissionAmount > 0 ? input.partnerCommissionType : null,
    partnerCommissionValue: partnerCommissionAmount > 0 ? Math.max(Number(input.partnerCommissionValue) || 0, 0) : 0,
    partnerCommissionAmount,
    partnerCommissionPaid: 0,
    partnerCommissionStatus: partnerCommissionAmount > 0 ? 'UNPAID' as const : 'PAID' as const,
    totalAmount,
    totalPaid: paidAmount,
    remainingAmount: Math.max(totalAmount - paidAmount, 0),
    paymentPercentage: getPaymentPercentage(totalAmount, paidAmount),
    paymentStatus: getPaymentStatus(totalAmount, paidAmount, initialPayment ? 1 : 0),
    initialPayment,
  }
}

export async function listInvoices(userId: string) {
  const invoicesQuery = query(collection(firestore, firestoreCollections.invoices), where('userId', '==', userId))
  const snapshot = await getDocs(invoicesQuery)

  return snapshot.docs
    .map((invoiceDoc) => buildInvoiceRecord(invoiceDoc.id, invoiceDoc.data()))
    .filter((invoice) => !invoice.deletedAt)
    .sort((a, b) => {
      const aDate = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0
      const bDate = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0
      return bDate - aDate
    })
}

export async function getInvoice(userId: string, invoiceId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.invoices, invoiceId))
  if (!snapshot.exists()) return null

  const invoice = buildInvoiceRecord(snapshot.id, snapshot.data())
  if (invoice.userId !== userId || invoice.deletedAt) return null

  return invoice
}

export async function getPublicInvoiceById(invoiceId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.invoices, invoiceId))
  if (!snapshot.exists()) return null

  const invoice = buildInvoiceRecord(snapshot.id, snapshot.data())
  if (invoice.deletedAt || !invoice.publicFormEnabled) return null

  return invoice
}

export async function createInvoice(
  userId: string,
  input: InvoiceMutationInput,
  dependencies: InvoiceMutationDependencies,
) {
  const normalized = normalizeInvoiceInput(input, dependencies)
  const client =
    input.clientMode === 'new' ? await createClient(userId, input.newClient) : await updateClient(input.clientId, userId, input.existingClient)

  if (!client) throw new Error('INVOICE_CLIENT_REQUIRED')
  if (!client.name.trim()) throw new Error('CLIENT_NAME_REQUIRED')

  const businessProfile = await getBusinessProfile(userId)
  const period = currentPeriod()
  const vendorCode = businessProfile?.vendorCode || makeVendorCode(businessProfile?.vendorName ?? '')
  const invoiceRef = doc(collection(firestore, firestoreCollections.invoices))
  const paymentRef = normalized.initialPayment ? doc(collection(firestore, firestoreCollections.payments)) : null
  const sequenceRef = doc(firestore, firestoreCollections.invoiceSequences, `${userId}_${period}`)

  await runTransaction(firestore, async (transaction) => {
    const sequenceSnapshot = await transaction.get(sequenceRef)
    const nextNumber = Number(sequenceSnapshot.data()?.lastNumber ?? 0) + 1
    const invoiceNumber = `INV-${vendorCode}-${period}-${String(nextNumber).padStart(4, '0')}`

    transaction.set(
      sequenceRef,
      {
        userId,
        period,
        lastNumber: nextNumber,
        updatedAt: serverTimestamp(),
        createdAt: sequenceSnapshot.exists() ? sequenceSnapshot.data().createdAt : serverTimestamp(),
      },
      { merge: true },
    )

    transaction.set(invoiceRef, {
      userId,
      clientId: client.id,
      clientName: client.name,
      clientWhatsappNumber: client.whatsappNumber,
      clientEmail: client.email,
      clientAddress: client.address,
      invoiceNumber,
      invoiceDate: Timestamp.now(),
      eventType: input.eventType,
      eventDataStatus: 'NOT_FILLED',
      publicFormSlug: null,
      publicFormEnabled: false,
      eventDate: dateStringToTimestamp(input.eventDate),
      eventLocation: input.eventLocation.trim(),
      additionalNote: input.additionalNote.trim() || null,
      subtotal: normalized.subtotal,
      discountType: normalized.discountType,
      discountValue: normalized.discountValue,
      discountAmount: normalized.discountAmount,
      discountLabel: normalized.discountLabel,
      discountSourcePricelistId: normalized.discountSourcePricelistId,
      leadSourceType: normalized.leadSourceType,
      partnerId: normalized.partnerId,
      partnerName: normalized.partnerName,
      partnerCategory: normalized.partnerCategory,
      partnerCommissionType: normalized.partnerCommissionType,
      partnerCommissionValue: normalized.partnerCommissionValue,
      partnerCommissionAmount: normalized.partnerCommissionAmount,
      partnerCommissionPaid: 0,
      partnerCommissionStatus: normalized.partnerCommissionStatus,
      totalAmount: normalized.totalAmount,
      totalPaid: normalized.totalPaid,
      remainingAmount: normalized.remainingAmount,
      paymentPercentage: normalized.paymentPercentage,
      paymentStatus: normalized.paymentStatus,
      paymentMethod: normalized.initialPayment?.paymentMethod ?? null,
      items: normalized.items,
      payments: [],
      isPublic: false,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    if (paymentRef && normalized.initialPayment) {
      transaction.set(paymentRef, {
        userId,
        invoiceId: invoiceRef.id,
        amount: normalized.initialPayment.amount,
        paymentDate: normalized.initialPayment.paymentDate,
        paymentMethod: normalized.initialPayment.paymentMethod,
        notes: normalized.initialPayment.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      })
    }
  })

  if (paymentRef) {
    try {
      await createReceiptForPayment(userId, paymentRef.id)
    } catch (error) {
      console.error('Invoice was created, but automatic receipt creation failed', error)
    }
  }

  await createInvoiceEvent(userId, invoiceRef.id, input.eventType).catch((error) => {
    console.error('Invoice was created, but event detail document creation failed', error)
  })

  return invoiceRef.id
}

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  input: InvoiceMutationInput,
  dependencies: InvoiceMutationDependencies,
) {
  const existingInvoice = await getInvoice(userId, invoiceId)
  if (!existingInvoice) throw new Error('INVOICE_NOT_FOUND')

  const normalized = normalizeInvoiceInput(input, dependencies)
  const client =
    input.clientMode === 'new' ? await createClient(userId, input.newClient) : await updateClient(input.clientId, userId, input.existingClient)

  if (!client) throw new Error('INVOICE_CLIENT_REQUIRED')
  if (!client.name.trim()) throw new Error('CLIENT_NAME_REQUIRED')
  const payments = await listPayments(userId, invoiceId)
  const totalPaid = Math.min(
    payments.reduce((sum, payment) => sum + payment.amount, 0),
    normalized.totalAmount,
  )
  const remainingAmount = Math.max(normalized.totalAmount - totalPaid, 0)
  const partnerCommissionPaid = existingInvoice.partnerId === normalized.partnerId
    ? Math.min(existingInvoice.partnerCommissionPaid, normalized.partnerCommissionAmount)
    : 0
  const partnerCommissionStatus = normalized.partnerCommissionAmount <= 0
    ? 'PAID'
    : partnerCommissionPaid <= 0
      ? 'UNPAID'
      : partnerCommissionPaid >= normalized.partnerCommissionAmount
        ? 'PAID'
        : 'PARTIAL'

  await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
    userId,
    clientId: client.id,
    clientName: client.name,
    clientWhatsappNumber: client.whatsappNumber,
    clientEmail: client.email,
    clientAddress: client.address,
    eventType: input.eventType,
    eventDate: dateStringToTimestamp(input.eventDate),
    eventLocation: input.eventLocation.trim(),
    additionalNote: input.additionalNote.trim() || null,
    subtotal: normalized.subtotal,
    discountType: normalized.discountType,
    discountValue: normalized.discountValue,
    discountAmount: normalized.discountAmount,
    discountLabel: normalized.discountLabel,
    discountSourcePricelistId: normalized.discountSourcePricelistId,
    leadSourceType: normalized.leadSourceType,
    partnerId: normalized.partnerId,
    partnerName: normalized.partnerName,
    partnerCategory: normalized.partnerCategory,
    partnerCommissionType: normalized.partnerCommissionType,
    partnerCommissionValue: normalized.partnerCommissionValue,
    partnerCommissionAmount: normalized.partnerCommissionAmount,
    partnerCommissionPaid,
    partnerCommissionStatus,
    totalAmount: normalized.totalAmount,
    totalPaid,
    remainingAmount,
    paymentPercentage: getPaymentPercentage(normalized.totalAmount, totalPaid),
    paymentStatus: getPaymentStatus(normalized.totalAmount, totalPaid, payments.length),
    paymentMethod: payments.length > 0 ? payments[payments.length - 1].paymentMethod : null,
    items: normalized.items,
    payments: [],
    updatedAt: serverTimestamp(),
  })

  await createInvoiceEvent(userId, invoiceId, input.eventType).catch((error) => {
    console.error('Invoice was updated, but event detail document sync failed', error)
  })
  await recalculateInvoicePayments(userId, invoiceId)
}

export async function softDeleteInvoice(userId: string, invoiceId: string) {
  const existingInvoice = await getInvoice(userId, invoiceId)
  if (!existingInvoice) throw new Error('INVOICE_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
