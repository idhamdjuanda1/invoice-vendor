import { ExternalLink, KeyRound, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { getFriendlyAuthError } from './authErrors'
import { renewVendorActivationToken } from '../../services/firestore/activationTokens'
import { useAuth } from './useAuth'

const adminWhatsappUrl =
  'https://wa.me/6285176932228?text=Halo%20Admin%2C%20saya%20ingin%20melakukan%20perpanjangan%20atau%20pembelian%20token%20Invoice%20Vendor.'

export function TokenExpiredModal() {
  const { activationAccess, logout, profile, refreshProfile } = useAuth()
  const [newToken, setNewToken] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleActivateToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!profile) {
      setError('Profil vendor tidak ditemukan.')
      return
    }

    setIsActivating(true)

    try {
      await renewVendorActivationToken({ profile, tokenCode: newToken })
      await refreshProfile()
      setMessage('Token berhasil diaktivasi. Akses aplikasi dipulihkan.')
    } catch (activationError) {
      setError(getFriendlyAuthError(activationError))
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <main className="fixed inset-0 z-50 grid min-h-screen place-items-center bg-app-text/80 px-5 py-8 backdrop-blur-sm">
      <section
        aria-labelledby="token-expired-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-app-border bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-gold">Invoice Vendor</p>
        <h1 className="mt-3 text-2xl font-bold text-app-text" id="token-expired-title">
          Masa Aktif Token Telah Berakhir
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Token aktivasi Anda telah habis masa berlakunya. Silakan hubungi admin untuk melakukan perpanjangan atau
          pembelian token baru.
        </p>

        <form className="mt-5 grid gap-4" onSubmit={handleActivateToken}>
          <Input
            autoComplete="off"
            id="newActivationToken"
            label="Token Baru"
            onChange={(event) => setNewToken(event.target.value)}
            placeholder="Masukkan token aktivasi baru"
            required
            value={newToken}
          />

          {activationAccess.message ? (
            <p className="rounded-md bg-app-muted p-3 text-sm text-neutral-600">{activationAccess.message}</p>
          ) : null}
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger">{error}</p> : null}
          {message ? <p className="rounded-md bg-green-50 p-3 text-sm text-app-success">{message}</p> : null}

          <Button disabled={isActivating} icon={<KeyRound size={16} />}>
            {isActivating ? 'Mengaktivasi...' : 'Aktivasi Token'}
          </Button>

          <a href={adminWhatsappUrl} rel="noreferrer" target="_blank">
            <Button className="w-full" icon={<ExternalLink size={16} />}>
              Hubungi Admin via WhatsApp
            </Button>
          </a>

          <Button icon={<LogOut size={16} />} onClick={() => void logout()} type="button" variant="ghost">
            Logout
          </Button>
        </form>
      </section>
    </main>
  )
}
