import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { eventTypeLabels } from '../../lib/events/eventDetails'
import { formatDisplayDate } from '../../lib/formatters/date'
import { getInvoiceEventByInvoiceId } from '../../services/firestore/invoiceEvents'
import { editJobStatusLabels, listJobDeliverables } from '../../services/firestore/jobDeliverables'
import { freelanceTypeLabels } from '../../services/firestore/freelancers'
import { listInvoices } from '../../services/firestore/invoices'
import { getAssignmentMembers, listTeamAssignments } from '../../services/firestore/teamAssignments'
import type { InvoiceEventDetail, InvoiceRecord, JobDeliverableRecord, TeamAssignmentRecord, TeamAssignmentMember } from '../../types/domain'

type EditorJob = {
  invoice: InvoiceRecord
  assignment: TeamAssignmentRecord
  event: InvoiceEventDetail | null
  editors: TeamAssignmentMember[]
  deliverables: JobDeliverableRecord[]
}

function getFilledLinkCount(deliverable: JobDeliverableRecord) {
  return Object.values(deliverable.links).filter(Boolean).length
}

function getLocation(job: EditorJob) {
  return job.event?.location.venueName || job.event?.location.address || job.invoice.eventLocation || '-'
}

export function EditorDashboardPage() {
  const { profile } = useAuth()
  const [jobs, setJobs] = useState<EditorJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadJobs = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const [invoices, assignments, deliverables] = await Promise.all([
        listInvoices(profile.uid),
        listTeamAssignments(profile.uid),
        listJobDeliverables(profile.uid),
      ])
      const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
      const editorAssignments = assignments.filter((assignment) => assignment.photoEditors.length > 0 || assignment.videoEditors.length > 0)

      const loadedJobs = await Promise.all(
        editorAssignments.map(async (assignment) => {
          const invoice = invoiceById.get(assignment.invoiceId)
          if (!invoice) return null
          const event = await getInvoiceEventByInvoiceId(profile.uid, invoice.id)
          const editors = getAssignmentMembers(assignment).filter((member) => member.freelanceType === 'EDITOR_FOTO' || member.freelanceType === 'EDITOR_VIDEO')
          return {
            invoice,
            assignment,
            event,
            editors,
            deliverables: deliverables.filter((deliverable) => deliverable.invoiceId === invoice.id),
          }
        }),
      )

      setJobs(loadedJobs.filter((job): job is EditorJob => Boolean(job)))
    } catch (error) {
      console.error('Failed to load editor dashboard', error)
      setErrorMessage('Dashboard editor belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [profile?.uid])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const summary = useMemo(() => {
    const totalEditors = new Set(jobs.flatMap((job) => job.editors.map((editor) => editor.freelanceId))).size
    const doneJobs = jobs.filter((job) => job.deliverables.some((deliverable) => deliverable.status === 'DONE')).length
    const inProgressJobs = jobs.filter((job) => job.deliverables.some((deliverable) => deliverable.status === 'IN_PROGRESS')).length
    return { totalJobs: jobs.length, totalEditors, doneJobs, inProgressJobs }
  }, [jobs])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Editor"
        description="Monitoring pekerjaan editor foto/video, status edit, dan link hasil Google Drive."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Job Editing', summary.totalJobs],
          ['Editor Aktif', summary.totalEditors],
          ['Sedang Diedit', summary.inProgressJobs],
          ['Selesai', summary.doneJobs],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat job editor...
            </div>
          ) : errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-neutral-500">Belum ada invoice yang ditugaskan ke Editor Foto atau Editor Video.</p>
          ) : (
            <div className="grid gap-3">
              {jobs.map((job) => (
                <div className="rounded-md border border-app-border bg-white p-4" key={job.assignment.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-base font-bold">{job.invoice.clientName}</p>
                      <p className="mt-1 text-sm text-neutral-500">{eventTypeLabels[job.invoice.eventType]}</p>
                    </div>
                    <Link to={`/invoices/${job.invoice.id}`}>
                      <Button icon={<ExternalLink size={16} />} variant="secondary">Detail Invoice</Button>
                    </Link>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-neutral-600 md:grid-cols-3">
                    <span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDisplayDate(job.invoice.eventDate)}</span>
                    <span>Lokasi: {getLocation(job)}</span>
                    <span>Invoice: {job.invoice.invoiceNumber}</span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {job.editors.map((editor) => {
                      const deliverable = job.deliverables.find((item) => item.freelancerId === editor.freelanceId)
                      return (
                        <div className="rounded-md bg-app-muted p-3" key={`${job.assignment.id}-${editor.freelanceId}-${editor.freelanceType}`}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold">{editor.fullName}</p>
                              <p className="text-xs text-neutral-500">{freelanceTypeLabels[editor.freelanceType]}</p>
                            </div>
                            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold">
                              {editJobStatusLabels[deliverable?.status ?? 'WAITING_UPLOAD']}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-neutral-600">
                            Link terisi: {deliverable ? getFilledLinkCount(deliverable) : 0}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
