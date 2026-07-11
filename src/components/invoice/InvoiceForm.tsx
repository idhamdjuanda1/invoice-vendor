import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import { eventTypeLabels } from '../../lib/events/eventDetails'
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters/currency'
import { paymentMethodLabels, paymentStatusLabels } from '../../lib/formatters/invoice'
import { toInputDate } from '../../lib/formatters/date'
import { listClients, type ClientInput } from '../../services/firestore/clients'
import { createInvoice, updateInvoice, type InvoiceMutationInput } from '../../services/firestore/invoices'
import { listServicePackages } from '../../services/firestore/packages'
import { listPricelists } from '../../services/firestore/pricelists'
import { calculateCommission, listPartners, partnerCategoryLabels } from '../../services/firestore/partners'
import type {
  ClientRecord,
  DiscountType,
  EventType,
  InvoiceRecord,
  LeadSourceType,
  PartnerRecord,
  PaymentMethod,
  PaymentStatus,
  PricelistRecord,
  ServicePackage,
} from '../../types/domain'

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
    INVOICE_PARTNER_REQUIRED: 'Pilih partner untuk sumber job ini.',
    INVOICE_NOT_FOUND: 'Invoice tidak ditemukan.',
  }

  return messages[message] ?? getFriendlyAuthError(error)
}

export function InvoiceForm({ invoice, mode }: InvoiceFormProps) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [pricelists, setPricelists] = useState<PricelistRecord[]>([])
  const [partners, setPartners] = useState<PartnerRecord[]>([])
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(invoice ? 'existing' : 'existing')
  const [clientId, setClientId] = useState(invoice?.clientId ?? '')
  const [existingClient, setExistingClient] = useState<ClientInput>(invoiceClientToInput(invoice))
  const [newClient, setNewClient] = useState<ClientInput>(emptyClientInput)
  const [eventType, setEventType] = useState<EventType>(invoice?.eventType ?? 'WEDDING')
  const [eventDate, setEventDate] = useState(toInputDate(invoice?.eventDate))
  const [eventLocation, setEventLocation] = useState(invoice?.eventLocation ?? '')
  const [additionalNote, setAdditionalNote] = useState(invoice?.additionalNote ?? '')
  const [selectedPackageIds, setSelectedPackageIds] = useState(invoice?.items.map((item) => item.packageId) ?? [])
  const [discountMode, setDiscountMode] = useState<'NONE' | 'PRICELIST' | 'MANUAL'>(
    invoice?.discountType === 'PERCENTAGE'
      ? 'PRICELIST'
      : invoice?.discountType === 'NOMINAL'
        ? 'MANUAL'
        : 'NONE',
  )
  const [discountPricelistId, setDiscountPricelistId] = useState(invoice?.discountSourcePricelistId ?? '')
  const [manualDiscountInput, setManualDiscountInput] = useState(
    invoice?.discountType === 'NOMINAL' && invoice.discountValue > 0 ? String(invoice.discountValue) : '',
  )
  const [paymentAmountInput, setPaymentAmountInput] = useState(
    invoice?.totalPaid ? String(invoice.totalPaid) : '',
  )
  const [leadSourceType, setLeadSourceType] = useState<LeadSourceType>(invoice?.leadSourceType ?? 'DIRECT')
  const [partnerId, setPartnerId] = useState(invoice?.partnerId ?? '')
  const [partnerCommissionMode, setPartnerCommissionMode] = useState<'NONE' | 'PERCENTAGE' | 'NOMINAL'>(
    invoice?.partnerCommissionType === 'PERCENTAGE'
      ? 'PERCENTAGE'
      : invoice?.partnerCommissionType === 'NOMINAL'
        ? 'NOMINAL'
        : 'NONE',
  )
  const [partnerCommissionInput, setPartnerCommissionInput] = useState(
    invoice?.partnerCommissionValue ? String(invoice.partnerCommissionValue) : '',
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
        const [clientList, packageList, pricelistList, partnerList] = await Promise.all([
          listClients(profile.uid),
          listServicePackages(profile.uid),
          listPricelists(profile.uid),
          listPartners(profile.uid, mode === 'edit'),
        ])
        setClients(clientList)
        setPackages(packageList.filter((servicePackage) => servicePackage.isActive))
        setPricelists(pricelistList)
        setPartners(partnerList)

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
  }, [invoice, mode, profile?.uid])

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
  const subtotal = selectedPackages.reduce((sum, servicePackage) => sum + servicePackage.price, 0)
  const discountPricelists = useMemo(
    () =>
      pricelists.filter((pricelist) => {
        const isCurrentInvoiceDiscount = pricelist.id === invoice?.discountSourcePricelistId
        if ((!pricelist.discountIsActive || pricelist.discountPercentage <= 0) && !isCurrentInvoiceDiscount) {
          return false
        }
        if (selectedPackageIds.length === 0 || pricelist.id === discountPricelistId) return true
        return pricelist.items.some((item) => selectedPackageIds.includes(item.packageId))
      }),
    [discountPricelistId, invoice?.discountSourcePricelistId, pricelists, selectedPackageIds],
  )
  const selectedDiscountPricelist = pricelists.find((pricelist) => pricelist.id === discountPricelistId)
  const pricelistDiscountPercentage = selectedDiscountPricelist?.discountPercentage
    ?? (invoice?.discountType === 'PERCENTAGE' ? invoice.discountValue : 0)
  const discountType: DiscountType | null =
    discountMode === 'PRICELIST' ? 'PERCENTAGE' : discountMode === 'MANUAL' ? 'NOMINAL' : null
  const discountValue =
    discountMode === 'PRICELIST' ? pricelistDiscountPercentage : parseCurrencyInput(manualDiscountInput)
  const discountAmount =
    discountType === 'PERCENTAGE'
      ? Math.min(Math.round(subtotal * (Math.min(Math.max(discountValue, 0), 100) / 100)), subtotal)
      : discountType === 'NOMINAL'
        ? Math.min(Math.max(discountValue, 0), subtotal)
        : 0
  const totalAmount = Math.max(subtotal - discountAmount, 0)
  const paymentAmount = Math.min(parseCurrencyInput(paymentAmountInput), totalAmount)
  const partnerCommissionType: DiscountType | null =
    leadSourceType === 'PARTNER' && partnerCommissionMode !== 'NONE' ? partnerCommissionMode : null
  const partnerCommissionValue = partnerCommissionMode === 'NOMINAL'
    ? parseCurrencyInput(partnerCommissionInput)
    : Number(partnerCommissionInput || 0)
  const partnerCommissionAmount = calculateCommission(totalAmount, partnerCommissionType, partnerCommissionValue)
  const remainingAmount = Math.max(totalAmount - paymentAmount, 0)
  const paymentStatus: PaymentStatus =
    paymentAmount <= 0 ? 'BELUM_BAYAR' : paymentAmount >= totalAmount ? 'LUNAS' : 'DP'

  function togglePackage(packageId: string) {
    setSelectedPackageIds((current) =>
      current.includes(packageId) ? current.filter((id) => id !== packageId) : [...current, packageId],
    )
  }

  function usePricelistDiscount() {
    const nextPricelistId = discountPricelistId || discountPricelists[0]?.id || ''
    setDiscountPricelistId(nextPricelistId)
    setDiscountMode('PRICELIST')
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
      eventType,
      eventDate,
      eventLocation,
      additionalNote,
      packageIds: selectedPackageIds,
      discountType,
      discountValue,
      discountLabel:
        discountMode === 'PRICELIST'
          ? selectedDiscountPricelist?.title || invoice?.discountLabel || 'Diskon pricelist'
          : discountMode === 'MANUAL'
            ? 'Potongan harga / negosiasi'
            : '',
      discountSourcePricelistId: discountMode === 'PRICELIST' ? discountPricelistId : '',
      leadSourceType,
      partnerId: leadSourceType === 'PARTNER' ? partnerId : '',
      partnerCommissionType,
      partnerCommissionValue,
      paymentAmount,
      paymentMethod,
    }

    try {
      if (mode === 'create') {
        await createInvoice(profile.uid, payload, { clients, packages, partners })
        setSuccessMessage('Invoice berhasil dibuat.')
        navigate('/invoices')
      } else if (invoice) {
        await updateInvoice(profile.uid, invoice.id, payload, { clients, packages, partners })
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
          <h2 className="text-base font-semibold">Sumber Job & Komisi Partner</h2>
          <p className="mt-1 text-sm text-neutral-500">Catat apakah job berasal dari klien langsung atau partner.</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant={leadSourceType === 'DIRECT' ? 'primary' : 'secondary'} onClick={() => setLeadSourceType('DIRECT')}>
              Klien Langsung
            </Button>
            <Button type="button" variant={leadSourceType === 'PARTNER' ? 'primary' : 'secondary'} onClick={() => setLeadSourceType('PARTNER')}>
              Partner
            </Button>
          </div>

          {leadSourceType === 'PARTNER' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-app-text">
                Partner
                <select
                  className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                  value={partnerId}
                  onChange={(event) => setPartnerId(event.target.value)}
                >
                  <option value="">Pilih partner</option>
                  {invoice?.partnerId && invoice.partnerName && !partners.some((partner) => partner.id === invoice.partnerId) ? (
                    <option value={invoice.partnerId}>{invoice.partnerName}</option>
                  ) : null}
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name} - {partnerCategoryLabels[partner.category]}{partner.isActive ? '' : ' (Nonaktif)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-app-text">
                Tipe Komisi
                <select
                  className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                  value={partnerCommissionMode}
                  onChange={(event) => setPartnerCommissionMode(event.target.value as typeof partnerCommissionMode)}
                >
                  <option value="NONE">Tanpa komisi</option>
                  <option value="PERCENTAGE">Persentase (%)</option>
                  <option value="NOMINAL">Nominal (Rp)</option>
                </select>
              </label>
              {partnerCommissionMode !== 'NONE' ? (
                <Input
                  hint={partnerCommissionMode === 'PERCENTAGE' ? 'Contoh: 10 untuk komisi 10%.' : 'Contoh: 300000 untuk komisi Rp300.000.'}
                  inputMode="numeric"
                  label={partnerCommissionMode === 'PERCENTAGE' ? 'Persentase Komisi' : 'Nominal Komisi'}
                  value={partnerCommissionInput}
                  onChange={(event) => setPartnerCommissionInput(event.target.value)}
                />
              ) : null}
              <div className="rounded-md bg-app-muted p-4">
                <p className="text-xs text-neutral-500">Komisi / Hutang Partner</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(partnerCommissionAmount)}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Data Acara</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-app-text">
            Jenis Acara
            <select
              className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
              value={eventType}
              onChange={(event) => setEventType(event.target.value as EventType)}
            >
              {Object.entries(eventTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Input label="Tanggal Acara" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
          <Input
            hint="Opsional. Detail lokasi lengkap bisa diisi Vendor atau Klien melalui Form Klien."
            label="Lokasi Acara"
            value={eventLocation}
            onChange={(event) => setEventLocation(event.target.value)}
          />
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
          <h2 className="text-base font-semibold">Diskon & Potongan Harga</h2>
          <p className="mt-1 text-sm text-neutral-500">Gunakan promo Pricelist atau masukkan harga negosiasi secara manual.</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              onClick={() => setDiscountMode('NONE')}
              type="button"
              variant={discountMode === 'NONE' ? 'primary' : 'secondary'}
            >
              Tanpa Potongan
            </Button>
            <Button
              disabled={discountPricelists.length === 0}
              onClick={usePricelistDiscount}
              type="button"
              variant={discountMode === 'PRICELIST' ? 'primary' : 'secondary'}
            >
              Diskon Pricelist
            </Button>
            <Button
              onClick={() => setDiscountMode('MANUAL')}
              type="button"
              variant={discountMode === 'MANUAL' ? 'primary' : 'secondary'}
            >
              Potongan Manual
            </Button>
          </div>

          {discountMode === 'PRICELIST' ? (
            <label className="grid gap-2 text-sm font-medium text-app-text">
              Pricelist dengan Diskon
              <select
                className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                onChange={(event) => setDiscountPricelistId(event.target.value)}
                value={discountPricelistId}
              >
                <option value="">Pilih pricelist</option>
                {discountPricelists.map((pricelist) => (
                  <option key={pricelist.id} value={pricelist.id}>
                    {pricelist.title} - {pricelist.discountPercentage}%
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {discountMode === 'MANUAL' ? (
            <Input
              hint="Masukkan nominal potongan hasil negosiasi dengan klien."
              inputMode="numeric"
              label="Potongan Harga"
              onChange={(event) => setManualDiscountInput(event.target.value)}
              placeholder="Contoh: 300000"
              value={manualDiscountInput}
            />
          ) : null}

          {discountPricelists.length === 0 && discountMode !== 'MANUAL' ? (
            <p className="text-sm text-neutral-500">
              Belum ada Pricelist dengan opsi Menggunakan Diskon. Potongan manual tetap bisa digunakan.
            </p>
          ) : null}

          <div className="grid gap-3 rounded-md bg-app-muted p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-neutral-500">Subtotal</p>
              <p className="mt-1 font-bold">{formatCurrency(subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Potongan</p>
              <p className="mt-1 font-bold text-app-danger">-{formatCurrency(discountAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Grand Total</p>
              <p className="mt-1 font-bold">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
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
            <p className="text-xs text-neutral-500">Grand Total</p>
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
