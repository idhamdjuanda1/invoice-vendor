import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { paymentMethodLabels } from '../../lib/formatters/invoice'
import { listInvoiceEvents } from '../../services/firestore/invoiceEvents'
import { listInvoices } from '../../services/firestore/invoices'
import {
  createPartnerCommissionPayment,
  listPartnerCommissionPayments,
  listPartners,
  partnerCategoryLabels,
  partnerCommissionStatusLabels,
} from '../../services/firestore/partners'
import type { InvoiceEventDetail, InvoiceRecord, PartnerCommissionPaymentRecord, PartnerRecord, PaymentMethod } from '../../types/domain'

type PaymentInput = {
  amount: string
  paymentDate: string
  paymentMethod: PaymentMethod
  notes: string
}

type PartnerSummary = {
  partner: PartnerRecord
  invoices: InvoiceRecord[]
  jobCount: number
  totalInvoice: number
  totalCommission: number
  totalPaid: number
  totalUnpaid: number
}

const todayInput = new Date().toISOString().slice(0, 10)
const emptyPaymentInput: PaymentInput = {
  amount: '',
  paymentDate: todayInput,
  paymentMethod: 'TRANSFER_BANK',
  notes: '',
}

function getPackageSummary(invoice: InvoiceRecord) {
  return invoice.items.map((item) => item.packageName).join(', ') || '-'
}

function getEventPeople(invoice: InvoiceRecord, event: InvoiceEventDetail | undefined) {
  if (!event) return '-'
  if (invoice.eventType === 'WEDDING' || invoice.eventType === 'LAMARAN') {
    return [event.details.groomName, event.details.brideName].filter(Boolean).join(' & ') || '-'
  }
  if (invoice.eventType === 'PREWEDDING') {
    return [event.details.manName, event.details.womanName].filter(Boolean).join(' & ') || '-'
  }
  return event.details.organizationName || event.details.picName || '-'
}

function getPartnerFallback(partnerId: string, invoices: InvoiceRecord[]): PartnerRecord {
  const sample = invoices.find((invoice) => invoice.partnerId === partnerId)

  return {
    id: partnerId,
    userId: sample?.userId ?? '',
    name: sample?.partnerName ?? 'Partner tanpa nama',
    category: sample?.partnerCategory ?? 'VENDOR_LAINNYA',
    picName: null,
    whatsappNumber: null,
    email: null,
    address: null,
    notes: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
  }
}

export function PartnerReportsPage() {
  const { profile } = useAuth()
  const [partners, setPartners] = useState<PartnerRecord[]>([])
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [events, setEvents] = useState<InvoiceEventDetail[]>([])
  const [payments, setPayments] = useState<PartnerCommissionPaymentRecord[]>([])
  const [payingInvoiceId, setPayingInvoiceId] = useState('')
  const [paymentInput, setPaymentInput] = useState<PaymentInput>(emptyPaymentInput)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadReport = useCallback(async () => {
    if (!profile?.uid) return
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [partnerList, invoiceList, eventList, paymentList] = await Promise.all([
        listPartners(profile.uid),
        listInvoices(profile.uid),
        listInvoiceEvents(profile.uid),
        listPartnerCommissionPayments(profile.uid),
      ])
      setPartners(partnerList)
      setInvoices(invoiceList)
      setEvents(eventList)
      setPayments(paymentList)
    } catch (error) {
      console.error('Failed to load partner report', error)
      setErrorMessage('Laporan partner belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const partnerInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.leadSourceType === 'PARTNER' && invoice.partnerId),
    [invoices],
  )
  const eventByInvoiceId = useMemo(
    () => new Map(events.map((event) => [event.invoiceId, event])),
    [events],
  )

  const summaries = useMemo(() => {
    const partnerMap = new Map(partners.map((partner) => [partner.id, partner]))
    for (const invoice of partnerInvoices) {
      if (invoice.partnerId && !partnerMap.has(invoice.partnerId)) {
        partnerMap.set(invoice.partnerId, getPartnerFallback(invoice.partnerId, partnerInvoices))
      }
    }

    return Array.from(partnerMap.values())
      .map<PartnerSummary>((partner) => {
        const partnerJobs = partnerInvoices.filter((invoice) => invoice.partnerId === partner.id)
        const totalInvoice = partnerJobs.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
        const totalCommission = partnerJobs.reduce((sum, invoice) => sum + invoice.partnerCommissionAmount, 0)
        const totalPaid = partnerJobs.reduce((sum, invoice) => sum + invoice.partnerCommissionPaid, 0)

        return {
          partner,
          invoices: partnerJobs,
          jobCount: partnerJobs.length,
          totalInvoice,
          totalCommission,
          totalPaid,
          totalUnpaid: Math.max(totalCommission - totalPaid, 0),
        }
      })
      .filter((summary) => summary.jobCount > 0 || partners.some((partner) => partner.id === summary.partner.id))
      .sort((a, b) => b.jobCount - a.jobCount || a.partner.name.localeCompare(b.partner.name))
  }, [partnerInvoices, partners])

  const totals = useMemo(() => {
    const directJobs = invoices.filter((invoice) => invoice.leadSourceType !== 'PARTNER').length
    const partnerJobs = partnerInvoices.length
    const totalCommission = partnerInvoices.reduce((sum, invoice) => sum + invoice.partnerCommissionAmount, 0)
    const totalPaid = partnerInvoices.reduce((sum, invoice) => sum + invoice.partnerCommissionPaid, 0)
    const topPartner = summaries.find((summary) => summary.jobCount > 0)

    return {
      directJobs,
      partnerJobs,
      totalCommission,
      totalPaid,
      totalUnpaid: Math.max(totalCommission - totalPaid, 0),
      topPartnerName: topPartner ? `${topPartner.partner.name} (${topPartner.jobCount} job)` : '-',
    }
  }, [invoices, partnerInvoices, summaries])

  async function handlePayCommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.uid || !payingInvoiceId) return

    const invoice = partnerInvoices.find((item) => item.id === payingInvoiceId)
    if (!invoice?.partnerId) return

    setIsSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      await createPartnerCommissionPayment(profile.uid, {
        partnerId: invoice.partnerId,
        invoiceId: invoice.id,
        amount: parseCurrencyInput(paymentInput.amount),
        paymentDate: paymentInput.paymentDate,
        paymentMethod: paymentInput.paymentMethod,
        notes: paymentInput.notes,
      })
      setPayingInvoiceId('')
      setPaymentInput(emptyPaymentInput)
      await loadReport()
      setMessage('Pembayaran komisi berhasil dicatat.')
    } catch (error) {
      console.error('Failed to save partner commission payment', error)
      const code = error instanceof Error ? error.message : ''
      setErrorMessage(code === 'PARTNER_COMMISSION_ALREADY_PAID'
        ? 'Komisi invoice ini sudah lunas.'
        : 'Pembayaran komisi belum bisa disimpan. Pastikan nominal dan tanggal sudah benar.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Laporan Partner" description="Pantau sumber job, nilai invoice, komisi, hutang, dan pembayaran partner." />

      {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Klien Langsung" value={isLoading ? '...' : String(totals.directJobs)} helper="Job tanpa partner" />
        <StatCard label="Job Partner" value={isLoading ? '...' : String(totals.partnerJobs)} helper="Invoice dari partner" />
        <StatCard label="Komisi Total" value={isLoading ? '...' : formatCurrency(totals.totalCommission)} helper="Hutang komisi partner" />
        <StatCard label="Sudah Dibayar" value={isLoading ? '...' : formatCurrency(totals.totalPaid)} helper={`Sisa ${formatCurrency(totals.totalUnpaid)}`} />
        <StatCard label="Partner Teratas" value={isLoading ? '...' : totals.topPartnerName} helper="Berdasarkan jumlah job" />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={16} />
            Memuat laporan partner...
          </CardContent>
        </Card>
      ) : summaries.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">
            Belum ada data partner. Tambahkan partner, lalu pilih Sumber Job Partner saat membuat invoice.
          </CardContent>
        </Card>
      ) : (
        summaries.map((summary) => (
          <Card key={summary.partner.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold">{summary.partner.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{partnerCategoryLabels[summary.partner.category]}</p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-4 lg:min-w-[620px]">
                  <div className="rounded-md bg-app-muted p-3">
                    <p className="text-xs text-neutral-500">Job</p>
                    <p className="font-bold">{summary.jobCount}</p>
                  </div>
                  <div className="rounded-md bg-app-muted p-3">
                    <p className="text-xs text-neutral-500">Total Invoice</p>
                    <p className="font-bold">{formatCurrency(summary.totalInvoice)}</p>
                  </div>
                  <div className="rounded-md bg-app-muted p-3">
                    <p className="text-xs text-neutral-500">Komisi</p>
                    <p className="font-bold">{formatCurrency(summary.totalCommission)}</p>
                  </div>
                  <div className="rounded-md bg-app-muted p-3">
                    <p className="text-xs text-neutral-500">Belum Dibayar</p>
                    <p className="font-bold">{formatCurrency(summary.totalUnpaid)}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {summary.invoices.length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada job dari partner ini.</p>
              ) : (
                summary.invoices.map((invoice) => {
                  const remainingCommission = Math.max(invoice.partnerCommissionAmount - invoice.partnerCommissionPaid, 0)
                  const invoicePayments = payments.filter((payment) => payment.invoiceId === invoice.id)

                  return (
                    <div className="rounded-md border border-app-border p-4" key={invoice.id}>
                      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-bold">{invoice.clientName || 'Klien tanpa nama'}</p>
                              <p className="text-xs text-neutral-500">{invoice.invoiceNumber} - {formatDisplayDate(invoice.eventDate)}</p>
                            </div>
                            <span className="w-fit rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                              {partnerCommissionStatusLabels[invoice.partnerCommissionStatus]}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <p className="text-xs text-neutral-500">Nama CPP / CPW</p>
                              <p className="font-semibold">{getEventPeople(invoice, eventByInvoiceId.get(invoice.id))}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500">Paket</p>
                              <p className="font-semibold">{getPackageSummary(invoice)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500">Nilai Invoice</p>
                              <p className="font-semibold">{formatCurrency(invoice.totalAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500">Komisi / Sisa</p>
                              <p className="font-semibold">{formatCurrency(invoice.partnerCommissionAmount)} / {formatCurrency(remainingCommission)}</p>
                            </div>
                          </div>
                          {invoicePayments.length > 0 ? (
                            <div className="mt-3 rounded-md bg-app-muted p-3 text-xs text-neutral-600">
                              {invoicePayments.map((payment) => (
                                <p key={payment.id}>
                                  {formatDisplayDate(payment.paymentDate)} - {formatCurrency(payment.amount)} - {paymentMethodLabels[payment.paymentMethod]}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex xl:justify-end">
                          <Button
                            disabled={remainingCommission <= 0}
                            onClick={() => {
                              setPayingInvoiceId(invoice.id)
                              setPaymentInput({ ...emptyPaymentInput, amount: String(remainingCommission) })
                            }}
                            type="button"
                            variant="secondary"
                          >
                            Bayar Komisi
                          </Button>
                        </div>
                      </div>

                      {payingInvoiceId === invoice.id ? (
                        <form className="mt-4 grid gap-3 rounded-md border border-app-border bg-app-muted p-4 md:grid-cols-2" onSubmit={handlePayCommission}>
                          <Input
                            inputMode="numeric"
                            label="Nominal"
                            value={paymentInput.amount}
                            onChange={(event) => setPaymentInput((current) => ({ ...current, amount: event.target.value }))}
                          />
                          <Input
                            label="Tanggal Bayar"
                            type="date"
                            value={paymentInput.paymentDate}
                            onChange={(event) => setPaymentInput((current) => ({ ...current, paymentDate: event.target.value }))}
                          />
                          <label className="grid gap-2 text-sm font-medium text-app-text">
                            Metode Pembayaran
                            <select
                              className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                              value={paymentInput.paymentMethod}
                              onChange={(event) => setPaymentInput((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))}
                            >
                              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <Input
                            label="Catatan"
                            value={paymentInput.notes}
                            onChange={(event) => setPaymentInput((current) => ({ ...current, notes: event.target.value }))}
                          />
                          <div className="flex flex-col-reverse gap-2 md:col-span-2 sm:flex-row sm:justify-end">
                            <Button icon={<X size={16} />} onClick={() => setPayingInvoiceId('')} type="button" variant="secondary">
                              Batal
                            </Button>
                            <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}>
                              Simpan Pembayaran
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
