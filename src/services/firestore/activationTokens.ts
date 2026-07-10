import { createUserWithEmailAndPassword, deleteUser, updateProfile } from 'firebase/auth'
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import type { RegisterInput } from '../../features/auth/authTypes'
import { FREE_TRIAL_TOKEN_ID } from '../../lib/activation'
import { firebaseAuth, firestore } from '../../lib/firebase/client'
import type { TokenDurationType, UserProfile } from '../../types/domain'

const durationInMs: Record<TokenDurationType, number> = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  THREE_MONTHS: 90 * 24 * 60 * 60 * 1000,
  SIX_MONTHS: 180 * 24 * 60 * 60 * 1000,
  ONE_YEAR: 365 * 24 * 60 * 60 * 1000,
}

const freeTrialDurationInMs = 24 * 60 * 60 * 1000

function normalizeToken(code: string) {
  return code.trim().toUpperCase()
}

function getTimestampMs(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

export async function registerVendorWithFreeTrial(input: RegisterInput) {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, input.email, input.password)

  try {
    await updateProfile(credential.user, { displayName: input.name })
    await setDoc(doc(firestore, firestoreCollections.users, credential.user.uid), {
      uid: credential.user.uid,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: 'user',
      isActive: true,
      isSuspended: false,
      activatedAt: serverTimestamp(),
      activationExpiresAt: Timestamp.fromMillis(Date.now() + freeTrialDurationInMs),
      activationTokenId: FREE_TRIAL_TOKEN_ID,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined)
    throw error
  }
}

export async function getActivationTokenByCode(code: string) {
  const tokenCode = normalizeToken(code)
  const snapshot = await getDoc(doc(firestore, firestoreCollections.activationTokens, tokenCode))
  return snapshot.exists() ? snapshot.data() : null
}

export async function renewVendorActivationToken({
  profile,
  tokenCode,
}: {
  profile: UserProfile
  tokenCode: string
}) {
  const activationCode = normalizeToken(tokenCode)

  if (!activationCode) throw new Error('TOKEN_REQUIRED')
  if (profile.role !== 'user') throw new Error('VENDOR_REQUIRED')

  await runTransaction(firestore, async (transaction) => {
    const tokenRef = doc(firestore, firestoreCollections.activationTokens, activationCode)
    const userRef = doc(firestore, firestoreCollections.users, profile.uid)
    const tokenSnapshot = await transaction.get(tokenRef)
    const userSnapshot = await transaction.get(userRef)

    if (!userSnapshot.exists()) throw new Error('USER_PROFILE_NOT_FOUND')
    if (!tokenSnapshot.exists()) throw new Error('TOKEN_NOT_FOUND')

    const token = tokenSnapshot.data()
    const isUsed = Boolean(token.isUsed)
    const expiresAt = getTimestampMs(token.expiresAt)
    const durationType = token.durationType as TokenDurationType

    if (isUsed) throw new Error('TOKEN_USED')
    if (token.isActive === false || token.isRevoked === true || token.deletedAt) throw new Error('TOKEN_REVOKED')
    if (!durationInMs[durationType]) throw new Error('TOKEN_INVALID_DURATION')
    if (expiresAt <= Date.now()) throw new Error('TOKEN_EXPIRED')

    const activationExpiresAt = Timestamp.fromMillis(Date.now() + durationInMs[durationType])

    transaction.update(userRef, {
      isActive: true,
      activatedAt: serverTimestamp(),
      activationExpiresAt,
      activationTokenId: activationCode,
      updatedAt: serverTimestamp(),
    })

    transaction.update(tokenRef, {
      isUsed: true,
      usedById: profile.uid,
      usedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}
