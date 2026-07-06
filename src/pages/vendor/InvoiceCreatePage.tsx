import { InvoiceForm } from '../../components/invoice/InvoiceForm'
import { PageHeader } from '../../components/ui/PageHeader'

export function InvoiceCreatePage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Buat Invoice"
        description="Buat invoice baru dari klien tersimpan, paket aktif, data acara, dan pembayaran awal."
      />
      <InvoiceForm mode="create" />
    </div>
  )
}
