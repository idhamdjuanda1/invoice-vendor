import { getPrimaryEventLocation, getPrimaryEventTime } from '../../lib/events/eventDetails'
import { listInvoices } from '../../services/firestore/invoices'
import { getInvoiceEventByInvoiceId } from '../../services/firestore/invoiceEvents'
import { getDeliverableForEditor, listJobDeliverables } from '../../services/firestore/jobDeliverables'
import { getAssignmentMembers, getTeamAssignmentByInvoiceId, listTeamAssignments } from '../../services/firestore/teamAssignments'
import type { InvoiceEventDetail, InvoiceRecord, JobDeliverableRecord, TeamAssignmentRecord, UserProfile } from '../../types/domain'

export type FreelanceJobItem = {
  invoice: InvoiceRecord
  assignment: TeamAssignmentRecord
  event: InvoiceEventDetail | null
  deliverable: JobDeliverableRecord | null
}

export function isEditorProfile(profile: UserProfile | null) {
  return Boolean(profile?.freelanceRoles.some((role) => role === 'EDITOR_FOTO' || role === 'EDITOR_VIDEO'))
}

export async function listFreelanceJobs(profile: UserProfile): Promise<FreelanceJobItem[]> {
  if (!profile.vendorId || !profile.freelancerId) return []

  const [assignments, invoices, deliverables] = await Promise.all([
    listTeamAssignments(profile.vendorId),
    listInvoices(profile.vendorId),
    listJobDeliverables(profile.vendorId),
  ])
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const relatedAssignments = assignments.filter((assignment) =>
    getAssignmentMembers(assignment).some((member) => member.freelanceId === profile.freelancerId),
  )

  const jobs = await Promise.all(
    relatedAssignments.map(async (assignment) => {
      const invoice = invoiceById.get(assignment.invoiceId)
      if (!invoice) return null
      const event = await getInvoiceEventByInvoiceId(profile.vendorId || '', invoice.id)
      const deliverable = deliverables.find(
        (item) => item.invoiceId === invoice.id && item.freelancerId === profile.freelancerId,
      ) ?? null

      return { invoice, assignment, event, deliverable }
    }),
  )

  return jobs.filter((job): job is FreelanceJobItem => Boolean(job))
}

export async function getFreelanceJob(profile: UserProfile, invoiceId: string) {
  if (!profile.vendorId || !profile.freelancerId) return null
  const jobs = await listFreelanceJobs(profile)
  const existing = jobs.find((job) => job.invoice.id === invoiceId)
  if (existing) return existing

  const assignment = await getTeamAssignmentByInvoiceId(profile.vendorId, invoiceId)
  if (!assignment || !getAssignmentMembers(assignment).some((member) => member.freelanceId === profile.freelancerId)) return null
  const invoices = await listInvoices(profile.vendorId)
  const invoice = invoices.find((item) => item.id === invoiceId)
  if (!invoice) return null
  const event = await getInvoiceEventByInvoiceId(profile.vendorId, invoice.id)
  const deliverable = await getDeliverableForEditor(profile.vendorId, invoice.id, profile.freelancerId)
  return { invoice, assignment, event, deliverable }
}

export function getJobLocation(job: FreelanceJobItem) {
  return getPrimaryEventLocation(job.event, job.invoice.eventLocation || '-')
}

export function getJobTime(job: FreelanceJobItem) {
  return getPrimaryEventTime(job.event) || '-'
}
