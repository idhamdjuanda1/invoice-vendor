import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { PricelistPackageItem, PricelistRecord } from '../../types/domain'
import { getBusinessProfile } from './businessProfiles'
import { listServicePackages } from './packages'

export type PricelistImageInput = {
  imageUrl: string | null
  imageKey: string | null
}

export type PricelistInput = {
  title: string
  tagline: string
  packageIds: string[]
  packageImages: Record<string, PricelistImageInput>
  thumbnailPackageId: string
  instagramUrl: string
  tiktokUrl: string
  whatsappUrl: string
  discountTitle: string
  discountDescription: string
  discountPercentage: number
  discountIsActive: boolean
}

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return `${base || 'pricelist'}-${Date.now().toString(36)}`
}

function buildPricelist(id: string, data: Record<string, unknown>): PricelistRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    slug: String(data.slug ?? ''),
    title: String(data.title ?? ''),
    tagline: typeof data.tagline === 'string' ? data.tagline : null,
    discountTitle: typeof data.discountTitle === 'string' ? data.discountTitle : null,
    discountDescription: typeof data.discountDescription === 'string' ? data.discountDescription : null,
    discountPercentage: Number(data.discountPercentage ?? 0),
    discountIsActive: Boolean(data.discountIsActive),
    vendorName: String(data.vendorName ?? ''),
    vendorWhatsappNumber: typeof data.vendorWhatsappNumber === 'string' ? data.vendorWhatsappNumber : null,
    vendorAddress: typeof data.vendorAddress === 'string' ? data.vendorAddress : null,
    vendorLogoUrl: typeof data.vendorLogoUrl === 'string' ? data.vendorLogoUrl : null,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
    thumbnailKey: typeof data.thumbnailKey === 'string' ? data.thumbnailKey : null,
    instagramUrl: typeof data.instagramUrl === 'string' ? data.instagramUrl : null,
    tiktokUrl: typeof data.tiktokUrl === 'string' ? data.tiktokUrl : null,
    whatsappUrl: typeof data.whatsappUrl === 'string' ? data.whatsappUrl : null,
    items: Array.isArray(data.items) ? (data.items as PricelistPackageItem[]) : [],
    isPublished: Boolean(data.isPublished),
    createdAt: (data.createdAt as PricelistRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as PricelistRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as PricelistRecord['deletedAt']) ?? null,
  }
}

function normalizeWhatsAppNumber(value: string | null) {
  if (!value) return null
  return value.trim() || null
}

function normalizeInput(input: PricelistInput) {
  const discountPercentage = Number(input.discountPercentage)

  return {
    title: input.title.trim(),
    tagline: input.tagline.trim() || null,
    packageIds: input.packageIds,
    packageImages: input.packageImages,
    thumbnailPackageId: input.thumbnailPackageId,
    instagramUrl: input.instagramUrl.trim() || null,
    tiktokUrl: input.tiktokUrl.trim() || null,
    whatsappUrl: input.whatsappUrl.trim() || null,
    discountTitle: input.discountTitle.trim() || null,
    discountDescription: input.discountDescription.trim() || null,
    discountPercentage: Number.isNaN(discountPercentage) ? 0 : Math.min(Math.max(discountPercentage, 0), 100),
    discountIsActive: input.discountIsActive,
  }
}

function buildItemsFromPackages(packages: Awaited<ReturnType<typeof listServicePackages>>, normalized: ReturnType<typeof normalizeInput>) {
  const selectedPackageIds = new Set(normalized.packageIds)
  const selectedPackages = packages.filter((servicePackage) => selectedPackageIds.has(servicePackage.id) && servicePackage.isActive)

  const items: PricelistPackageItem[] = selectedPackages.map((servicePackage) => {
    const packageImage = normalized.packageImages[servicePackage.id] ?? { imageUrl: null, imageKey: null }

    return {
      id: servicePackage.id,
      packageId: servicePackage.id,
      categoryId: servicePackage.categoryId,
      categoryName: servicePackage.categoryName,
      packageName: servicePackage.name,
      description: servicePackage.description,
      price: servicePackage.price,
      imageUrl: packageImage.imageUrl,
      imageKey: packageImage.imageKey,
    }
  })

  if (items.length === 0) throw new Error('PRICELIST_PACKAGES_REQUIRED')

  const thumbnailItem = items.find((item) => item.packageId === normalized.thumbnailPackageId && item.imageUrl) ?? items.find((item) => item.imageUrl)

  return {
    items,
    thumbnailUrl: thumbnailItem?.imageUrl ?? null,
    thumbnailKey: thumbnailItem?.imageKey ?? null,
  }
}

export async function listPricelists(userId: string) {
  const pricelistsQuery = query(collection(firestore, firestoreCollections.pricelists), where('userId', '==', userId))
  const snapshot = await getDocs(pricelistsQuery)

  return snapshot.docs
    .map((pricelistDoc) => buildPricelist(pricelistDoc.id, pricelistDoc.data()))
    .filter((pricelist) => !pricelist.deletedAt)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
}

export async function getPricelist(userId: string, pricelistId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.pricelists, pricelistId))
  if (!snapshot.exists()) return null

  const pricelist = buildPricelist(snapshot.id, snapshot.data())
  if (pricelist.userId !== userId || pricelist.deletedAt) return null

  return pricelist
}

export async function getPublishedPricelistBySlug(slug: string) {
  const pricelistsQuery = query(
    collection(firestore, firestoreCollections.pricelists),
    where('slug', '==', slug),
    where('isPublished', '==', true),
    limit(1),
  )
  const snapshot = await getDocs(pricelistsQuery)
  const firstDoc = snapshot.docs[0]
  if (!firstDoc) return null

  const pricelist = buildPricelist(firstDoc.id, firstDoc.data())
  return pricelist.deletedAt ? null : pricelist
}

export async function createPricelist(userId: string, input: PricelistInput) {
  const normalized = normalizeInput(input)
  if (!normalized.title) throw new Error('PRICELIST_TITLE_REQUIRED')
  if (normalized.packageIds.length === 0) throw new Error('PRICELIST_PACKAGES_REQUIRED')

  const [businessProfile, packages] = await Promise.all([getBusinessProfile(userId), listServicePackages(userId)])
  const { items, thumbnailUrl, thumbnailKey } = buildItemsFromPackages(packages, normalized)

  const docRef = await addDoc(collection(firestore, firestoreCollections.pricelists), {
    userId,
    slug: makeSlug(normalized.title),
    title: normalized.title,
    tagline: normalized.tagline,
    discountTitle: normalized.discountTitle,
    discountDescription: normalized.discountDescription,
    discountPercentage: normalized.discountPercentage,
    discountIsActive: normalized.discountIsActive,
    vendorName: businessProfile?.vendorName || 'Vendor',
    vendorWhatsappNumber: normalizeWhatsAppNumber(businessProfile?.whatsappNumber ?? null),
    vendorAddress: businessProfile?.address || null,
    vendorLogoUrl: businessProfile?.logoUrl ?? null,
    thumbnailUrl,
    thumbnailKey,
    instagramUrl: normalized.instagramUrl,
    tiktokUrl: normalized.tiktokUrl,
    whatsappUrl: normalized.whatsappUrl,
    items,
    isPublished: true,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updatePricelist(userId: string, pricelistId: string, input: PricelistInput) {
  const normalized = normalizeInput(input)
  if (!normalized.title) throw new Error('PRICELIST_TITLE_REQUIRED')
  if (normalized.packageIds.length === 0) throw new Error('PRICELIST_PACKAGES_REQUIRED')

  const existingPricelist = await getPricelist(userId, pricelistId)
  if (!existingPricelist) throw new Error('PRICELIST_NOT_FOUND')

  const [businessProfile, packages] = await Promise.all([getBusinessProfile(userId), listServicePackages(userId)])
  const { items, thumbnailUrl, thumbnailKey } = buildItemsFromPackages(packages, normalized)

  await updateDoc(doc(firestore, firestoreCollections.pricelists, pricelistId), {
    title: normalized.title,
    tagline: normalized.tagline,
    discountTitle: normalized.discountTitle,
    discountDescription: normalized.discountDescription,
    discountPercentage: normalized.discountPercentage,
    discountIsActive: normalized.discountIsActive,
    vendorName: businessProfile?.vendorName || existingPricelist.vendorName || 'Vendor',
    vendorWhatsappNumber: normalizeWhatsAppNumber(businessProfile?.whatsappNumber ?? existingPricelist.vendorWhatsappNumber),
    vendorAddress: businessProfile?.address || existingPricelist.vendorAddress || null,
    vendorLogoUrl: businessProfile?.logoUrl ?? existingPricelist.vendorLogoUrl ?? null,
    thumbnailUrl,
    thumbnailKey,
    instagramUrl: normalized.instagramUrl,
    tiktokUrl: normalized.tiktokUrl,
    whatsappUrl: normalized.whatsappUrl,
    items,
    isPublished: true,
    updatedAt: serverTimestamp(),
  })
}

export async function softDeletePricelist(userId: string, pricelistId: string) {
  const pricelist = await getPricelist(userId, pricelistId)
  if (!pricelist) throw new Error('PRICELIST_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.pricelists, pricelistId), {
    isPublished: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
