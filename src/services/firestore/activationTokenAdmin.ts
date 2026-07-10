import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { ActivationToken, TokenDurationType, UserProfile } from '../../types/domain'

const durationLabels: Record<TokenDurationType, string> = {
  ONE_HOUR: '1 jam',
  ONE_DAY: '1 hari',
  ONE_WEEK: '1 minggu',
  ONE_MONTH: '1 bulan',
  THREE_MONTHS: '3 bulan',
  SIX_MONTHS: '6 bulan',
  ONE_YEAR: '1 tahun',
}

const durationInMs: Record<TokenDurationType, number> = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  THREE_MONTHS: 90 * 24 * 60 * 60 * 1000,
  SIX_MONTHS: 180 * 24 * 60 * 60 * 1000,
  ONE_YEAR: 365 * 24 * 60 * 60 * 1000,
}

function generateTokenCode() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function buildActivationToken(id: string, data: Record<string, unknown>): ActivationToken {
  return {
    id,
    code: String(data.code ?? id),
    durationType: data.durationType as TokenDurationType,
    isUsed: Boolean(data.isUsed),
    expiresAt: (data.expiresAt as ActivationToken['expiresAt']) ?? null,
    createdById: String(data.createdById ?? ''),
    usedById: typeof data.usedById === 'string' ? data.usedById : null,
    usedAt: (data.usedAt as ActivationToken['usedAt']) ?? null,
    createdAt: (data.createdAt as ActivationToken['createdAt']) ?? null,
    updatedAt: (data.updatedAt as ActivationToken['updatedAt']) ?? null,
  }
}

export function getActivationTokenDurationLabel(durationType: TokenDurationType) {
  return durationLabels[durationType] ?? durationType
}

export function getActivationTokenStatus(token: ActivationToken) {
  if (token.isUsed) return 'Sudah digunakan'

  if (token.expiresAt instanceof Timestamp && token.expiresAt.toMillis() <= Date.now()) {
    return 'Expired'
  }

  if (token.expiresAt instanceof Date && token.expiresAt.getTime() <= Date.now()) {
    return 'Expired'
  }

  return 'Belum digunakan'
}

export function formatFirestoreDate(value: ActivationToken['expiresAt']) {
  if (!value) return '-'

  if (value instanceof Timestamp) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value.toDate())
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value)
  }

  return '-'
}

export async function createActivationToken({
  durationType,
  superAdmin,
}: {
  durationType: TokenDurationType
  superAdmin: UserProfile
}) {
  if (superAdmin.role !== 'super_admin') {
    throw new Error('SUPER_ADMIN_REQUIRED')
  }

  const tokenCode = generateTokenCode()
  const expiresAt = Timestamp.fromMillis(Date.now() + durationInMs[durationType])
  const tokenRef = doc(firestore, firestoreCollections.activationTokens, tokenCode)

  await setDoc(tokenRef, {
    code: tokenCode,
    durationType,
    durationLabel: durationLabels[durationType],
    isUsed: false,
    expiresAt,
    createdById: superAdmin.uid,
    createdByEmail: superAdmin.email,
    usedById: null,
    usedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return tokenCode
}

export async function listActivationTokens() {
  const tokensQuery = query(
    collection(firestore, firestoreCollections.activationTokens),
    orderBy('createdAt', 'desc'),
    limit(50),
  )
  const snapshot = await getDocs(tokensQuery)

  return snapshot.docs.map((tokenDoc) => buildActivationToken(tokenDoc.id, tokenDoc.data()))
}
