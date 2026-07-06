import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { ServicePackage } from '../../types/domain'

export type ServicePackageInput = {
  categoryId: string
  categoryName: string
  name: string
  price: number
  description: string
  eventDuration: string
  additionalNote: string
  isActive: boolean
}

function buildServicePackage(id: string, data: Record<string, unknown>): ServicePackage {
  return {
    id,
    userId: String(data.userId ?? ''),
    categoryId: String(data.categoryId ?? ''),
    categoryName: String(data.categoryName ?? data.category ?? 'Tanpa kategori'),
    name: String(data.name ?? ''),
    price: Number(data.price ?? 0),
    description: typeof data.description === 'string' ? data.description : null,
    eventDuration: typeof data.eventDuration === 'string' ? data.eventDuration : null,
    additionalNote: typeof data.additionalNote === 'string' ? data.additionalNote : null,
    isActive: Boolean(data.isActive),
    deletedAt: (data.deletedAt as ServicePackage['deletedAt']) ?? null,
    createdAt: (data.createdAt as ServicePackage['createdAt']) ?? null,
    updatedAt: (data.updatedAt as ServicePackage['updatedAt']) ?? null,
  }
}

function normalizePackageInput(input: ServicePackageInput) {
  return {
    categoryId: input.categoryId,
    categoryName: input.categoryName.trim(),
    name: input.name.trim(),
    price: Number(input.price),
    description: input.description.trim() || null,
    eventDuration: input.eventDuration.trim() || null,
    additionalNote: input.additionalNote.trim() || null,
    isActive: input.isActive,
  }
}

export async function listServicePackages(userId: string) {
  const packagesQuery = query(collection(firestore, firestoreCollections.packages), where('userId', '==', userId))
  const snapshot = await getDocs(packagesQuery)

  return snapshot.docs
    .map((packageDoc) => buildServicePackage(packageDoc.id, packageDoc.data()))
    .filter((servicePackage) => !servicePackage.deletedAt)
    .sort((a, b) => {
      const categorySort = a.categoryName.localeCompare(b.categoryName)
      if (categorySort !== 0) return categorySort

      const priceSort = a.price - b.price
      if (priceSort !== 0) return priceSort

      return a.name.localeCompare(b.name)
    })
}

export async function createServicePackage(userId: string, input: ServicePackageInput) {
  const normalized = normalizePackageInput(input)

  if (!normalized.categoryId || !normalized.categoryName) throw new Error('PACKAGE_CATEGORY_REQUIRED')
  if (!normalized.name) throw new Error('PACKAGE_NAME_REQUIRED')
  if (Number.isNaN(normalized.price) || normalized.price < 0) throw new Error('PACKAGE_PRICE_INVALID')

  await addDoc(collection(firestore, firestoreCollections.packages), {
    userId,
    ...normalized,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateServicePackage(packageId: string, userId: string, input: ServicePackageInput) {
  const normalized = normalizePackageInput(input)

  if (!normalized.categoryId || !normalized.categoryName) throw new Error('PACKAGE_CATEGORY_REQUIRED')
  if (!normalized.name) throw new Error('PACKAGE_NAME_REQUIRED')
  if (Number.isNaN(normalized.price) || normalized.price < 0) throw new Error('PACKAGE_PRICE_INVALID')

  await updateDoc(doc(firestore, firestoreCollections.packages, packageId), {
    userId,
    ...normalized,
    updatedAt: serverTimestamp(),
  })
}

export async function softDeleteServicePackage(packageId: string) {
  await updateDoc(doc(firestore, firestoreCollections.packages, packageId), {
    isActive: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
