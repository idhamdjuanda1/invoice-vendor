import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Edit3, Loader2, Plus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { createPartner, listPartners, partnerCategoryLabels, updatePartner, type PartnerInput } from '../../services/firestore/partners'
import type { PartnerCategory, PartnerRecord } from '../../types/domain'

const emptyInput: PartnerInput = {
  name: '',
  category: 'WEDDING_ORGANIZER',
  picName: '',
  whatsappNumber: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
}

function getPartnerSaveError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : ''

  if (message === 'PARTNER_NAME_REQUIRED') return 'Nama partner wajib diisi.'
  if (message === 'PARTNER_NOT_FOUND') return 'Partner tidak ditemukan.'
  if (code === 'permission-denied') return 'Partner belum bisa disimpan karena Firestore rules belum mengizinkan. Deploy rules terbaru dulu.'

  return 'Partner belum bisa disimpan. Cek koneksi atau coba ulang.'
}

export function PartnersPage() {
  const { profile } = useAuth()
  const [partners, setPartners] = useState<PartnerRecord[]>([])
  const [input, setInput] = useState<PartnerInput>(emptyInput)
  const [editingId, setEditingId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadPartners = useCallback(async () => {
    if (!profile?.uid) return
    setIsLoading(true)
    setErrorMessage('')
    try {
      setPartners(await listPartners(profile.uid))
    } catch (error) {
      console.error('Failed to load partners', error)
      setErrorMessage('Data partner belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadPartners()
  }, [loadPartners])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.uid) return
    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      if (editingId) await updatePartner(profile.uid, editingId, input)
      else await createPartner(profile.uid, input)
      setInput(emptyInput)
      setEditingId('')
      await loadPartners()
      setMessage(editingId ? 'Partner berhasil diperbarui.' : 'Partner berhasil ditambahkan.')
    } catch (error) {
      console.error('Failed to save partner', error)
      setErrorMessage(getPartnerSaveError(error))
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(partner: PartnerRecord) {
    setEditingId(partner.id)
    setInput({
      name: partner.name,
      category: partner.category,
      picName: partner.picName ?? '',
      whatsappNumber: partner.whatsappNumber ?? '',
      email: partner.email ?? '',
      address: partner.address ?? '',
      notes: partner.notes ?? '',
      isActive: partner.isActive,
    })
    setMessage('Mode edit partner aktif.')
    setErrorMessage('')
  }

  function cancelEdit() {
    setEditingId('')
    setInput(emptyInput)
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Master Partner" description="Kelola sumber job seperti WO, dekorasi, MUA, venue, EO, dan vendor lainnya." />
      {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{editingId ? 'Edit Partner' : 'Tambah Partner'}</h2>
              {editingId ? <Button className="min-h-9 px-3 py-1.5" icon={<X size={15} />} onClick={cancelEdit} type="button" variant="secondary">Batal</Button> : null}
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Input label="Nama Partner" value={input.name} onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))} />
              <label className="grid gap-2 text-sm font-medium text-app-text">
                Kategori
                <select className="min-h-12 rounded-md border border-app-border bg-white px-3" value={input.category} onChange={(event) => setInput((current) => ({ ...current, category: event.target.value as PartnerCategory }))}>
                  {Object.entries(partnerCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Input label="Nama PIC" value={input.picName} onChange={(event) => setInput((current) => ({ ...current, picName: event.target.value }))} />
              <Input label="Nomor WhatsApp" value={input.whatsappNumber} onChange={(event) => setInput((current) => ({ ...current, whatsappNumber: event.target.value }))} />
              <Input label="Email" type="email" value={input.email} onChange={(event) => setInput((current) => ({ ...current, email: event.target.value }))} />
              <Input label="Alamat" value={input.address} onChange={(event) => setInput((current) => ({ ...current, address: event.target.value }))} />
              <Input label="Catatan" value={input.notes} onChange={(event) => setInput((current) => ({ ...current, notes: event.target.value }))} />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input checked={input.isActive} className="size-4" type="checkbox" onChange={(event) => setInput((current) => ({ ...current, isActive: event.target.checked }))} />
                Partner aktif
              </label>
              <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}>
                {editingId ? 'Simpan Perubahan' : 'Tambah Partner'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="text-base font-semibold">Daftar Partner</h2></CardHeader>
          <CardContent className="grid gap-3">
            {isLoading ? <p className="text-sm text-neutral-500">Memuat partner...</p> : null}
            {!isLoading && partners.length === 0 ? <p className="text-sm text-neutral-500">Belum ada partner.</p> : null}
            {partners.map((partner) => (
              <div className="rounded-md border border-app-border p-4" key={partner.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{partner.name}</p>
                    <p className="text-sm text-neutral-500">{partnerCategoryLabels[partner.category]}{partner.picName ? ` - ${partner.picName}` : ''}</p>
                    <p className="mt-1 text-xs text-neutral-500">{partner.whatsappNumber || '-'}{partner.email ? ` - ${partner.email}` : ''}</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${partner.isActive ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      {partner.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <Button className="min-h-9 px-3 py-1.5" icon={<Edit3 size={15} />} onClick={() => startEdit(partner)} type="button" variant="secondary">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
