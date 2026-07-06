import { Download, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { PlaceholderTable } from '../../components/ui/PlaceholderTable'

export function AdminBackupPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Backup dan Restore"
        description="Backup dan restore hanya untuk Super Admin, wajib konfirmasi, validasi, dan audit log."
        actions={
          <>
            <Button icon={<Download size={16} />} variant="secondary">Backup</Button>
            <Button icon={<Upload size={16} />}>Restore</Button>
          </>
        }
      />
      <PlaceholderTable columns={['File', 'Aksi', 'Status', 'Tanggal']} />
    </div>
  )
}
