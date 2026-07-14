import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Edit3, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { WhatsAppReminderButton } from './WhatsAppReminderButton'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters/currency'
import { formatDisplayDate, toInputDate } from '../../lib/formatters/date'
import { paymentMethodLabels, paymentStatusLabels } from '../../lib/formatters/invoice'
import {
  addPayment,
  listPayments,
  markInvoiceFullyPaid,
  softDeletePayment,
  updatePayment,
  type PaymentInput,
} from '../../services/firestore/payments'
import type { InvoiceRecord, PaymentMethod, PaymentRecord } from '../../types/domain'

type PaymentManagerProps = {
  invoice: InvoiceRecord
  initialPayments?: PaymentRecord[]
  onChanged: () => Promise<void>
}

const defaultPaymentMethod: PaymentMethod = 'TRANSFER_BANK'

function todayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function getPaymentError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    PAYMENT_AMOUNT_INVALID: 'Nominal pembayaran harus lebih dari 0.',
    PAYMENT_AMOUNT_EXCEEDS_REMAINING: 'Nominal pembayaran melebihi sisa tagihan.',
    PAYMENT_DATE_REQUIRED: 'Tanggal pembayaran wajib diisi.',
    PAYMENT_NOT_FOUND: 'Data pembayaran tidak ditemukan.',
    INVOICE_NOT_FOUND: 'Invoice tidak ditemukan.',
  }

  return messages[message] ?? 'Pembayaran belum bisa diproses. Coba lagi beberapa saat.'
}

export function PaymentManager({ invoice, initialPayments, onChanged }: PaymentManagerProps) {
  const { profile } = useAuth()
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments ?? [])
  const [amountInput, setAmountInput] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayInputDate())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod)
  const [notes, setNotes] = useState('')
  const [editingPaymentId, setEditingPaymentId] = useState('')
  const [isLoading, setIsLoading] = useState(!initialPayments)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadPayments = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      setPayments(await listPayments(profile.uid, invoice.id))
    } catch (error) {
      console.error('Failed to load payments', error)
      setErrorMessage('Riwayat pembayaran belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [invoice.id, profile?.uid])

  useEffect(() => {
    if (initialPayments) {
      setPayments(initialPayments)
      setIsLoading(false)
      return
    }

    void loadPayments()
  }, [initialPayments, loadPayments])

  function resetForm() {
    setAmountInput('')
    setPaymentDate(todayInputDate())
    setPaymentMethod(defaultPaymentMethod)
    setNotes('')
    setEditingPaymentId('')
  }

  function startEdit(payment: PaymentRecord) {
    setEditingPaymentId(payment.id)
    setAmountInput(String(payment.amount))
    setPaymentDate(toInputDate(payment.paymentDate))
    setPaymentMethod(payment.paymentMethod)
    setNotes(payment.notes ?? '')
    setSuccessMessage('')
    setErrorMessage('')
  }

  async function refreshAfterChange(message: string) {
    await Promise.all([loadPayments(), onChanged()])
    setSuccessMessage(message)
    resetForm()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.uid) return

    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    const payload: PaymentInput = {
      amount: parseCurrencyInput(amountInput),
      paymentDate,
      paymentMethod,
      notes,
    }

    try {
      if (editingPaymentId) {
        await updatePayment(profile.uid, editingPaymentId, payload)
        await refreshAfterChange('Pembayaran berhasil diperbarui.')
      } else {
        await addPayment(profile.uid, invoice.id, payload)
        await refreshAfterChange('Pembayaran berhasil ditambahkan.')
      }
    } catch (error) {
      console.error('Failed to save payment', error)
      setErrorMessage(getPaymentError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(paymentId: string) {
    if (!profile?.uid) return
    const confirmed = window.confirm('Hapus pembayaran ini dari riwayat?')
    if (!confirmed) return

    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      await softDeletePayment(profile.uid, paymentId)
      await refreshAfterChange('Pembayaran berhasil dihapus.')
    } catch (error) {
      console.error('Failed to delete payment', error)
      setErrorMessage(getPaymentError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMarkFullyPaid() {
    if (!profile?.uid) return

    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      await markInvoiceFullyPaid(profile.uid, invoice.id, paymentMethod)
      await refreshAfterChange('Invoice berhasil ditandai lunas.')
    } catch (error) {
      console.error('Failed to mark invoice fully paid', error)
      setErrorMessage(getPaymentError(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-5 no-print">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-app-border bg-white p-4">
          <p className="text-xs text-neutral-500">Total Tagihan</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(invoice.totalAmount)}</p>
        </div>
        <div className="rounded-md border border-app-border bg-white p-4">
          <p className="text-xs text-neutral-500">Sudah Dibayar</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(invoice.totalPaid)}</p>
          <p className="mt-1 text-xs text-neutral-500">{invoice.paymentPercentage}% dari total</p>
        </div>
        <div className="rounded-md border border-app-border bg-white p-4">
          <p className="text-xs text-neutral-500">Sisa Pembayaran</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(invoice.remainingAmount)}</p>
        </div>
        <div className="rounded-md border border-app-border bg-white p-4">
          <p className="text-xs text-neutral-500">Status</p>
          <p className="mt-1 text-lg font-bold">{paymentStatusLabels[invoice.paymentStatus]}</p>
        </div>
      </div>

      {invoice.remainingAmount > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Reminder pembayaran</p>
              <p className="mt-1 text-sm text-neutral-500">
                Kirim pesan WhatsApp otomatis ke klien untuk mengingatkan sisa pembayaran.
              </p>
            </div>
            <WhatsAppReminderButton className="w-full sm:w-auto" invoice={invoice} variant="primary" />
          </CardContent>
        </Card>
      ) : null}

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
          <h2 className="text-base font-semibold">Tambah Pembayaran</h2>
          <p className="mt-1 text-sm text-neutral-500">Kelola DP, cicilan, dan pelunasan invoice.</p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <CurrencyInput
              label="Nominal Pembayaran"
              value={amountInput}
              onValueChange={(formattedValue) => setAmountInput(formattedValue)}
            />
            <Input
              label="Tanggal Pembayaran"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
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
            <Input label="Catatan" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={handleMarkFullyPaid}
                disabled={isSaving || invoice.remainingAmount <= 0}
                className="w-full sm:w-auto"
              >
                Tandai Lunas
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                {editingPaymentId ? (
                  <Button type="button" variant="secondary" onClick={resetForm} disabled={isSaving} className="w-full sm:w-auto">
                    Batal Edit
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={isSaving}
                  icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  className="w-full sm:w-auto"
                >
                  {editingPaymentId ? 'Simpan Pembayaran' : 'Tambah Pembayaran'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Riwayat Pembayaran</h2>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat riwayat pembayaran...
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-md border border-dashed border-app-border bg-app-muted p-4 text-sm text-neutral-500">
              Belum ada pembayaran untuk invoice ini.
            </div>
          ) : (
            payments.map((payment) => (
              <div
                className="grid gap-3 rounded-md border border-app-border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                key={payment.id}
              >
                <div>
                  <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatDisplayDate(payment.paymentDate)} - {paymentMethodLabels[payment.paymentMethod]}
                  </p>
                  {payment.notes ? <p className="mt-2 text-sm text-neutral-600">{payment.notes}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button type="button" variant="secondary" icon={<Edit3 size={15} />} onClick={() => startEdit(payment)} className="w-full sm:w-auto">
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    icon={<Trash2 size={15} />}
                    onClick={() => handleDelete(payment.id)}
                    disabled={isSaving}
                    className="w-full sm:w-auto"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
