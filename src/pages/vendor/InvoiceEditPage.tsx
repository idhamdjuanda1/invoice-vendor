import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InvoiceForm } from '../../components/invoice/InvoiceForm'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { getInvoice } from '../../services/firestore/invoices'
import type { InvoiceRecord } from '../../types/domain'

export function InvoiceEditPage() {
  const { invoiceId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadInvoice() {
      if (!profile?.uid || !invoiceId) return

      setIsLoading(true)
      setErrorMessage('')

      try {
        const invoiceData = await getInvoice(profile.uid, invoiceId)
        if (!invoiceData) {
          setErrorMessage('Invoice tidak ditemukan.')
          return
        }
        setInvoice(invoiceData)
      } catch (error) {
        console.error('Failed to load invoice for edit', error)
        setErrorMessage('Invoice belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadInvoice()
  }, [invoiceId, profile?.uid])

  return (
    <div className="grid gap-6">
      <PageHeader title="Edit Invoice" description="Edit data invoice tanpa mengubah nomor invoice yang sudah dibuat." />
      {isLoading ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">Memuat invoice...</CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="grid gap-4">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button className="text-left text-sm font-semibold text-app-gold" onClick={() => navigate('/invoices')}>
              Kembali ke daftar invoice
            </button>
          </CardContent>
        </Card>
      ) : invoice ? (
        <InvoiceForm invoice={invoice} mode="edit" />
      ) : null}
    </div>
  )
}
