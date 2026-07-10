import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { EditJobStatus, FreelanceRole, JobDeliverableLinks, JobDeliverableRecord } from '../../types/domain'

export type JobDeliverableInput = {
  status: EditJobStatus
  links: JobDeliverableLinks
  notes: string
}

export const editJobStatusLabels: Record<EditJobStatus, string> = {
  WAITING_UPLOAD: 'Menunggu Upload',
  IN_PROGRESS: 'Sedang Diedit',
  DONE: 'Selesai',
}

export const emptyDeliverableLinks: JobDeliverableLinks = {
  photoRawUrl: '',
  photoEditedUrl: '',
  albumUrl: '',
  videoFootageUrl: '',
  videoHighlightUrl: '',
  videoFullUrl: '',
  revisionUrl: '',
}

function normalizeLinks(value: unknown): JobDeliverableLinks {
  const links = value && typeof value === 'object' ? value as Partial<JobDeliverableLinks> : {}
  return {
    photoRawUrl: links.photoRawUrl ?? '',
    photoEditedUrl: links.photoEditedUrl ?? '',
    albumUrl: links.albumUrl ?? '',
    videoFootageUrl: links.videoFootageUrl ?? '',
    videoHighlightUrl: links.videoHighlightUrl ?? '',
    videoFullUrl: links.videoFullUrl ?? '',
    revisionUrl: links.revisionUrl ?? '',
  }
}

function buildDeliverable(id: string, data: Record<string, unknown>): JobDeliverableRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    freelancerId: String(data.freelancerId ?? ''),
    editorUid: typeof data.editorUid === 'string' ? data.editorUid : null,
    editorName: String(data.editorName ?? ''),
    editorRoles: Array.isArray(data.editorRoles) ? data.editorRoles as FreelanceRole[] : [],
    status: data.status === 'IN_PROGRESS' || data.status === 'DONE' ? data.status : 'WAITING_UPLOAD',
    links: normalizeLinks(data.links),
    notes: typeof data.notes === 'string' ? data.notes : null,
    uploadedAt: (data.uploadedAt as JobDeliverableRecord['uploadedAt']) ?? null,
    createdAt: (data.createdAt as JobDeliverableRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as JobDeliverableRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as JobDeliverableRecord['deletedAt']) ?? null,
  }
}

export async function listJobDeliverables(userId: string) {
  const deliverablesQuery = query(collection(firestore, firestoreCollections.jobDeliverables), where('userId', '==', userId))
  const snapshot = await getDocs(deliverablesQuery)
  return snapshot.docs
    .map((deliverableDoc) => buildDeliverable(deliverableDoc.id, deliverableDoc.data()))
    .filter((deliverable) => !deliverable.deletedAt)
}

export async function getDeliverableForEditor(userId: string, invoiceId: string, freelancerId: string) {
  const deliverables = await listJobDeliverables(userId)
  return deliverables.find((deliverable) => deliverable.invoiceId === invoiceId && deliverable.freelancerId === freelancerId) ?? null
}

export async function upsertJobDeliverable(params: {
  userId: string
  invoiceId: string
  freelancerId: string
  editorUid: string | null
  editorName: string
  editorRoles: FreelanceRole[]
  input: JobDeliverableInput
}) {
  const existing = await getDeliverableForEditor(params.userId, params.invoiceId, params.freelancerId)
  const payload = {
    userId: params.userId,
    invoiceId: params.invoiceId,
    freelancerId: params.freelancerId,
    editorUid: params.editorUid,
    editorName: params.editorName,
    editorRoles: params.editorRoles,
    status: params.input.status,
    links: params.input.links,
    notes: params.input.notes.trim() || null,
    uploadedAt: params.input.status === 'DONE' ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  }

  if (existing) {
    await updateDoc(doc(firestore, firestoreCollections.jobDeliverables, existing.id), payload)
    return
  }

  await addDoc(collection(firestore, firestoreCollections.jobDeliverables), {
    ...payload,
    createdAt: serverTimestamp(),
    deletedAt: null,
  })
}

export async function getJobDeliverableById(userId: string, deliverableId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.jobDeliverables, deliverableId))
  if (!snapshot.exists()) return null
  const deliverable = buildDeliverable(snapshot.id, snapshot.data())
  if (deliverable.userId !== userId || deliverable.deletedAt) return null
  return deliverable
}
