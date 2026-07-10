import { addDoc, collection, doc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { dateStringToTimestamp, toInputDate } from '../../lib/formatters/date'
import { firestore } from '../../lib/firebase/client'
import type {
  AccountingAccountType,
  AccountingAssetCondition,
  AccountingAssetRecord,
  AccountingCategoryRecord,
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
  condition: AccountingAssetCondition
  location: string
  notes: string
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
      data.referenceType === 'INVOICE_PAYMENT' || data.referenceType === 'ASSET_PURCHASE' || data.referenceType === 'OPENING_BALANCE'
        ? data.referenceType
        : 'MANUAL',
    referenceId: typeof data.referenceId === 'string' ? data.referenceId : null,
    createdById: String(data.createdById ?? ''),
    createdAt: (data.createdAt as AccountingTransactionRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as AccountingTransactionRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as AccountingTransactionRecord['deletedAt']) ?? null,
  }
}

function buildAsset(id: string, data: Record<string, unknown>): AccountingAssetRecord {
  const condition = ['PERLU_PERAWATAN', 'RUSAK', 'DIJUAL'].includes(String(data.condition)) ? data.condition as AccountingAssetCondition : 'BAIK'
  return {
    id,
    userId: String(data.userId ?? ''),
    name: String(data.name ?? ''),
    purchaseDate: (data.purchaseDate as AccountingAssetRecord['purchaseDate']) ?? null,
    purchasePrice: Number(data.purchasePrice ?? 0),
    condition,
    location: typeof data.location === 'string' ? data.location : null,
    notes: typeof data.notes === 'string' ? data.notes : null,
    depreciationMethod: typeof data.depreciationMethod === 'string' ? data.depreciationMethod : null,
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
  await addDoc(collection(firestore, firestoreCollections.accountingAssets), {
    userId,
    name: input.name.trim(),
    purchaseDate: dateStringToTimestamp(input.purchaseDate),
    purchasePrice: input.purchasePrice,
    condition: input.condition,
    location: input.location.trim() || null,
    notes: input.notes.trim() || null,
    depreciationMethod: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
}

export function buildAccountingSummary(transactions: AccountingTransactionRecord[], assets: AccountingAssetRecord[]) {
  const operatingTransactions = transactions.filter((transaction) => transaction.referenceType !== 'OPENING_BALANCE')
  const income = operatingTransactions.filter((transaction) => transaction.type === 'INCOME')
  const expenses = operatingTransactions.filter((transaction) => transaction.type === 'EXPENSE')
  const monthlyIncome = income.filter((transaction) => isCurrentMonth(transaction.date)).reduce((sum, item) => sum + item.amount, 0)
  const monthlyExpense = expenses.filter((transaction) => isCurrentMonth(transaction.date)).reduce((sum, item) => sum + item.amount, 0)
  const cashBalance = transactions.reduce((sum, item) => {
    if (item.accountType !== 'CASH') return sum
    return item.type === 'INCOME' ? sum + item.amount : sum - item.amount
  }, 0)
  const bankBalance = transactions.reduce((sum, item) => {
    if (item.accountType !== 'BANK') return sum
    return item.type === 'INCOME' ? sum + item.amount : sum - item.amount
  }, 0)

  return {
    cashBalance,
    bankBalance,
    monthlyIncome,
    monthlyExpense,
    netProfit: monthlyIncome - monthlyExpense,
    receivable: 0,
    payable: 0,
    assetValue: assets.reduce((sum, asset) => sum + asset.purchasePrice, 0),
  }
}
