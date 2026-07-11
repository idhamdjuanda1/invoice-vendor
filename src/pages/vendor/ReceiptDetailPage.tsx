import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, Printer, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { paymentMethodLabels } from '../../lib/formatters/invoice'
import { makePrintTitle } from '../../lib/formatters/printTitle'
import { softDeletePayment } from '../../services/firestore/payments'
import { getReceipt, softDeleteReceipt } from '../../services/firestore/receipts'
import type { ReceiptRecord } from '../../types/domain'

export function ReceiptDetailPage() {
  const { receiptId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const pdfRef = useRef<HTMLDivElement | null>(null)
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function handlePrint() {
    const currentTitle = document.title
    document.title = receipt
      ? makePrintTitle(['Kuitansi', receipt.clientName || receipt.receiptNumber])
      : 'Kuitansi Invoice Vendor'
    window.print()
    window.setTimeout(() => {
      document.title = currentTitle
    }, 500)
  }

  async function handleGeneratePdf() {
    if (!receipt) return

    setIsGeneratingPdf(true)
    setErrorMessage('')

    try {
      const { generateReceiptPdf } = await import('../../lib/pdf/documentPdf')
      generateReceiptPdf({
        receipt,
        filename: makePrintTitle(['Kuitansi', receipt.clientName || receipt.receiptNumber]),
      })
    } catch (error) {
      console.error('Failed to generate receipt PDF', error)
      setErrorMessage('PDF kuitansi belum bisa dibuat. Coba refresh halaman lalu ulangi.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  async function handleDeleteReceipt() {
    if (!profile?.uid || !receipt) return
    const confirmed = window.confirm('Hapus kuitansi ini? Pembayaran terkait akan ikut dihapus dari invoice dan accounting.')
    if (!confirmed) return

    setIsDeleting(true)
    setErrorMessage('')
    try {
      try {
        await softDeletePayment(profile.uid, receipt.paymentId)
      } catch (paymentError) {
        console.warn('Payment linked to receipt could not be deleted, deleting receipt only.', paymentError)
        await softDeleteReceipt(profile.uid, receipt.id)
      }
      navigate('/receipts', { replace: true })
    } catch (error) {
      console.error('Failed to delete receipt/payment', error)
      setErrorMessage('Kuitansi belum bisa dihapus.')
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    async function loadReceipt() {
      if (!profile?.uid || !receiptId) return

      setIsLoading(true)
      setErrorMessage('')

      try {
        const receiptData = await getReceipt(profile.uid, receiptId)
        if (!receiptData) {
          setErrorMessage('Kuitansi tidak ditemukan.')
          return
        }
        setReceipt(receiptData)
      } catch (error) {
        console.error('Failed to load receipt detail', error)
        setErrorMessage('Detail kuitansi belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadReceipt()
  }, [profile?.uid, receiptId])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Detail Kuitansi"
        description="Preview kuitansi pembayaran yang siap dicetak."
        actions={
          <>
            <Link to="/receipts">
              <Button icon={<ArrowLeft size={16} />} variant="secondary">
                Kembali
              </Button>
            </Link>
            {receipt ? (
              <Button
                disabled={isGeneratingPdf}
                icon={isGeneratingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                onClick={() => void handleGeneratePdf()}
                variant="secondary"
              >
                {isGeneratingPdf ? 'Membuat PDF...' : 'Download PDF'}
              </Button>
            ) : null}
            {receipt ? (
              <Button
                disabled={isDeleting}
                icon={isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                onClick={() => void handleDeleteReceipt()}
                variant="danger"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </Button>
            ) : null}
            <Button icon={<Printer size={16} />} onClick={handlePrint}>
              Cetak
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={16} />
            Memuat kuitansi...
          </CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="text-sm text-red-600">{errorMessage}</CardContent>
        </Card>
      ) : receipt ? (
        <Card className="print-card receipt-print-card">
          <CardContent className="print-card-content">
            <div className="receipt-print-area print-area grid gap-6 bg-white p-2 text-sm text-app-text sm:p-8" ref={pdfRef}>
              <div className="print-header flex flex-col gap-5 border-b-2 border-app-text pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-gold">Invoice Vendor</p>
                  <h2 className="mt-1 text-2xl font-bold leading-tight">{receipt.vendorName}</h2>
                  <div className="mt-3 grid gap-1 text-sm leading-relaxed text-neutral-600">
                    {receipt.vendorWhatsappNumber ? <span>WhatsApp: {receipt.vendorWhatsappNumber}</span> : null}
                    {receipt.vendorAddress ? <span>{receipt.vendorAddress}</span> : null}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <h1 className="text-3xl font-black uppercase tracking-[0.12em] text-app-text">Kuitansi</h1>
                  <p className="mt-3 font-bold">{receipt.receiptNumber}</p>
                  <p className="text-sm text-neutral-600">{formatDisplayDate(receipt.receiptDate)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-app-border bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Telah Diterima Dari</p>
                  <p className="mt-2 text-lg font-bold">{receipt.clientName}</p>
                  <p className="mt-2 text-sm text-neutral-600">Untuk pembayaran invoice {receipt.invoiceNumber}</p>
                </div>
                <div className="rounded-md border border-app-border bg-app-muted p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Nominal Pembayaran</p>
                  <p className="mt-2 text-2xl font-black">{formatCurrency(receipt.amount)}</p>
                  <p className="mt-2 text-sm text-neutral-600">Metode: {paymentMethodLabels[receipt.paymentMethod]}</p>
                </div>
              </div>

              <div className="rounded-md border border-app-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Keterangan</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-neutral-700">
                  {receipt.notes || `Pembayaran untuk invoice ${receipt.invoiceNumber}.`}
                </p>
              </div>

              <div className="print-footer flex flex-col gap-10 border-t border-app-border pt-5 text-sm sm:flex-row sm:items-end sm:justify-between">
                <p className="text-xs text-neutral-500">Kuitansi ini dibuat secara elektronik dan sah tanpa tanda tangan basah.</p>
                <div className="min-w-48 text-left sm:text-right">
                  <p className="text-neutral-500">Hormat kami,</p>
                  <p className="mt-10 font-bold text-app-text">{receipt.vendorName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
