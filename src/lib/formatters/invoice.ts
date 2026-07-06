import type { PaymentMethod, PaymentStatus } from '../../types/domain'

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  DP: 'DP',
  CICILAN: 'Cicilan',
  LUNAS: 'Lunas',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  TRANSFER_BANK: 'Transfer',
  CASH: 'Cash',
  QRIS: 'QRIS',
  OTHER: 'Other',
}

export function getPaymentStatus(totalAmount: number, totalPaid: number, paymentCount: number): PaymentStatus {
  if (totalPaid <= 0) return 'BELUM_BAYAR'
  if (totalPaid >= totalAmount) return 'LUNAS'
  return paymentCount > 1 ? 'CICILAN' : 'DP'
}

export function getPaymentPercentage(totalAmount: number, totalPaid: number) {
  if (totalAmount <= 0) return 0
  return Math.min(100, Math.round((totalPaid / totalAmount) * 100))
}
