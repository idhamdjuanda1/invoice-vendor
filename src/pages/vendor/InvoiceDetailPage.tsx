import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, Edit3, FileSignature, Loader2, Printer } from 'lucide-react'
import { PaymentManager } from '../../components/invoice/PaymentManager'
import { WhatsAppReminderButton } from '../../components/invoice/WhatsAppReminderButton'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { paymentMethodLabels, paymentStatusLabels } from '../../lib/formatters/invoice'
import { makePrintTitle } from '../../lib/formatters/printTitle'
import { generateInvoicePdf } from '../../lib/pdf/documentPdf'
import { createAgreementFromInvoice } from '../../services/firestore/agreements'
import { getBusinessProfile } from '../../services/firestore/businessProfiles'
import { getInvoice } from '../../services/firestore/invoices'
import { listPayments } from '../../services/firestore/payments'
import type { BusinessProfile, InvoiceRecord, PaymentRecord } from '../../types/domain'

function formatPackageDetails(value: string | null) {
  if (!value) return ''

  return value
    .split(/\r?\n|•|;|\s{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ')
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const pdfRef = useRef<HTMLDivElement | null>(null)
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingAgreement, setIsCreatingAgreement] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadInvoice = useCallback(async () => {
    if (!profile?.uid || !invoiceId) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const [invoiceData, businessData, paymentList] = await Promise.all([
        getInvoice(profile.uid, invoiceId),
        getBusinessProfile(profile.uid),
        listPayments(profile.uid, invoiceId),
      ])
      if (!invoiceData) {
        setErrorMessage('Invoice tidak ditemukan.')
        return
      }
      setInvoice(invoiceData)
      setBusinessProfile(businessData)
      setPayments(paymentList)
    } catch (error) {
      console.error('Failed to load invoice detail', error)
      setErrorMessage('Detail invoice belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [invoiceId, profile?.uid])

  useEffect(() => {
    void loadInvoice()
  }, [loadInvoice])

  function handlePrint() {
    const currentTitle = document.title
    document.title = invoice
      ? makePrintTitle(['Invoice', invoice.clientName || invoice.invoiceNumber, invoice.eventDate])
      : 'Invoice Vendor'
    window.print()
    window.setTimeout(() => {
      document.title = currentTitle
    }, 500)
  }

  async function handleCreateAgreement() {
    if (!profile?.uid || !invoice) return

    setIsCreatingAgreement(true)
    setErrorMessage('')

    try {
      const agreementId = await createAgreementFromInvoice(profile.uid, invoice.id)
      navigate(`/agreements/${agreementId}`)
    } catch (error) {
      console.error('Failed to create agreement', error)
      setErrorMessage('MOU belum bisa dibuat dari invoice ini.')
    } finally {
      setIsCreatingAgreement(false)
    }
  }

  async function handleGeneratePdf() {
    if (!invoice) return

    setIsGeneratingPdf(true)
    setErrorMessage('')

    try {
      generateInvoicePdf({
        invoice,
        payments,
        businessProfile,
        filename: makePrintTitle(['Invoice', invoice.clientName || invoice.invoiceNumber, invoice.eventDate]),
      })
    } catch (error) {
      console.error('Failed to generate invoice PDF', error)
      setErrorMessage('PDF invoice belum bisa dibuat. Coba refresh halaman lalu ulangi.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Detail Invoice"
        description="Preview invoice, riwayat pembayaran, status, link publik, PDF, dan WhatsApp."
        actions={
          <>
            {invoice ? (
              <Link to={`/invoices/${invoice.id}/edit`}>
                <Button icon={<Edit3 size={16} />} variant="secondary">
                  Edit
                </Button>
              </Link>
            ) : null}
            {invoice && invoice.remainingAmount > 0 ? <WhatsAppReminderButton invoice={invoice} /> : null}
            {invoice ? (
              <Button
                disabled={isGeneratingPdf}
                icon={isGeneratingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                onClick={() => void handleGeneratePdf()}
                variant="secondary"
              >
                {isGeneratingPdf ? 'Membuat PDF...' : 'Download PDF'}
              </Button>
            ) : null}
            {invoice ? (
              <Button
                disabled={isCreatingAgreement}
                icon={isCreatingAgreement ? <Loader2 className="animate-spin" size={16} /> : <FileSignature size={16} />}
                onClick={() => void handleCreateAgreement()}
                variant="secondary"
              >
                {isCreatingAgreement ? 'Membuat...' : 'Buat MOU'}
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
            Memuat invoice...
          </CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="text-sm text-red-600">{errorMessage}</CardContent>
        </Card>
      ) : invoice ? (
        <>
          <PaymentManager invoice={invoice} onChanged={loadInvoice} />

          <Card className="print-card">
            <CardContent className="print-card-content">
              <div className="invoice-print-area print-area grid gap-6 bg-white p-2 text-sm text-app-text sm:p-8" ref={pdfRef}>
                <div className="print-header flex flex-col gap-5 border-b-2 border-app-text pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-gold">Invoice Vendor</p>
                      <h2 className="mt-1 text-2xl font-bold leading-tight">{businessProfile?.vendorName || profile?.name || 'Vendor'}</h2>
                    </div>
                    <div className="mt-3 grid max-w-xl gap-1 text-sm leading-relaxed text-neutral-600">
                      {businessProfile?.whatsappNumber ? <span>WhatsApp: {businessProfile.whatsappNumber}</span> : null}
                      {businessProfile?.address ? <span>{businessProfile.address}</span> : null}
                      {businessProfile?.bankAccountNumber ? (
                        <span>
                          Rekening: {businessProfile.bankAccountNumber}
                          {businessProfile.bankAccountName ? ` a.n. ${businessProfile.bankAccountName}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    {businessProfile?.logoUrl ? (
                      <img alt="Logo vendor" className="print-logo mb-3 ml-auto h-16 max-w-32 object-contain" src={businessProfile.logoUrl} />
                    ) : null}
                    <h1 className="text-3xl font-black uppercase tracking-[0.12em] text-app-text">Invoice</h1>
                    <div className="mt-3 grid gap-1 text-sm">
                      <p className="font-bold">{invoice.invoiceNumber}</p>
                      <p className="text-neutral-600">{formatDisplayDate(invoice.invoiceDate)}</p>
                      <span className="mt-1 inline-flex rounded-full bg-app-gold-soft px-3 py-1 text-xs font-bold text-app-text sm:ml-auto">
                        {paymentStatusLabels[invoice.paymentStatus]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="print-meta grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-app-border bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Ditagihkan Kepada</p>
                    <p className="mt-2 text-lg font-bold">{invoice.clientName || 'Klien tanpa nama'}</p>
                    <div className="mt-2 grid gap-1 leading-relaxed text-neutral-700">
                      <span>Nama Pengantin: {invoice.clientName || '-'}</span>
                      <span>Tahap Pembayaran: {paymentStatusLabels[invoice.paymentStatus]}</span>
                    </div>
                    <div className="mt-2 grid gap-1 leading-relaxed text-neutral-600">
                      {invoice.clientWhatsappNumber ? <span>{invoice.clientWhatsappNumber}</span> : null}
                      {invoice.clientEmail ? <span>{invoice.clientEmail}</span> : null}
                      {invoice.clientAddress ? <span>{invoice.clientAddress}</span> : null}
                    </div>
                  </div>
                  <div className="rounded-md border border-app-border bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Detail Acara</p>
                    <div className="mt-2 grid gap-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Tanggal</span>
                        <strong className="text-right">{formatDisplayDate(invoice.eventDate)}</strong>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Lokasi</span>
                        <strong className="text-right">{invoice.eventLocation}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <p className="print-only mb-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Detail Pricelist</p>
                  <table className="print-items w-full min-w-[640px] border-collapse text-left">
                    <thead className="bg-app-muted text-xs uppercase text-neutral-600">
                      <tr>
                        <th className="border border-app-border px-3 py-2">Paket</th>
                        <th className="border border-app-border px-3 py-2">Kategori</th>
                        <th className="border border-app-border px-3 py-2 text-right">Qty</th>
                        <th className="border border-app-border px-3 py-2 text-right">Harga</th>
                        <th className="border border-app-border px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-app-border px-3 py-3 align-top">
                            <p className="font-semibold">{item.packageName}</p>
                            {item.description ? <p className="mt-1 text-xs leading-snug text-neutral-500">{formatPackageDetails(item.description)}</p> : null}
                          </td>
                          <td className="border border-app-border px-3 py-3 align-top">{item.categoryName}</td>
                          <td className="border border-app-border px-3 py-3 text-right align-top">{item.quantity}</td>
                          <td className="border border-app-border px-3 py-3 text-right align-top">{formatCurrency(item.unitPrice)}</td>
                          <td className="border border-app-border px-3 py-3 text-right align-top font-semibold">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="print-bottom grid gap-4 md:grid-cols-[1fr_320px]">
                  <div className="rounded-md border border-app-border p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Catatan & Pembayaran</p>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed text-neutral-700">{invoice.additionalNote || '-'}</p>
                    {businessProfile?.bankAccountNumber ? (
                      <div className="mt-4 rounded-md bg-app-muted p-3 text-sm leading-relaxed text-app-text">
                        Pembayaran dilakukan ke nomor rekening <strong>{businessProfile.bankAccountNumber}</strong>
                        {businessProfile.bankAccountName ? <> atas nama <strong>{businessProfile.bankAccountName}</strong></> : null}.
                      </div>
                    ) : null}
                    {payments.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Pembayaran Diterima</p>
                        <div className="mt-2 grid gap-1.5">
                          {payments.map((payment) => (
                            <div className="flex items-center justify-between gap-4 text-sm" key={payment.id}>
                              <span>
                                {formatDisplayDate(payment.paymentDate)} - {paymentMethodLabels[payment.paymentMethod]}
                              </span>
                              <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-2 rounded-md border border-app-border bg-app-muted p-4">
                    <div className="flex justify-between gap-4">
                      <span>Total Tagihan</span>
                      <strong>{formatCurrency(invoice.totalAmount)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Total Terbayar</span>
                      <strong>{formatCurrency(invoice.totalPaid)}</strong>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-app-border pt-3 text-base">
                      <span>Sisa Pembayaran</span>
                      <strong>{formatCurrency(invoice.remainingAmount)}</strong>
                    </div>
                  </div>
                </div>

                <div className="print-footer flex flex-col gap-3 border-t border-app-border pt-4 text-xs text-neutral-500 sm:flex-row sm:items-end sm:justify-between">
                  <p>Invoice ini dibuat secara elektronik dan sah tanpa tanda tangan basah.</p>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-app-text">{businessProfile?.vendorName || profile?.name || 'Vendor'}</p>
                    <p>Terima kasih atas kepercayaan Anda.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
