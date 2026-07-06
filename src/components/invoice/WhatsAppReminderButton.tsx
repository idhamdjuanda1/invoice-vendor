import { MessageCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import type { InvoiceRecord } from '../../types/domain'

type WhatsAppReminderButtonProps = {
  invoice: InvoiceRecord
  className?: string
  variant?: 'primary' | 'secondary'
}

function normalizeWhatsAppNumber(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}

function buildReminderMessage(invoice: InvoiceRecord) {
  const clientName = invoice.clientName || 'Kak'
  const eventDate = formatDisplayDate(invoice.eventDate)

  return [
    `Halo ${clientName},`,
    '',
    `Kami ingin mengingatkan pembayaran untuk invoice ${invoice.invoiceNumber}.`,
    `Tanggal acara: ${eventDate}`,
    `Total tagihan: ${formatCurrency(invoice.totalAmount)}`,
    `Sudah dibayar: ${formatCurrency(invoice.totalPaid)}`,
    `Sisa pembayaran: ${formatCurrency(invoice.remainingAmount)}`,
    '',
    'Mohon konfirmasi pembayaran atau hubungi kami jika ada pertanyaan.',
    '',
    'Terima kasih.',
  ].join('\n')
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)
}

function openWhatsApp(phoneNumber: string, message: string) {
  const encodedMessage = encodeURIComponent(message)
  const appUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`
  const webUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`

  if (isMobileDevice()) {
    window.location.href = appUrl
    window.setTimeout(() => {
      window.location.href = webUrl
    }, 1200)
    return
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer')
}

export function WhatsAppReminderButton({ invoice, className, variant = 'secondary' }: WhatsAppReminderButtonProps) {
  function handleClick() {
    const phoneNumber = normalizeWhatsAppNumber(invoice.clientWhatsappNumber)

    if (!phoneNumber) {
      window.alert('Nomor WhatsApp klien belum tersedia di invoice ini.')
      return
    }

    openWhatsApp(phoneNumber, buildReminderMessage(invoice))
  }

  return (
    <Button className={className} icon={<MessageCircle size={16} />} onClick={handleClick} type="button" variant={variant}>
      Reminder WhatsApp
    </Button>
  )
}
