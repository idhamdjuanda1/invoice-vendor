import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { PlaceholderTable } from '../../components/ui/PlaceholderTable'

export function AdminUserDetailPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Detail User"
        description="Kelola suspend, reactivate, dan soft delete user tanpa merusak integritas invoice."
        actions={
          <>
            <Button variant="secondary">Aktifkan</Button>
            <Button variant="danger">Suspend</Button>
          </>
        }
      />
      <PlaceholderTable columns={['Properti', 'Nilai']} rows={6} />
    </div>
  )
}
