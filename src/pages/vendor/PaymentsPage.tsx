import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit3, Eye, FileText, Loader2, Plus } from 'lucide-react'
import { PaymentManager } from '../../components/invoice/PaymentManager'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { paymentStatusLabels } from '../../lib/formatters/invoice'
import { getInvoice, listInvoices } from '../../services/firestore/invoices'
import type { InvoiceRecord } from '../../types/domain'

export function PaymentsPage() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const openInvoices = useMemo(
    () =>
      invoices.filter((invoice) => invoice.paymentStatus !== 'LUNAS').length > 0
        ? invoices.filter((invoice) => invoice.paymentStatus !== 'LUNAS')
        : invoices,
    [invoices],
  )

  const loadInvoices = useCallback(async (preferredInvoiceId = '') => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const invoiceList = await listInvoices(profile.uid)
      setInvoices(invoiceList)

      const nextSelectedId = preferredInvoiceId || invoiceList[0]?.id || ''
      setSelectedInvoiceId(nextSelectedId)

      if (nextSelectedId) {
        const invoice = await getInvoice(profile.uid, nextSelectedId)
        setSelectedInvoice(invoice)
      } else {
        setSelectedInvoice(null)
      }
    } catch (error) {
      console.error('Failed to load payment invoices', error)
      setErrorMessage('Data invoice untuk pembayaran belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  async function handleSelectInvoice(invoiceId: string) {
    if (!profile?.uid) return

    setSelectedInvoiceId(invoiceId)
    setErrorMessage('')

    try {
      setSelectedInvoice(await getInvoice(profile.uid, invoiceId))
    } catch (error) {
      console.error('Failed to load selected invoice', error)
      setErrorMessage('Invoice terpilih belum bisa dimuat.')
    }
  }

  async function refreshSelectedInvoice() {
    await loadInvoices(selectedInvoiceId)
  }

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pembayaran"
        description="Catat DP, cicilan, pelunasan, metode pembayaran, dan keterangan pembayaran."
        actions={
          <Link to="/invoices/new">
            <Button icon={<Plus size={16} />}>Buat invoice</Button>
          </Link>
        }
      />

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Pilih Invoice</h2>
          <p className="mt-1 text-sm text-neutral-500">Pembayaran selalu terhubung ke satu invoice.</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat invoice...
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-md border border-dashed border-app-border bg-app-muted p-5 text-sm text-neutral-500">
              Belum ada invoice. Buat invoice terlebih dahulu untuk mencatat pembayaran.
            </div>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-medium text-app-text">
                Invoice
                <select
                  className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                  value={selectedInvoiceId}
                  onChange={(event) => void handleSelectInvoice(event.target.value)}
                >
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {invoice.clientName || 'Klien tanpa nama'} - {paymentStatusLabels[invoice.paymentStatus]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {openInvoices.slice(0, 6).map((invoice) => (
                  <button
                    className={`rounded-md border p-4 text-left transition hover:border-app-gold ${
                      selectedInvoiceId === invoice.id ? 'border-app-gold bg-app-gold-soft' : 'border-app-border bg-white'
                    }`}
                    key={invoice.id}
                    onClick={() => void handleSelectInvoice(invoice.id)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <FileText size={16} />
                      {invoice.invoiceNumber}
                    </span>
                    <span className="mt-2 block text-sm text-neutral-600">{invoice.clientName || 'Klien tanpa nama'}</span>
                    <span className="mt-1 block text-xs text-neutral-500">{formatDisplayDate(invoice.eventDate)}</span>
                    <span className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span>{paymentStatusLabels[invoice.paymentStatus]}</span>
                      <strong>{formatCurrency(invoice.remainingAmount)}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedInvoice ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link to={`/invoices/${selectedInvoice.id}`}>
              <Button variant="secondary" icon={<Eye size={16} />}>
                Detail Invoice
              </Button>
            </Link>
            <Link to={`/invoices/${selectedInvoice.id}/edit`}>
              <Button variant="secondary" icon={<Edit3 size={16} />}>
                Edit Invoice
              </Button>
            </Link>
          </div>
          <PaymentManager invoice={selectedInvoice} onChanged={refreshSelectedInvoice} />
        </>
      ) : null}
    </div>
  )
}
