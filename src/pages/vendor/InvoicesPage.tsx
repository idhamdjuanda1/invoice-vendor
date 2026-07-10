import { useCallback, useEffect, useState } from 'react'
import { Edit3, Eye, Loader2, Plus, Printer, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { WhatsAppReminderButton } from '../../components/invoice/WhatsAppReminderButton'
import { useAuth } from '../../features/auth/useAuth'
import { eventStatusLabels, eventStatusStyles, eventTypeLabels } from '../../lib/events/eventDetails'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { paymentStatusLabels } from '../../lib/formatters/invoice'
import { listInvoices, softDeleteInvoice } from '../../services/firestore/invoices'
import type { InvoiceRecord } from '../../types/domain'

export function InvoicesPage() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadInvoices = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      setInvoices(await listInvoices(profile.uid))
    } catch (error) {
      console.error('Failed to load invoices', error)
      setErrorMessage('Daftar invoice belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  async function handleDelete(invoiceId: string) {
    if (!profile?.uid) return
    const confirmed = window.confirm('Hapus invoice ini dari daftar?')
    if (!confirmed) return

    setIsDeleting(invoiceId)
    setErrorMessage('')

    try {
      await softDeleteInvoice(profile.uid, invoiceId)
      await loadInvoices()
    } catch (error) {
      console.error('Failed to delete invoice', error)
      setErrorMessage('Invoice belum bisa dihapus.')
    } finally {
      setIsDeleting('')
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Invoice"
        description="Kelola invoice multi-acara, status pembayaran realtime, PDF, link publik, dan tombol WhatsApp."
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat invoice...
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">Belum ada invoice. Buat invoice pertama dari tombol di atas.</div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              {invoices.map((invoice) => (
                <div className="rounded-md border border-app-border bg-white p-4" key={invoice.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-base font-semibold">{invoice.clientName || 'Klien tanpa nama'}</p>
                      <p className="mt-1 text-sm text-neutral-500">{formatDisplayDate(invoice.eventDate)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                      {paymentStatusLabels[invoice.paymentStatus]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-app-muted px-3 py-1 text-xs font-semibold text-neutral-600">
                      {eventTypeLabels[invoice.eventType]}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${eventStatusStyles[invoice.eventDataStatus]}`}>
                      {eventStatusLabels[invoice.eventDataStatus]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-app-muted p-3 text-sm">
                    <div>
                      <p className="text-xs text-neutral-500">Total</p>
                      <p className="mt-1 font-bold">{formatCurrency(invoice.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Terbayar</p>
                      <p className="mt-1 font-bold">{formatCurrency(invoice.totalPaid)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/invoices/${invoice.id}`}>
                      <Button variant="secondary" icon={<Eye size={15} />} className="w-full">
                        Detail
                      </Button>
                    </Link>
                    <Link to={`/invoices/${invoice.id}/edit`}>
                      <Button variant="secondary" icon={<Edit3 size={15} />} className="w-full">
                        Edit
                      </Button>
                    </Link>
                    <Link to={`/invoices/${invoice.id}`} className="col-span-1">
                      <Button variant="secondary" icon={<Printer size={15} />} className="w-full">
                        Cetak
                      </Button>
                    </Link>
                    <Button
                      variant="danger"
                      icon={isDeleting === invoice.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                      className="w-full"
                      onClick={() => handleDelete(invoice.id)}
                      disabled={Boolean(isDeleting)}
                    >
                      Hapus
                    </Button>
                    {invoice.remainingAmount > 0 ? (
                      <div className="col-span-2">
                        <WhatsAppReminderButton className="w-full" invoice={invoice} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-app-border bg-app-muted text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-3">Nomor Invoice</th>
                    <th className="px-5 py-3">Klien</th>
                    <th className="px-5 py-3">Tanggal Acara</th>
                    <th className="px-5 py-3">Jenis</th>
                    <th className="px-5 py-3">Data Acara</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Terbayar</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr className="border-b border-app-border last:border-b-0" key={invoice.id}>
                      <td className="px-5 py-4 font-semibold">{invoice.invoiceNumber}</td>
                      <td className="px-5 py-4">{invoice.clientName || 'Klien tanpa nama'}</td>
                      <td className="px-5 py-4">{formatDisplayDate(invoice.eventDate)}</td>
                      <td className="px-5 py-4">{eventTypeLabels[invoice.eventType]}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${eventStatusStyles[invoice.eventDataStatus]}`}>
                          {eventStatusLabels[invoice.eventDataStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-4">{formatCurrency(invoice.totalAmount)}</td>
                      <td className="px-5 py-4">{formatCurrency(invoice.totalPaid)}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                          {paymentStatusLabels[invoice.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/invoices/${invoice.id}`}>
                            <Button variant="secondary" icon={<Eye size={15} />} className="px-3">
                              Detail
                            </Button>
                          </Link>
                          <Link to={`/invoices/${invoice.id}/edit`}>
                            <Button variant="secondary" icon={<Edit3 size={15} />} className="px-3">
                              Edit
                            </Button>
                          </Link>
                          <Link to={`/invoices/${invoice.id}`}>
                            <Button variant="secondary" icon={<Printer size={15} />} className="px-3">
                              Cetak
                            </Button>
                          </Link>
                          {invoice.remainingAmount > 0 ? <WhatsAppReminderButton className="px-3" invoice={invoice} /> : null}
                          <Button
                            variant="danger"
                            icon={isDeleting === invoice.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                            className="px-3"
                            onClick={() => handleDelete(invoice.id)}
                            disabled={Boolean(isDeleting)}
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
