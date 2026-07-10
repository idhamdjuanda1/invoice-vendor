import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, UserX } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import {
  getRemainingActivationDays,
  getUserActivationStatus,
  getUserActivationStatusLabel,
  type UserActivationStatus,
} from '../../lib/activation'
import { formatFirestoreDate } from '../../services/firestore/activationTokenAdmin'
import { listUsersForAdmin, setUserSuspended } from '../../services/firestore/adminUsers'
import type { UserProfile } from '../../types/domain'

function getUserStatus(user: UserProfile) {
  if (user.isSuspended) return 'Nonaktif'
  if (!user.isActive) return 'Belum aktif'
  return 'Aktif'
}

const tokenStatusStyles: Record<UserActivationStatus, string> = {
  active: 'border-green-200 bg-green-50 text-green-700',
  expiring: 'border-amber-200 bg-amber-50 text-amber-700',
  inactive: 'border-red-200 bg-red-50 text-red-700',
}

function TokenStatusBadge({ user }: { user: UserProfile }) {
  const status = getUserActivationStatus(user)
  const remainingDays = getRemainingActivationDays(user.activationExpiresAt)
  const detail = user.role === 'super_admin'
    ? 'Tanpa batas'
    : status === 'inactive'
      ? null
      : `${remainingDays} hari`

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tokenStatusStyles[status]}`}>
      <span className="size-2 rounded-full bg-current" />
      {getUserActivationStatusLabel(status)}{detail ? ` - ${detail}` : ''}
    </span>
  )
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      setUsers(await listUsersForAdmin())
    } catch (error) {
      console.error('Failed to load admin users', error)
      setErrorMessage('Daftar user belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function handleToggleUser(user: UserProfile) {
    if (user.role === 'super_admin') {
      setErrorMessage('Super Admin tidak bisa dinonaktifkan dari halaman ini.')
      return
    }

    const nextSuspended = !user.isSuspended
    const confirmed = window.confirm(
      nextSuspended ? `Nonaktifkan akun ${user.email}?` : `Aktifkan kembali akun ${user.email}?`,
    )
    if (!confirmed) return

    setUpdatingUserId(user.uid)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await setUserSuspended(user.uid, nextSuspended)
      await loadUsers()
      setSuccessMessage(nextSuspended ? 'User berhasil dinonaktifkan.' : 'User berhasil diaktifkan kembali.')
    } catch (error) {
      console.error('Failed to update user status', error)
      setErrorMessage('Status user belum bisa diperbarui.')
    } finally {
      setUpdatingUserId('')
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Daftar User"
        description="Lihat vendor, role, status aktif, suspend, masa aktivasi, dan nonaktifkan user manual."
        actions={
          <Button icon={<RefreshCw size={16} />} onClick={() => void loadUsers()} variant="secondary" disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {successMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat user...
            </div>
          ) : users.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">Belum ada user.</div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {users.map((user) => (
                  <div className="rounded-md border border-app-border bg-white p-4" key={user.uid}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold">{user.name || user.email}</p>
                        <p className="mt-1 truncate text-sm text-neutral-500">{user.email}</p>
                      </div>
                      <TokenStatusBadge user={user} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-app-muted p-3 text-sm">
                      <div>
                        <p className="text-xs text-neutral-500">Role</p>
                        <p className="mt-1 font-bold">{user.role === 'super_admin' ? 'Super Admin' : 'Vendor'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Expired</p>
                        <p className="mt-1 font-bold">{formatFirestoreDate(user.activationExpiresAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Status Akun</p>
                        <p className="mt-1 font-bold">{getUserStatus(user)}</p>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      disabled={updatingUserId === user.uid || user.role === 'super_admin'}
                      icon={updatingUserId === user.uid ? <Loader2 className="animate-spin" size={16} /> : user.isSuspended ? <CheckCircle2 size={16} /> : <UserX size={16} />}
                      onClick={() => void handleToggleUser(user)}
                      variant={user.isSuspended ? 'secondary' : 'danger'}
                    >
                      {user.isSuspended ? 'Aktifkan' : 'Nonaktifkan'}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-app-border bg-app-muted text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">Nama</th>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Status Token</th>
                      <th className="px-5 py-3">Expired</th>
                      <th className="px-5 py-3">Token</th>
                      <th className="px-5 py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr className="border-b border-app-border last:border-b-0" key={user.uid}>
                        <td className="px-5 py-4 font-semibold">{user.name || '-'}</td>
                        <td className="px-5 py-4">{user.email}</td>
                        <td className="px-5 py-4">{user.role === 'super_admin' ? 'Super Admin' : 'Vendor'}</td>
                        <td className="px-5 py-4">{getUserStatus(user)}</td>
                        <td className="px-5 py-4"><TokenStatusBadge user={user} /></td>
                        <td className="px-5 py-4">{formatFirestoreDate(user.activationExpiresAt)}</td>
                        <td className="px-5 py-4 font-mono text-xs">{user.activationTokenId ?? '-'}</td>
                        <td className="px-5 py-4">
                          <Button
                            className="px-3"
                            disabled={updatingUserId === user.uid || user.role === 'super_admin'}
                            icon={updatingUserId === user.uid ? <Loader2 className="animate-spin" size={15} /> : user.isSuspended ? <CheckCircle2 size={15} /> : <UserX size={15} />}
                            onClick={() => void handleToggleUser(user)}
                            variant={user.isSuspended ? 'secondary' : 'danger'}
                          >
                            {user.isSuspended ? 'Aktifkan' : 'Nonaktifkan'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
