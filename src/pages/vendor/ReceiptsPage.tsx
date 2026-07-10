import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Loader2, Printer, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { paymentMethodLabels } from '../../lib/formatters/invoice'
import { listInvoices } from '../../services/firestore/invoices'
import { listPayments, softDeletePayment } from '../../services/firestore/payments'
import { createReceiptForPayment, listReceipts } from '../../services/firestore/receipts'
import type { ReceiptRecord } from '../../types/domain'

export function ReceiptsPage() {
  const { profile } = useAuth()
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDeleting, setIsDeleting] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadReceipts = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      setReceipts(await listReceipts(profile.uid))
    } catch (error) {
      console.error('Failed to load receipts', error)
      setErrorMessage('Daftar kuitansi belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  async function handleSyncReceipts() {
    if (!profile?.uid) return

    setIsSyncing(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const invoices = await listInvoices(profile.uid)
      const paymentGroups = await Promise.all(invoices.map((invoice) => listPayments(profile.uid, invoice.id)))
      const payments = paymentGroups.flat()

      await Promise.all(payments.map((payment) => createReceiptForPayment(profile.uid, payment.id)))
      await loadReceipts()
      setSuccessMessage('Kuitansi berhasil disinkronkan dari riwayat pembayaran.')
    } catch (error) {
      console.error('Failed to sync receipts', error)
      setErrorMessage('Kuitansi belum bisa disinkronkan.')
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleDeleteReceipt(receipt: ReceiptRecord) {
    if (!profile?.uid) return
    const confirmed = window.confirm('Hapus kuitansi ini? Pembayaran terkait akan ikut dihapus dari invoice dan accounting.')
    if (!confirmed) return

    setIsDeleting(receipt.id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await softDeletePayment(profile.uid, receipt.paymentId)
      await loadReceipts()
      setSuccessMessage('Kuitansi dan pembayaran terkait berhasil dihapus. Accounting ikut diperbarui.')
    } catch (error) {
      console.error('Failed to delete receipt/payment', error)
      setErrorMessage('Kuitansi belum bisa dihapus.')
    } finally {
      setIsDeleting('')
    }
  }

  useEffect(() => {
    void loadReceipts()
  }, [loadReceipts])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Kuitansi"
        description="Setiap pembayaran akan membuat kuitansi otomatis dengan nomor RCT per vendor dan bulan."
        actions={
          <Button
            icon={isSyncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            onClick={handleSyncReceipts}
            variant="secondary"
            disabled={isSyncing}
          >
            Sinkronkan
          </Button>
        }
      />

      {successMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat kuitansi...
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">
              Belum ada kuitansi. Tambahkan pembayaran pada invoice, lalu kuitansi akan dibuat otomatis.
            </div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              {receipts.map((receipt) => (
                <div className="rounded-md border border-app-border bg-white p-4" key={receipt.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{receipt.receiptNumber}</p>
                      <p className="mt-1 text-base font-semibold">{receipt.clientName || 'Klien tanpa nama'}</p>
                      <p className="mt-1 text-sm text-neutral-500">{receipt.invoiceNumber}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                      {paymentMethodLabels[receipt.paymentMethod]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-app-muted p-3 text-sm">
                    <div>
                      <p className="text-xs text-neutral-500">Nominal</p>
                      <p className="mt-1 font-bold">{formatCurrency(receipt.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Tanggal</p>
                      <p className="mt-1 font-bold">{formatDisplayDate(receipt.receiptDate)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/receipts/${receipt.id}`}>
                      <Button variant="secondary" icon={<Eye size={15} />} className="w-full">
                        Detail
                      </Button>
                    </Link>
                    <Link to={`/receipts/${receipt.id}`}>
                      <Button variant="secondary" icon={<Printer size={15} />} className="w-full">
                        Cetak
                      </Button>
                    </Link>
                    <Button
                      className="col-span-2 w-full"
                      disabled={Boolean(isDeleting)}
                      icon={isDeleting === receipt.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                      onClick={() => void handleDeleteReceipt(receipt)}
                      variant="danger"
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-app-border bg-app-muted text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-3">Nomor Kuitansi</th>
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Klien</th>
                    <th className="px-5 py-3">Nominal</th>
                    <th className="px-5 py-3">Metode</th>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr className="border-b border-app-border last:border-b-0" key={receipt.id}>
                      <td className="px-5 py-4 font-semibold">{receipt.receiptNumber}</td>
                      <td className="px-5 py-4">{receipt.invoiceNumber}</td>
                      <td className="px-5 py-4">{receipt.clientName}</td>
                      <td className="px-5 py-4">{formatCurrency(receipt.amount)}</td>
                      <td className="px-5 py-4">{paymentMethodLabels[receipt.paymentMethod]}</td>
                      <td className="px-5 py-4">{formatDisplayDate(receipt.receiptDate)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/receipts/${receipt.id}`}>
                            <Button variant="secondary" icon={<Eye size={15} />} className="px-3">
                              Detail
                            </Button>
                          </Link>
                          <Link to={`/receipts/${receipt.id}`}>
                            <Button variant="secondary" icon={<Printer size={15} />} className="px-3">
                              Cetak
                            </Button>
                          </Link>
                          <Button
                            className="px-3"
                            disabled={Boolean(isDeleting)}
                            icon={isDeleting === receipt.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                            onClick={() => void handleDeleteReceipt(receipt)}
                            variant="danger"
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
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
