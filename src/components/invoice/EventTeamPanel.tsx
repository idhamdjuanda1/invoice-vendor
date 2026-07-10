import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Loader2, Mail, MapPin, MessageCircle, Send, Users } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { env } from '../../config/env'
import { useAuth } from '../../features/auth/useAuth'
import { eventFieldDefinitions, eventStatusLabels, eventStatusStyles, eventTypeLabels, getPrimaryEventLocation, getPrimaryEventTime } from '../../lib/events/eventDetails'
import { getInvoiceEventByInvoiceId, publishClientForm, upsertInvoiceEvent } from '../../services/firestore/invoiceEvents'
import { freelanceTypeLabels, listFreelancers } from '../../services/firestore/freelancers'
import { editJobStatusLabels, listJobDeliverables } from '../../services/firestore/jobDeliverables'
import { getAssignmentConflicts, getAssignmentMembers, getTeamAssignmentByInvoiceId, saveTeamAssignment } from '../../services/firestore/teamAssignments'
import { buildTeamMailtoUrl, buildTeamMessage, buildTeamWhatsappUrls, logTeamNotification } from '../../services/notifications/teamNotifications'
import type { FreelanceRecord, FreelanceType, InvoiceEventDetail, InvoiceRecord, JobDeliverableRecord, TeamAssignmentRecord } from '../../types/domain'

type EventTeamPanelProps = {
  invoice: InvoiceRecord
  onChanged: () => void
}

function normalizeWhatsapp(value: string | null) {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

function buildClientFormWhatsappUrl(invoice: InvoiceRecord, formUrl: string) {
  const phone = normalizeWhatsapp(invoice.clientWhatsappNumber)
  const message = [
    `Halo ${invoice.clientName || 'Kak'},`,
    '',
    'Mohon bantu lengkapi detail acara melalui link berikut:',
    formUrl,
    '',
    'Data ini hanya untuk kebutuhan teknis acara dan tidak mengubah invoice/pembayaran.',
  ].join('\n')

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function getFilledDeliverableLinks(deliverable: JobDeliverableRecord) {
  return [
    ['Foto RAW', deliverable.links.photoRawUrl],
    ['Foto Edit', deliverable.links.photoEditedUrl],
    ['Album', deliverable.links.albumUrl],
    ['Footage Video', deliverable.links.videoFootageUrl],
    ['Video Highlight', deliverable.links.videoHighlightUrl],
    ['Video Full', deliverable.links.videoFullUrl],
    ['Revisi', deliverable.links.revisionUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
}

function buildClientDeliveryMessage(invoice: InvoiceRecord, deliverables: JobDeliverableRecord[]) {
  const linkRows = deliverables.flatMap((deliverable) => getFilledDeliverableLinks(deliverable))
  return [
    `Halo ${invoice.clientName || 'Kak'},`,
    '',
    'Berikut adalah hasil dokumentasi acara Anda.',
    '',
    ...linkRows.map(([label, url]) => `${label}: ${url}`),
    '',
    'Terima kasih telah menggunakan jasa kami.',
  ].join('\n')
}

function buildClientDeliveryWhatsappUrl(invoice: InvoiceRecord, message: string) {
  const phone = normalizeWhatsapp(invoice.clientWhatsappNumber)
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function buildClientDeliveryMailtoUrl(invoice: InvoiceRecord, message: string) {
  if (!invoice.clientEmail) return ''
  return `mailto:${encodeURIComponent(invoice.clientEmail)}?subject=${encodeURIComponent(`Hasil Dokumentasi - ${invoice.clientName}`)}&body=${encodeURIComponent(message)}`
}

export function EventTeamPanel({ invoice, onChanged }: EventTeamPanelProps) {
  const { profile } = useAuth()
  const [eventDetail, setEventDetail] = useState<InvoiceEventDetail | null>(null)
  const [eventInputDetails, setEventInputDetails] = useState<Record<string, string>>({})
  const [eventInputLocation, setEventInputLocation] = useState({
    venueName: '',
    address: '',
    googleMapsUrl: '',
  })
  const [freelancers, setFreelancers] = useState<FreelanceRecord[]>([])
  const [assignment, setAssignment] = useState<TeamAssignmentRecord | null>(null)
  const [deliverables, setDeliverables] = useState<JobDeliverableRecord[]>([])
  const [clientDeliveryMessage, setClientDeliveryMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState<Record<FreelanceType, string[]>>({
    FOTOGRAFER: [],
    VIDEOGRAFER: [],
    EDITOR_FOTO: [],
    EDITOR_VIDEO: [],
    ASISTEN: [],
    ACCOUNTING: [],
  })
  const [conflictMessage, setConflictMessage] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loadingAction, setLoadingAction] = useState('')

  const formUrl = eventDetail?.publicFormSlug ? `${env.appUrl.replace(/\/$/, '')}/form/${eventDetail.publicFormSlug}` : ''
  const eventFields = eventDetail ? eventFieldDefinitions[eventDetail.eventType] : []
  const selectedMembers = useMemo(() => getAssignmentMembers(assignment), [assignment])

  const loadPanel = useCallback(async () => {
    if (!profile?.uid) return

    try {
      const [eventData, freelancerList, assignmentData] = await Promise.all([
        getInvoiceEventByInvoiceId(profile.uid, invoice.id),
        listFreelancers(profile.uid, false),
        getTeamAssignmentByInvoiceId(profile.uid, invoice.id),
      ])
      const deliverableList = await listJobDeliverables(profile.uid)
      const invoiceDeliverables = deliverableList.filter((deliverable) => deliverable.invoiceId === invoice.id)
      setEventDetail(eventData)
      setEventInputDetails(eventData?.details ?? {})
      setEventInputLocation({
        venueName: eventData?.location.venueName ?? invoice.eventLocation ?? '',
        address: eventData?.location.address ?? '',
        googleMapsUrl: eventData?.location.googleMapsUrl ?? '',
      })
      setFreelancers(freelancerList)
      setAssignment(assignmentData)
      setDeliverables(invoiceDeliverables)
      setClientDeliveryMessage(buildClientDeliveryMessage(invoice, invoiceDeliverables))
      setSelectedIds({
        FOTOGRAFER: assignmentData?.photographers.map((member) => member.freelanceId) ?? [],
        VIDEOGRAFER: assignmentData?.videographers.map((member) => member.freelanceId) ?? [],
        EDITOR_FOTO: assignmentData?.photoEditors.map((member) => member.freelanceId) ?? [],
        EDITOR_VIDEO: assignmentData?.videoEditors.map((member) => member.freelanceId) ?? [],
        ASISTEN: assignmentData?.assistants.map((member) => member.freelanceId) ?? [],
        ACCOUNTING: [],
      })
    } catch (error) {
      console.error('Failed to load event/team panel', error)
      setErrorMessage('Detail acara atau data tim belum bisa dimuat.')
    }
  }, [invoice, profile?.uid])

  useEffect(() => {
    void loadPanel()
  }, [loadPanel])

  function toggleFreelancer(type: FreelanceType, freelancerId: string) {
    setSelectedIds((current) => {
      const currentIds = current[type]
      const nextIds = currentIds.includes(freelancerId)
        ? currentIds.filter((id) => id !== freelancerId)
        : [...currentIds, freelancerId]

      return { ...current, [type]: nextIds }
    })
  }

  async function handlePublishForm() {
    if (!profile?.uid) return

    setLoadingAction('publish')
    setMessage('')
    setErrorMessage('')

    try {
      const slug = await publishClientForm(profile.uid, invoice.id, invoice.eventType)
      await loadPanel()
      onChanged()
      const url = `${env.appUrl.replace(/\/$/, '')}/form/${slug}`
      await navigator.clipboard?.writeText(url).catch(() => undefined)
      setMessage('Form klien berhasil dipublish. Link sudah disiapkan untuk dibagikan.')
    } catch (error) {
      console.error('Failed to publish client form', error)
      setErrorMessage('Form klien belum bisa dipublish.')
    } finally {
      setLoadingAction('')
    }
  }

  async function handleSaveEventDetails() {
    if (!profile?.uid) return

    setLoadingAction('save-event')
    setMessage('')
    setErrorMessage('')

    try {
      await upsertInvoiceEvent(profile.uid, invoice.id, {
        eventType: invoice.eventType,
        details: eventInputDetails,
        location: {
          venueName: eventInputLocation.venueName,
          address: eventInputLocation.address,
          googleMapsUrl: eventInputLocation.googleMapsUrl,
          latitude: null,
          longitude: null,
        },
      })
      await loadPanel()
      onChanged()
      setMessage('Detail acara berhasil disimpan.')
    } catch (error) {
      console.error('Failed to save event details', error)
      setErrorMessage('Detail acara belum bisa disimpan.')
    } finally {
      setLoadingAction('')
    }
  }

  async function handleSaveTeam() {
    if (!profile?.uid) return

    setLoadingAction('save-team')
    setMessage('')
    setErrorMessage('')
    setConflictMessage('')

    try {
      const memberIds = [
        ...selectedIds.FOTOGRAFER,
        ...selectedIds.VIDEOGRAFER,
        ...selectedIds.EDITOR_FOTO,
        ...selectedIds.EDITOR_VIDEO,
        ...selectedIds.ASISTEN,
      ]
      const conflicts = await getAssignmentConflicts(profile.uid, invoice, memberIds)
      await saveTeamAssignment(profile.uid, invoice.id, {
        photographers: selectedIds.FOTOGRAFER,
        videographers: selectedIds.VIDEOGRAFER,
        photoEditors: selectedIds.EDITOR_FOTO,
        videoEditors: selectedIds.EDITOR_VIDEO,
        assistants: selectedIds.ASISTEN,
      }, freelancers)
      await loadPanel()
      setMessage('Tim bertugas berhasil disimpan.')
      if (conflicts.length > 0) {
        setConflictMessage(`Peringatan bentrok: ${conflicts.map((conflict) => `${conflict.invoiceNumber} - ${conflict.clientName}`).join(', ')}`)
      }
    } catch (error) {
      console.error('Failed to save team assignment', error)
      setErrorMessage('Tim bertugas belum bisa disimpan.')
    } finally {
      setLoadingAction('')
    }
  }

  async function handleSend(channel: 'whatsapp' | 'email') {
    if (!profile?.uid) return

    setLoadingAction(channel)
    setMessage('')
    setErrorMessage('')

    try {
      if (selectedMembers.length === 0) throw new Error('TEAM_RECIPIENTS_REQUIRED')

      const notificationMessage = buildTeamMessage(invoice, eventDetail)

      if (channel === 'whatsapp') {
        const whatsappUrls = buildTeamWhatsappUrls(invoice, eventDetail, selectedMembers)
        if (whatsappUrls.length === 0) throw new Error('TEAM_WHATSAPP_REQUIRED')
        whatsappUrls.forEach((entry) => window.open(entry.url, '_blank', 'noopener,noreferrer'))
        await logTeamNotification(profile.uid, invoice.id, channel, whatsappUrls.map((entry) => entry.recipient), 'sent', notificationMessage).catch(() => undefined)
        setMessage('WhatsApp tim sudah dibuka. Kirim pesan dari WhatsApp untuk masing-masing freelance.')
      } else {
        const mailtoUrl = buildTeamMailtoUrl(invoice, eventDetail, selectedMembers)
        if (!mailtoUrl) throw new Error('TEAM_EMAIL_REQUIRED')
        window.location.href = mailtoUrl
        await logTeamNotification(profile.uid, invoice.id, channel, selectedMembers.filter((member) => member.email), 'sent', notificationMessage).catch(() => undefined)
        setMessage('Email tim sudah dibuka di aplikasi email perangkat ini.')
      }
    } catch (error) {
      console.error('Failed to send team notification', error)
      const code = error instanceof Error ? error.message : ''
      const messages: Record<string, string> = {
        TEAM_RECIPIENTS_REQUIRED: 'Pilih dan simpan tim bertugas terlebih dahulu.',
        TEAM_WHATSAPP_REQUIRED: 'Nomor WhatsApp freelance belum tersedia.',
        TEAM_EMAIL_REQUIRED: 'Email freelance belum tersedia.',
      }
      setErrorMessage(messages[code] ?? 'Detail acara belum bisa dibuka untuk dikirim ke tim.')
    } finally {
      setLoadingAction('')
    }
  }

  function handleSendClientDelivery(channel: 'whatsapp' | 'email') {
    const filledLinks = deliverables.flatMap((deliverable) => getFilledDeliverableLinks(deliverable))
    if (filledLinks.length === 0) {
      setErrorMessage('Belum ada link hasil editing yang bisa dikirim ke klien.')
      return
    }

    if (channel === 'whatsapp') {
      if (!invoice.clientWhatsappNumber) {
        setErrorMessage('Nomor WhatsApp klien belum tersedia.')
        return
      }
      window.open(buildClientDeliveryWhatsappUrl(invoice, clientDeliveryMessage), '_blank', 'noopener,noreferrer')
      setMessage('WhatsApp klien sudah dibuka. Silakan cek dan kirim pesannya.')
      return
    }

    const mailtoUrl = buildClientDeliveryMailtoUrl(invoice, clientDeliveryMessage)
    if (!mailtoUrl) {
      setErrorMessage('Email klien belum tersedia.')
      return
    }
    window.location.href = mailtoUrl
    setMessage('Email klien sudah dibuka di aplikasi email perangkat ini.')
  }

  return (
    <div className="grid gap-5">
      {message ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {conflictMessage ? <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{conflictMessage}</div> : null}
      {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Form Detail Acara Klien</h2>
              <p className="mt-1 text-sm text-neutral-500">Jenis acara dikunci oleh vendor: {eventTypeLabels[invoice.eventType]}</p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${eventStatusStyles[invoice.eventDataStatus]}`}>
              {eventStatusLabels[invoice.eventDataStatus]}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loadingAction === 'publish'} icon={loadingAction === 'publish' ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} onClick={() => void handlePublishForm()}>
              Publish Form Klien
            </Button>
            {formUrl ? (
              <>
                <Button icon={<Copy size={16} />} variant="secondary" onClick={() => void navigator.clipboard?.writeText(formUrl)}>
                  Copy Link
                </Button>
                {invoice.clientWhatsappNumber ? (
                  <a href={buildClientFormWhatsappUrl(invoice, formUrl)} rel="noreferrer" target="_blank">
                    <Button icon={<MessageCircle size={16} />} type="button" variant="secondary">
                      Kirim ke Klien
                    </Button>
                  </a>
                ) : null}
              </>
            ) : null}
          </div>
          {formUrl ? <p className="break-all rounded-md bg-app-muted p-3 text-sm text-neutral-600">{formUrl}</p> : null}

          {eventDetail ? (
            <div className="grid gap-3 rounded-md border border-app-border p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-500">Jam Acara</p>
                <p className="mt-1 font-semibold">{getPrimaryEventTime(eventDetail) || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Lokasi Utama</p>
                <p className="mt-1 font-semibold">{getPrimaryEventLocation(eventDetail, invoice.eventLocation || '-') || '-'}</p>
              </div>
              {eventFields.map((field) => (
                <div key={field.key}>
                  <p className="text-xs text-neutral-500">{field.label}</p>
                  <p className="mt-1 font-semibold">{eventDetail.details[field.key] || '-'}</p>
                </div>
              ))}
              <div className="sm:col-span-2">
                <p className="text-xs text-neutral-500">Alamat Lengkap</p>
                <p className="mt-1 whitespace-pre-wrap font-semibold">{eventDetail.location.address || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-neutral-500">Patokan Alamat</p>
                <p className="mt-1 whitespace-pre-wrap font-semibold">{eventDetail.details.locationLandmark || '-'}</p>
              </div>
              {eventDetail.location.googleMapsUrl ? (
                <a className="sm:col-span-2" href={eventDetail.location.googleMapsUrl} rel="noreferrer" target="_blank">
                  <Button icon={<MapPin size={16} />} type="button" variant="secondary">Buka di Google Maps</Button>
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 rounded-md border border-app-border bg-white p-4">
            <div>
              <h3 className="text-sm font-semibold">Edit Detail Acara</h3>
              <p className="mt-1 text-xs text-neutral-500">Vendor dapat melengkapi atau memperbaiki data terbaru sebelum dikirim ke tim.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {eventFieldDefinitions[invoice.eventType].map((field) => field.type === 'textarea' ? (
                <label className="grid gap-2 text-sm font-medium text-app-text sm:col-span-2" key={field.key}>
                  {field.label}
                  <textarea
                    className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                    value={eventInputDetails[field.key] ?? ''}
                    onChange={(inputEvent) => setEventInputDetails((current) => ({ ...current, [field.key]: inputEvent.target.value }))}
                  />
                </label>
              ) : (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.type ?? 'text'}
                  value={eventInputDetails[field.key] ?? ''}
                  onChange={(inputEvent) => setEventInputDetails((current) => ({ ...current, [field.key]: inputEvent.target.value }))}
                />
              ))}
              <Input label="Nama Lokasi / Gedung" value={eventInputLocation.venueName} onChange={(inputEvent) => setEventInputLocation((current) => ({ ...current, venueName: inputEvent.target.value }))} />
              <Input label="Link Google Maps" value={eventInputLocation.googleMapsUrl} onChange={(inputEvent) => setEventInputLocation((current) => ({ ...current, googleMapsUrl: inputEvent.target.value }))} />
              <label className="grid gap-2 text-sm font-medium text-app-text sm:col-span-2">
                Alamat Lengkap
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                  placeholder="Tulis alamat lengkap seperti di aplikasi ojek online."
                  value={eventInputLocation.address}
                  onChange={(inputEvent) => setEventInputLocation((current) => ({ ...current, address: inputEvent.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-app-text sm:col-span-2">
                Patokan Alamat
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
                  placeholder="Contoh: dekat Gedung A, sebelah Indomaret, pagar hitam, masuk gang pertama."
                  value={eventInputDetails.locationLandmark ?? ''}
                  onChange={(inputEvent) => setEventInputDetails((current) => ({ ...current, locationLandmark: inputEvent.target.value }))}
                />
              </label>
            </div>
            <Button
              className="w-fit"
              disabled={loadingAction === 'save-event'}
              icon={loadingAction === 'save-event' ? <Loader2 className="animate-spin" size={16} /> : undefined}
              onClick={() => void handleSaveEventDetails()}
            >
              {loadingAction === 'save-event' ? 'Menyimpan...' : 'Simpan Detail Acara'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Users size={18} /> Tim yang Bertugas</h2>
        </CardHeader>
        <CardContent className="grid gap-5">
          {(['FOTOGRAFER', 'VIDEOGRAFER', 'EDITOR_FOTO', 'EDITOR_VIDEO', 'ASISTEN'] as FreelanceType[]).map((type) => {
            const options = freelancers.filter((freelancer) => freelancer.roles.includes(type))
            return (
              <div className="grid gap-2" key={type}>
                <p className="text-sm font-semibold">{freelanceTypeLabels[type]}</p>
                {options.length === 0 ? (
                  <p className="rounded-md bg-app-muted p-3 text-sm text-neutral-500">Belum ada {freelanceTypeLabels[type]} aktif di Master Freelance.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {options.map((freelancer) => (
                      <label className="flex items-start gap-3 rounded-md border border-app-border bg-white p-3 text-sm" key={freelancer.id}>
                        <input
                          checked={selectedIds[type].includes(freelancer.id)}
                          className="mt-1 size-4"
                          type="checkbox"
                          onChange={() => toggleFreelancer(type, freelancer.id)}
                        />
                        <span>
                          <span className="block font-semibold">{freelancer.fullName}</span>
                          <span className="block text-xs text-neutral-500">{freelancer.whatsappNumber}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loadingAction === 'save-team'} icon={loadingAction === 'save-team' ? <Loader2 className="animate-spin" size={16} /> : undefined} onClick={() => void handleSaveTeam()}>
              {loadingAction === 'save-team' ? 'Menyimpan...' : 'Simpan Tim'}
            </Button>
            <Button disabled={loadingAction === 'whatsapp'} icon={loadingAction === 'whatsapp' ? <Loader2 className="animate-spin" size={16} /> : <MessageCircle size={16} />} onClick={() => void handleSend('whatsapp')} variant="secondary">
              Kirim Detail Acara via WhatsApp
            </Button>
            <Button disabled={loadingAction === 'email'} icon={loadingAction === 'email' ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} onClick={() => void handleSend('email')} variant="secondary">
              Kirim Detail Acara via Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Hasil Editing</h2>
          <p className="mt-1 text-sm text-neutral-500">Vendor dapat memantau link Drive dari editor dan mengirimkannya ke klien.</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {deliverables.length === 0 ? (
            <p className="rounded-md bg-app-muted p-3 text-sm text-neutral-500">Belum ada link hasil pekerjaan dari editor.</p>
          ) : (
            <div className="grid gap-3">
              {deliverables.map((deliverable) => {
                const links = getFilledDeliverableLinks(deliverable)
                return (
                  <div className="rounded-md border border-app-border p-4" key={deliverable.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{deliverable.editorName || 'Editor'}</p>
                        <p className="mt-1 text-xs text-neutral-500">{deliverable.editorRoles.map((role) => freelanceTypeLabels[role]).join(', ') || 'Editor'}</p>
                      </div>
                      <span className="w-fit rounded-full bg-app-gold-soft px-3 py-1 text-xs font-semibold text-app-text">
                        {editJobStatusLabels[deliverable.status]}
                      </span>
                    </div>
                    {links.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {links.map(([label, url]) => (
                          <a className="break-all text-sm font-semibold text-app-gold hover:underline" href={url} key={`${deliverable.id}-${label}`} rel="noreferrer" target="_blank">
                            {label}: {url}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-neutral-500">Link belum diisi.</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <label className="grid gap-2 text-sm font-medium text-app-text">
            Pesan ke Klien
            <textarea
              className="min-h-40 rounded-md border border-app-border bg-white px-3 py-3 text-base outline-none focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft sm:text-sm"
              value={clientDeliveryMessage}
              onChange={(event) => setClientDeliveryMessage(event.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button icon={<MessageCircle size={16} />} onClick={() => handleSendClientDelivery('whatsapp')} variant="secondary">
              Kirim Link ke Klien via WhatsApp
            </Button>
            <Button icon={<Mail size={16} />} onClick={() => handleSendClientDelivery('email')} variant="secondary">
              Kirim Link ke Klien via Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
