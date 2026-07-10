import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Download, Loader2, Plus } from 'lucide-react'
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
  accountingTransactionTypeLabels,
  assetConditionLabels,
  buildAccountingSummary,
  createAccountingAsset,
  createAccountingCategory,
  createAccountingTransaction,
  listAccountingAssets,
  listAccountingTransactions,
  seedAccountingCategories,
  updateAccountingCategory,
} from '../../services/firestore/accounting'
import type {
  AccountingAccountType,
  AccountingAssetCondition,
  AccountingAssetRecord,
  AccountingCategoryRecord,
  AccountingTransactionRecord,
  AccountingTransactionType,
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
  const [assets, setAssets] = useState<AccountingAssetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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
  const [assetInput, setAssetInput] = useState({
    name: '',
    purchaseDate: today,
    purchasePrice: '',
    condition: 'BAIK' as AccountingAssetCondition,
    location: '',
    notes: '',
  })

  const loadAccounting = useCallback(async () => {
    if (!ownerUserId) return
    setIsLoading(true)
    setErrorMessage('')

    try {
      const loadedCategories = await seedAccountingCategories(ownerUserId)
      const [loadedTransactions, loadedAssets] = await Promise.all([
        listAccountingTransactions(ownerUserId),
        listAccountingAssets(ownerUserId),
      ])
      setCategories(loadedCategories)
      setTransactions(loadedTransactions)
      setAssets(loadedAssets)
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

  const summary = useMemo(() => buildAccountingSummary(transactions, assets), [assets, transactions])
  const filteredTransactions = transactions.filter((transaction) => {
    if (activeTab === 'income') return transaction.type === 'INCOME'
    if (activeTab === 'expense') return transaction.type === 'EXPENSE'
    if (activeTab === 'cash-bank') return true
    return true
  })
  const selectedCategories = categories.filter((category) => category.type === transactionInput.type)
  const cashFlowData = useMemo(() => {
    const months = new Map<string, { month: string; income: number; expense: number }>()
    transactions.forEach((transaction) => {
      const date = toInputDate(transaction.date)
      const key = date ? date.slice(0, 7) : 'Tanpa Tanggal'
      const item = months.get(key) ?? { month: key, income: 0, expense: 0 }
      if (transaction.type === 'INCOME') item.income += transaction.amount
      else item.expense += transaction.amount
      months.set(key, item)
    })
    return Array.from(months.values()).slice(0, 12).reverse()
  }, [transactions])

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
      await createAccountingTransaction(ownerUserId, profile.uid, {
        type: transactionInput.type,
        date: transactionInput.date,
        accountType: transactionInput.accountType,
        categoryId: category?.id ?? '',
        categoryName: category?.name ?? transactionInput.type,
        amount: Number(transactionInput.amount),
        description: transactionInput.description,
      })
      setTransactionInput((current) => ({ ...current, amount: '', description: '' }))
      await loadAccounting()
      setMessage('Transaksi accounting berhasil ditambahkan.')
    } catch (error) {
      console.error('Failed to create accounting transaction', error)
      setErrorMessage('Transaksi belum bisa disimpan.')
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
        condition: assetInput.condition,
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

  function exportTransactions() {
    downloadCsv('laporan-accounting-transaksi', transactions.map((transaction) => ({
      Tanggal: formatDisplayDate(transaction.date),
      Jenis: accountingTransactionTypeLabels[transaction.type],
      Akun: accountingAccountTypeLabels[transaction.accountType],
      Kategori: transaction.categoryName,
      Nominal: transaction.amount,
      Keterangan: transaction.description,
    })))
  }

  function exportAssets() {
    downloadCsv('laporan-accounting-aset', assets.map((asset) => ({
      Aset: asset.name,
      Tanggal: formatDisplayDate(asset.purchaseDate),
      Harga: asset.purchasePrice,
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

          {['cash-bank', 'income', 'expense', 'journal', 'ledger', 'trial-balance', 'profit-loss', 'balance-sheet', 'cash-flow', 'equity', 'reports'].includes(activeTab) ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
              {['cash-bank', 'income', 'expense'].includes(activeTab) ? (
                <Card>
                  <CardHeader><h2 className="text-base font-semibold">Tambah Transaksi</h2></CardHeader>
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
                      <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>Tambah Transaksi</Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              <Card className={['cash-bank', 'income', 'expense'].includes(activeTab) ? '' : 'xl:col-span-2'}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold">Transaksi Accounting</h2>
                    <div className="flex gap-2">
                      <Button icon={<Download size={16} />} onClick={exportTransactions} type="button" variant="secondary">Excel/CSV</Button>
                      <Button icon={<Download size={16} />} onClick={() => window.print()} type="button" variant="secondary">PDF</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {filteredTransactions.length === 0 ? <p className="text-sm text-neutral-500">Belum ada transaksi.</p> : filteredTransactions.map((transaction) => (
                    <div className="rounded-md border border-app-border p-3" key={transaction.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{transaction.description}</p>
                          <p className="text-sm text-neutral-500">{formatDisplayDate(transaction.date)} - {transaction.categoryName} - {accountingAccountTypeLabels[transaction.accountType]}</p>
                        </div>
                        <p className={`font-bold ${transaction.type === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>{transaction.type === 'INCOME' ? '+' : '-'} {formatCurrency(transaction.amount)}</p>
                      </div>
                    </div>
                  ))}
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
                        </div>
                        <p className="font-bold">{formatCurrency(asset.purchasePrice)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === 'payable' || activeTab === 'receivable' || activeTab === 'tax' ? (
            <Card>
              <CardContent>
                <p className="font-semibold">{tabs.find((tab) => tab.id === activeTab)?.label}</p>
                <p className="mt-2 text-sm text-neutral-500">Struktur modul sudah disiapkan. Pencatatan detail, approval, pajak, dan rekonsiliasi akan dapat ditambahkan di versi berikutnya tanpa mengubah fondasi modul.</p>
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
