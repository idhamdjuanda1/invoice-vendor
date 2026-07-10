import { Copy, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import {
  createActivationToken,
  formatFirestoreDate,
  getActivationTokenDurationLabel,
  getActivationTokenStatus,
  listActivationTokens,
} from '../../services/firestore/activationTokenAdmin'
import { listUsersForAdmin } from '../../services/firestore/adminUsers'
import type { ActivationToken, TokenDurationType } from '../../types/domain'

const durationOptions: Array<{ label: string; value: TokenDurationType }> = [
  { label: '1 Hari (Trial)', value: 'ONE_DAY' },
  { label: '1 Minggu', value: 'ONE_WEEK' },
  { label: '1 bulan', value: 'ONE_MONTH' },
  { label: '3 Bulan', value: 'THREE_MONTHS' },
  { label: '6 Bulan', value: 'SIX_MONTHS' },
  { label: '1 Tahun', value: 'ONE_YEAR' },
]

export function AdminTokenPage() {
  const { isSuperAdmin, profile } = useAuth()
  const [durationType, setDurationType] = useState<TokenDurationType>('ONE_DAY')
  const [tokens, setTokens] = useState<ActivationToken[]>([])
  const [userEmailById, setUserEmailById] = useState<Record<string, string>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadTokens() {
    setError('')
    setIsLoading(true)

    try {
      const [tokenList, userList] = await Promise.all([listActivationTokens(), listUsersForAdmin()])
      setTokens(tokenList)
      setUserEmailById(
        Object.fromEntries(userList.map((user) => [user.uid, user.email || user.name || user.uid])),
      )
    } catch (loadError) {
      setError(getFriendlyAuthError(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTokens()
  }, [])

  async function handleCreateToken() {
    setError('')
    setSuccess('')

    if (!profile || !isSuperAdmin) {
      setError('Hanya Super Admin yang bisa membuat token aktivasi.')
      return
    }

    setIsCreating(true)

    try {
      const tokenCode = await createActivationToken({ durationType, superAdmin: profile })
      setSuccess(`Token ${tokenCode} berhasil dibuat.`)
      await loadTokens()
    } catch (createError) {
      setError(getFriendlyAuthError(createError))
    } finally {
      setIsCreating(false)
    }
  }

  async function copyToken(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setSuccess(`Token ${code} disalin.`)
    } catch {
      setError('Token tidak bisa disalin otomatis. Silakan salin manual.')
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Token Aktivasi"
        description="Buat token mulai 1 hari sampai 1 tahun, lalu pantau status digunakan, belum digunakan, dan expired."
        actions={
          <Button disabled={isLoading} icon={<RefreshCw size={16} />} onClick={() => void loadTokens()} variant="secondary">
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">Buat Token Aktivasi</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Token akan disimpan di Firestore collection <span className="font-semibold">activationTokens</span>.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor="durationType">
            Durasi token
            <select
              className="min-h-11 rounded-md border border-app-border bg-white px-3 text-sm outline-none transition focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
              id="durationType"
              onChange={(event) => setDurationType(event.target.value as TokenDurationType)}
              value={durationType}
            >
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isCreating || !isSuperAdmin} icon={<Plus size={16} />} onClick={() => void handleCreateToken()}>
            {isCreating ? 'Membuat...' : 'Create Token'}
          </Button>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger md:col-span-2">{error}</p> : null}
          {success ? <p className="rounded-md bg-green-50 p-3 text-sm text-app-success md:col-span-2">{success}</p> : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-lg font-bold">Daftar Token</h2>
          <p className="mt-1 text-sm text-neutral-600">Menampilkan maksimal 50 token terbaru.</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-app-muted text-xs uppercase text-neutral-500">
              <tr>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Token</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Durasi</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Status</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Expired</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Email pendaftar</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-neutral-500" colSpan={6}>
                    Memuat token...
                  </td>
                </tr>
              ) : null}
              {!isLoading && tokens.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-neutral-500" colSpan={6}>
                    Belum ada token aktivasi.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tokens.map((token) => (
                    <tr className="border-b border-app-border last:border-0" key={token.id}>
                      <td className="px-4 py-4 font-mono text-sm font-semibold">{token.code}</td>
                      <td className="px-4 py-4">{getActivationTokenDurationLabel(token.durationType)}</td>
                      <td className="px-4 py-4">{getActivationTokenStatus(token)}</td>
                      <td className="px-4 py-4">{formatFirestoreDate(token.expiresAt)}</td>
                      <td className="px-4 py-4">{token.usedById ? userEmailById[token.usedById] ?? token.usedById : '-'}</td>
                      <td className="px-4 py-4">
                        <Button
                          className="h-9 min-h-9 px-3"
                          icon={<Copy size={14} />}
                          onClick={() => void copyToken(token.code)}
                          variant="secondary"
                        >
                          Salin
                        </Button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
