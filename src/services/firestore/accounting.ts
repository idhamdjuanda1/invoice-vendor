import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { dateStringToTimestamp, toInputDate } from '../../lib/formatters/date'
import { firestore } from '../../lib/firebase/client'
import type {
  AccountingAccountType,
  AccountingAssetCondition,
  AccountingAssetRecord,
  AccountingCategoryRecord,
  AccountingPayableRecord,
  AccountingPayableStatus,
  AccountingTransactionRecord,
  AccountingTransactionType,
  FirestoreDate,
} from '../../types/domain'

export type AccountingTransactionInput = {
  type: AccountingTransactionType
  date: string
  accountType: AccountingAccountType
  categoryId: string
  categoryName: string
  amount: number
  description: string
  referenceType?: AccountingTransactionRecord['referenceType']
}

export type AccountingAssetInput = {
  name: string
  purchaseDate: string
  purchasePrice: number
  paymentAccountType: AccountingAccountType
  condition: AccountingAssetCondition
  depreciationMonths: number
  location: string
  notes: string
}

export type AccountingPayableInput = {
  vendorName: string
  description: string
  dueDate: string
  amount: number
}

export const incomeCategoryDefaults = ['Pelunasan Invoice', 'Pendapatan Lain', 'Pendapatan Jasa', 'Pendapatan Tambahan', 'Saldo Awal / Modal']

export const expenseCategoryDefaults = [
  'Biaya Operasional',
  'Pembelian Aset',
  'Gaji',
  'Honor Freelance',
  'Transportasi',
  'Konsumsi',
  'Marketing',
  'Sewa',
  'Listrik',
  'Internet',
  'Peralatan',
  'Perawatan',
  'Pajak',
  'Administrasi Bank',
  'Prive',
  'Pengeluaran Lainnya',
]

export const accountingTransactionTypeLabels: Record<AccountingTransactionType, string> = {
  INCOME: 'Pemasukan',
  EXPENSE: 'Pengeluaran',
}

export const accountingAccountTypeLabels: Record<AccountingAccountType, string> = {
  CASH: 'Kas',
  BANK: 'Bank',
}

export const assetConditionLabels: Record<AccountingAssetCondition, string> = {
  BAIK: 'Baik',
  PERLU_PERAWATAN: 'Perlu Perawatan',
  RUSAK: 'Rusak',
  DIJUAL: 'Dijual',
}

export const accountingPayableStatusLabels: Record<AccountingPayableStatus, string> = {
  UNPAID: 'Belum Dibayar',
  PARTIAL: 'Dibayar Sebagian',
  PAID: 'Lunas',
}

function toMillis(value: FirestoreDate) {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  return value.getTime()
}

function isCurrentMonth(value: FirestoreDate) {
  const inputDate = toInputDate(value)
  if (!inputDate) return false
  const now = new Date()
  const [year, month] = inputDate.split('-')
  return Number(year) === now.getFullYear() && Number(month) === now.getMonth() + 1
}

function buildCategory(id: string, data: Record<string, unknown>): AccountingCategoryRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    type: data.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
    name: String(data.name ?? ''),
    isDefault: data.isDefault === true,
    createdAt: (data.createdAt as AccountingCategoryRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as AccountingCategoryRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as AccountingCategoryRecord['deletedAt']) ?? null,
  }
}

function buildTransaction(id: string, data: Record<string, unknown>): AccountingTransactionRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    type: data.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
    date: (data.date as AccountingTransactionRecord['date']) ?? null,
    accountType: data.accountType === 'BANK' ? 'BANK' : 'CASH',
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : null,
    categoryName: String(data.categoryName ?? ''),
    amount: Number(data.amount ?? 0),
    description: String(data.description ?? ''),
    referenceType:
      data.referenceType === 'INVOICE_PAYMENT'
        || data.referenceType === 'ASSET_PURCHASE'
        || data.referenceType === 'OPENING_BALANCE'
        || data.referenceType === 'DEPRECIATION'
        || data.referenceType === 'PAYABLE_PAYMENT'
        ? data.referenceType
        : 'MANUAL',
    referenceId: typeof data.referenceId === 'string' ? data.referenceId : null,
    createdById: String(data.createdById ?? ''),
    createdAt: (data.createdAt as AccountingTransactionRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as AccountingTransactionRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as AccountingTransactionRecord['deletedAt']) ?? null,
  }
}

function buildPayable(id: string, data: Record<string, unknown>): AccountingPayableRecord {
  const status = ['PARTIAL', 'PAID'].includes(String(data.status)) ? data.status as AccountingPayableStatus : 'UNPAID'
  return {
    id,
    userId: String(data.userId ?? ''),
    vendorName: String(data.vendorName ?? ''),
    description: String(data.description ?? ''),
    dueDate: (data.dueDate as AccountingPayableRecord['dueDate']) ?? null,
    amount: Number(data.amount ?? 0),
    paidAmount: Number(data.paidAmount ?? 0),
    status,
    createdAt: (data.createdAt as AccountingPayableRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as AccountingPayableRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as AccountingPayableRecord['deletedAt']) ?? null,
  }
}

function buildAsset(id: string, data: Record<string, unknown>): AccountingAssetRecord {
  const condition = ['PERLU_PERAWATAN', 'RUSAK', 'DIJUAL'].includes(String(data.condition)) ? data.condition as AccountingAssetCondition : 'BAIK'
  const purchasePrice = Number(data.purchasePrice ?? 0)
  const depreciationMonths = Math.max(Number(data.depreciationMonths ?? 12), 1)
  const monthlyDepreciation = Number(data.monthlyDepreciation ?? 0) || Math.round(purchasePrice / depreciationMonths)
  return {
    id,
    userId: String(data.userId ?? ''),
    name: String(data.name ?? ''),
    purchaseDate: (data.purchaseDate as AccountingAssetRecord['purchaseDate']) ?? null,
    purchasePrice,
    paymentAccountType: data.paymentAccountType === 'CASH' ? 'CASH' : 'BANK',
    condition,
    location: typeof data.location === 'string' ? data.location : null,
    notes: typeof data.notes === 'string' ? data.notes : null,
    depreciationMethod: typeof data.depreciationMethod === 'string' ? data.depreciationMethod : 'STRAIGHT_LINE',
    depreciationMonths,
    monthlyDepreciation,
    createdAt: (data.createdAt as AccountingAssetRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as AccountingAssetRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as AccountingAssetRecord['deletedAt']) ?? null,
  }
}

export async function seedAccountingCategories(userId: string) {
  const existing = await listAccountingCategories(userId)
  if (existing.length > 0) return existing

  await Promise.all([
    ...incomeCategoryDefaults.map((name) => createAccountingCategory(userId, 'INCOME', name, true)),
    ...expenseCategoryDefaults.map((name) => createAccountingCategory(userId, 'EXPENSE', name, true)),
  ])
  return listAccountingCategories(userId)
}

export async function listAccountingCategories(userId: string) {
  const snapshot = await getDocs(query(collection(firestore, firestoreCollections.accountingCategories), where('userId', '==', userId)))
  return snapshot.docs
    .map((categoryDoc) => buildCategory(categoryDoc.id, categoryDoc.data()))
    .filter((category) => !category.deletedAt)
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
}

export async function createAccountingCategory(userId: string, type: AccountingTransactionType, name: string, isDefault = false) {
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('ACCOUNTING_CATEGORY_REQUIRED')
  await addDoc(collection(firestore, firestoreCollections.accountingCategories), {
    userId,
    type,
    name: normalizedName,
    isDefault,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function updateAccountingCategory(userId: string, categoryId: string, name: string) {
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('ACCOUNTING_CATEGORY_REQUIRED')
  await updateDoc(doc(firestore, firestoreCollections.accountingCategories, categoryId), {
    userId,
    name: normalizedName,
    updatedAt: serverTimestamp(),
  })
}

export async function listAccountingTransactions(userId: string) {
  const snapshot = await getDocs(query(collection(firestore, firestoreCollections.accountingTransactions), where('userId', '==', userId)))
  return snapshot.docs
    .map((transactionDoc) => buildTransaction(transactionDoc.id, transactionDoc.data()))
    .filter((transaction) => !transaction.deletedAt)
    .sort((a, b) => toMillis(b.date) - toMillis(a.date))
}

export async function createAccountingTransaction(userId: string, createdById: string, input: AccountingTransactionInput) {
  if (!input.amount || input.amount <= 0) throw new Error('ACCOUNTING_AMOUNT_INVALID')
  if (!input.description.trim()) throw new Error('ACCOUNTING_DESCRIPTION_REQUIRED')
  await addDoc(collection(firestore, firestoreCollections.accountingTransactions), {
    userId,
    type: input.type,
    date: dateStringToTimestamp(input.date),
    accountType: input.accountType,
    categoryId: input.categoryId || null,
    categoryName: input.categoryName,
    amount: input.amount,
    description: input.description.trim(),
    referenceType: input.referenceType ?? 'MANUAL',
    referenceId: null,
    createdById,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function updateAccountingTransaction(userId: string, transactionId: string, input: AccountingTransactionInput) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.accountingTransactions, transactionId))
  if (!snapshot.exists()) throw new Error('ACCOUNTING_TRANSACTION_NOT_FOUND')

  const transaction = buildTransaction(snapshot.id, snapshot.data())
  if (transaction.userId !== userId || transaction.deletedAt) throw new Error('ACCOUNTING_TRANSACTION_NOT_FOUND')
  if (!['MANUAL', 'OPENING_BALANCE'].includes(transaction.referenceType)) throw new Error('ACCOUNTING_TRANSACTION_LOCKED')
  if (!input.amount || input.amount <= 0) throw new Error('ACCOUNTING_AMOUNT_INVALID')
  if (!input.description.trim()) throw new Error('ACCOUNTING_DESCRIPTION_REQUIRED')

  await updateDoc(doc(firestore, firestoreCollections.accountingTransactions, transactionId), {
    userId,
    type: input.type,
    date: dateStringToTimestamp(input.date),
    accountType: input.accountType,
    categoryId: input.categoryId || null,
    categoryName: input.categoryName,
    amount: input.amount,
    description: input.description.trim(),
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    updatedAt: serverTimestamp(),
  })
}

export async function softDeleteAccountingTransaction(userId: string, transactionId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.accountingTransactions, transactionId))
  if (!snapshot.exists()) throw new Error('ACCOUNTING_TRANSACTION_NOT_FOUND')

  const transaction = buildTransaction(snapshot.id, snapshot.data())
  if (transaction.userId !== userId || transaction.deletedAt) throw new Error('ACCOUNTING_TRANSACTION_NOT_FOUND')
  if (!['MANUAL', 'OPENING_BALANCE'].includes(transaction.referenceType)) throw new Error('ACCOUNTING_TRANSACTION_LOCKED')

  await updateDoc(doc(firestore, firestoreCollections.accountingTransactions, transactionId), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function createOpeningBalanceTransaction(userId: string, createdById: string, input: {
  date: string
  accountType: AccountingAccountType
  amount: number
  description: string
}) {
  await createAccountingTransaction(userId, createdById, {
    type: 'INCOME',
    date: input.date,
    accountType: input.accountType,
    categoryId: '',
    categoryName: 'Saldo Awal / Modal',
    amount: input.amount,
    description: input.description || `Penambahan saldo ${accountingAccountTypeLabels[input.accountType]}`,
    referenceType: 'OPENING_BALANCE',
  })
}

export async function listAccountingAssets(userId: string) {
  const snapshot = await getDocs(query(collection(firestore, firestoreCollections.accountingAssets), where('userId', '==', userId)))
  return snapshot.docs
    .map((assetDoc) => buildAsset(assetDoc.id, assetDoc.data()))
    .filter((asset) => !asset.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createAccountingAsset(userId: string, input: AccountingAssetInput) {
  if (!input.name.trim()) throw new Error('ACCOUNTING_ASSET_NAME_REQUIRED')
  if (!input.purchasePrice || input.purchasePrice <= 0) throw new Error('ACCOUNTING_AMOUNT_INVALID')
  const depreciationMonths = Math.max(Number(input.depreciationMonths || 12), 1)
  const monthlyDepreciation = Math.round(input.purchasePrice / depreciationMonths)
  const assetRef = await addDoc(collection(firestore, firestoreCollections.accountingAssets), {
    userId,
    name: input.name.trim(),
    purchaseDate: dateStringToTimestamp(input.purchaseDate),
    purchasePrice: input.purchasePrice,
    paymentAccountType: input.paymentAccountType,
    condition: input.condition,
    location: input.location.trim() || null,
    notes: input.notes.trim() || null,
    depreciationMethod: 'STRAIGHT_LINE',
    depreciationMonths,
    monthlyDepreciation,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })

  await addDoc(collection(firestore, firestoreCollections.accountingTransactions), {
    userId,
    type: 'EXPENSE',
    date: dateStringToTimestamp(input.purchaseDate),
    accountType: input.paymentAccountType,
    categoryId: null,
    categoryName: 'Pembelian Aset',
    amount: input.purchasePrice,
    description: `Pembelian aset ${input.name.trim()}`,
    referenceType: 'ASSET_PURCHASE',
    referenceId: assetRef.id,
    createdById: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function updateAccountingAsset(userId: string, assetId: string, input: AccountingAssetInput) {
  const assetSnapshot = await getDoc(doc(firestore, firestoreCollections.accountingAssets, assetId))
  if (!assetSnapshot.exists()) throw new Error('ACCOUNTING_ASSET_NOT_FOUND')

  const asset = buildAsset(assetSnapshot.id, assetSnapshot.data())
  if (asset.userId !== userId || asset.deletedAt) throw new Error('ACCOUNTING_ASSET_NOT_FOUND')
  if (!input.name.trim()) throw new Error('ACCOUNTING_ASSET_NAME_REQUIRED')
  if (!input.purchasePrice || input.purchasePrice <= 0) throw new Error('ACCOUNTING_AMOUNT_INVALID')

  const depreciationMonths = Math.max(Number(input.depreciationMonths || 12), 1)
  const monthlyDepreciation = Math.round(input.purchasePrice / depreciationMonths)

  await updateDoc(doc(firestore, firestoreCollections.accountingAssets, assetId), {
    userId,
    name: input.name.trim(),
    purchaseDate: dateStringToTimestamp(input.purchaseDate),
    purchasePrice: input.purchasePrice,
    paymentAccountType: input.paymentAccountType,
    condition: input.condition,
    location: input.location.trim() || null,
    notes: input.notes.trim() || null,
    depreciationMethod: 'STRAIGHT_LINE',
    depreciationMonths,
    monthlyDepreciation,
    updatedAt: serverTimestamp(),
  })

  const transactionSnapshot = await getDocs(query(
    collection(firestore, firestoreCollections.accountingTransactions),
    where('userId', '==', userId),
    where('referenceId', '==', assetId),
  ))
  const assetPurchaseTransaction = transactionSnapshot.docs
    .map((transactionDoc) => buildTransaction(transactionDoc.id, transactionDoc.data()))
    .find((transaction) => transaction.referenceType === 'ASSET_PURCHASE' && !transaction.deletedAt)

  if (!assetPurchaseTransaction) return

  await updateDoc(doc(firestore, firestoreCollections.accountingTransactions, assetPurchaseTransaction.id), {
    userId,
    type: 'EXPENSE',
    date: dateStringToTimestamp(input.purchaseDate),
    accountType: input.paymentAccountType,
    categoryId: null,
    categoryName: 'Pembelian Aset',
    amount: input.purchasePrice,
    description: `Pembelian aset ${input.name.trim()}`,
    referenceType: 'ASSET_PURCHASE',
    referenceId: assetId,
    updatedAt: serverTimestamp(),
  })
}

export async function listAccountingPayables(userId: string) {
  const snapshot = await getDocs(query(collection(firestore, firestoreCollections.accountingPayables), where('userId', '==', userId)))
  return snapshot.docs
    .map((payableDoc) => buildPayable(payableDoc.id, payableDoc.data()))
    .filter((payable) => !payable.deletedAt)
    .sort((a, b) => toMillis(a.dueDate) - toMillis(b.dueDate))
}

export async function createAccountingPayable(userId: string, input: AccountingPayableInput) {
  if (!input.vendorName.trim()) throw new Error('ACCOUNTING_PAYABLE_VENDOR_REQUIRED')
  if (!input.description.trim()) throw new Error('ACCOUNTING_DESCRIPTION_REQUIRED')
  if (!input.amount || input.amount <= 0) throw new Error('ACCOUNTING_AMOUNT_INVALID')

  await addDoc(collection(firestore, firestoreCollections.accountingPayables), {
    userId,
    vendorName: input.vendorName.trim(),
    description: input.description.trim(),
    dueDate: dateStringToTimestamp(input.dueDate),
    amount: input.amount,
    paidAmount: 0,
    status: 'UNPAID',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function markAccountingPayablePaid(userId: string, payableId: string, accountType: AccountingAccountType, createdById: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.accountingPayables, payableId))
  if (!snapshot.exists()) throw new Error('ACCOUNTING_PAYABLE_NOT_FOUND')

  const payable = buildPayable(snapshot.id, snapshot.data())
  if (payable.userId !== userId || payable.deletedAt) throw new Error('ACCOUNTING_PAYABLE_NOT_FOUND')
  const remainingAmount = Math.max(payable.amount - payable.paidAmount, 0)
  if (remainingAmount <= 0) throw new Error('ACCOUNTING_PAYABLE_ALREADY_PAID')

  await updateDoc(doc(firestore, firestoreCollections.accountingPayables, payableId), {
    userId,
    paidAmount: payable.amount,
    status: 'PAID',
    updatedAt: serverTimestamp(),
  })

  await addDoc(collection(firestore, firestoreCollections.accountingTransactions), {
    userId,
    type: 'EXPENSE',
    date: serverTimestamp(),
    accountType,
    categoryId: null,
    categoryName: 'Pembayaran Hutang',
    amount: remainingAmount,
    description: `Pembayaran hutang ${payable.vendorName} - ${payable.description}`,
    referenceType: 'PAYABLE_PAYMENT',
    referenceId: payableId,
    createdById,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function softDeleteAccountingPayable(userId: string, payableId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.accountingPayables, payableId))
  if (!snapshot.exists()) throw new Error('ACCOUNTING_PAYABLE_NOT_FOUND')

  const payable = buildPayable(snapshot.id, snapshot.data())
  if (payable.userId !== userId || payable.deletedAt) throw new Error('ACCOUNTING_PAYABLE_NOT_FOUND')
  if (payable.paidAmount > 0) throw new Error('ACCOUNTING_PAYABLE_HAS_PAYMENT')

  await updateDoc(doc(firestore, firestoreCollections.accountingPayables, payableId), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function buildAccountingSummary(transactions: AccountingTransactionRecord[], assets: AccountingAssetRecord[]) {
  const operatingTransactions = transactions.filter((transaction) => transaction.referenceType !== 'OPENING_BALANCE')
  const income = operatingTransactions.filter((transaction) => transaction.type === 'INCOME')
  const expenses = operatingTransactions.filter((transaction) => transaction.type === 'EXPENSE' && !['ASSET_PURCHASE', 'PAYABLE_PAYMENT'].includes(transaction.referenceType))
  const monthlyIncome = income.filter((transaction) => isCurrentMonth(transaction.date)).reduce((sum, item) => sum + item.amount, 0)
  const monthlyExpense = expenses.filter((transaction) => isCurrentMonth(transaction.date)).reduce((sum, item) => sum + item.amount, 0)
  const monthlyDepreciation = assets.reduce((sum, asset) => sum + asset.monthlyDepreciation, 0)
  const cashBalance = transactions.reduce((sum, item) => {
    if (item.accountType !== 'CASH') return sum
    return item.type === 'INCOME' ? sum + item.amount : sum - item.amount
  }, 0)
  const bankBalance = transactions.reduce((sum, item) => {
    if (item.accountType !== 'BANK') return sum
    return item.type === 'INCOME' ? sum + item.amount : sum - item.amount
  }, 0)

  const assetValue = assets.reduce((sum, asset) => {
    const purchaseDate = toInputDate(asset.purchaseDate)
    if (!purchaseDate) return sum + asset.purchasePrice
    const startDate = new Date(`${purchaseDate}T00:00:00`)
    const now = new Date()
    const elapsedMonths = Math.max((now.getFullYear() - startDate.getFullYear()) * 12 + now.getMonth() - startDate.getMonth() + 1, 0)
    const usedMonths = Math.min(elapsedMonths, asset.depreciationMonths)
    return sum + Math.max(asset.purchasePrice - usedMonths * asset.monthlyDepreciation, 0)
  }, 0)

  return {
    cashBalance,
    bankBalance,
    monthlyIncome,
    monthlyExpense: monthlyExpense + monthlyDepreciation,
    monthlyDepreciation,
    netProfit: monthlyIncome - monthlyExpense - monthlyDepreciation,
    receivable: 0,
    payable: 0,
    assetValue,
  }
}
