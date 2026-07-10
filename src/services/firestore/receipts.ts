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
import { firestore } from '../../lib/firebase/client'
import type { InvoiceRecord, PaymentMethod, PaymentRecord, ReceiptRecord } from '../../types/domain'
import { getBusinessProfile } from './businessProfiles'

function buildPaymentRecord(id: string, data: Record<string, unknown>): PaymentRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    amount: Number(data.amount ?? 0),
    paymentDate: (data.paymentDate as PaymentRecord['paymentDate']) ?? null,
    paymentMethod: (data.paymentMethod as PaymentMethod) ?? 'TRANSFER_BANK',
    notes: typeof data.notes === 'string' ? data.notes : null,
    createdAt: (data.createdAt as PaymentRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as PaymentRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as PaymentRecord['deletedAt']) ?? null,
  }
}

function buildInvoiceRecord(id: string, data: Record<string, unknown>): Pick<InvoiceRecord, 'id' | 'userId' | 'invoiceNumber' | 'clientName' | 'deletedAt'> {
  return {
    id,
    userId: String(data.userId ?? ''),
    invoiceNumber: String(data.invoiceNumber ?? ''),
    clientName: String(data.clientName ?? ''),
    deletedAt: (data.deletedAt as InvoiceRecord['deletedAt']) ?? null,
  }
}

function buildReceiptRecord(id: string, data: Record<string, unknown>): ReceiptRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    receiptNumber: String(data.receiptNumber ?? ''),
    receiptDate: (data.receiptDate as ReceiptRecord['receiptDate']) ?? null,
    invoiceId: String(data.invoiceId ?? ''),
    invoiceNumber: String(data.invoiceNumber ?? ''),
    paymentId: String(data.paymentId ?? ''),
    clientName: String(data.clientName ?? ''),
    vendorName: String(data.vendorName ?? ''),
    vendorWhatsappNumber: typeof data.vendorWhatsappNumber === 'string' ? data.vendorWhatsappNumber : null,
    vendorAddress: typeof data.vendorAddress === 'string' ? data.vendorAddress : null,
    amount: Number(data.amount ?? 0),
    paymentMethod: (data.paymentMethod as PaymentMethod) ?? 'TRANSFER_BANK',
    notes: typeof data.notes === 'string' ? data.notes : null,
    createdAt: (data.createdAt as ReceiptRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as ReceiptRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as ReceiptRecord['deletedAt']) ?? null,
  }
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function getReceiptByPaymentId(userId: string, paymentId: string) {
  const receiptsQuery = query(collection(firestore, firestoreCollections.receipts), where('userId', '==', userId))
  const snapshot = await getDocs(receiptsQuery)

  return (
    snapshot.docs
      .map((receiptDoc) => buildReceiptRecord(receiptDoc.id, receiptDoc.data()))
      .find((receipt) => receipt.paymentId === paymentId && !receipt.deletedAt) ?? null
  )
}

async function getReceiptSource(userId: string, paymentId: string) {
  const paymentSnapshot = await getDoc(doc(firestore, firestoreCollections.payments, paymentId))
  if (!paymentSnapshot.exists()) throw new Error('PAYMENT_NOT_FOUND')

  const payment = buildPaymentRecord(paymentSnapshot.id, paymentSnapshot.data())
  if (payment.userId !== userId || payment.deletedAt) throw new Error('PAYMENT_NOT_FOUND')

  const invoiceSnapshot = await getDoc(doc(firestore, firestoreCollections.invoices, payment.invoiceId))
  if (!invoiceSnapshot.exists()) throw new Error('INVOICE_NOT_FOUND')

  const invoice = buildInvoiceRecord(invoiceSnapshot.id, invoiceSnapshot.data())
  if (invoice.userId !== userId || invoice.deletedAt) throw new Error('INVOICE_NOT_FOUND')

  const businessProfile = await getBusinessProfile(userId)

  return {
    payment,
    invoice,
    businessProfile,
  }
}

export async function listReceipts(userId: string) {
  const receiptsQuery = query(collection(firestore, firestoreCollections.receipts), where('userId', '==', userId))
  const snapshot = await getDocs(receiptsQuery)

  return snapshot.docs
    .map((receiptDoc) => buildReceiptRecord(receiptDoc.id, receiptDoc.data()))
    .filter((receipt) => !receipt.deletedAt)
    .sort((a, b) => {
      const aDate = a.receiptDate instanceof Timestamp ? a.receiptDate.toMillis() : 0
      const bDate = b.receiptDate instanceof Timestamp ? b.receiptDate.toMillis() : 0
      return bDate - aDate
    })
}

export async function getReceipt(userId: string, receiptId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.receipts, receiptId))
  if (!snapshot.exists()) return null

  const receipt = buildReceiptRecord(snapshot.id, snapshot.data())
  if (receipt.userId !== userId || receipt.deletedAt) return null

  return receipt
}

export async function createReceiptForPayment(userId: string, paymentId: string) {
  const existingReceipt = await getReceiptByPaymentId(userId, paymentId)
  if (existingReceipt) return existingReceipt.id

  const { payment, invoice, businessProfile } = await getReceiptSource(userId, paymentId)
  const period = currentPeriod()
  const vendorCode = businessProfile?.vendorCode || 'VND'
  const sequenceRef = doc(firestore, firestoreCollections.receiptSequences, `${userId}_${period}`)
  const receiptRef = doc(collection(firestore, firestoreCollections.receipts))

  await runTransaction(firestore, async (transaction) => {
    const sequenceSnapshot = await transaction.get(sequenceRef)
    const nextNumber = Number(sequenceSnapshot.data()?.lastNumber ?? 0) + 1
    const receiptNumber = `RCT-${vendorCode}-${period}-${String(nextNumber).padStart(4, '0')}`

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

    transaction.set(receiptRef, {
      userId,
      receiptNumber,
      receiptDate: payment.paymentDate ?? Timestamp.now(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentId: payment.id,
      clientName: invoice.clientName,
      vendorName: businessProfile?.vendorName || 'Vendor',
      vendorWhatsappNumber: businessProfile?.whatsappNumber || null,
      vendorAddress: businessProfile?.address || null,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
    })
  })

  return receiptRef.id
}

export async function syncReceiptForPayment(userId: string, paymentId: string) {
  const existingReceipt = await getReceiptByPaymentId(userId, paymentId)
  if (!existingReceipt) return createReceiptForPayment(userId, paymentId)

  const { payment, invoice, businessProfile } = await getReceiptSource(userId, paymentId)

  await updateDoc(doc(firestore, firestoreCollections.receipts, existingReceipt.id), {
    userId,
    receiptDate: payment.paymentDate ?? Timestamp.now(),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    paymentId: payment.id,
    clientName: invoice.clientName,
    vendorName: businessProfile?.vendorName || existingReceipt.vendorName || 'Vendor',
    vendorWhatsappNumber: businessProfile?.whatsappNumber || null,
    vendorAddress: businessProfile?.address || null,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    notes: payment.notes,
    updatedAt: serverTimestamp(),
  })

  return existingReceipt.id
}

export async function softDeleteReceiptForPayment(userId: string, paymentId: string) {
  const existingReceipt = await getReceiptByPaymentId(userId, paymentId)
  if (!existingReceipt) return

  await updateDoc(doc(firestore, firestoreCollections.receipts, existingReceipt.id), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function softDeleteReceipt(userId: string, receiptId: string) {
  const receipt = await getReceipt(userId, receiptId)
  if (!receipt) throw new Error('RECEIPT_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.receipts, receipt.id), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
