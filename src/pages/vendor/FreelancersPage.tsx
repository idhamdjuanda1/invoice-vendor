import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Edit3, Loader2, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { env } from '../../config/env'
import { useAuth } from '../../features/auth/useAuth'
import {
  createFreelancer,
  ensureFreelancerInvite,
  freelanceTypeLabels,
  listFreelancers,
  softDeleteFreelancer,
  updateFreelancer,
  type FreelancerInput,
} from '../../services/firestore/freelancers'
import type { FreelanceRecord, FreelanceType } from '../../types/domain'

const emptyInput: FreelancerInput = {
  fullName: '',
  freelanceType: 'FOTOGRAFER',
  roles: ['FOTOGRAFER'],
  whatsappNumber: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
}

function freelancerToInput(freelancer: FreelanceRecord): FreelancerInput {
  return {
    fullName: freelancer.fullName,
    freelanceType: freelancer.freelanceType,
    roles: freelancer.roles,
    whatsappNumber: freelancer.whatsappNumber,
    email: freelancer.email,
    address: freelancer.address ?? '',
    notes: freelancer.notes ?? '',
    isActive: freelancer.isActive,
  }
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    FREELANCER_NAME_REQUIRED: 'Nama lengkap freelance wajib diisi.',
    FREELANCER_WHATSAPP_REQUIRED: 'Nomor WhatsApp freelance wajib diisi.',
    FREELANCER_EMAIL_REQUIRED: 'Email freelance wajib diisi untuk mengirim aktivasi.',
    FREELANCER_NOT_FOUND: 'Data freelance tidak ditemukan.',
  }

  return messages[message] ?? 'Data freelance belum bisa disimpan.'
}

function buildInviteUrl(token: string | null) {
  return token ? `${env.appUrl.replace(/\/$/, '')}/freelance/activate/${token}` : ''
}

function buildInviteMailto(freelancer: Pick<FreelanceRecord, 'email' | 'fullName'>, inviteToken: string | null) {
  const inviteUrl = buildInviteUrl(inviteToken)
  const subject = 'Aktivasi Akun Freelance Invoice Vendor'
  const body = [
    `Halo ${freelancer.fullName},`,
    '',
    'Silakan aktifkan akun freelance Anda melalui link berikut:',
    inviteUrl,
    '',
    'Setelah aktif, Anda dapat login untuk melihat jadwal pekerjaan dan mengunggah link hasil pekerjaan.',
  ].join('\n')

  return `mailto:${freelancer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function FreelancersPage() {
  const { profile } = useAuth()
  const [freelancers, setFreelancers] = useState<FreelanceRecord[]>([])
  const [input, setInput] = useState<FreelancerInput>(emptyInput)
  const [editingId, setEditingId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState('')
  const [isPreparingInvite, setIsPreparingInvite] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const activeCount = useMemo(() => freelancers.filter((freelancer) => freelancer.isActive).length, [freelancers])

  const loadFreelancers = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      setFreelancers(await listFreelancers(profile.uid))
    } catch (error) {
      console.error('Failed to load freelancers', error)
      setErrorMessage('Master freelance belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadFreelancers()
  }, [loadFreelancers])

  function resetForm() {
    setEditingId('')
    setInput(emptyInput)
  }

  function toggleRole(role: FreelanceType) {
    setInput((current) => {
      const roles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role]
      const nextRoles = roles.length > 0 ? roles : [role]

      return { ...current, roles: nextRoles, freelanceType: nextRoles[0] }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.uid) return

    setIsSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      if (editingId) {
        await updateFreelancer(profile.uid, editingId, input)
        setMessage('Data freelance berhasil diperbarui.')
      } else {
        await createFreelancer(profile.uid, input)
        setMessage('Freelance baru berhasil ditambahkan.')
      }
      resetForm()
      await loadFreelancers()
    } catch (error) {
      console.error('Failed to save freelancer', error)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(freelancerId: string) {
    if (!profile?.uid) return
    const confirmed = window.confirm('Hapus freelance ini dari master data?')
    if (!confirmed) return

    setIsDeleting(freelancerId)
    setErrorMessage('')

    try {
      await softDeleteFreelancer(profile.uid, freelancerId)
      setMessage('Freelance berhasil dihapus.')
      await loadFreelancers()
      if (editingId === freelancerId) resetForm()
    } catch (error) {
      console.error('Failed to delete freelancer', error)
      setErrorMessage('Freelance belum bisa dihapus.')
    } finally {
      setIsDeleting('')
    }
  }

  async function handleSendInvite(freelancer: FreelanceRecord) {
    if (!profile?.uid) return

    setIsPreparingInvite(freelancer.id)
    setMessage('')
    setErrorMessage('')

    try {
      const invitedFreelancer = await ensureFreelancerInvite(profile.uid, freelancer.id)
      await loadFreelancers()
      window.location.href = buildInviteMailto(invitedFreelancer, invitedFreelancer.inviteToken)
      setMessage('Email aktivasi sudah dibuka. Silakan kirim dari aplikasi email perangkat ini.')
    } catch (error) {
      console.error('Failed to prepare freelancer invite', error)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsPreparingInvite('')
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Master Freelance"
        description="Kelola database fotografer, videografer, dan asisten untuk penugasan acara."
      />

      {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">{editingId ? 'Edit Freelance' : 'Tambah Freelance'}</h2>
            <p className="mt-1 text-sm text-neutral-500">{activeCount} freelance aktif siap ditugaskan.</p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Input label="Nama Lengkap" value={input.fullName} onChange={(event) => setInput((current) => ({ ...current, fullName: event.target.value }))} />
              <div className="grid gap-2 text-sm font-medium text-app-text">
                <span>Role</span>
                <div className="grid gap-2 rounded-md border border-app-border p-3">
                  {Object.entries(freelanceTypeLabels).map(([value, label]) => (
                    <label className="flex items-center gap-3 text-sm" key={value}>
                      <input
                        checked={input.roles.includes(value as FreelanceType)}
                        className="size-4"
                        type="checkbox"
                        onChange={() => toggleRole(value as FreelanceType)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <Input label="Nomor WhatsApp" value={input.whatsappNumber} onChange={(event) => setInput((current) => ({ ...current, whatsappNumber: event.target.value }))} />
              <Input label="Email" type="email" value={input.email} onChange={(event) => setInput((current) => ({ ...current, email: event.target.value }))} />
              <Input label="Alamat" value={input.address} onChange={(event) => setInput((current) => ({ ...current, address: event.target.value }))} />
              <label className="grid gap-2 text-sm font-medium text-app-text">
                Catatan
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                  value={input.notes}
                  onChange={(event) => setInput((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
              <label className="flex items-center gap-3 rounded-md border border-app-border px-3 py-3 text-sm font-medium">
                <input
                  checked={input.isActive}
                  className="size-4"
                  type="checkbox"
                  onChange={(event) => setInput((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Status Aktif
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="w-full" disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>
                  {isSaving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Freelance'}
                </Button>
                {editingId ? <Button className="w-full" type="button" variant="secondary" onClick={resetForm}>Batal</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center gap-2 p-5 text-sm text-neutral-500">
                <Loader2 className="animate-spin" size={16} />
                Memuat freelance...
              </div>
            ) : freelancers.length === 0 ? (
              <div className="p-5 text-sm text-neutral-500">Belum ada data freelance.</div>
            ) : (
              <div className="grid gap-3 p-4">
                {freelancers.map((freelancer) => (
                  <div className="rounded-md border border-app-border bg-white p-4" key={freelancer.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link className="font-bold text-app-text hover:underline" to={`/freelancers/${freelancer.id}`}>
                          {freelancer.fullName}
                        </Link>
                        <p className="mt-1 text-sm text-neutral-500">
                          {freelancer.roles.map((role) => freelanceTypeLabels[role]).join(', ')}
                        </p>
                        <p className="mt-2 text-sm">{freelancer.whatsappNumber}{freelancer.email ? ` - ${freelancer.email}` : ''}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Login: {freelancer.inviteStatus === 'ACCEPTED' ? 'Aktif' : freelancer.inviteStatus === 'PENDING' ? 'Undangan terkirim' : 'Belum diundang'}
                        </p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${freelancer.isActive ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
                        {freelancer.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {freelancer.email && freelancer.inviteStatus !== 'ACCEPTED' ? (
                        <>
                          <Button
                            disabled={isPreparingInvite === freelancer.id}
                            icon={isPreparingInvite === freelancer.id ? <Loader2 className="animate-spin" size={15} /> : undefined}
                            type="button"
                            variant="secondary"
                            onClick={() => void handleSendInvite(freelancer)}
                          >
                            {isPreparingInvite === freelancer.id ? 'Menyiapkan...' : 'Kirim Email Aktivasi'}
                          </Button>
                          {freelancer.inviteToken ? (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void navigator.clipboard?.writeText(buildInviteUrl(freelancer.inviteToken))}
                            >
                              Copy Link Aktivasi
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        icon={<Edit3 size={15} />}
                        onClick={() => {
                          setEditingId(freelancer.id)
                          setInput(freelancerToInput(freelancer))
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={Boolean(isDeleting)}
                        icon={isDeleting === freelancer.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                        onClick={() => void handleDelete(freelancer.id)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
