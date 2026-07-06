import { useCallback, useEffect, useState } from 'react'
import { Eye, FileSignature, Loader2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { listAgreements, softDeleteAgreement } from '../../services/firestore/agreements'
import type { AgreementRecord } from '../../types/domain'

export function AgreementsPage() {
  const { profile } = useAuth()
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadAgreements = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      setAgreements(await listAgreements(profile.uid))
    } catch (error) {
      console.error('Failed to load agreements', error)
      setErrorMessage('Daftar MOU belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadAgreements()
  }, [loadAgreements])

  async function handleDelete(agreementId: string) {
    if (!profile?.uid) return
    const confirmed = window.confirm('Hapus MOU ini dari daftar?')
    if (!confirmed) return

    setIsDeleting(agreementId)
    setErrorMessage('')

    try {
      await softDeleteAgreement(profile.uid, agreementId)
      await loadAgreements()
    } catch (error) {
      console.error('Failed to delete agreement', error)
      setErrorMessage('MOU belum bisa dihapus.')
    } finally {
      setIsDeleting('')
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="MOU"
        description="Arsip memorandum of understanding/perjanjian kerja sama berdasarkan invoice yang sudah dibuat."
      />

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat MOU...
            </div>
          ) : agreements.length === 0 ? (
            <div className="grid gap-3 p-5 text-sm text-neutral-500">
              <p>Belum ada MOU.</p>
              <p>Buka detail invoice, lalu klik tombol Buat MOU untuk membuat dokumen kerja sama.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {agreements.map((agreement) => (
                  <div className="rounded-md border border-app-border bg-white p-4" key={agreement.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{agreement.agreementNumber}</p>
                        <p className="mt-1 text-base font-semibold">{agreement.clientName || 'Klien tanpa nama'}</p>
                        <p className="mt-1 text-sm text-neutral-500">{formatDisplayDate(agreement.eventDate)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                        {agreement.status === 'SIGNED' ? 'Signed' : 'Draft'}
                      </span>
                    </div>
                    <div className="mt-4 rounded-md bg-app-muted p-3 text-sm">
                      <p className="text-xs text-neutral-500">Nilai kerja sama</p>
                      <p className="mt-1 font-bold">{formatCurrency(agreement.totalAmount)}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link to={`/agreements/${agreement.id}`}>
                        <Button className="w-full" icon={<Eye size={15} />} variant="secondary">
                          Detail
                        </Button>
                      </Link>
                      <Button
                        className="w-full"
                        disabled={Boolean(isDeleting)}
                        icon={isDeleting === agreement.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                        onClick={() => void handleDelete(agreement.id)}
                        variant="danger"
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-app-border bg-app-muted text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">Nomor MOU</th>
                      <th className="px-5 py-3">Klien</th>
                      <th className="px-5 py-3">Invoice</th>
                      <th className="px-5 py-3">Tanggal Acara</th>
                      <th className="px-5 py-3">Nilai</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreements.map((agreement) => (
                      <tr className="border-b border-app-border last:border-b-0" key={agreement.id}>
                        <td className="px-5 py-4 font-semibold">{agreement.agreementNumber}</td>
                        <td className="px-5 py-4">{agreement.clientName || 'Klien tanpa nama'}</td>
                        <td className="px-5 py-4">{agreement.invoiceNumber}</td>
                        <td className="px-5 py-4">{formatDisplayDate(agreement.eventDate)}</td>
                        <td className="px-5 py-4">{formatCurrency(agreement.totalAmount)}</td>
                        <td className="px-5 py-4">{agreement.status === 'SIGNED' ? 'Signed' : 'Draft'}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/agreements/${agreement.id}`}>
                              <Button className="px-3" icon={<FileSignature size={15} />} variant="secondary">
                                Detail
                              </Button>
                            </Link>
                            <Button
                              className="px-3"
                              disabled={Boolean(isDeleting)}
                              icon={isDeleting === agreement.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                              onClick={() => void handleDelete(agreement.id)}
                              variant="danger"
                            >
                              Hapus
                            </Button>
                          </div>
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
