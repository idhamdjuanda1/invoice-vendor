import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { firestore } from '../../lib/firebase/client'
import type { ClientRecord } from '../../types/domain'

export type ClientInput = {
  name: string
  whatsappNumber: string
  email: string
  address: string
}

function normalizeClientInput(userId: string, input: ClientInput) {
  const name = input.name.trim()
  if (!name) throw new Error('CLIENT_NAME_REQUIRED')

  return {
    userId,
    name,
    whatsappNumber: input.whatsappNumber.trim() || null,
    email: input.email.trim() || null,
    address: input.address.trim() || null,
  }
}

function buildClientRecord(id: string, data: Record<string, unknown>): ClientRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    name: String(data.name ?? ''),
    whatsappNumber: typeof data.whatsappNumber === 'string' ? data.whatsappNumber : null,
    email: typeof data.email === 'string' ? data.email : null,
    address: typeof data.address === 'string' ? data.address : null,
    createdAt: (data.createdAt as ClientRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as ClientRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as ClientRecord['deletedAt']) ?? null,
  }
}

export async function listClients(userId: string) {
  const clientsQuery = query(collection(firestore, firestoreCollections.clients), where('userId', '==', userId))
  const snapshot = await getDocs(clientsQuery)

  return snapshot.docs
    .map((clientDoc) => buildClientRecord(clientDoc.id, clientDoc.data()))
    .filter((client) => !client.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createClient(userId: string, input: ClientInput) {
  const normalized = normalizeClientInput(userId, input)

  const docRef = await addDoc(collection(firestore, firestoreCollections.clients), {
    ...normalized,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    ...normalized,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
  } satisfies ClientRecord
}

export async function updateClient(clientId: string, userId: string, input: ClientInput) {
  const normalized = normalizeClientInput(userId, input)

  await updateDoc(doc(firestore, firestoreCollections.clients, clientId), {
    ...normalized,
    updatedAt: serverTimestamp(),
  })

  return {
    id: clientId,
    ...normalized,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
  } satisfies ClientRecord
}
