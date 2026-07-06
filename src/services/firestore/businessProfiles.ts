import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
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

function normalizeWhatsAppNumber(value: string) {
  const trimmed = value.trim()
  return trimmed || null
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

async function syncPricelistVendorSnapshot(userId: string, profileData: {
  vendorName: string
  whatsappNumber: string
  address: string
  logoUrl: string | null
}) {
  const pricelistsQuery = query(collection(firestore, firestoreCollections.pricelists), where('userId', '==', userId))
  const snapshot = await getDocs(pricelistsQuery)
  if (snapshot.empty) return

  const batch = writeBatch(firestore)
  let updateCount = 0

  snapshot.docs.forEach((pricelistDoc) => {
    const data = pricelistDoc.data()
    if (data.deletedAt) return

    batch.update(pricelistDoc.ref, {
      vendorName: profileData.vendorName || 'Vendor',
      vendorWhatsappNumber: normalizeWhatsAppNumber(profileData.whatsappNumber),
      vendorAddress: profileData.address || null,
      vendorLogoUrl: profileData.logoUrl,
      updatedAt: serverTimestamp(),
    })
    updateCount += 1
  })

  if (updateCount > 0) await batch.commit()
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
  const existingData = existingProfile.exists() ? existingProfile.data() : null
  const profileData = {
    userId,
    vendorName: input.vendorName.trim(),
    vendorCode: makeVendorCode(input.vendorName),
    whatsappNumber: input.whatsappNumber.trim(),
    address: input.address.trim(),
    businessDescription: input.businessDescription.trim(),
    bankAccountNumber: input.bankAccountNumber.trim(),
    bankAccountName: input.bankAccountName.trim(),
    logoUrl: input.logoUrl === undefined
      ? existingData?.logoUrl ?? null
      : input.logoUrl,
    logoKey: input.logoKey === undefined
      ? existingData?.logoKey ?? null
      : input.logoKey,
    signatureUrl: input.signatureUrl === undefined
      ? existingData?.signatureUrl ?? null
      : input.signatureUrl,
    email: existingData?.email ?? '',
    ownerName: existingData?.ownerName ?? '',
    defaultPaymentNote: existingData?.defaultPaymentNote ?? null,
    createdAt: existingData?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(
    profileRef,
    profileData,
    { merge: true },
  )

  try {
    await syncPricelistVendorSnapshot(userId, {
      vendorName: profileData.vendorName,
      whatsappNumber: profileData.whatsappNumber,
      address: profileData.address,
      logoUrl: profileData.logoUrl,
    })
  } catch (error) {
    console.error('Failed to sync vendor profile to published pricelists', error)
  }

  return getBusinessProfile(userId)
}
