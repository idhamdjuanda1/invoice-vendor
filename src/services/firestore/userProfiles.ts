import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { env } from '../../config/env'
import { firestoreCollections } from '../../constants/firestore'
import type { ActivationAccessState } from '../../features/auth/authTypes'
import { FREE_TRIAL_TOKEN_ID } from '../../lib/activation'
import { firestore } from '../../lib/firebase/client'
import type { FreelanceRole, UserProfile } from '../../types/domain'

function normalizeFeatureAccess(value: unknown): UserProfile['featureAccess'] {
  return value === 'WITHOUT_ACCOUNTING' ? 'WITHOUT_ACCOUNTING' : 'FULL_ACCESS'
}

function buildUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    uid: String(data.uid ?? id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: data.role === 'super_admin' ? 'super_admin' : data.role === 'freelance' ? 'freelance' : 'user',
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

export async function getUserProfile(uid: string) {
  const profileRef = doc(firestore, firestoreCollections.users, uid)
  const snapshot = await getDoc(profileRef)

  if (!snapshot.exists()) return null

  return buildUserProfile(snapshot.id, snapshot.data())
}

export async function bootstrapSuperAdminProfile(firebaseUser: User) {
  const configuredEmail = env.superAdminEmail.toLowerCase()
  const userEmail = firebaseUser.email?.toLowerCase() ?? ''

  if (!configuredEmail || userEmail !== configuredEmail) return null

  const existingProfile = await getUserProfile(firebaseUser.uid)
  if (existingProfile) return existingProfile

  const now = serverTimestamp()
  const profileRef = doc(firestore, firestoreCollections.users, firebaseUser.uid)

  try {
    await setDoc(profileRef, {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName ?? 'Super Admin',
      email: firebaseUser.email ?? configuredEmail,
      role: 'super_admin',
      vendorId: null,
      freelancerId: null,
      freelanceRoles: [],
      isActive: true,
      isSuspended: false,
      activatedAt: now,
      activationExpiresAt: null,
      activationTokenId: null,
      featureAccess: 'FULL_ACCESS',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    })
  } catch (error) {
    console.warn('Super Admin bootstrap profile could not be created.', error)
    return null
  }

  return getUserProfile(firebaseUser.uid)
}

export function isProfileExpired(profile: UserProfile) {
  if (!profile.activationExpiresAt) return false

  if (profile.activationExpiresAt instanceof Timestamp) {
    return profile.activationExpiresAt.toDate().getTime() <= Date.now()
  }

  if (profile.activationExpiresAt instanceof Date) {
    return profile.activationExpiresAt.getTime() <= Date.now()
  }

  return false
}

export function getAccountBlockedReason(profile: UserProfile | null) {
  if (!profile) return null
  if (profile.deletedAt) return 'Akun sudah dihapus.'
  if (profile.isSuspended) return 'Akun sedang dinonaktifkan oleh Super Admin.'
  if (!profile.isActive) return 'Akun belum aktif.'
  if (isProfileExpired(profile)) return 'Masa aktif akun sudah expired.'
  return null
}

export function createActivationAccessState(overrides?: Partial<ActivationAccessState>): ActivationAccessState {
  return {
    isChecking: false,
    isBlocked: false,
    code: null,
    message: null,
    currentToken: null,
    ...overrides,
  }
}

export async function validateVendorActivationAccess(profile: UserProfile | null): Promise<ActivationAccessState> {
  if (!profile) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'missing_profile',
      message: 'Profil Firestore belum tersedia.',
    })
  }

  if (profile.role === 'super_admin' || profile.role === 'freelance') {
    return createActivationAccessState({ code: 'active' })
  }

  const currentToken = profile.activationTokenId

  if (profile.deletedAt) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'deleted',
      currentToken,
      message: 'Akun sudah dihapus.',
    })
  }

  if (profile.isSuspended) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'suspended',
      currentToken,
      message: 'Akun sedang dinonaktifkan oleh Super Admin.',
    })
  }

  if (!profile.isActive) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'inactive',
      currentToken,
      message: 'Akun belum aktif.',
    })
  }

  if (!currentToken) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'invalid',
      currentToken,
      message: 'Token aktivasi tidak tersedia pada akun ini.',
    })
  }

  if (isProfileExpired(profile)) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'expired',
      currentToken,
      message: 'Masa aktif token telah berakhir.',
    })
  }

  if (currentToken === FREE_TRIAL_TOKEN_ID) {
    return createActivationAccessState({
      code: 'active',
      currentToken,
    })
  }

  const tokenSnapshot = await getDoc(doc(firestore, firestoreCollections.activationTokens, currentToken))

  if (!tokenSnapshot.exists()) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'invalid',
      currentToken,
      message: 'Token aktivasi tidak ditemukan atau sudah tidak valid.',
    })
  }

  const token = tokenSnapshot.data()
  const usedById = typeof token.usedById === 'string' ? token.usedById : null

  if (token.isRevoked === true || token.deletedAt) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'invalid',
      currentToken,
      message: 'Token aktivasi sudah tidak valid.',
    })
  }

  if (usedById && usedById !== profile.uid) {
    return createActivationAccessState({
      isBlocked: true,
      code: 'invalid',
      currentToken,
      message: 'Token aktivasi tidak sesuai dengan akun ini.',
    })
  }

  return createActivationAccessState({
    code: 'active',
    currentToken,
  })
}
