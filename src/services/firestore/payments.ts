import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { dateStringToTimestamp } from '../../lib/formatters/date'
import { getPaymentPercentage, getPaymentStatus } from '../../lib/formatters/invoice'
import { firestore } from '../../lib/firebase/client'
import type { InvoiceRecord, PaymentMethod, PaymentRecord } from '../../types/domain'
import { createReceiptForPayment, softDeleteReceiptForPayment, syncReceiptForPayment } from './receipts'

export type PaymentInput = {
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  notes: string
}

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

function normalizePaymentInput(input: PaymentInput) {
  const amount = Number(input.amount)
  if (Number.isNaN(amount) || amount <= 0) throw new Error('PAYMENT_AMOUNT_INVALID')
  if (!input.paymentDate) throw new Error('PAYMENT_DATE_REQUIRED')

  return {
    amount,
    paymentDate: dateStringToTimestamp(input.paymentDate),
    paymentMethod: input.paymentMethod,
    notes: input.notes.trim() || null,
  }
}

async function getInvoiceForPayment(userId: string, invoiceId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.invoices, invoiceId))
  if (!snapshot.exists()) throw new Error('INVOICE_NOT_FOUND')

  const data = snapshot.data() as InvoiceRecord
  if (data.userId !== userId || data.deletedAt) throw new Error('INVOICE_NOT_FOUND')

  return {
    id: snapshot.id,
    totalAmount: Number(data.totalAmount ?? 0),
  }
}

async function getOtherPaymentTotal(userId: string, invoiceId: string, excludedPaymentId?: string) {
  const payments = await listPayments(userId, invoiceId)
  return payments
    .filter((payment) => payment.id !== excludedPaymentId)
    .reduce((sum, payment) => sum + payment.amount, 0)
}

async function assertPaymentDoesNotOverpay(
  userId: string,
  invoiceId: string,
  amount: number,
  excludedPaymentId?: string,
) {
  const invoice = await getInvoiceForPayment(userId, invoiceId)
  const otherPaymentTotal = await getOtherPaymentTotal(userId, invoiceId, excludedPaymentId)

  if (otherPaymentTotal + amount > invoice.totalAmount) {
    throw new Error('PAYMENT_AMOUNT_EXCEEDS_REMAINING')
  }
}

export async function listPayments(userId: string, invoiceId: string) {
  const paymentsQuery = query(
    collection(firestore, firestoreCollections.payments),
    where('userId', '==', userId),
  )
  const snapshot = await getDocs(paymentsQuery)

  return snapshot.docs
    .map((paymentDoc) => buildPaymentRecord(paymentDoc.id, paymentDoc.data()))
    .filter((payment) => payment.invoiceId === invoiceId && !payment.deletedAt)
    .sort((a, b) => {
      const aDate = a.paymentDate instanceof Timestamp ? a.paymentDate.toMillis() : 0
      const bDate = b.paymentDate instanceof Timestamp ? b.paymentDate.toMillis() : 0
      return aDate - bDate
    })
}

export async function recalculateInvoicePayments(userId: string, invoiceId: string) {
  const invoice = await getInvoiceForPayment(userId, invoiceId)
  const payments = await listPayments(userId, invoiceId)
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const clampedPaid = Math.min(totalPaid, invoice.totalAmount)
  const remainingAmount = Math.max(invoice.totalAmount - clampedPaid, 0)

  await updateDoc(doc(firestore, firestoreCollections.invoices, invoiceId), {
    userId,
    totalPaid: clampedPaid,
    remainingAmount,
    paymentPercentage: getPaymentPercentage(invoice.totalAmount, clampedPaid),
    paymentStatus: getPaymentStatus(invoice.totalAmount, clampedPaid, payments.length),
    paymentMethod: payments.length > 0 ? payments[payments.length - 1].paymentMethod : null,
    updatedAt: serverTimestamp(),
  })
}

export async function addPayment(userId: string, invoiceId: string, input: PaymentInput) {
  await getInvoiceForPayment(userId, invoiceId)
  const normalized = normalizePaymentInput(input)
  await assertPaymentDoesNotOverpay(userId, invoiceId, normalized.amount)

  const paymentRef = await addDoc(collection(firestore, firestoreCollections.payments), {
    userId,
    invoiceId,
    ...normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })

  await recalculateInvoicePayments(userId, invoiceId)
  await createReceiptForPayment(userId, paymentRef.id)
}

export async function updatePayment(userId: string, paymentId: string, input: PaymentInput) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.payments, paymentId))
  if (!snapshot.exists()) throw new Error('PAYMENT_NOT_FOUND')

  const payment = buildPaymentRecord(snapshot.id, snapshot.data())
  if (payment.userId !== userId || payment.deletedAt) throw new Error('PAYMENT_NOT_FOUND')
  const normalized = normalizePaymentInput(input)
  await assertPaymentDoesNotOverpay(userId, payment.invoiceId, normalized.amount, payment.id)

  await updateDoc(doc(firestore, firestoreCollections.payments, paymentId), {
    userId,
    invoiceId: payment.invoiceId,
    ...normalized,
    updatedAt: serverTimestamp(),
  })

  await recalculateInvoicePayments(userId, payment.invoiceId)
  await syncReceiptForPayment(userId, payment.id)
}

export async function softDeletePayment(userId: string, paymentId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.payments, paymentId))
  if (!snapshot.exists()) throw new Error('PAYMENT_NOT_FOUND')

  const payment = buildPaymentRecord(snapshot.id, snapshot.data())
  if (payment.userId !== userId || payment.deletedAt) throw new Error('PAYMENT_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.payments, paymentId), {
    userId,
    invoiceId: payment.invoiceId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await recalculateInvoicePayments(userId, payment.invoiceId)
  await softDeleteReceiptForPayment(userId, payment.id)
}

export async function markInvoiceFullyPaid(userId: string, invoiceId: string, paymentMethod: PaymentMethod) {
  const invoice = await getInvoiceForPayment(userId, invoiceId)
  const payments = await listPayments(userId, invoiceId)
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const remainingAmount = Math.max(invoice.totalAmount - totalPaid, 0)

  if (remainingAmount > 0) {
    const paymentRef = await addDoc(collection(firestore, firestoreCollections.payments), {
      userId,
      invoiceId,
      amount: remainingAmount,
      paymentDate: Timestamp.now(),
      paymentMethod,
      notes: 'Pelunasan invoice',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
    })

    await createReceiptForPayment(userId, paymentRef.id)
  }

  await recalculateInvoicePayments(userId, invoiceId)
}
