import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../features/auth/useAuth'
import { eventTypeLabels } from '../../lib/events/eventDetails'
import { formatDisplayDate } from '../../lib/formatters/date'
import {
  editJobStatusLabels,
  emptyDeliverableLinks,
  upsertJobDeliverable,
  type JobDeliverableInput,
} from '../../services/firestore/jobDeliverables'
import { freelanceTypeLabels } from '../../services/firestore/freelancers'
import type { EditJobStatus } from '../../types/domain'
import { getFreelanceJob, getJobLocation, getJobTime, isEditorProfile, type FreelanceJobItem } from './freelanceJobs'

export function FreelanceJobDetailPage() {
  const { invoiceId } = useParams()
  const { profile } = useAuth()
  const [job, setJob] = useState<FreelanceJobItem | null>(null)
  const [input, setInput] = useState<JobDeliverableInput>({
    status: 'WAITING_UPLOAD',
    links: emptyDeliverableLinks,
    notes: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadJob() {
      if (!profile || !invoiceId) return
      setIsLoading(true)
      setErrorMessage('')
      try {
        const loadedJob = await getFreelanceJob(profile, invoiceId)
        setJob(loadedJob)
        if (loadedJob?.deliverable) {
          setInput({
            status: loadedJob.deliverable.status,
            links: loadedJob.deliverable.links,
            notes: loadedJob.deliverable.notes ?? '',
          })
        }
        if (!loadedJob) setErrorMessage('Job tidak ditemukan atau bukan assignment Anda.')
      } catch (error) {
        console.error('Failed to load freelance job detail', error)
        setErrorMessage('Detail job belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadJob()
  }, [invoiceId, profile])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.vendorId || !profile.freelancerId || !job) return

    setIsSaving(true)
    setMessage('')
    setErrorMessage('')
    try {
      await upsertJobDeliverable({
        userId: profile.vendorId,
        invoiceId: job.invoice.id,
        freelancerId: profile.freelancerId,
        editorUid: profile.uid,
        editorName: profile.name,
        editorRoles: profile.freelanceRoles,
        input,
      })
      setMessage('Link hasil pekerjaan berhasil disimpan.')
    } catch (error) {
      console.error('Failed to save deliverable', error)
      setErrorMessage('Link hasil pekerjaan belum bisa disimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  const canEdit = isEditorProfile(profile)

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/freelance/jobs">
          <Button icon={<ArrowLeft size={16} />} variant="secondary">Kembali</Button>
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={16} />
            Memuat detail job...
          </CardContent>
        </Card>
      ) : errorMessage && !job ? (
        <Card><CardContent className="text-sm text-red-600">{errorMessage}</CardContent></Card>
      ) : job ? (
        <>
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-neutral-500">Klien</p>
                <p className="mt-1 font-bold">{job.invoice.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Jenis Acara</p>
                <p className="mt-1 font-bold">{eventTypeLabels[job.invoice.eventType]}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Tanggal</p>
                <p className="mt-1 font-bold">{formatDisplayDate(job.invoice.eventDate)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Jam</p>
                <p className="mt-1 font-bold">{getJobTime(job)}</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-xs text-neutral-500">Lokasi</p>
                <p className="mt-1 font-bold">{getJobLocation(job)}</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-neutral-500">Role Anda</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile?.freelanceRoles.map((role) => (
                    <span className="rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold" key={role}>{freelanceTypeLabels[role]}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
          {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Upload Link Hasil</h2>
              {!canEdit ? <p className="mt-1 text-sm text-neutral-500">Hanya role Editor Foto/Editor Video yang dapat mengisi link hasil editing.</p> : null}
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-2 text-sm font-medium text-app-text">
                  Status Edit
                  <select
                    className="min-h-12 rounded-md border border-app-border bg-white px-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:min-h-11 sm:text-sm"
                    disabled={!canEdit}
                    value={input.status}
                    onChange={(event) => setInput((current) => ({ ...current, status: event.target.value as EditJobStatus }))}
                  >
                    {Object.entries(editJobStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input disabled={!canEdit} label="Link Folder Foto RAW" value={input.links.photoRawUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, photoRawUrl: event.target.value } }))} />
                  <Input disabled={!canEdit} label="Link Folder Foto Edit" value={input.links.photoEditedUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, photoEditedUrl: event.target.value } }))} />
                  <Input disabled={!canEdit} label="Link Album" value={input.links.albumUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, albumUrl: event.target.value } }))} />
                  <Input disabled={!canEdit} label="Link Footage" value={input.links.videoFootageUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, videoFootageUrl: event.target.value } }))} />
                  <Input disabled={!canEdit} label="Link Video Highlight" value={input.links.videoHighlightUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, videoHighlightUrl: event.target.value } }))} />
                  <Input disabled={!canEdit} label="Link Video Full" value={input.links.videoFullUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, videoFullUrl: event.target.value } }))} />
                  <Input disabled={!canEdit} label="Link Revisi" value={input.links.revisionUrl} onChange={(event) => setInput((current) => ({ ...current, links: { ...current.links, revisionUrl: event.target.value } }))} />
                </div>
                <label className="grid gap-2 text-sm font-medium text-app-text">
                  Catatan
                  <textarea
                    className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft disabled:bg-neutral-100 sm:text-sm"
                    disabled={!canEdit}
                    value={input.notes}
                    onChange={(event) => setInput((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>
                {canEdit ? (
                  <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : undefined}>
                    {isSaving ? 'Menyimpan...' : 'Simpan Link'}
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
