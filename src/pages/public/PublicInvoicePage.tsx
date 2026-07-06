import { Download, MessageCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

export function PublicInvoicePage() {
  return (
    <div className="mx-auto grid min-h-screen max-w-4xl gap-6 px-5 py-8">
      <header className="flex flex-col gap-4 border-b border-app-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-app-gold">Invoice Vendor</p>
          <h1 className="mt-1 text-2xl font-bold">Invoice Publik</h1>
          <p className="mt-2 text-sm text-neutral-600">Halaman ini dapat dibuka klien tanpa login.</p>
        </div>
        <Badge>Status pembayaran realtime</Badge>
      </header>
      <Card>
        <CardContent>
          <div className="min-h-96 rounded-md border border-dashed border-app-border bg-app-muted p-8 text-sm text-neutral-500">
            Placeholder detail invoice publik dengan tombol PDF dan WhatsApp vendor.
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button icon={<Download size={16} />} variant="secondary">Download PDF</Button>
        <Button icon={<MessageCircle size={16} />}>Hubungi vendor</Button>
      </div>
    </div>
  )
}
