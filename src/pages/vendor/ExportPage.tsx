import { Download, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate, toInputDate } from '../../lib/formatters/date'
import { paymentStatusLabels } from '../../lib/formatters/invoice'
import { listInvoices } from '../../services/firestore/invoices'
import type { InvoiceRecord, PaymentStatus } from '../../types/domain'

type ExportStatusFilter = PaymentStatus | 'ALL'

type ExportRow = {
  Invoice: string
  Tanggal: string
  Klien: string
  Acara: string
  Subtotal: number
  Potongan: number
  'Grand Total': number
  Status: string
}

const monthOptions = [
  { value: 'ALL', label: 'Semua bulan' },
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
] as const

const statusOptions: Array<{ value: ExportStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Semua status' },
  { value: 'BELUM_BAYAR', label: paymentStatusLabels.BELUM_BAYAR },
  { value: 'DP', label: paymentStatusLabels.DP },
  { value: 'CICILAN', label: paymentStatusLabels.CICILAN },
  { value: 'LUNAS', label: paymentStatusLabels.LUNAS },
]

function getInvoiceDate(invoice: InvoiceRecord) {
  return toInputDate(invoice.invoiceDate)
}

function makeYearOptions(invoices: InvoiceRecord[]) {
  const years = new Set<string>()
  invoices.forEach((invoice) => {
    const invoiceDate = getInvoiceDate(invoice)
    if (invoiceDate) years.add(invoiceDate.slice(0, 4))
  })

  if (years.size === 0) years.add(String(new Date().getFullYear()))

  return Array.from(years).sort((a, b) => Number(b) - Number(a))
}

function isInDateRange(invoiceDate: string, startDate: string, endDate: string) {
  if (!invoiceDate) return false
  if (startDate && invoiceDate < startDate) return false
  if (endDate && invoiceDate > endDate) return false
  return true
}

function makeExportRows(invoices: InvoiceRecord[]): ExportRow[] {
  return invoices.map((invoice) => ({
    Invoice: invoice.invoiceNumber,
    Tanggal: getInvoiceDate(invoice),
    Klien: invoice.clientName,
    Acara: invoice.eventLocation,
    Subtotal: invoice.subtotal,
    Potongan: invoice.discountAmount,
    'Grand Total': invoice.totalAmount,
    Status: paymentStatusLabels[invoice.paymentStatus],
  }))
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(rows: ExportRow[], fileName: string) {
  const headers: Array<keyof ExportRow> = [
    'Invoice',
    'Tanggal',
    'Klien',
    'Acara',
    'Subtotal',
    'Potongan',
    'Grand Total',
    'Status',
  ]
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ].join('\n')
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), fileName)
}

async function downloadExcel(rows: ExportRow[], fileName: string) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 32 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice')
  XLSX.writeFile(workbook, fileName)
}

function makeFileName(extension: 'csv' | 'xlsx') {
  const stamp = new Date().toISOString().slice(0, 10)
  return `invoice-export-${stamp}.${extension}`
}

export function ExportPage() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState('ALL')
  const [year, setYear] = useState('ALL')
  const [status, setStatus] = useState<ExportStatusFilter>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  const loadInvoices = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setError('')

    try {
      const invoiceList = await listInvoices(profile.uid)
      setInvoices(invoiceList)
    } catch (loadError) {
      setError(getFriendlyAuthError(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  const yearOptions = useMemo(() => makeYearOptions(invoices), [invoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceDate = getInvoiceDate(invoice)
      if (!isInDateRange(invoiceDate, startDate, endDate)) return false
      if (year !== 'ALL' && invoiceDate.slice(0, 4) !== year) return false
      if (month !== 'ALL' && invoiceDate.slice(5, 7) !== month) return false
      if (status !== 'ALL' && invoice.paymentStatus !== status) return false
      return true
    })
  }, [endDate, invoices, month, startDate, status, year])

  const exportRows = useMemo(() => makeExportRows(filteredInvoices), [filteredInvoices])
  const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)

  function assertExportRowsAvailable() {
    if (exportRows.length > 0) return true

    setError(invoices.length === 0 ? 'Belum ada invoice yang bisa diexport.' : 'Tidak ada invoice sesuai filter export saat ini.')
    return false
  }

  function handleDownloadCsv() {
    setError('')
    if (!assertExportRowsAvailable()) return
    downloadCsv(exportRows, makeFileName('csv'))
  }

  async function handleDownloadExcel() {
    setError('')
    if (!assertExportRowsAvailable()) return
    setIsExportingExcel(true)
    try {
      await downloadExcel(exportRows, makeFileName('xlsx'))
    } catch (exportError) {
      console.error('Failed to export Excel', exportError)
      setError('File Excel belum bisa dibuat. Coba ulang beberapa saat lagi.')
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Export Data"
        description="Export invoice ke CSV dan Excel dengan filter bulan, tahun, status pembayaran, dan rentang tanggal."
        actions={
          <>
            <Button disabled={isLoading} icon={<Download size={16} />} onClick={handleDownloadCsv} variant="secondary">
              CSV
            </Button>
            <Button disabled={isLoading || isExportingExcel} icon={isExportingExcel ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} onClick={() => void handleDownloadExcel()}>
              {isExportingExcel ? 'Menyiapkan...' : 'Excel'}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-app-text">Filter Export</h2>
              <p className="mt-1 text-sm text-neutral-500">Atur data invoice yang ingin diunduh.</p>
            </div>
            <Button disabled={isLoading} icon={isLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} onClick={() => void loadInvoices()} variant="secondary">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-5">
            <label className="grid gap-2 text-sm font-medium text-app-text">
              Bulan
              <select
                className="min-h-11 rounded-md border border-app-border bg-white px-3 text-sm outline-none transition focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                onChange={(event) => setMonth(event.target.value)}
                value={month}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-app-text">
              Tahun
              <select
                className="min-h-11 rounded-md border border-app-border bg-white px-3 text-sm outline-none transition focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                onChange={(event) => setYear(event.target.value)}
                value={year}
              >
                <option value="ALL">Semua tahun</option>
                {yearOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-app-text">
              Status
              <select
                className="min-h-11 rounded-md border border-app-border bg-white px-3 text-sm outline-none transition focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                onChange={(event) => setStatus(event.target.value as ExportStatusFilter)}
                value={status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <Input label="Dari Tanggal" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            <Input label="Sampai Tanggal" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-app-muted p-4">
              <p className="text-xs text-neutral-500">Invoice Terfilter</p>
              <p className="mt-1 text-xl font-bold text-app-text">{filteredInvoices.length}</p>
            </div>
            <div className="rounded-md bg-app-muted p-4 sm:col-span-2">
              <p className="text-xs text-neutral-500">Total Nilai Invoice</p>
              <p className="mt-1 text-xl font-bold text-app-text">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-base font-bold text-app-text">Preview Data</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-app-muted text-xs uppercase text-neutral-500">
              <tr>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Invoice</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Tanggal</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Klien</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Acara</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Subtotal</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Potongan</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Grand Total</th>
                <th className="border-b border-app-border px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-neutral-500" colSpan={8}>
                    <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Memuat invoice...</span>
                  </td>
                </tr>
              ) : null}
              {!isLoading && filteredInvoices.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-neutral-500" colSpan={8}>Tidak ada invoice sesuai filter.</td>
                </tr>
              ) : null}
              {!isLoading
                ? filteredInvoices.map((invoice) => (
                    <tr className="border-b border-app-border last:border-0" key={invoice.id}>
                      <td className="px-5 py-4 font-semibold text-app-text">{invoice.invoiceNumber}</td>
                      <td className="px-5 py-4">{formatDisplayDate(invoice.invoiceDate)}</td>
                      <td className="px-5 py-4">{invoice.clientName || '-'}</td>
                      <td className="px-5 py-4">{invoice.eventLocation || '-'}</td>
                      <td className="px-5 py-4">{formatCurrency(invoice.subtotal)}</td>
                      <td className="px-5 py-4 text-app-danger">-{formatCurrency(invoice.discountAmount)}</td>
                      <td className="px-5 py-4 font-semibold">{formatCurrency(invoice.totalAmount)}</td>
                      <td className="px-5 py-4">{paymentStatusLabels[invoice.paymentStatus]}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
