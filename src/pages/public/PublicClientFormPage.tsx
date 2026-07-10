import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, MapPin } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { eventFieldDefinitions, eventTypeLabels } from '../../lib/events/eventDetails'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { getInvoiceEventBySlug, submitPublicInvoiceEvent } from '../../services/firestore/invoiceEvents'
import { getPublicInvoiceById } from '../../services/firestore/invoices'
import type { EventLocationDetail, InvoiceEventDetail, InvoiceRecord } from '../../types/domain'

export function PublicClientFormPage() {
  const { slug } = useParams()
  const [eventDetail, setEventDetail] = useState<InvoiceEventDetail | null>(null)
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null)
  const [details, setDetails] = useState<Record<string, string>>({})
  const [location, setLocation] = useState<EventLocationDetail>({
    venueName: '',
    address: '',
    googleMapsUrl: '',
    latitude: null,
    longitude: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const fields = useMemo(() => eventDetail ? eventFieldDefinitions[eventDetail.eventType] : [], [eventDetail])

  useEffect(() => {
    async function loadForm() {
      if (!slug) return

      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedEvent = await getInvoiceEventBySlug(slug)
        const loadedInvoice = loadedEvent ? await getPublicInvoiceById(loadedEvent.invoiceId) : null
        setEventDetail(loadedEvent)
        setInvoice(loadedInvoice)
        setDetails(loadedEvent?.details ?? {})
        setLocation(loadedEvent?.location ?? {
          venueName: '',
          address: '',
          googleMapsUrl: '',
          latitude: null,
          longitude: null,
        })
        document.title = loadedEvent ? `Form Detail Acara - ${eventTypeLabels[loadedEvent.eventType]}` : 'Form Klien'
        if (!loadedEvent) setErrorMessage('Form klien tidak ditemukan atau sudah tidak aktif.')
      } catch (error) {
        console.error('Failed to load public client form', error)
        setErrorMessage('Form klien belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadForm()
  }, [slug])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slug || !eventDetail) return

    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      await submitPublicInvoiceEvent(slug, {
        eventType: eventDetail.eventType,
        details,
        location,
      })
      setSuccessMessage('Detail acara berhasil dikirim. Terima kasih.')
    } catch (error) {
      console.error('Failed to submit public client form', error)
      setErrorMessage('Detail acara belum bisa dikirim. Periksa data lalu coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-3xl gap-5 bg-app-muted px-4 py-6 sm:px-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-gold">Invoice Vendor</p>
        <h1 className="mt-2 text-2xl font-bold text-app-text">Form Detail Acara</h1>
        {eventDetail ? <p className="mt-1 text-sm text-neutral-600">{eventTypeLabels[eventDetail.eventType]}</p> : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={16} />
            Memuat form...
          </CardContent>
        </Card>
      ) : errorMessage && !eventDetail ? (
        <Card>
          <CardContent className="text-sm text-red-600">{errorMessage}</CardContent>
        </Card>
      ) : eventDetail ? (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          {successMessage ? (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 size={16} />
              {successMessage}
            </div>
          ) : null}
          {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

          {invoice ? (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Ringkasan Booking</h2>
                <p className="mt-1 text-sm text-neutral-500">Data ini hanya untuk informasi dan tidak bisa diubah dari form klien.</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 rounded-md bg-app-muted p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-neutral-500">Nama Klien</p>
                    <p className="mt-1 font-bold">{invoice.clientName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Tanggal Acara</p>
                    <p className="mt-1 font-bold">{formatDisplayDate(invoice.eventDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">WhatsApp</p>
                    <p className="mt-1 font-bold">{invoice.clientWhatsappNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Alamat Klien</p>
                    <p className="mt-1 whitespace-pre-wrap font-bold">{invoice.clientAddress || '-'}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead className="bg-app-muted text-left text-xs uppercase text-neutral-500">
                      <tr>
                        <th className="border border-app-border px-3 py-2">Paket</th>
                        <th className="border border-app-border px-3 py-2">Kategori</th>
                        <th className="border border-app-border px-3 py-2 text-right">Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-app-border px-3 py-2 font-semibold">{item.packageName}</td>
                          <td className="border border-app-border px-3 py-2">{item.categoryName}</td>
                          <td className="border border-app-border px-3 py-2 text-right">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 rounded-md bg-app-muted p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-neutral-500">Total Paket</p>
                    <p className="mt-1 font-bold">{formatCurrency(invoice.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">DP / Terbayar</p>
                    <p className="mt-1 font-bold">{formatCurrency(invoice.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Sisa Pembayaran</p>
                    <p className="mt-1 font-bold">{formatCurrency(invoice.remainingAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Data Acara</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => field.type === 'textarea' ? (
                <label className="grid gap-2 text-sm font-medium text-app-text sm:col-span-2" key={field.key}>
                  {field.label}
                  <textarea
                    className="min-h-28 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                    value={details[field.key] ?? ''}
                    onChange={(inputEvent) => setDetails((current) => ({ ...current, [field.key]: inputEvent.target.value }))}
                  />
                </label>
              ) : (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.type ?? 'text'}
                  value={details[field.key] ?? ''}
                  onChange={(inputEvent) => setDetails((current) => ({ ...current, [field.key]: inputEvent.target.value }))}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold"><MapPin size={18} /> Lokasi Acara</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input label="Nama Lokasi / Gedung" value={location.venueName} onChange={(event) => setLocation((current) => ({ ...current, venueName: event.target.value }))} />
              <Input label="Link Google Maps" value={location.googleMapsUrl} onChange={(event) => setLocation((current) => ({ ...current, googleMapsUrl: event.target.value }))} />
              <label className="grid gap-2 text-sm font-medium text-app-text sm:col-span-2">
                Alamat Lengkap
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                  placeholder="Tulis alamat lengkap seperti di aplikasi ojek online."
                  value={location.address}
                  onChange={(event) => setLocation((current) => ({ ...current, address: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-app-text sm:col-span-2">
                Patokan Alamat
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                  placeholder="Contoh: dekat Gedung A, sebelah Indomaret, pagar hitam, masuk gang pertama."
                  value={details.locationLandmark ?? ''}
                  onChange={(event) => setDetails((current) => ({ ...current, locationLandmark: event.target.value }))}
                />
              </label>
            </CardContent>
          </Card>

          <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : undefined}>
            {isSaving ? 'Mengirim...' : 'Kirim Detail Acara'}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
