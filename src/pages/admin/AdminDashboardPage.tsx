import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Ticket, UserX, Users } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { getUserActivationStatus } from '../../lib/activation'
import {
  formatFirestoreDate,
  getActivationTokenStatus,
  listActivationTokens,
} from '../../services/firestore/activationTokenAdmin'
import { listUsersForAdmin } from '../../services/firestore/adminUsers'
import type { ActivationToken, UserProfile } from '../../types/domain'

export function AdminDashboardPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [tokens, setTokens] = useState<ActivationToken[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const [userList, tokenList] = await Promise.all([listUsersForAdmin(), listActivationTokens()])
        setUsers(userList)
        setTokens(tokenList)
      } catch (error) {
        console.error('Failed to load admin dashboard', error)
        setErrorMessage('Ringkasan Super Admin belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  const summary = useMemo(() => {
    const vendorUsers = users.filter((user) => user.role !== 'super_admin')
    const activeUsers = vendorUsers.filter((user) => getUserActivationStatus(user) !== 'inactive').length
    const suspendedUsers = vendorUsers.filter((user) => getUserActivationStatus(user) === 'inactive').length
    const availableTokens = tokens.filter((token) => getActivationTokenStatus(token) === 'Belum digunakan').length
    const usedTokens = tokens.filter((token) => token.isUsed).length
    const expiredTokens = tokens.filter((token) => getActivationTokenStatus(token) === 'Expired').length

    return {
      totalUsers: vendorUsers.length,
      activeUsers,
      suspendedUsers,
      availableTokens,
      usedTokens,
      expiredTokens,
      recentUsers: vendorUsers.slice(0, 5),
      recentTokens: tokens.slice(0, 5),
    }
  }, [tokens, users])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Dashboard Super Admin"
        description="Pantau user vendor, status akun, token aktivasi, serta akses backup dan restore."
      />

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users size={20} />}
          label="Total user"
          value={isLoading ? '...' : String(summary.totalUsers)}
          helper={`${summary.activeUsers} aktif, ${summary.suspendedUsers} nonaktif`}
        />
        <StatCard
          icon={<Ticket size={20} />}
          label="Token tersedia"
          value={isLoading ? '...' : String(summary.availableTokens)}
          helper={`${summary.usedTokens} terpakai, ${summary.expiredTokens} expired`}
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Vendor aktif"
          value={isLoading ? '...' : String(summary.activeUsers)}
          helper="Akun bisa login"
        />
        <StatCard
          icon={<UserX size={20} />}
          label="Vendor nonaktif"
          value={isLoading ? '...' : String(summary.suspendedUsers)}
          helper="Suspended atau belum aktif"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-app-border p-5">
              <h2 className="text-base font-semibold">User terbaru</h2>
              <p className="mt-1 text-sm text-neutral-500">Ringkasan vendor terakhir yang terdaftar.</p>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
                <Loader2 className="animate-spin" size={16} />
                Memuat user...
              </div>
            ) : summary.recentUsers.length === 0 ? (
              <div className="p-5 text-sm text-neutral-500">Belum ada vendor.</div>
            ) : (
              <div className="divide-y divide-app-border">
                {summary.recentUsers.map((user) => (
                  <div className="flex items-center justify-between gap-4 p-4" key={user.uid}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                      <p className="truncate text-xs text-neutral-500">{user.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                      {user.isSuspended ? 'Nonaktif' : user.isActive ? 'Aktif' : 'Belum aktif'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-app-border p-5">
              <h2 className="text-base font-semibold">Token terbaru</h2>
              <p className="mt-1 text-sm text-neutral-500">Status token aktivasi terakhir.</p>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
                <Loader2 className="animate-spin" size={16} />
                Memuat token...
              </div>
            ) : summary.recentTokens.length === 0 ? (
              <div className="p-5 text-sm text-neutral-500">Belum ada token.</div>
            ) : (
              <div className="divide-y divide-app-border">
                {summary.recentTokens.map((token) => (
                  <div className="flex items-center justify-between gap-4 p-4" key={token.id}>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold">{token.code}</p>
                      <p className="truncate text-xs text-neutral-500">Expired {formatFirestoreDate(token.expiresAt)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-app-muted px-3 py-1 text-xs font-semibold text-app-text">
                      {getActivationTokenStatus(token)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 text-sm text-neutral-600">
          <AlertTriangle className="mt-0.5 shrink-0 text-app-warning" size={18} />
          <p>
            Ringkasan ini membaca langsung dari koleksi Firestore <span className="font-semibold">users</span> dan{' '}
            <span className="font-semibold">activationTokens</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
