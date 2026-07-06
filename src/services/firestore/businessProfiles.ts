import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { BusinessProfile } from '../../types/domain'

export type BusinessProfileInput = {
  vendorName: string
  whatsappNumber: string
  address: string
  businessDescription: string
  bankAccountNumber: string
  bankAccountName: string
  logoUrl?: string | null
  logoKey?: string | null
  signatureUrl?: string | null
}

function makeVendorCode(vendorName: string) {
  const words = vendorName
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
  }

  return (words[0] ?? 'VND').slice(0, 3).toUpperCase()
}

function buildBusinessProfile(id: string, data: Record<string, unknown>): BusinessProfile {
  return {
    id,
    userId: String(data.userId ?? id),
    vendorName: String(data.vendorName ?? ''),
    vendorCode: String(data.vendorCode ?? ''),
    whatsappNumber: String(data.whatsappNumber ?? ''),
    email: String(data.email ?? ''),
    address: String(data.address ?? ''),
    businessDescription: String(data.businessDescription ?? data.defaultPaymentNote ?? ''),
    ownerName: String(data.ownerName ?? ''),
    bankAccountNumber: String(data.bankAccountNumber ?? ''),
    bankAccountName: String(data.bankAccountName ?? ''),
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : null,
    logoKey: typeof data.logoKey === 'string' ? data.logoKey : null,
    signatureUrl: typeof data.signatureUrl === 'string' ? data.signatureUrl : null,
    defaultPaymentNote: typeof data.defaultPaymentNote === 'string' ? data.defaultPaymentNote : null,
    createdAt: (data.createdAt as BusinessProfile['createdAt']) ?? null,
    updatedAt: (data.updatedAt as BusinessProfile['updatedAt']) ?? null,
  }
}

export async function getBusinessProfile(userId: string) {
  const profileRef = doc(firestore, firestoreCollections.businessProfiles, userId)
  const snapshot = await getDoc(profileRef)

  if (!snapshot.exists()) return null

  return buildBusinessProfile(snapshot.id, snapshot.data())
}

export async function saveBusinessProfile(userId: string, input: BusinessProfileInput) {
  const profileRef = doc(firestore, firestoreCollections.businessProfiles, userId)
  const existingProfile = await getDoc(profileRef)

  await setDoc(
    profileRef,
    {
      userId,
      vendorName: input.vendorName.trim(),
      vendorCode: makeVendorCode(input.vendorName),
      whatsappNumber: input.whatsappNumber.trim(),
      address: input.address.trim(),
      businessDescription: input.businessDescription.trim(),
      bankAccountNumber: input.bankAccountNumber.trim(),
      bankAccountName: input.bankAccountName.trim(),
      logoUrl: input.logoUrl === undefined
        ? existingProfile.exists() ? (existingProfile.data().logoUrl ?? null) : null
        : input.logoUrl,
      logoKey: input.logoKey === undefined
        ? existingProfile.exists() ? (existingProfile.data().logoKey ?? null) : null
        : input.logoKey,
      signatureUrl: input.signatureUrl === undefined
        ? existingProfile.exists() ? (existingProfile.data().signatureUrl ?? null) : null
        : input.signatureUrl,
      email: existingProfile.exists() ? (existingProfile.data().email ?? '') : '',
      ownerName: existingProfile.exists() ? (existingProfile.data().ownerName ?? '') : '',
      defaultPaymentNote: existingProfile.exists() ? (existingProfile.data().defaultPaymentNote ?? null) : null,
      createdAt: existingProfile.exists() ? existingProfile.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return getBusinessProfile(userId)
}
