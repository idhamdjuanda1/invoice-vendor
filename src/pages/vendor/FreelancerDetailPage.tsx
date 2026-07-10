import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { eventTypeLabels } from '../../lib/events/eventDetails'
import { formatDisplayDate } from '../../lib/formatters/date'
import { freelanceTypeLabels, getFreelancer } from '../../services/firestore/freelancers'
import { getFreelancerSchedule, type FreelancerScheduleItem } from '../../services/firestore/teamAssignments'
import type { FreelanceRecord } from '../../types/domain'

export function FreelancerDetailPage() {
  const { freelancerId } = useParams()
  const { profile } = useAuth()
  const [freelancer, setFreelancer] = useState<FreelanceRecord | null>(null)
  const [schedule, setSchedule] = useState<FreelancerScheduleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadDetail() {
      if (!profile?.uid || !freelancerId) return

      setIsLoading(true)
      setErrorMessage('')

      try {
        const [freelancerData, scheduleData] = await Promise.all([
          getFreelancer(profile.uid, freelancerId),
          getFreelancerSchedule(profile.uid, freelancerId),
        ])
        setFreelancer(freelancerData)
        setSchedule(scheduleData)
        if (!freelancerData) setErrorMessage('Freelance tidak ditemukan.')
      } catch (error) {
        console.error('Failed to load freelancer detail', error)
        setErrorMessage('Profil freelance belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadDetail()
  }, [freelancerId, profile?.uid])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Profil Freelance"
        description="Kalender pekerjaan dan riwayat assignment freelance."
        actions={
          <Link to="/freelancers">
            <Button icon={<ArrowLeft size={16} />} variant="secondary">Kembali</Button>
          </Link>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={16} />
            Memuat profil freelance...
          </CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="text-sm text-red-600">{errorMessage}</CardContent>
        </Card>
      ) : freelancer ? (
        <>
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-neutral-500">Nama</p>
                <p className="mt-1 font-bold">{freelancer.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Jenis</p>
                <p className="mt-1 font-bold">{freelanceTypeLabels[freelancer.freelanceType]}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">WhatsApp</p>
                <p className="mt-1 font-bold">{freelancer.whatsappNumber}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Email</p>
                <p className="mt-1 font-bold">{freelancer.email || '-'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={18} />
                <h2 className="text-base font-semibold">Kalender Pekerjaan</h2>
              </div>
              {schedule.length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada pekerjaan terjadwal.</p>
              ) : (
                <div className="grid gap-3">
                  {schedule.map((item) => (
                    <Link
                      className="rounded-md border border-app-border bg-white p-4 transition hover:border-app-gold"
                      key={`${item.invoiceId}-${item.invoiceNumber}`}
                      to={`/invoices/${item.invoiceId}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold">{item.clientName || item.invoiceNumber}</p>
                          <p className="mt-1 text-sm text-neutral-500">{eventTypeLabels[item.eventType]}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatDisplayDate(item.eventDate)}</p>
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-neutral-600">
                        <span>Jam: {item.eventTime || '-'}</span>
                        <span>Lokasi: {item.location || '-'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
