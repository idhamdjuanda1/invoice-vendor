import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Edit3, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { syncPricelistsWithBusinessProfile } from '../../services/firestore/businessProfiles'
import { listPricelists, softDeletePricelist } from '../../services/firestore/pricelists'
import type { PricelistRecord } from '../../types/domain'

function getPublicUrl(slug: string) {
  return `${window.location.origin}/pricelist/${slug}`
}

function getShareUrl(slug: string) {
  return `https://invoice-vendor-r2.idm-invoice-vendor.workers.dev/share/pricelist/${slug}`
}

function getHomeShareUrl() {
  return 'https://invoice-vendor-r2.idm-invoice-vendor.workers.dev/share/home'
}

export function PricelistsPage() {
  const { profile } = useAuth()
  const [pricelists, setPricelists] = useState<PricelistRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const stats = useMemo(() => {
    const published = pricelists.filter((pricelist) => pricelist.isPublished).length
    const totalItems = pricelists.reduce((sum, pricelist) => sum + pricelist.items.length, 0)
    return { published, totalItems }
  }, [pricelists])

  const loadPricelists = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      await syncPricelistsWithBusinessProfile(profile.uid).catch((error) => {
        console.error('Failed to sync pricelist vendor profile', error)
      })
      setPricelists(await listPricelists(profile.uid))
    } catch (error) {
      console.error('Failed to load pricelists', error)
      setErrorMessage('Daftar pricelist belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadPricelists()
  }, [loadPricelists])

  async function handleCopy(slug: string) {
    setMessage('')
    setErrorMessage('')

    try {
      await navigator.clipboard.writeText(getShareUrl(slug))
      setMessage('Link share berhasil disalin.')
    } catch (error) {
      console.error('Failed to copy pricelist link', error)
      setErrorMessage('Link belum bisa disalin. Buka link lalu salin dari browser.')
    }
  }

  async function handleDelete(pricelistId: string) {
    if (!profile?.uid) return
    const confirmed = window.confirm('Hapus pricelist ini dari link publish?')
    if (!confirmed) return

    setIsDeleting(pricelistId)
    setErrorMessage('')
    setMessage('')

    try {
      await softDeletePricelist(profile.uid, pricelistId)
      setMessage('Pricelist berhasil dihapus.')
      await loadPricelists()
    } catch (error) {
      console.error('Failed to delete pricelist', error)
      setErrorMessage('Pricelist belum bisa dihapus.')
    } finally {
      setIsDeleting('')
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pricelist"
        description="Buat link publish profesional dari paket yang sudah tersedia, lalu bagikan ke calon klien tanpa perlu login."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              icon={<Copy size={16} />}
              onClick={() => void navigator.clipboard.writeText(getHomeShareUrl()).then(() => setMessage('Link website utama berhasil disalin.')).catch(() => setErrorMessage('Link website utama belum bisa disalin.'))}
              type="button"
              variant="secondary"
            >
              Share Website
            </Button>
            <Link to="/pricelists/new">
              <Button icon={<Plus size={16} />}>Buat Pricelist</Button>
            </Link>
          </div>
        }
      />

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Link aktif</p>
            <p className="mt-2 text-2xl font-bold text-app-text">{stats.published}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Paket dipublish</p>
            <p className="mt-2 text-2xl font-bold text-app-text">{stats.totalItems}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat pricelist...
            </div>
          ) : pricelists.length === 0 ? (
            <div className="grid gap-3 p-5 text-sm text-neutral-500">
              <p>Belum ada pricelist publish.</p>
              <p>Klik Buat Pricelist untuk memilih paket dan membuat link yang bisa dibagikan ke calon klien.</p>
            </div>
          ) : (
            <div className="grid gap-3 p-4">
              {pricelists.map((pricelist) => {
                const total = pricelist.items.reduce((sum, item) => sum + item.price, 0)
                const publicUrl = getPublicUrl(pricelist.slug)
                const shareUrl = getShareUrl(pricelist.slug)

                return (
                  <div className="rounded-md border border-app-border bg-white p-4" key={pricelist.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-app-text">{pricelist.title}</p>
                        <p className="mt-1 text-sm text-neutral-500">{pricelist.items.length} paket - {formatCurrency(total)}</p>
                        <div className="mt-2 rounded-md bg-app-muted px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-gold">Link share WhatsApp</p>
                          <p className="mt-1 break-all text-xs text-neutral-600">{shareUrl}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4 lg:w-auto">
                        <Button icon={<Copy size={15} />} onClick={() => void handleCopy(pricelist.slug)} variant="secondary">
                          Salin
                        </Button>
                        <Link to={`/pricelists/${pricelist.id}/edit`}>
                          <Button className="w-full" icon={<Edit3 size={15} />} variant="secondary">
                            Edit
                          </Button>
                        </Link>
                        <a href={publicUrl} rel="noreferrer" target="_blank">
                          <Button className="w-full" icon={<ExternalLink size={15} />} variant="secondary">
                            Buka
                          </Button>
                        </a>
                        <Button
                          disabled={Boolean(isDeleting)}
                          icon={isDeleting === pricelist.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                          onClick={() => void handleDelete(pricelist.id)}
                          variant="danger"
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
