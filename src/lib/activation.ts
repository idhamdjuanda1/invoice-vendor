import { Timestamp } from 'firebase/firestore'
import type { FirestoreDate, UserProfile } from '../types/domain'

export const FREE_TRIAL_TOKEN_ID = 'FREE_TRIAL'

const dayInMs = 24 * 60 * 60 * 1000

export type UserActivationStatus = 'active' | 'expiring' | 'inactive'

export function firestoreDateToMillis(value: FirestoreDate) {
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

export function getRemainingActivationDays(value: FirestoreDate, now = Date.now()) {
  const expiresAt = firestoreDateToMillis(value)
  if (!expiresAt || expiresAt <= now) return 0
  return Math.ceil((expiresAt - now) / dayInMs)
}

export function getUserActivationStatus(user: UserProfile, now = Date.now()): UserActivationStatus {
  if (user.role === 'super_admin') return 'active'
  if (user.deletedAt || user.isSuspended || !user.isActive) return 'inactive'

  const remainingDays = getRemainingActivationDays(user.activationExpiresAt, now)
  if (remainingDays <= 0) return 'inactive'
  if (remainingDays <= 7) return 'expiring'
  return 'active'
}

export function getUserActivationStatusLabel(status: UserActivationStatus) {
  if (status === 'active') return 'Aktif'
  if (status === 'expiring') return 'Hampir Habis'
  return 'Tidak Aktif / Expired'
}
