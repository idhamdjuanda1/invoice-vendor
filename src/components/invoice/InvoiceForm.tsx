import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters/currency'
import { paymentMethodLabels, paymentStatusLabels } from '../../lib/formatters/invoice'
import { toInputDate } from '../../lib/formatters/date'
import { listClients, type ClientInput } from '../../services/firestore/clients'
import { createInvoice, updateInvoice, type InvoiceMutationInput } from '../../services/firestore/invoices'
import { listServicePackages } from '../../services/firestore/packages'
import type { ClientRecord, InvoiceRecord, PaymentMethod, PaymentStatus, ServicePackage } from '../../types/domain'

type InvoiceFormProps = {
  invoice?: InvoiceRecord
  mode: 'create' | 'edit'
}

const defaultPaymentMethod: PaymentMethod = 'TRANSFER_BANK'
const emptyClientInput: ClientInput = {
  name: '',
  whatsappNumber: '',
  email: '',
  address: '',
}

function clientRecordToInput(client: ClientRecord): ClientInput {
  return {
    name: client.name,
    whatsappNumber: client.whatsappNumber ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
  }
}

function invoiceClientToInput(invoice?: InvoiceRecord): ClientInput {
  return {
    name: invoice?.clientName ?? '',
    whatsappNumber: invoice?.clientWhatsappNumber ?? '',
    email: invoice?.clientEmail ?? '',
    address: invoice?.clientAddress ?? '',
  }
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  const messages: Record<string, string> = {
    CLIENT_NAME_REQUIRED: 'Nama klien wajib diisi.',
    INVOICE_CLIENT_REQUIRED: 'Pilih klien yang sudah tersimpan atau buat klien baru.',
    INVOICE_PACKAGES_REQUIRED: 'Pilih minimal satu paket.',
    INVOICE_EVENT_DATE_REQUIRED: 'Tanggal acara wajib diisi.',
    INVOICE_EVENT_LOCATION_REQUIRED: 'Lokasi acara wajib diisi.',
    INVOICE_NOT_FOUND: 'Invoice tidak ditemukan.',
  }

  return messages[message] ?? 'Invoice belum bisa disimpan. Periksa data lalu coba lagi.'
}

export function InvoiceForm({ invoice, mode }: InvoiceFormProps) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(invoice ? 'existing' : 'existing')
  const [clientId, setClientId] = useState(invoice?.clientId ?? '')
  const [existingClient, setExistingClient] = useState<ClientInput>(invoiceClientToInput(invoice))
  const [newClient, setNewClient] = useState<ClientInput>(emptyClientInput)
  const [eventDate, setEventDate] = useState(toInputDate(invoice?.eventDate))
  const [eventLocation, setEventLocation] = useState(invoice?.eventLocation ?? '')
  const [additionalNote, setAdditionalNote] = useState(invoice?.additionalNote ?? '')
  const [selectedPackageIds, setSelectedPackageIds] = useState(invoice?.items.map((item) => item.packageId) ?? [])
  const [paymentAmountInput, setPaymentAmountInput] = useState(
    invoice?.totalPaid ? String(invoice.totalPaid) : '',
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(invoice?.paymentMethod ?? defaultPaymentMethod)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!profile?.uid) return

      setIsLoading(true)
      setErrorMessage('')

      try {
        const [clientList, packageList] = await Promise.all([
          listClients(profile.uid),
          listServicePackages(profile.uid),
        ])
        setClients(clientList)
        setPackages(packageList.filter((servicePackage) => servicePackage.isActive))

        if (!invoice && clientList.length === 0) {
          setClientMode('new')
        }
      } catch (error) {
        console.error('Failed to load invoice form data', error)
        setErrorMessage('Data klien atau paket belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [invoice, profile?.uid])

  useEffect(() => {
    if (clientMode !== 'existing') return

    const selectedClient = clients.find((client) => client.id === clientId)
    if (selectedClient) {
      setExistingClient(clientRecordToInput(selectedClient))
      return
    }

    if (invoice?.clientId === clientId) {
      setExistingClient(invoiceClientToInput(invoice))
      return
    }

    setExistingClient(emptyClientInput)
  }, [clientId, clientMode, clients, invoice])

  const selectedPackages = useMemo(
    () => packages.filter((servicePackage) => selectedPackageIds.includes(servicePackage.id)),
    [packages, selectedPackageIds],
  )
  const totalAmount = selectedPackages.reduce((sum, servicePackage) => sum + servicePackage.price, 0)
  const paymentAmount = Math.min(parseCurrencyInput(paymentAmountInput), totalAmount)
  const remainingAmount = Math.max(totalAmount - paymentAmount, 0)
  const paymentStatus: PaymentStatus =
    paymentAmount <= 0 ? 'BELUM_BAYAR' : paymentAmount >= totalAmount ? 'LUNAS' : 'DP'

  function togglePackage(packageId: string) {
    setSelectedPackageIds((current) =>
      current.includes(packageId) ? current.filter((id) => id !== packageId) : [...current, packageId],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.uid) return

    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    const payload: InvoiceMutationInput = {
      clientMode,
      clientId,
      existingClient,
      newClient,
      eventDate,
      eventLocation,
      additionalNote,
      packageIds: selectedPackageIds,
      paymentAmount,
      paymentMethod,
    }

    try {
      if (mode === 'create') {
        await createInvoice(profile.uid, payload, { clients, packages })
        setSuccessMessage('Invoice berhasil dibuat.')
        navigate('/invoices')
      } else if (invoice) {
        await updateInvoice(profile.uid, invoice.id, payload, { clients, packages })
        setSuccessMessage('Invoice berhasil diperbarui.')
        navigate(`/invoices/${invoice.id}`)
      }
    } catch (error) {
      console.error('Failed to save invoice', error)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {successMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Data Klien</h2>
          <p className="mt-1 text-sm text-neutral-500">Pilih klien tersimpan atau tambahkan klien baru.</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={clientMode === 'existing' ? 'primary' : 'secondary'}
              onClick={() => setClientMode('existing')}
              disabled={clients.length === 0}
            >
              Klien tersimpan
            </Button>
            <Button
              type="button"
              variant={clientMode === 'new' ? 'primary' : 'secondary'}
              onClick={() => setClientMode('new')}
            >
              Klien baru
            </Button>
          </div>

          {clientMode === 'existing' ? (
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-app-text">
                Nama Klien
                <select
                  className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  disabled={isLoading}
                >
                  <option value="">Pilih klien</option>
                  {invoice?.clientId && !clients.some((client) => client.id === invoice.clientId) ? (
                    <option value={invoice.clientId}>{invoice.clientName || 'Klien invoice ini'}</option>
                  ) : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              {clientId ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Nama Klien"
                    value={existingClient.name}
                    onChange={(event) =>
                      setExistingClient((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  <Input
                    label="Nomor WhatsApp"
                    value={existingClient.whatsappNumber}
                    onChange={(event) =>
                      setExistingClient((current) => ({ ...current, whatsappNumber: event.target.value }))
                    }
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={existingClient.email}
                    onChange={(event) =>
                      setExistingClient((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                  <Input
                    label="Alamat"
                    value={existingClient.address}
                    onChange={(event) =>
                      setExistingClient((current) => ({ ...current, address: event.target.value }))
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nama Klien"
                value={newClient.name}
                onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                label="Nomor WhatsApp"
                value={newClient.whatsappNumber}
                onChange={(event) =>
                  setNewClient((current) => ({ ...current, whatsappNumber: event.target.value }))
                }
              />
              <Input
                label="Email"
                type="email"
                value={newClient.email}
                onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))}
              />
              <Input
                label="Alamat"
                value={newClient.address}
                onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Data Acara</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input label="Tanggal Acara" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
          <Input label="Lokasi Acara" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
          <label className="grid gap-2 text-sm font-medium text-app-text md:col-span-2">
            Catatan Tambahan
            <textarea
              className="min-h-32 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-28 sm:text-sm"
              value={additionalNote}
              onChange={(event) => setAdditionalNote(event.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Paket</h2>
          <p className="mt-1 text-sm text-neutral-500">Pilih satu atau beberapa paket yang sudah dibuat.</p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat paket...
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-md border border-dashed border-app-border bg-app-muted p-4 text-sm text-neutral-500">
              Belum ada paket aktif. Buat paket terlebih dahulu sebelum membuat invoice.
            </div>
          ) : (
            packages.map((servicePackage) => (
              <label
                className="flex flex-col gap-3 rounded-md border border-app-border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                key={servicePackage.id}
              >
                <span className="flex items-start gap-3">
                  <input
                    className="mt-1 size-4 accent-app-gold"
                    type="checkbox"
                    checked={selectedPackageIds.includes(servicePackage.id)}
                    onChange={() => togglePackage(servicePackage.id)}
                  />
                  <span>
                    <span className="block font-semibold">{servicePackage.name}</span>
                    <span className="text-xs text-neutral-500">{servicePackage.categoryName}</span>
                  </span>
                </span>
                <span className="font-semibold">{formatCurrency(servicePackage.price)}</span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Pembayaran</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input
            label="Nominal DP atau Cicilan"
            inputMode="numeric"
            value={paymentAmountInput}
            onChange={(event) => setPaymentAmountInput(event.target.value)}
            hint="Kosongkan jika belum ada pembayaran."
          />
          <label className="grid gap-2 text-sm font-medium text-app-text">
            Metode Pembayaran
              <select
              className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            >
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md bg-app-muted p-4">
            <p className="text-xs text-neutral-500">Total Tagihan</p>
            <p className="mt-1 text-lg font-bold">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="rounded-md bg-app-muted p-4">
            <p className="text-xs text-neutral-500">Sisa Pembayaran</p>
            <p className="mt-1 text-lg font-bold">{formatCurrency(remainingAmount)}</p>
          </div>
          <div className="rounded-md border border-app-border p-4 md:col-span-2">
            <p className="text-xs text-neutral-500">Status Pembayaran</p>
            <p className="mt-1 font-semibold">{paymentStatusLabels[paymentStatus]}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => navigate('/invoices')} className="w-full sm:w-auto">
          Batal
        </Button>
        <Button type="submit" disabled={isSaving || isLoading} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} className="w-full sm:w-auto">
          {isSaving ? 'Menyimpan...' : mode === 'create' ? 'Buat Invoice' : 'Simpan Perubahan'}
        </Button>
      </div>
    </form>
  )
}
