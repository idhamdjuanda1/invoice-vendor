import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { FreelanceRole, UserProfile } from '../../types/domain'

function normalizeRole(value: unknown): UserProfile['role'] {
  if (value === 'super_admin' || value === 'freelance') return value
  return 'user'
}

function normalizeFeatureAccess(value: unknown): UserProfile['featureAccess'] {
  return value === 'WITHOUT_ACCOUNTING' ? 'WITHOUT_ACCOUNTING' : 'FULL_ACCESS'
}

function buildUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    uid: String(data.uid ?? id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: normalizeRole(data.role),
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : null,
    freelancerId: typeof data.freelancerId === 'string' ? data.freelancerId : null,
    freelanceRoles: Array.isArray(data.freelanceRoles) ? (data.freelanceRoles as FreelanceRole[]) : [],
    isActive: Boolean(data.isActive),
    isSuspended: Boolean(data.isSuspended),
    activatedAt: (data.activatedAt as UserProfile['activatedAt']) ?? null,
    activationExpiresAt: (data.activationExpiresAt as UserProfile['activationExpiresAt']) ?? null,
    activationTokenId: typeof data.activationTokenId === 'string' ? data.activationTokenId : null,
    featureAccess: normalizeFeatureAccess(data.featureAccess),
    deletedAt: (data.deletedAt as UserProfile['deletedAt']) ?? null,
    createdAt: (data.createdAt as UserProfile['createdAt']) ?? null,
    updatedAt: (data.updatedAt as UserProfile['updatedAt']) ?? null,
  }
}

export async function listUsersForAdmin() {
  const snapshot = await getDocs(collection(firestore, firestoreCollections.users))

  return snapshot.docs
    .map((userDoc) => buildUserProfile(userDoc.id, userDoc.data()))
    .filter((user) => !user.deletedAt)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'super_admin' ? -1 : 1
      return a.email.localeCompare(b.email)
    })
}

export async function setUserSuspended(userId: string, isSuspended: boolean) {
  await updateDoc(doc(firestore, firestoreCollections.users, userId), {
    isSuspended,
    isActive: !isSuspended,
    updatedAt: serverTimestamp(),
  })
}
