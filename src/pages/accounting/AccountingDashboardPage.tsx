import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, Download, Edit3, Loader2, Plus, Trash2, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate, toInputDate } from '../../lib/formatters/date'
import {
  accountingAccountTypeLabels,
  accountingPayableStatusLabels,
  accountingTransactionTypeLabels,
  assetConditionLabels,
  buildAccountingSummary,
  createAccountingAsset,
  createAccountingCategory,
  createAccountingPayable,
  createAccountingTransaction,
  createOpeningBalanceTransaction,
  listAccountingAssets,
  listAccountingPayables,
  listAccountingTransactions,
  markAccountingPayablePaid,
  seedAccountingCategories,
  softDeleteAccountingPayable,
  softDeleteAccountingTransaction,
  updateAccountingCategory,
  updateAccountingTransaction,
} from '../../services/firestore/accounting'
import { listInvoices } from '../../services/firestore/invoices'
import { listAllPayments } from '../../services/firestore/payments'
import type {
  AccountingAccountType,
  AccountingAssetCondition,
  AccountingAssetRecord,
  AccountingCategoryRecord,
  AccountingPayableRecord,
  AccountingTransactionRecord,
  AccountingTransactionType,
  InvoiceRecord,
  PaymentMethod,
  PaymentRecord,
} from '../../types/domain'

type AccountingTab =
  | 'dashboard'
  | 'cash-bank'
  | 'income'
  | 'expense'
  | 'assets'
  | 'payable'
  | 'receivable'
  | 'journal'
  | 'ledger'
  | 'trial-balance'
  | 'profit-loss'
  | 'balance-sheet'
  | 'cash-flow'
  | 'equity'
  | 'tax'
  | 'reports'

const tabs: Array<{ id: AccountingTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'cash-bank', label: 'Kas & Bank' },
  { id: 'income', label: 'Pemasukan' },
  { id: 'expense', label: 'Pengeluaran' },
  { id: 'assets', label: 'Aset' },
  { id: 'payable', label: 'Hutang' },
  { id: 'receivable', label: 'Piutang' },
  { id: 'journal', label: 'Jurnal Umum' },
  { id: 'ledger', label: 'Buku Besar' },
  { id: 'trial-balance', label: 'Neraca Saldo' },
  { id: 'profit-loss', label: 'Laba Rugi' },
  { id: 'balance-sheet', label: 'Neraca' },
  { id: 'cash-flow', label: 'Arus Kas' },
  { id: 'equity', label: 'Ekuitas / Modal' },
  { id: 'tax', label: 'Pajak' },
  { id: 'reports', label: 'Laporan' },
]

const today = new Date().toISOString().slice(0, 10)

const paymentMethodAccountMap: Record<PaymentMethod, AccountingAccountType> = {
  TRANSFER_BANK: 'BANK',
  QRIS: 'BANK',
  CASH: 'CASH',
  OTHER: 'BANK',
}

type JournalLine = {
  id: string
  date: string
  account: string
  description: string
  debit: number
  credit: number
  source: string
}

type LedgerRow = {
  account: string
  debit: number
  credit: number
  balance: number
}

function getAccountName(accountType: AccountingAccountType) {
  return accountType === 'CASH' ? 'Kas' : 'Bank'
}

function buildJournalLines(transactions: AccountingTransactionRecord[], assets: AccountingAssetRecord[]): JournalLine[] {
  const transactionLines = transactions.flatMap((transaction) => {
    const date = toInputDate(transaction.date) || today
    const source = transaction.referenceType === 'INVOICE_PAYMENT'
      ? 'Invoice'
      : transaction.referenceType === 'ASSET_PURCHASE'
        ? 'Aset'
        : transaction.referenceType === 'OPENING_BALANCE'
          ? 'Modal'
          : transaction.referenceType === 'PAYABLE_PAYMENT'
            ? 'Hutang'
            : 'Manual'

    if (transaction.type === 'INCOME') {
      return [
        {
          id: `${transaction.id}-debit`,
          date,
          account: getAccountName(transaction.accountType),
          description: transaction.description,
          debit: transaction.amount,
          credit: 0,
          source,
        },
        {
          id: `${transaction.id}-credit`,
          date,
          account: transaction.referenceType === 'OPENING_BALANCE' ? 'Modal Owner' : 'Pendapatan',
          description: transaction.categoryName,
          debit: 0,
          credit: transaction.amount,
          source,
        },
      ]
    }

    return [
      {
        id: `${transaction.id}-debit`,
        date,
        account: transaction.referenceType === 'ASSET_PURCHASE' ? 'Aset Tetap' : transaction.referenceType === 'PAYABLE_PAYMENT' ? 'Hutang Usaha' : `Beban - ${transaction.categoryName}`,
        description: transaction.description,
        debit: transaction.amount,
        credit: 0,
        source,
      },
      {
        id: `${transaction.id}-credit`,
        date,
        account: getAccountName(transaction.accountType),
        description: transaction.categoryName,
        debit: 0,
        credit: transaction.amount,
        source,
      },
    ]
  })

  const depreciationLines = assets.flatMap((asset) => {
    if (!asset.monthlyDepreciation) return []
    const date = today
    return [
      {
        id: `${asset.id}-depreciation-debit`,
        date,
        account: 'Beban - Penyusutan',
        description: `Penyusutan bulanan ${asset.name}`,
        debit: asset.monthlyDepreciation,
        credit: 0,
        source: 'Penyusutan',
      },
      {
        id: `${asset.id}-depreciation-credit`,
        date,
        account: 'Akumulasi Penyusutan',
        description: asset.name,
        debit: 0,
        credit: asset.monthlyDepreciation,
        source: 'Penyusutan',
      },
    ]
  })

  return [...transactionLines, ...depreciationLines].sort((a, b) => b.date.localeCompare(a.date))
}

function buildLedgerRows(journalLines: JournalLine[]): LedgerRow[] {
  const accounts = new Map<string, LedgerRow>()
  journalLines.forEach((line) => {
    const current = accounts.get(line.account) ?? { account: line.account, debit: 0, credit: 0, balance: 0 }
    current.debit += line.debit
    current.credit += line.credit
    current.balance = current.debit - current.credit
    accounts.set(line.account, current)
  })
  return Array.from(accounts.values()).sort((a, b) => a.account.localeCompare(b.account))
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? { Data: '' })
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function AccountingDashboardPage() {
  const { profile } = useAuth()
  const ownerUserId = profile?.role === 'user' ? profile.uid : profile?.vendorId ?? ''
  const [activeTab, setActiveTab] = useState<AccountingTab>('dashboard')
  const [categories, setCategories] = useState<AccountingCategoryRecord[]>([])
  const [transactions, setTransactions] = useState<AccountingTransactionRecord[]>([])
  const [invoicePayments, setInvoicePayments] = useState<PaymentRecord[]>([])
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [assets, setAssets] = useState<AccountingAssetRecord[]>([])
  const [payables, setPayables] = useState<AccountingPayableRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingTransactionId, setEditingTransactionId] = useState('')
  const [isDeletingTransaction, setIsDeletingTransaction] = useState('')
  const [isUpdatingPayable, setIsUpdatingPayable] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [categoryInput, setCategoryInput] = useState({ type: 'INCOME' as AccountingTransactionType, name: '' })
  const [transactionInput, setTransactionInput] = useState({
    type: 'INCOME' as AccountingTransactionType,
    date: today,
    accountType: 'BANK' as AccountingAccountType,
    categoryId: '',
    amount: '',
    description: '',
  })
  const [balanceInput, setBalanceInput] = useState({
    date: today,
    accountType: 'BANK' as AccountingAccountType,
    amount: '',
    description: 'Saldo awal',
  })
  const [assetInput, setAssetInput] = useState({
    name: '',
    purchaseDate: today,
    purchasePrice: '',
    paymentAccountType: 'BANK' as AccountingAccountType,
    condition: 'BAIK' as AccountingAssetCondition,
    depreciationMonths: '24',
    location: '',
    notes: '',
  })
  const [payableInput, setPayableInput] = useState({
    vendorName: '',
    description: '',
    dueDate: today,
    amount: '',
  })

  const loadAccounting = useCallback(async () => {
    if (!ownerUserId) return
    setIsLoading(true)
    setErrorMessage('')

    try {
      const loadedCategories = await seedAccountingCategories(ownerUserId)
      const [loadedTransactions, loadedAssets, loadedPayments, loadedInvoices, loadedPayables] = await Promise.all([
        listAccountingTransactions(ownerUserId),
        listAccountingAssets(ownerUserId),
        listAllPayments(ownerUserId),
        listInvoices(ownerUserId),
        listAccountingPayables(ownerUserId),
      ])
      setCategories(loadedCategories)
      setTransactions(loadedTransactions)
      setAssets(loadedAssets)
      setInvoicePayments(loadedPayments)
      setInvoices(loadedInvoices)
      setPayables(loadedPayables)
    } catch (error) {
      console.error('Failed to load accounting module', error)
      setErrorMessage('Modul accounting belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [ownerUserId])

  useEffect(() => {
    void loadAccounting()
  }, [loadAccounting])

  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices])
  const autoPaymentTransactions = useMemo<AccountingTransactionRecord[]>(() => {
    const transactionsFromPayments = invoicePayments.map((payment) => {
      const invoice = invoiceById.get(payment.invoiceId)
      return {
        id: `payment-${payment.id}`,
        userId: payment.userId,
        type: 'INCOME' as const,
        date: payment.paymentDate,
        accountType: paymentMethodAccountMap[payment.paymentMethod],
        categoryId: null,
        categoryName: 'Pelunasan Invoice',
        amount: payment.amount,
        description: `Pembayaran invoice ${invoice?.invoiceNumber ?? ''}${invoice?.clientName ? ` - ${invoice.clientName}` : ''}`.trim(),
        referenceType: 'INVOICE_PAYMENT' as const,
        referenceId: payment.id,
        createdById: payment.userId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        deletedAt: null,
      }
    })
    const invoiceIdsWithPaymentRecords = new Set(invoicePayments.map((payment) => payment.invoiceId))
    const fallbackTransactions = invoices
      .filter((invoice) => !invoiceIdsWithPaymentRecords.has(invoice.id) && invoice.totalPaid > 0)
      .flatMap((invoice) => {
        if (invoice.payments.length > 0) {
          return invoice.payments.map((payment) => ({
            id: `invoice-payment-${invoice.id}-${payment.id}`,
            userId: invoice.userId,
            type: 'INCOME' as const,
            date: payment.paymentDate || invoice.invoiceDate,
            accountType: paymentMethodAccountMap[payment.method],
            categoryId: null,
            categoryName: 'Pelunasan Invoice',
            amount: payment.amount,
            description: `Pembayaran invoice ${invoice.invoiceNumber} - ${invoice.clientName}`,
            referenceType: 'INVOICE_PAYMENT' as const,
            referenceId: payment.id,
            createdById: invoice.userId,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
            deletedAt: null,
          }))
        }

        return [{
          id: `invoice-total-paid-${invoice.id}`,
          userId: invoice.userId,
          type: 'INCOME' as const,
          date: invoice.invoiceDate,
          accountType: invoice.paymentMethod ? paymentMethodAccountMap[invoice.paymentMethod] : 'BANK',
          categoryId: null,
          categoryName: 'Pelunasan Invoice',
          amount: invoice.totalPaid,
          description: `Pembayaran invoice ${invoice.invoiceNumber} - ${invoice.clientName}`,
          referenceType: 'INVOICE_PAYMENT' as const,
          referenceId: invoice.id,
          createdById: invoice.userId,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
          deletedAt: null,
        }]
      })

    return [...transactionsFromPayments, ...fallbackTransactions]
  }, [invoiceById, invoicePayments, invoices])
  const allTransactions = useMemo(() => [...autoPaymentTransactions, ...transactions].sort((a, b) => {
    const aDate = toInputDate(a.date)
    const bDate = toInputDate(b.date)
    return bDate.localeCompare(aDate)
  }), [autoPaymentTransactions, transactions])
  const receivables = useMemo(() => invoices
    .filter((invoice) => !invoice.deletedAt && invoice.remainingAmount > 0)
    .sort((a, b) => (toInputDate(a.eventDate) || '').localeCompare(toInputDate(b.eventDate) || '')), [invoices])
  const receivableTotal = useMemo(() => receivables.reduce((sum, invoice) => sum + invoice.remainingAmount, 0), [receivables])
  const payableTotal = useMemo(() => payables.reduce((sum, payable) => sum + Math.max(payable.amount - payable.paidAmount, 0), 0), [payables])
  const summary = useMemo(() => {
    const baseSummary = buildAccountingSummary(allTransactions, assets)
    return {
      ...baseSummary,
      receivable: receivableTotal,
      payable: payableTotal,
    }
  }, [allTransactions, assets, payableTotal, receivableTotal])
  const journalLines = useMemo(() => buildJournalLines(allTransactions, assets), [allTransactions, assets])
  const ledgerRows = useMemo(() => buildLedgerRows(journalLines), [journalLines])
  const cashFlowTotals = useMemo(() => allTransactions.reduce((total, transaction) => {
    if (transaction.type === 'INCOME') return { ...total, inflow: total.inflow + transaction.amount, net: total.net + transaction.amount }
    return { ...total, outflow: total.outflow + transaction.amount, net: total.net - transaction.amount }
  }, { inflow: 0, outflow: 0, net: 0 }), [allTransactions])
  const totalOpeningCapital = useMemo(() => allTransactions
    .filter((transaction) => transaction.referenceType === 'OPENING_BALANCE')
    .reduce((sum, transaction) => sum + transaction.amount, 0), [allTransactions])
  const totalPrive = useMemo(() => allTransactions
    .filter((transaction) => transaction.type === 'EXPENSE' && transaction.categoryName.toLowerCase().includes('prive'))
    .reduce((sum, transaction) => sum + transaction.amount, 0), [allTransactions])
  const currentEquity = totalOpeningCapital + summary.netProfit - totalPrive
  const filteredTransactions = allTransactions.filter((transaction) => {
    if (activeTab === 'income') return transaction.type === 'INCOME' && transaction.referenceType !== 'OPENING_BALANCE'
    if (activeTab === 'expense') return transaction.type === 'EXPENSE'
    if (activeTab === 'cash-bank') return true
    return true
  })
  const selectedCategories = categories.filter((category) => category.type === transactionInput.type)
  const cashFlowData = useMemo(() => {
    const months = new Map<string, { month: string; income: number; expense: number }>()
    allTransactions.forEach((transaction) => {
      const date = toInputDate(transaction.date)
      const key = date ? date.slice(0, 7) : 'Tanpa Tanggal'
      const item = months.get(key) ?? { month: key, income: 0, expense: 0 }
      if (transaction.type === 'INCOME') item.income += transaction.amount
      else item.expense += transaction.amount
      months.set(key, item)
    })
    return Array.from(months.values()).slice(0, 12).reverse()
  }, [allTransactions])

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerUserId) return
    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      await createAccountingCategory(ownerUserId, categoryInput.type, categoryInput.name)
      setCategoryInput((current) => ({ ...current, name: '' }))
      await loadAccounting()
      setMessage('Kategori accounting berhasil ditambahkan.')
    } catch (error) {
      console.error('Failed to create accounting category', error)
      setErrorMessage('Kategori belum bisa disimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerUserId || !profile) return
    const category = categories.find((item) => item.id === transactionInput.categoryId)
    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      const payload = {
        type: transactionInput.type,
        date: transactionInput.date,
        accountType: transactionInput.accountType,
        categoryId: category?.id ?? '',
        categoryName: category?.name ?? transactionInput.type,
        amount: Number(transactionInput.amount),
        description: transactionInput.description,
      }
      if (editingTransactionId) {
        await updateAccountingTransaction(ownerUserId, editingTransactionId, payload)
      } else {
        await createAccountingTransaction(ownerUserId, profile.uid, payload)
      }
      setTransactionInput((current) => ({ ...current, amount: '', description: '' }))
      setEditingTransactionId('')
      await loadAccounting()
      setMessage(editingTransactionId ? 'Transaksi harian berhasil diperbarui.' : 'Transaksi accounting berhasil ditambahkan.')
    } catch (error) {
      console.error('Failed to create accounting transaction', error)
      setErrorMessage('Transaksi belum bisa disimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateOpeningBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerUserId || !profile) return
    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      await createOpeningBalanceTransaction(ownerUserId, profile.uid, {
        date: balanceInput.date,
        accountType: balanceInput.accountType,
        amount: Number(balanceInput.amount),
        description: balanceInput.description,
      })
      setBalanceInput((current) => ({ ...current, amount: '', description: 'Saldo awal' }))
      await loadAccounting()
      setMessage(`Saldo ${accountingAccountTypeLabels[balanceInput.accountType]} berhasil ditambahkan.`)
    } catch (error) {
      console.error('Failed to add opening balance', error)
      setErrorMessage('Saldo manual belum bisa ditambahkan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerUserId) return
    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      await createAccountingAsset(ownerUserId, {
        name: assetInput.name,
        purchaseDate: assetInput.purchaseDate,
        purchasePrice: Number(assetInput.purchasePrice),
        paymentAccountType: assetInput.paymentAccountType,
        condition: assetInput.condition,
        depreciationMonths: Number(assetInput.depreciationMonths),
        location: assetInput.location,
        notes: assetInput.notes,
      })
      setAssetInput((current) => ({ ...current, name: '', purchasePrice: '', location: '', notes: '' }))
      await loadAccounting()
      setMessage('Aset berhasil ditambahkan.')
    } catch (error) {
      console.error('Failed to create accounting asset', error)
      setErrorMessage('Aset belum bisa disimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreatePayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerUserId) return
    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      await createAccountingPayable(ownerUserId, {
        vendorName: payableInput.vendorName,
        description: payableInput.description,
        dueDate: payableInput.dueDate,
        amount: Number(payableInput.amount),
      })
      setPayableInput({ vendorName: '', description: '', dueDate: today, amount: '' })
      await loadAccounting()
      setMessage('Hutang berhasil dicatat.')
    } catch (error) {
      console.error('Failed to create accounting payable', error)
      setErrorMessage('Hutang belum bisa disimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePayPayable(payable: AccountingPayableRecord, accountType: AccountingAccountType) {
    if (!ownerUserId || !profile) return
    const confirmed = window.confirm(`Tandai hutang ${payable.vendorName} lunas dan catat pembayaran dari ${accountingAccountTypeLabels[accountType]}?`)
    if (!confirmed) return

    setIsUpdatingPayable(payable.id)
    setMessage('')
    setErrorMessage('')
    try {
      await markAccountingPayablePaid(ownerUserId, payable.id, accountType, profile.uid)
      await loadAccounting()
      setMessage('Hutang berhasil dibayar dan mutasi kas/bank sudah tercatat.')
    } catch (error) {
      console.error('Failed to pay accounting payable', error)
      setErrorMessage('Pembayaran hutang belum bisa diproses.')
    } finally {
      setIsUpdatingPayable('')
    }
  }

  async function handleDeletePayable(payable: AccountingPayableRecord) {
    if (!ownerUserId) return
    const confirmed = window.confirm('Hapus catatan hutang ini? Hutang yang sudah dibayar tidak bisa dihapus dari sini.')
    if (!confirmed) return

    setIsUpdatingPayable(payable.id)
    setMessage('')
    setErrorMessage('')
    try {
      await softDeleteAccountingPayable(ownerUserId, payable.id)
      await loadAccounting()
      setMessage('Catatan hutang berhasil dihapus.')
    } catch (error) {
      console.error('Failed to delete accounting payable', error)
      setErrorMessage('Hutang belum bisa dihapus. Jika sudah pernah dibayar, biarkan sebagai riwayat.')
    } finally {
      setIsUpdatingPayable('')
    }
  }

  async function handleRenameCategory(category: AccountingCategoryRecord) {
    if (!ownerUserId) return
    const nextName = window.prompt('Ubah nama kategori', category.name)
    if (!nextName || nextName.trim() === category.name) return

    setMessage('')
    setErrorMessage('')
    try {
      await updateAccountingCategory(ownerUserId, category.id, nextName)
      await loadAccounting()
      setMessage('Kategori berhasil diperbarui.')
    } catch (error) {
      console.error('Failed to update accounting category', error)
      setErrorMessage('Kategori belum bisa diperbarui.')
    }
  }

  function handleEditTransaction(transaction: AccountingTransactionRecord) {
    setEditingTransactionId(transaction.id)
    setTransactionInput({
      type: transaction.type,
      date: toInputDate(transaction.date) || today,
      accountType: transaction.accountType,
      categoryId: transaction.categoryId ?? '',
      amount: String(transaction.amount),
      description: transaction.description,
    })
    setActiveTab(transaction.type === 'EXPENSE' ? 'expense' : 'income')
    setMessage('Mode edit transaksi aktif. Ubah data lalu klik Simpan Perubahan.')
    setErrorMessage('')
  }

  function cancelEditTransaction() {
    setEditingTransactionId('')
    setTransactionInput({
      type: 'INCOME',
      date: today,
      accountType: 'BANK',
      categoryId: '',
      amount: '',
      description: '',
    })
  }

  async function handleDeleteTransaction(transaction: AccountingTransactionRecord) {
    if (!ownerUserId) return
    const confirmed = window.confirm('Hapus transaksi harian ini? Saldo kas/bank dan laporan accounting akan ikut berubah.')
    if (!confirmed) return

    setIsDeletingTransaction(transaction.id)
    setMessage('')
    setErrorMessage('')

    try {
      await softDeleteAccountingTransaction(ownerUserId, transaction.id)
      if (editingTransactionId === transaction.id) cancelEditTransaction()
      await loadAccounting()
      setMessage('Transaksi harian berhasil dihapus.')
    } catch (error) {
      console.error('Failed to delete accounting transaction', error)
      setErrorMessage('Transaksi harian belum bisa dihapus.')
    } finally {
      setIsDeletingTransaction('')
    }
  }

  function exportTransactions() {
    downloadCsv('laporan-accounting-transaksi', allTransactions.map((transaction) => ({
      Tanggal: formatDisplayDate(transaction.date),
      Jenis: accountingTransactionTypeLabels[transaction.type],
      Akun: accountingAccountTypeLabels[transaction.accountType],
      Kategori: transaction.categoryName,
      Nominal: transaction.amount,
      Keterangan: transaction.description,
      Sumber: transaction.referenceType === 'INVOICE_PAYMENT' ? 'Otomatis Invoice' : transaction.referenceType === 'OPENING_BALANCE' ? 'Saldo Manual' : transaction.referenceType === 'PAYABLE_PAYMENT' ? 'Pembayaran Hutang' : 'Manual',
    })))
  }

  function exportJournal() {
    downloadCsv('laporan-accounting-jurnal-umum', journalLines.map((line) => ({
      Tanggal: line.date,
      Akun: line.account,
      Keterangan: line.description,
      Debit: line.debit,
      Kredit: line.credit,
      Sumber: line.source,
    })))
  }

  function exportAssets() {
    downloadCsv('laporan-accounting-aset', assets.map((asset) => ({
      Aset: asset.name,
      Tanggal: formatDisplayDate(asset.purchaseDate),
      Harga: asset.purchasePrice,
      DibayarDari: accountingAccountTypeLabels[asset.paymentAccountType],
      MasaManfaatBulan: asset.depreciationMonths,
      PenyusutanBulanan: asset.monthlyDepreciation,
      Kondisi: assetConditionLabels[asset.condition],
      Lokasi: asset.location ?? '',
      Catatan: asset.notes ?? '',
    })))
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Accounting"
        description="Modul keuangan terpisah untuk kas, bank, transaksi, aset, dan laporan."
        actions={profile?.role === 'user' ? (
          <Link to="/dashboard">
            <Button icon={<ArrowLeft size={16} />} type="button" variant="secondary">
              Back to Operasional
            </Button>
          </Link>
        ) : null}
      />

      {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <div className="flex gap-2 overflow-x-auto rounded-md border border-app-border bg-white p-2">
        {tabs.map((tab) => (
          <button
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? 'bg-app-gold-soft text-app-text' : 'text-neutral-500 hover:bg-app-muted'}`}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card><CardContent className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="animate-spin" size={16} /> Memuat accounting...</CardContent></Card>
      ) : (
        <>
          {activeTab === 'dashboard' ? (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Saldo Kas', summary.cashBalance],
                  ['Saldo Bank', summary.bankBalance],
                  ['Pendapatan Bulan Ini', summary.monthlyIncome],
                  ['Pengeluaran Bulan Ini', summary.monthlyExpense],
                  ['Laba Bersih', summary.netProfit],
                  ['Penyusutan Bulan Ini', summary.monthlyDepreciation],
                  ['Piutang', summary.receivable],
                  ['Hutang', summary.payable],
                  ['Nilai Aset', summary.assetValue],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <CardContent>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
                      <p className="mt-2 text-xl font-black">{formatCurrency(Number(value))}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader><h2 className="flex items-center gap-2 text-base font-semibold"><BarChart3 size={18} /> Grafik Cash Flow</h2></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="income" fill="#16a34a" name="Pemasukan" />
                      <Bar dataKey="expense" fill="#dc2626" name="Pengeluaran" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {['cash-bank', 'income', 'expense'].includes(activeTab) ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              {activeTab === 'cash-bank' ? (
                <Card>
                  <CardHeader><h2 className="text-base font-semibold">Tambah Saldo Kas/Bank</h2></CardHeader>
                  <CardContent>
                    <form className="grid gap-4" onSubmit={handleCreateOpeningBalance}>
                      <Input label="Tanggal" type="date" value={balanceInput.date} onChange={(event) => setBalanceInput((current) => ({ ...current, date: event.target.value }))} />
                      <label className="grid gap-2 text-sm font-medium">
                        Simpan ke
                        <select className="min-h-12 rounded-md border border-app-border px-3" value={balanceInput.accountType} onChange={(event) => setBalanceInput((current) => ({ ...current, accountType: event.target.value as AccountingAccountType }))}>
                          <option value="CASH">Kas</option>
                          <option value="BANK">Bank</option>
                        </select>
                      </label>
                      <Input label="Nominal" min="0" type="number" value={balanceInput.amount} onChange={(event) => setBalanceInput((current) => ({ ...current, amount: event.target.value }))} />
                      <Input label="Keterangan" value={balanceInput.description} onChange={(event) => setBalanceInput((current) => ({ ...current, description: event.target.value }))} />
                      <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>Tambah Saldo</Button>
                    </form>
                    <div className="mt-5 grid gap-3">
                      <div className="rounded-md bg-app-muted p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Saldo Kas</p>
                        <p className="mt-1 text-lg font-black">{formatCurrency(summary.cashBalance)}</p>
                      </div>
                      <div className="rounded-md bg-app-muted p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Saldo Bank</p>
                        <p className="mt-1 text-lg font-black">{formatCurrency(summary.bankBalance)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {['income', 'expense'].includes(activeTab) ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold">{editingTransactionId ? 'Edit Transaksi Harian' : 'Tambah Transaksi'}</h2>
                      {editingTransactionId ? (
                        <Button className="min-h-9 px-3 py-1.5" icon={<X size={15} />} onClick={cancelEditTransaction} type="button" variant="secondary">
                          Batal
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-4" onSubmit={handleCreateTransaction}>
                      <label className="grid gap-2 text-sm font-medium">
                        Jenis
                        <select className="min-h-12 rounded-md border border-app-border px-3" value={transactionInput.type} onChange={(event) => setTransactionInput((current) => ({ ...current, type: event.target.value as AccountingTransactionType, categoryId: '' }))}>
                          <option value="INCOME">Pemasukan</option>
                          <option value="EXPENSE">Pengeluaran</option>
                        </select>
                      </label>
                      <Input label="Tanggal" type="date" value={transactionInput.date} onChange={(event) => setTransactionInput((current) => ({ ...current, date: event.target.value }))} />
                      <label className="grid gap-2 text-sm font-medium">
                        Akun
                        <select className="min-h-12 rounded-md border border-app-border px-3" value={transactionInput.accountType} onChange={(event) => setTransactionInput((current) => ({ ...current, accountType: event.target.value as AccountingAccountType }))}>
                          <option value="CASH">Kas</option>
                          <option value="BANK">Bank</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Kategori
                        <select className="min-h-12 rounded-md border border-app-border px-3" value={transactionInput.categoryId} onChange={(event) => setTransactionInput((current) => ({ ...current, categoryId: event.target.value }))}>
                          <option value="">Pilih kategori</option>
                          {selectedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                      </label>
                      <Input label="Nominal" min="0" type="number" value={transactionInput.amount} onChange={(event) => setTransactionInput((current) => ({ ...current, amount: event.target.value }))} />
                      <Input label="Keterangan" value={transactionInput.description} onChange={(event) => setTransactionInput((current) => ({ ...current, description: event.target.value }))} />
                      <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>
                        {editingTransactionId ? 'Simpan Perubahan' : 'Tambah Transaksi'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              <Card className={['cash-bank', 'income', 'expense'].includes(activeTab) ? '' : 'xl:col-span-2'}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold">{activeTab === 'cash-bank' ? 'Mutasi Kas & Bank' : 'Transaksi Accounting'}</h2>
                    <div className="flex gap-2">
                      <Button icon={<Download size={16} />} onClick={exportTransactions} type="button" variant="secondary">Excel/CSV</Button>
                      <Button icon={<Download size={16} />} onClick={() => window.print()} type="button" variant="secondary">PDF</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {filteredTransactions.length === 0 ? <p className="text-sm text-neutral-500">Belum ada transaksi.</p> : filteredTransactions.map((transaction) => {
                    const canEditTransaction = ['MANUAL', 'OPENING_BALANCE'].includes(transaction.referenceType)
                    return (
                    <div className="rounded-md border border-app-border p-3" key={transaction.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{transaction.description}</p>
                          <p className="text-sm text-neutral-500">{formatDisplayDate(transaction.date)} - {transaction.categoryName} - {accountingAccountTypeLabels[transaction.accountType]}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {transaction.referenceType === 'INVOICE_PAYMENT' ? 'Otomatis dari pembayaran invoice' : transaction.referenceType === 'OPENING_BALANCE' ? 'Saldo manual kas/bank' : 'Transaksi manual'}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:justify-items-end">
                          <p className={`font-bold ${transaction.type === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>{transaction.type === 'INCOME' ? '+' : '-'} {formatCurrency(transaction.amount)}</p>
                          {canEditTransaction ? (
                            <div className="flex flex-wrap gap-2">
                              <Button className="min-h-9 px-3 py-1.5" icon={<Edit3 size={15} />} onClick={() => handleEditTransaction(transaction)} type="button" variant="secondary">
                                Edit
                              </Button>
                              <Button
                                className="min-h-9 px-3 py-1.5"
                                disabled={Boolean(isDeletingTransaction)}
                                icon={isDeletingTransaction === transaction.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                                onClick={() => void handleDeleteTransaction(transaction)}
                                type="button"
                                variant="danger"
                              >
                                Hapus
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === 'assets' ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              <Card>
                <CardHeader><h2 className="text-base font-semibold">Tambah Aset</h2></CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={handleCreateAsset}>
                    <Input label="Nama Aset" value={assetInput.name} onChange={(event) => setAssetInput((current) => ({ ...current, name: event.target.value }))} />
                    <Input label="Tanggal Pembelian" type="date" value={assetInput.purchaseDate} onChange={(event) => setAssetInput((current) => ({ ...current, purchaseDate: event.target.value }))} />
                    <Input label="Harga" min="0" type="number" value={assetInput.purchasePrice} onChange={(event) => setAssetInput((current) => ({ ...current, purchasePrice: event.target.value }))} />
                    <label className="grid gap-2 text-sm font-medium">
                      Dibayar Dari
                      <select className="min-h-12 rounded-md border border-app-border px-3" value={assetInput.paymentAccountType} onChange={(event) => setAssetInput((current) => ({ ...current, paymentAccountType: event.target.value as AccountingAccountType }))}>
                        <option value="CASH">Kas</option>
                        <option value="BANK">Bank</option>
                      </select>
                    </label>
                    <Input
                      hint={assetInput.purchasePrice ? `Estimasi beban per bulan: ${formatCurrency(Math.round(Number(assetInput.purchasePrice || 0) / Math.max(Number(assetInput.depreciationMonths || 1), 1)))}` : 'Contoh: 12 bulan, 24 bulan, atau 36 bulan.'}
                      label="Masa Manfaat / Penyusutan (bulan)"
                      min="1"
                      type="number"
                      value={assetInput.depreciationMonths}
                      onChange={(event) => setAssetInput((current) => ({ ...current, depreciationMonths: event.target.value }))}
                    />
                    <label className="grid gap-2 text-sm font-medium">
                      Kondisi
                      <select className="min-h-12 rounded-md border border-app-border px-3" value={assetInput.condition} onChange={(event) => setAssetInput((current) => ({ ...current, condition: event.target.value as AccountingAssetCondition }))}>
                        {Object.entries(assetConditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <Input label="Lokasi" value={assetInput.location} onChange={(event) => setAssetInput((current) => ({ ...current, location: event.target.value }))} />
                    <Input label="Catatan" value={assetInput.notes} onChange={(event) => setAssetInput((current) => ({ ...current, notes: event.target.value }))} />
                    <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>Tambah Aset</Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold">Daftar Aset</h2>
                    <Button icon={<Download size={16} />} onClick={exportAssets} type="button" variant="secondary">Excel/CSV</Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {assets.length === 0 ? <p className="text-sm text-neutral-500">Belum ada aset.</p> : assets.map((asset) => (
                    <div className="rounded-md border border-app-border p-3" key={asset.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{asset.name}</p>
                          <p className="text-sm text-neutral-500">{formatDisplayDate(asset.purchaseDate)} - {assetConditionLabels[asset.condition]}{asset.location ? ` - ${asset.location}` : ''}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            Dibayar dari {accountingAccountTypeLabels[asset.paymentAccountType]} - Penyusutan {formatCurrency(asset.monthlyDepreciation)} / bulan selama {asset.depreciationMonths} bulan
                          </p>
                        </div>
                        <p className="font-bold">{formatCurrency(asset.purchasePrice)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === 'payable' ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              <Card>
                <CardHeader><h2 className="text-base font-semibold">Tambah Hutang</h2></CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={handleCreatePayable}>
                    <Input label="Nama Vendor / Pihak" value={payableInput.vendorName} onChange={(event) => setPayableInput((current) => ({ ...current, vendorName: event.target.value }))} />
                    <Input label="Keterangan Hutang" value={payableInput.description} onChange={(event) => setPayableInput((current) => ({ ...current, description: event.target.value }))} />
                    <Input label="Jatuh Tempo" type="date" value={payableInput.dueDate} onChange={(event) => setPayableInput((current) => ({ ...current, dueDate: event.target.value }))} />
                    <Input label="Nominal" min="0" type="number" value={payableInput.amount} onChange={(event) => setPayableInput((current) => ({ ...current, amount: event.target.value }))} />
                    <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>Simpan Hutang</Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold">Daftar Hutang</h2>
                    <p className="text-sm font-semibold text-red-700">Total {formatCurrency(summary.payable)}</p>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {payables.length === 0 ? <p className="text-sm text-neutral-500">Belum ada hutang.</p> : payables.map((payable) => {
                    const remaining = Math.max(payable.amount - payable.paidAmount, 0)
                    return (
                      <div className="rounded-md border border-app-border p-3" key={payable.id}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-semibold">{payable.vendorName}</p>
                            <p className="text-sm text-neutral-500">{payable.description}</p>
                            <p className="mt-1 text-xs text-neutral-500">Jatuh tempo {formatDisplayDate(payable.dueDate)} - {accountingPayableStatusLabels[payable.status]}</p>
                          </div>
                          <div className="grid gap-2 lg:justify-items-end">
                            <p className="font-bold">{formatCurrency(remaining)}</p>
                            {payable.status !== 'PAID' ? (
                              <div className="flex flex-wrap gap-2">
                                <Button className="min-h-9 px-3 py-1.5" disabled={Boolean(isUpdatingPayable)} onClick={() => void handlePayPayable(payable, 'BANK')} type="button" variant="secondary">
                                  Bayar Bank
                                </Button>
                                <Button className="min-h-9 px-3 py-1.5" disabled={Boolean(isUpdatingPayable)} onClick={() => void handlePayPayable(payable, 'CASH')} type="button" variant="secondary">
                                  Bayar Kas
                                </Button>
                                <Button className="min-h-9 px-3 py-1.5" disabled={Boolean(isUpdatingPayable)} icon={isUpdatingPayable === payable.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />} onClick={() => void handleDeletePayable(payable)} type="button" variant="danger">
                                  Hapus
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === 'receivable' ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold">Piutang Invoice</h2>
                  <p className="text-sm font-semibold text-amber-700">Total {formatCurrency(summary.receivable)}</p>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {receivables.length === 0 ? <p className="text-sm text-neutral-500">Tidak ada piutang. Semua invoice sudah lunas atau belum ada invoice.</p> : receivables.map((invoice) => (
                  <div className="rounded-md border border-app-border p-3" key={invoice.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{invoice.clientName}</p>
                        <p className="text-sm text-neutral-500">{invoice.invoiceNumber} - {formatDisplayDate(invoice.eventDate)}</p>
                        <p className="mt-1 text-xs text-neutral-500">Total {formatCurrency(invoice.totalAmount)} - Terbayar {formatCurrency(invoice.totalPaid)}</p>
                      </div>
                      <div className="grid gap-2 sm:justify-items-end">
                        <p className="font-bold text-amber-700">{formatCurrency(invoice.remainingAmount)}</p>
                        <Link to={`/invoices/${invoice.id}`}>
                          <Button className="min-h-9 px-3 py-1.5" type="button" variant="secondary">Buka Invoice</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'journal' ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold">Jurnal Umum</h2>
                  <Button icon={<Download size={16} />} onClick={exportJournal} type="button" variant="secondary">Excel/CSV</Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {journalLines.length === 0 ? <p className="text-sm text-neutral-500">Belum ada jurnal.</p> : journalLines.map((line) => (
                  <div className="grid gap-2 rounded-md border border-app-border p-3 md:grid-cols-[120px_1fr_140px_140px] md:items-center" key={line.id}>
                    <p className="text-sm text-neutral-500">{line.date}</p>
                    <div>
                      <p className="font-semibold">{line.account}</p>
                      <p className="text-sm text-neutral-500">{line.description} - {line.source}</p>
                    </div>
                    <p className="font-bold text-green-700 md:text-right">{line.debit ? formatCurrency(line.debit) : '-'}</p>
                    <p className="font-bold text-red-700 md:text-right">{line.credit ? formatCurrency(line.credit) : '-'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'ledger' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Buku Besar</h2></CardHeader>
              <CardContent className="grid gap-3">
                {ledgerRows.length === 0 ? <p className="text-sm text-neutral-500">Belum ada data buku besar.</p> : ledgerRows.map((row) => (
                  <div className="grid gap-2 rounded-md border border-app-border p-3 sm:grid-cols-[1fr_150px_150px_150px] sm:items-center" key={row.account}>
                    <p className="font-semibold">{row.account}</p>
                    <p className="text-sm sm:text-right">Debit {formatCurrency(row.debit)}</p>
                    <p className="text-sm sm:text-right">Kredit {formatCurrency(row.credit)}</p>
                    <p className="font-bold sm:text-right">{formatCurrency(Math.abs(row.balance))}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'trial-balance' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Neraca Saldo</h2></CardHeader>
              <CardContent className="grid gap-3">
                {ledgerRows.map((row) => (
                  <div className="grid gap-2 rounded-md border border-app-border p-3 sm:grid-cols-[1fr_160px_160px] sm:items-center" key={row.account}>
                    <p className="font-semibold">{row.account}</p>
                    <p className="sm:text-right">{row.balance >= 0 ? formatCurrency(row.balance) : '-'}</p>
                    <p className="sm:text-right">{row.balance < 0 ? formatCurrency(Math.abs(row.balance)) : '-'}</p>
                  </div>
                ))}
                <div className="grid gap-2 rounded-md bg-app-muted p-3 font-bold sm:grid-cols-[1fr_160px_160px]">
                  <p>Total</p>
                  <p className="sm:text-right">{formatCurrency(ledgerRows.filter((row) => row.balance >= 0).reduce((sum, row) => sum + row.balance, 0))}</p>
                  <p className="sm:text-right">{formatCurrency(ledgerRows.filter((row) => row.balance < 0).reduce((sum, row) => sum + Math.abs(row.balance), 0))}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'profit-loss' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Laba Rugi Bulan Ini</h2></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Pendapatan', summary.monthlyIncome],
                  ['Beban Operasional + Penyusutan', summary.monthlyExpense],
                  ['Penyusutan', summary.monthlyDepreciation],
                  ['Laba Bersih', summary.netProfit],
                ].map(([label, value]) => (
                  <div className="rounded-md border border-app-border p-4" key={label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
                    <p className="mt-2 text-xl font-black">{formatCurrency(Number(value))}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'balance-sheet' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Neraca</h2></CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-md border border-app-border p-4">
                  <p className="font-semibold">Aset</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <p>Kas: {formatCurrency(summary.cashBalance)}</p>
                    <p>Bank: {formatCurrency(summary.bankBalance)}</p>
                    <p>Piutang: {formatCurrency(summary.receivable)}</p>
                    <p>Aset Tetap: {formatCurrency(summary.assetValue)}</p>
                    <p className="font-bold">Total Aset: {formatCurrency(summary.cashBalance + summary.bankBalance + summary.receivable + summary.assetValue)}</p>
                  </div>
                </div>
                <div className="rounded-md border border-app-border p-4">
                  <p className="font-semibold">Kewajiban</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <p>Hutang Usaha: {formatCurrency(summary.payable)}</p>
                    <p className="font-bold">Total Kewajiban: {formatCurrency(summary.payable)}</p>
                  </div>
                </div>
                <div className="rounded-md border border-app-border p-4">
                  <p className="font-semibold">Ekuitas</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <p>Modal + Laba Ditahan: {formatCurrency(summary.cashBalance + summary.bankBalance + summary.receivable + summary.assetValue - summary.payable)}</p>
                    <p className="font-bold">Total Pasiva: {formatCurrency(summary.payable + (summary.cashBalance + summary.bankBalance + summary.receivable + summary.assetValue - summary.payable))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'cash-flow' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Arus Kas</h2></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Kas Masuk</p><p className="mt-1 text-xl font-black text-green-700">{formatCurrency(cashFlowTotals.inflow)}</p></div>
                  <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Kas Keluar</p><p className="mt-1 text-xl font-black text-red-700">{formatCurrency(cashFlowTotals.outflow)}</p></div>
                  <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Net Cash Flow</p><p className="mt-1 text-xl font-black">{formatCurrency(cashFlowTotals.net)}</p></div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'equity' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Ekuitas / Modal</h2></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Setoran Modal / Saldo Awal</p><p className="mt-1 text-xl font-black">{formatCurrency(totalOpeningCapital)}</p></div>
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Laba Bersih Bulan Ini</p><p className="mt-1 text-xl font-black">{formatCurrency(summary.netProfit)}</p></div>
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Prive</p><p className="mt-1 text-xl font-black">{formatCurrency(totalPrive)}</p></div>
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Estimasi Ekuitas</p><p className="mt-1 text-xl font-black">{formatCurrency(currentEquity)}</p></div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'tax' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Pajak</h2></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Pendapatan Bulan Ini</p><p className="mt-1 text-xl font-black">{formatCurrency(summary.monthlyIncome)}</p></div>
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Beban Bulan Ini</p><p className="mt-1 text-xl font-black">{formatCurrency(summary.monthlyExpense)}</p></div>
                <div className="rounded-md border border-app-border p-4"><p className="text-sm text-neutral-500">Dasar Pajak Estimasi</p><p className="mt-1 text-xl font-black">{formatCurrency(Math.max(summary.netProfit, 0))}</p></div>
                <p className="text-sm text-neutral-500 sm:col-span-3">Ini masih persiapan pajak: angka diambil dari pendapatan dan beban yang sudah dicatat. Tarif dan jenis pajak bisa ditambahkan nanti sesuai aturan usaha.</p>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'reports' ? (
            <Card>
              <CardHeader><h2 className="text-base font-semibold">Laporan Accounting</h2></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {['Laba Rugi', 'Neraca', 'Arus Kas', 'Buku Besar', 'Neraca Saldo', 'Jurnal Umum', 'Daftar Aset', 'Daftar Pengeluaran', 'Daftar Pendapatan', 'Rekap Bulanan', 'Rekap Tahunan'].map((report) => (
                  <div className="rounded-md border border-app-border p-4" key={report}>
                    <p className="font-semibold">{report}</p>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={exportTransactions} type="button" variant="secondary">Excel</Button>
                      <Button onClick={() => window.print()} type="button" variant="secondary">PDF</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <Card>
        <CardHeader><h2 className="text-base font-semibold">Kategori Transaksi</h2></CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <form className="grid gap-3" onSubmit={handleCreateCategory}>
            <label className="grid gap-2 text-sm font-medium">
              Jenis
              <select className="min-h-12 rounded-md border border-app-border px-3" value={categoryInput.type} onChange={(event) => setCategoryInput((current) => ({ ...current, type: event.target.value as AccountingTransactionType }))}>
                <option value="INCOME">Pemasukan</option>
                <option value="EXPENSE">Pengeluaran</option>
              </select>
            </label>
            <Input label="Nama Kategori" value={categoryInput.name} onChange={(event) => setCategoryInput((current) => ({ ...current, name: event.target.value }))} />
            <Button disabled={isSaving} type="submit">Tambah Kategori</Button>
          </form>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <div className="rounded-md border border-app-border p-3 text-sm" key={category.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="text-neutral-500">{accountingTransactionTypeLabels[category.type]}{category.isDefault ? ' - Default' : ''}</p>
                  </div>
                  <Button className="min-h-9 px-3 py-1.5" onClick={() => void handleRenameCategory(category)} type="button" variant="secondary">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
