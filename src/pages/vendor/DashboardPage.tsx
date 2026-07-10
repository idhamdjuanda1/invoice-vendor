import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock3, FileText, Loader2, WalletCards } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../features/auth/useAuth'
import { FREE_TRIAL_TOKEN_ID, getRemainingActivationDays } from '../../lib/activation'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate, toInputDate } from '../../lib/formatters/date'
import { paymentStatusLabels } from '../../lib/formatters/invoice'
import { listInvoices } from '../../services/firestore/invoices'
import type { InvoiceRecord } from '../../types/domain'

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function isCurrentMonth(invoice: InvoiceRecord) {
  const inputDate = toInputDate(invoice.invoiceDate)
  if (!inputDate) return false

  const invoiceDate = new Date(`${inputDate}T00:00:00`)
  const now = new Date()

  return invoiceDate.getFullYear() === now.getFullYear() && invoiceDate.getMonth() === now.getMonth()
}

function getInvoiceMonth(invoice: InvoiceRecord) {
  const inputDate = toInputDate(invoice.invoiceDate)
  if (!inputDate) return -1

  return new Date(`${inputDate}T00:00:00`).getMonth()
}

export function DashboardPage() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const remainingActivationDays = getRemainingActivationDays(profile?.activationExpiresAt ?? null)

  useEffect(() => {
    async function loadDashboard() {
      if (!profile?.uid) return

      setIsLoading(true)
      setErrorMessage('')

      try {
        setInvoices(await listInvoices(profile.uid))
      } catch (error) {
        console.error('Failed to load dashboard invoices', error)
        setErrorMessage('Ringkasan dashboard belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadDashboard()
  }, [profile?.uid])

  const summary = useMemo(() => {
    const totalInvoice = invoices.length
    const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.totalPaid, 0)
    const totalOutstanding = invoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)
    const paidInvoices = invoices.filter((invoice) => invoice.paymentStatus === 'LUNAS').length
    const currentMonthInvoices = invoices.filter(isCurrentMonth).length

    const monthlyRevenue = monthLabels.map((label, index) => ({
      label,
      value: invoices
        .filter((invoice) => getInvoiceMonth(invoice) === index)
        .reduce((sum, invoice) => sum + invoice.totalPaid, 0),
    }))
    const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((month) => month.value), 1)

    return {
      totalInvoice,
      totalRevenue,
      totalOutstanding,
      paidInvoices,
      currentMonthInvoices,
      monthlyRevenue,
      maxMonthlyRevenue,
      recentInvoices: invoices.slice(0, 6),
    }
  }, [invoices])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Invoice Vendor"
        description="Ringkasan total invoice, omzet, status pembayaran, invoice bulan ini, dan grafik transaksi bulanan."
      />

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-md border border-app-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-app-gold-soft text-app-text">
            <Clock3 size={20} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500">Sisa Masa Aktif</p>
            <p className="mt-1 text-xl font-bold text-app-text">
              {remainingActivationDays > 0 ? `${remainingActivationDays} Hari` : 'Token telah berakhir'}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {remainingActivationDays > 0
                ? profile?.activationTokenId === FREE_TRIAL_TOKEN_ID
                  ? 'Free Trial aktif. Masukkan token perpanjangan setelah masa trial selesai.'
                  : 'Akses aplikasi aktif sampai masa token berakhir.'
                : 'Silakan melakukan perpanjangan agar seluruh fitur dapat digunakan kembali.'}
            </p>
          </div>
        </div>
        {remainingActivationDays > 0 && remainingActivationDays <= 7 ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Hampir Habis
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FileText size={20} />}
          label="Total invoice"
          value={isLoading ? '...' : String(summary.totalInvoice)}
          helper="Semua invoice vendor"
        />
        <StatCard
          icon={<WalletCards size={20} />}
          label="Total omzet"
          value={isLoading ? '...' : formatCurrency(summary.totalRevenue)}
          helper={`Sisa tagihan ${formatCurrency(summary.totalOutstanding)}`}
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Invoice lunas"
          value={isLoading ? '...' : String(summary.paidInvoices)}
          helper="Status Lunas"
        />
        <StatCard
          icon={<CalendarDays size={20} />}
          label="Invoice bulan ini"
          value={isLoading ? '...' : String(summary.currentMonthInvoices)}
          helper="Tanggal invoice bulan berjalan"
        />
      </div>

      <Card>
        <CardContent className="grid gap-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Grafik transaksi bulanan</h2>
              <p className="text-sm text-neutral-500">Berdasarkan pembayaran yang sudah diterima.</p>
            </div>
            <p className="text-sm font-semibold text-app-text">{formatCurrency(summary.totalRevenue)}</p>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center gap-2 rounded-md bg-app-muted text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat grafik...
            </div>
          ) : (
            <div className="grid h-72 grid-cols-6 items-end gap-x-2 gap-y-4 rounded-md bg-app-muted p-4 sm:flex sm:h-64 sm:gap-3">
              {summary.monthlyRevenue.map((month) => {
                const height = Math.max(8, Math.round((month.value / summary.maxMonthlyRevenue) * 100))

                return (
                  <div className="flex h-28 min-w-0 flex-col items-center justify-end gap-2 sm:h-full sm:flex-1" key={month.label}>
                    <div
                      className="w-full rounded-t-md bg-app-gold transition"
                      style={{ height: `${month.value > 0 ? height : 4}%` }}
                      title={`${month.label}: ${formatCurrency(month.value)}`}
                    />
                    <span className="text-[10px] font-medium text-neutral-500 sm:text-xs">{month.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-app-border p-5">
            <h2 className="text-base font-semibold">Invoice terbaru</h2>
            <p className="mt-1 text-sm text-neutral-500">Daftar invoice terakhir beserta status pembayaran.</p>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat invoice...
            </div>
          ) : summary.recentInvoices.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">Belum ada invoice.</div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              {summary.recentInvoices.map((invoice) => (
                <Link className="block rounded-md border border-app-border bg-white p-4" key={invoice.id} to={`/invoices/${invoice.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-base font-semibold">{invoice.clientName || 'Klien tanpa nama'}</p>
                      <p className="mt-1 text-sm text-neutral-500">{formatDisplayDate(invoice.invoiceDate)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                      {paymentStatusLabels[invoice.paymentStatus]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-app-muted p-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-500">Tagihan</p>
                      <p className="mt-1 break-words font-bold">{formatCurrency(invoice.totalAmount)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-500">Dibayar</p>
                      <p className="mt-1 break-words font-bold">{formatCurrency(invoice.totalPaid)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-app-border bg-app-muted text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Klien</th>
                    <th className="px-5 py-3">Total tagihan</th>
                    <th className="px-5 py-3">Sudah dibayar</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentInvoices.map((invoice) => (
                    <tr className="border-b border-app-border last:border-b-0" key={invoice.id}>
                      <td className="px-5 py-4 font-semibold">
                        <Link className="hover:text-app-gold" to={`/invoices/${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-4">{invoice.clientName || 'Klien tanpa nama'}</td>
                      <td className="px-5 py-4">{formatCurrency(invoice.totalAmount)}</td>
                      <td className="px-5 py-4">{formatCurrency(invoice.totalPaid)}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                          {paymentStatusLabels[invoice.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-4">{formatDisplayDate(invoice.invoiceDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
