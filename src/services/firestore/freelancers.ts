import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { FreelanceRecord, FreelanceType } from '../../types/domain'

export type FreelancerInput = {
  fullName: string
  freelanceType: FreelanceType
  whatsappNumber: string
  email: string
  address: string
  notes: string
  isActive: boolean
}

export const freelanceTypeLabels: Record<FreelanceType, string> = {
  FOTOGRAFER: 'Fotografer',
  VIDEOGRAFER: 'Videografer',
  ASISTEN: 'Asisten',
}

function buildFreelancer(id: string, data: Record<string, unknown>): FreelanceRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    fullName: String(data.fullName ?? ''),
    freelanceType: (data.freelanceType as FreelanceType) ?? 'FOTOGRAFER',
    whatsappNumber: String(data.whatsappNumber ?? ''),
    email: String(data.email ?? ''),
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
    freelanceType: input.freelanceType,
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
  await addDoc(collection(firestore, firestoreCollections.freelancers), {
    userId,
    ...normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
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

export async function softDeleteFreelancer(userId: string, freelancerId: string) {
  const freelancer = await getFreelancer(userId, freelancerId)
  if (!freelancer) throw new Error('FREELANCER_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.freelancers, freelancerId), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
