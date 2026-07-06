import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { UserProfile } from '../../types/domain'

function buildUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    uid: String(data.uid ?? id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: data.role === 'super_admin' ? 'super_admin' : 'user',
    isActive: Boolean(data.isActive),
    isSuspended: Boolean(data.isSuspended),
    activatedAt: (data.activatedAt as UserProfile['activatedAt']) ?? null,
    activationExpiresAt: (data.activationExpiresAt as UserProfile['activationExpiresAt']) ?? null,
    activationTokenId: typeof data.activationTokenId === 'string' ? data.activationTokenId : null,
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
