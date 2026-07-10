import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Loader2 } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { eventTypeLabels } from '../../lib/events/eventDetails'
import { formatDisplayDate } from '../../lib/formatters/date'
import { editJobStatusLabels } from '../../services/firestore/jobDeliverables'
import { freelanceTypeLabels } from '../../services/firestore/freelancers'
import { getJobLocation, getJobTime, isEditorProfile, listFreelanceJobs, type FreelanceJobItem } from './freelanceJobs'

export function FreelanceJobsPage() {
  const { profile } = useAuth()
  const [jobs, setJobs] = useState<FreelanceJobItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadJobs() {
      if (!profile) return
      setIsLoading(true)
      setErrorMessage('')
      try {
        setJobs(await listFreelanceJobs(profile))
      } catch (error) {
        console.error('Failed to load freelance jobs', error)
        setErrorMessage('Daftar job belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadJobs()
  }, [profile])

  return (
    <div className="grid gap-6">
      <PageHeader
        title={isEditorProfile(profile) ? 'Dashboard Editor' : 'Daftar Job'}
        description="Pekerjaan yang ditugaskan kepada Anda."
      />

      <Card>
        <CardContent>
          <div className="mb-4 grid gap-2">
            <p className="text-sm text-neutral-500">Role</p>
            <div className="flex flex-wrap gap-2">
              {profile?.freelanceRoles.map((role) => (
                <span className="rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold" key={role}>
                  {freelanceTypeLabels[role]}
                </span>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat job...
            </div>
          ) : errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-neutral-500">Belum ada pekerjaan yang ditugaskan.</p>
          ) : (
            <div className="grid gap-3">
              {jobs.map((job) => (
                <Link className="rounded-md border border-app-border p-4 transition hover:border-app-gold" key={job.invoice.id} to={`/freelance/jobs/${job.invoice.id}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">{job.invoice.clientName}</p>
                      <p className="mt-1 text-sm text-neutral-500">{eventTypeLabels[job.invoice.eventType]}</p>
                    </div>
                    <span className="rounded-full bg-app-muted px-3 py-1 text-xs font-semibold">
                      {editJobStatusLabels[job.deliverable?.status ?? 'WAITING_UPLOAD']}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-neutral-600 sm:grid-cols-3">
                    <span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDisplayDate(job.invoice.eventDate)}</span>
                    <span>Jam: {getJobTime(job)}</span>
                    <span>Lokasi: {getJobLocation(job)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
