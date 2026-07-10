import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { toInputDate } from '../../lib/formatters/date'
import { getPrimaryEventTime } from '../../lib/events/eventDetails'
import { firestore } from '../../lib/firebase/client'
import type { FreelanceRecord, FreelanceType, InvoiceRecord, TeamAssignmentMember, TeamAssignmentRecord } from '../../types/domain'
import { getInvoice, listInvoices } from './invoices'
import { getInvoiceEventByInvoiceId } from './invoiceEvents'

export type TeamAssignmentInput = {
  photographers: string[]
  videographers: string[]
  assistants: string[]
}

export type FreelancerScheduleItem = {
  invoiceId: string
  invoiceNumber: string
  clientName: string
  eventType: InvoiceRecord['eventType']
  eventDate: InvoiceRecord['eventDate']
  location: string
  eventTime: string
}

function memberFromFreelancer(freelancer: FreelanceRecord): TeamAssignmentMember {
  return {
    freelanceId: freelancer.id,
    fullName: freelancer.fullName,
    freelanceType: freelancer.freelanceType,
    whatsappNumber: freelancer.whatsappNumber,
    email: freelancer.email,
  }
}

function buildAssignment(id: string, data: Record<string, unknown>): TeamAssignmentRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    photographers: Array.isArray(data.photographers) ? (data.photographers as TeamAssignmentMember[]) : [],
    videographers: Array.isArray(data.videographers) ? (data.videographers as TeamAssignmentMember[]) : [],
    assistants: Array.isArray(data.assistants) ? (data.assistants as TeamAssignmentMember[]) : [],
    createdAt: (data.createdAt as TeamAssignmentRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as TeamAssignmentRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as TeamAssignmentRecord['deletedAt']) ?? null,
  }
}

export function getAssignmentMembers(assignment: TeamAssignmentRecord | null) {
  if (!assignment) return []
  return [...assignment.photographers, ...assignment.videographers, ...assignment.assistants]
}

export async function listTeamAssignments(userId: string) {
  const assignmentsQuery = query(collection(firestore, firestoreCollections.teamAssignments), where('userId', '==', userId))
  const snapshot = await getDocs(assignmentsQuery)

  return snapshot.docs
    .map((assignmentDoc) => buildAssignment(assignmentDoc.id, assignmentDoc.data()))
    .filter((assignment) => !assignment.deletedAt)
}

export async function getTeamAssignmentByInvoiceId(userId: string, invoiceId: string) {
  const assignments = await listTeamAssignments(userId)
  return assignments.find((assignment) => assignment.invoiceId === invoiceId) ?? null
}

export async function saveTeamAssignment(userId: string, invoiceId: string, input: TeamAssignmentInput, freelancers: FreelanceRecord[]) {
  const assignment = await getTeamAssignmentByInvoiceId(userId, invoiceId)
  const byId = new Map(freelancers.map((freelancer) => [freelancer.id, freelancer]))
  const mapMembers = (ids: string[], type: FreelanceType) =>
    ids
      .map((id) => byId.get(id))
      .filter((freelancer): freelancer is FreelanceRecord => freelancer?.freelanceType === type)
      .map(memberFromFreelancer)

  const payload = {
    userId,
    invoiceId,
    photographers: mapMembers(input.photographers, 'FOTOGRAFER'),
    videographers: mapMembers(input.videographers, 'VIDEOGRAFER'),
    assistants: mapMembers(input.assistants, 'ASISTEN'),
    updatedAt: serverTimestamp(),
  }

  if (assignment) {
    await updateDoc(doc(firestore, firestoreCollections.teamAssignments, assignment.id), payload)
    return
  }

  await addDoc(collection(firestore, firestoreCollections.teamAssignments), {
    ...payload,
    createdAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function getFreelancerSchedule(userId: string, freelancerId: string): Promise<FreelancerScheduleItem[]> {
  const [assignments, invoices] = await Promise.all([listTeamAssignments(userId), listInvoices(userId)])
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const relatedAssignments = assignments.filter((assignment) =>
    getAssignmentMembers(assignment).some((member) => member.freelanceId === freelancerId),
  )

  const items = await Promise.all(
    relatedAssignments.map(async (assignment) => {
      const invoice = invoiceById.get(assignment.invoiceId) ?? (await getInvoice(userId, assignment.invoiceId))
      if (!invoice) return null
      const event = await getInvoiceEventByInvoiceId(userId, invoice.id)

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        eventType: invoice.eventType,
        eventDate: invoice.eventDate,
        location: event?.location.venueName || event?.location.address || invoice.eventLocation,
        eventTime: getPrimaryEventTime(event),
      }
    }),
  )

  return items
    .filter((item): item is FreelancerScheduleItem => Boolean(item))
    .sort((a, b) => toInputDate(a.eventDate).localeCompare(toInputDate(b.eventDate)))
}

export async function getAssignmentConflicts(userId: string, invoice: InvoiceRecord, memberIds: string[]) {
  if (memberIds.length === 0) return []

  const eventDate = toInputDate(invoice.eventDate)
  if (!eventDate) return []

  const assignments = await listTeamAssignments(userId)
  const conflicts: Array<{ freelanceId: string; invoiceNumber: string; clientName: string }> = []

  for (const assignment of assignments) {
    if (assignment.invoiceId === invoice.id) continue
    const otherInvoice = await getInvoice(userId, assignment.invoiceId)
    if (!otherInvoice || toInputDate(otherInvoice.eventDate) !== eventDate) continue

    getAssignmentMembers(assignment).forEach((member) => {
      if (memberIds.includes(member.freelanceId)) {
        conflicts.push({
          freelanceId: member.freelanceId,
          invoiceNumber: otherInvoice.invoiceNumber,
          clientName: otherInvoice.clientName,
        })
      }
    })
  }

  return conflicts
}
