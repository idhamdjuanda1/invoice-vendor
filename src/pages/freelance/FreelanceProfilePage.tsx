import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { freelanceTypeLabels } from '../../services/firestore/freelancers'

export function FreelanceProfilePage() {
  const { profile } = useAuth()

  return (
    <div className="grid gap-6">
      <PageHeader title="Profil" description="Data akun freelance Anda." />
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-500">Nama</p>
            <p className="mt-1 font-bold">{profile?.name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Email</p>
            <p className="mt-1 font-bold">{profile?.email || '-'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-neutral-500">Role</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile?.freelanceRoles.map((role) => (
                <span className="rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold" key={role}>
                  {freelanceTypeLabels[role]}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
