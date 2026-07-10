import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { FreelanceInviteRecord, FreelanceRecord, FreelanceRole, FreelanceType } from '../../types/domain'

export type FreelancerInput = {
  fullName: string
  freelanceType: FreelanceType
  roles: FreelanceRole[]
  whatsappNumber: string
  email: string
  address: string
  notes: string
  isActive: boolean
}

export const freelanceTypeLabels: Record<FreelanceType, string> = {
  FOTOGRAFER: 'Fotografer',
  VIDEOGRAFER: 'Videografer',
  EDITOR_FOTO: 'Editor Foto',
  EDITOR_VIDEO: 'Editor Video',
  ASISTEN: 'Asisten',
}

function makeInviteToken() {
  return `fl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function normalizeRoles(input: FreelancerInput | Partial<FreelanceRecord>) {
  const roles = Array.isArray(input.roles) && input.roles.length > 0 ? input.roles : input.freelanceType ? [input.freelanceType] : ['FOTOGRAFER' as FreelanceRole]
  return Array.from(new Set(roles))
}

function buildFreelancer(id: string, data: Record<string, unknown>): FreelanceRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    fullName: String(data.fullName ?? ''),
    freelanceType: (data.freelanceType as FreelanceType) ?? 'FOTOGRAFER',
    roles: normalizeRoles(data as Partial<FreelanceRecord>),
    whatsappNumber: String(data.whatsappNumber ?? ''),
    email: String(data.email ?? ''),
    authUid: typeof data.authUid === 'string' ? data.authUid : null,
    inviteToken: typeof data.inviteToken === 'string' ? data.inviteToken : null,
    inviteStatus:
      data.inviteStatus === 'PENDING' || data.inviteStatus === 'ACCEPTED' || data.inviteStatus === 'NOT_SENT'
        ? data.inviteStatus
        : 'NOT_SENT',
    address: typeof data.address === 'string' ? data.address : null,
    notes: typeof data.notes === 'string' ? data.notes : null,
    isActive: data.isActive !== false,
    createdAt: (data.createdAt as FreelanceRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as FreelanceRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as FreelanceRecord['deletedAt']) ?? null,
  }
}

function normalizeInput(input: FreelancerInput) {
  if (!input.fullName.trim()) throw new Error('FREELANCER_NAME_REQUIRED')
  if (!input.whatsappNumber.trim()) throw new Error('FREELANCER_WHATSAPP_REQUIRED')

  return {
    fullName: input.fullName.trim(),
    roles: normalizeRoles(input),
    freelanceType: normalizeRoles(input)[0],
    whatsappNumber: input.whatsappNumber.trim(),
    email: input.email.trim(),
    address: input.address.trim() || null,
    notes: input.notes.trim() || null,
    isActive: input.isActive,
  }
}

export async function listFreelancers(userId: string, includeInactive = true) {
  const freelancersQuery = query(collection(firestore, firestoreCollections.freelancers), where('userId', '==', userId))
  const snapshot = await getDocs(freelancersQuery)

  return snapshot.docs
    .map((freelancerDoc) => buildFreelancer(freelancerDoc.id, freelancerDoc.data()))
    .filter((freelancer) => !freelancer.deletedAt && (includeInactive || freelancer.isActive))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export async function getFreelancer(userId: string, freelancerId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.freelancers, freelancerId))
  if (!snapshot.exists()) return null

  const freelancer = buildFreelancer(snapshot.id, snapshot.data())
  if (freelancer.userId !== userId || freelancer.deletedAt) return null
  return freelancer
}

export async function createFreelancer(userId: string, input: FreelancerInput) {
  const normalized = normalizeInput(input)
  const inviteToken = input.email.trim() ? makeInviteToken() : null
  const freelancerRef = await addDoc(collection(firestore, firestoreCollections.freelancers), {
    userId,
    ...normalized,
    authUid: null,
    inviteToken,
    inviteStatus: inviteToken ? 'PENDING' : 'NOT_SENT',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })

  if (inviteToken) {
    await createFreelanceInvite(userId, freelancerRef.id, {
      fullName: normalized.fullName,
      email: normalized.email,
      roles: normalized.roles,
      token: inviteToken,
    })
  }
}

export async function updateFreelancer(userId: string, freelancerId: string, input: FreelancerInput) {
  const freelancer = await getFreelancer(userId, freelancerId)
  if (!freelancer) throw new Error('FREELANCER_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.freelancers, freelancerId), {
    userId,
    ...normalizeInput(input),
    updatedAt: serverTimestamp(),
  })
}

export async function ensureFreelancerInvite(userId: string, freelancerId: string) {
  const freelancer = await getFreelancer(userId, freelancerId)
  if (!freelancer) throw new Error('FREELANCER_NOT_FOUND')
  if (!freelancer.email.trim()) throw new Error('FREELANCER_EMAIL_REQUIRED')
  if (freelancer.inviteStatus === 'ACCEPTED') return freelancer
  if (freelancer.inviteToken) return freelancer

  const inviteToken = makeInviteToken()
  await updateDoc(doc(firestore, firestoreCollections.freelancers, freelancerId), {
    userId,
    inviteToken,
    inviteStatus: 'PENDING',
    updatedAt: serverTimestamp(),
  })
  await createFreelanceInvite(userId, freelancerId, {
    fullName: freelancer.fullName,
    email: freelancer.email,
    roles: freelancer.roles,
    token: inviteToken,
  })

  return {
    ...freelancer,
    inviteToken,
    inviteStatus: 'PENDING' as const,
  }
}

type InviteInput = {
  fullName: string
  email: string
  roles: FreelanceRole[]
  token: string
}

function buildInvite(id: string, data: Record<string, unknown>): FreelanceInviteRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    freelancerId: String(data.freelancerId ?? ''),
    email: String(data.email ?? ''),
    fullName: String(data.fullName ?? ''),
    roles: Array.isArray(data.roles) ? (data.roles as FreelanceRole[]) : [],
    token: String(data.token ?? ''),
    status: (data.status as FreelanceInviteRecord['status']) ?? 'PENDING',
    acceptedByUid: typeof data.acceptedByUid === 'string' ? data.acceptedByUid : null,
    acceptedAt: (data.acceptedAt as FreelanceInviteRecord['acceptedAt']) ?? null,
    expiresAt: (data.expiresAt as FreelanceInviteRecord['expiresAt']) ?? null,
    createdAt: (data.createdAt as FreelanceInviteRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as FreelanceInviteRecord['updatedAt']) ?? null,
  }
}

async function createFreelanceInvite(userId: string, freelancerId: string, input: InviteInput) {
  await addDoc(collection(firestore, firestoreCollections.freelanceInvites), {
    userId,
    freelancerId,
    fullName: input.fullName,
    email: input.email,
    roles: input.roles,
    token: input.token,
    status: 'PENDING',
    acceptedByUid: null,
    acceptedAt: null,
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getFreelanceInviteByToken(token: string) {
  const inviteQuery = query(
    collection(firestore, firestoreCollections.freelanceInvites),
    where('token', '==', token),
    where('status', '==', 'PENDING'),
  )
  const snapshot = await getDocs(inviteQuery)
  const firstDoc = snapshot.docs[0]
  if (!firstDoc) return null

  return buildInvite(firstDoc.id, firstDoc.data())
}

export async function markFreelanceInviteAccepted(invite: FreelanceInviteRecord, authUid: string) {
  await updateDoc(doc(firestore, firestoreCollections.freelanceInvites, invite.id), {
    status: 'ACCEPTED',
    acceptedByUid: authUid,
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await updateDoc(doc(firestore, firestoreCollections.freelancers, invite.freelancerId), {
    authUid,
    inviteStatus: 'ACCEPTED',
    updatedAt: serverTimestamp(),
  })
}

export async function softDeleteFreelancer(userId: string, freelancerId: string) {
  const freelancer = await getFreelancer(userId, freelancerId)
  if (!freelancer) throw new Error('FREELANCER_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.freelancers, freelancerId), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
