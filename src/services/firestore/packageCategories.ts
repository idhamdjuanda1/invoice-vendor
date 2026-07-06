import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { ServicePackageCategory } from '../../types/domain'
import { listServicePackages } from './packages'

export type ServicePackageCategoryInput = {
  name: string
}

function buildServicePackageCategory(id: string, data: Record<string, unknown>): ServicePackageCategory {
  return {
    id,
    userId: String(data.userId ?? ''),
    name: String(data.name ?? ''),
    createdAt: (data.createdAt as ServicePackageCategory['createdAt']) ?? null,
    updatedAt: (data.updatedAt as ServicePackageCategory['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as ServicePackageCategory['deletedAt']) ?? null,
  }
}

export async function listServicePackageCategories(userId: string) {
  const categoriesQuery = query(collection(firestore, firestoreCollections.packageCategories), where('userId', '==', userId))
  const snapshot = await getDocs(categoriesQuery)

  return snapshot.docs
    .map((categoryDoc) => buildServicePackageCategory(categoryDoc.id, categoryDoc.data()))
    .filter((category) => !category.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createServicePackageCategory(userId: string, input: ServicePackageCategoryInput) {
  const name = input.name.trim()

  if (!name) throw new Error('PACKAGE_CATEGORY_NAME_REQUIRED')

  await addDoc(collection(firestore, firestoreCollections.packageCategories), {
    userId,
    name,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateServicePackageCategory(categoryId: string, userId: string, input: ServicePackageCategoryInput) {
  const name = input.name.trim()

  if (!name) throw new Error('PACKAGE_CATEGORY_NAME_REQUIRED')

  const batch = writeBatch(firestore)
  const categoryRef = doc(firestore, firestoreCollections.packageCategories, categoryId)
  const packagesQuery = query(
    collection(firestore, firestoreCollections.packages),
    where('userId', '==', userId),
    where('categoryId', '==', categoryId),
  )
  const packageSnapshot = await getDocs(packagesQuery)

  batch.update(categoryRef, {
    name,
    updatedAt: serverTimestamp(),
  })

  packageSnapshot.docs.forEach((packageDoc) => {
    batch.update(packageDoc.ref, {
      categoryName: name,
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}

export async function softDeleteServicePackageCategory(categoryId: string, userId: string) {
  const packages = await listServicePackages(userId)
  const isUsed = packages.some((servicePackage) => servicePackage.categoryId === categoryId)

  if (isUsed) throw new Error('PACKAGE_CATEGORY_IN_USE')

  await updateDoc(doc(firestore, firestoreCollections.packageCategories, categoryId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
