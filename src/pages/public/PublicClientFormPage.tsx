import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, MapPin } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { eventFieldDefinitions, eventTypeLabels } from '../../lib/events/eventDetails'
import { getInvoiceEventBySlug, submitPublicInvoiceEvent } from '../../services/firestore/invoiceEvents'
import type { EventLocationDetail, InvoiceEventDetail } from '../../types/domain'

export function PublicClientFormPage() {
  const { slug } = useParams()
  const [eventDetail, setEventDetail] = useState<InvoiceEventDetail | null>(null)
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
        setEventDetail(loadedEvent)
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
                  value={location.address}
                  onChange={(event) => setLocation((current) => ({ ...current, address: event.target.value }))}
                />
              </label>
              <Input label="Latitude" inputMode="decimal" value={location.latitude ?? ''} onChange={(event) => setLocation((current) => ({ ...current, latitude: event.target.value ? Number(event.target.value) : null }))} />
              <Input label="Longitude" inputMode="decimal" value={location.longitude ?? ''} onChange={(event) => setLocation((current) => ({ ...current, longitude: event.target.value ? Number(event.target.value) : null }))} />
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
