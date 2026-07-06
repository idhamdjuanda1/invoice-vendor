import { Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { PlaceholderTable } from '../../components/ui/PlaceholderTable'

export function ExportPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Export Data"
        description="Export invoice ke CSV dan Excel dengan filter bulan, tahun, status pembayaran, dan rentang tanggal."
        actions={
          <>
            <Button icon={<Download size={16} />} variant="secondary">CSV</Button>
            <Button icon={<Download size={16} />}>Excel</Button>
          </>
        }
      />
      <PlaceholderTable columns={['Invoice', 'Tanggal', 'Klien', 'Acara', 'Total', 'Status']} />
    </div>
  )
}
