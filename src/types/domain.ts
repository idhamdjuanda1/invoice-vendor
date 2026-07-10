import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'super_admin' | 'user'
export type TokenDurationType =
  | 'ONE_HOUR'
  | 'ONE_DAY'
  | 'ONE_WEEK'
  | 'ONE_MONTH'
  | 'THREE_MONTHS'
  | 'SIX_MONTHS'
  | 'ONE_YEAR'
export type PaymentStatus = 'BELUM_BAYAR' | 'DP' | 'CICILAN' | 'LUNAS'
export type PaymentMethod = 'TRANSFER_BANK' | 'CASH' | 'QRIS' | 'OTHER'
export type DiscountType = 'NOMINAL' | 'PERCENTAGE'
export type EventType = 'WEDDING' | 'PREWEDDING' | 'LAMARAN' | 'CORPORATE'
export type EventDataStatus = 'NOT_FILLED' | 'PARTIAL' | 'COMPLETE'
export type FreelanceType = 'FOTOGRAFER' | 'VIDEOGRAFER' | 'ASISTEN'

export type EventLocationDetail = {
  venueName: string
  address: string
  googleMapsUrl: string
  latitude: number | null
  longitude: number | null
}

export type InvoiceEventDetail = {
  id: string
  userId: string
  invoiceId: string
  eventType: EventType
  status: EventDataStatus
  publicFormSlug: string
  publicFormEnabled: boolean
  location: EventLocationDetail
  details: Record<string, string>
  submittedAt: FirestoreDate
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type FreelanceRecord = {
  id: string
  userId: string
  fullName: string
  freelanceType: FreelanceType
  whatsappNumber: string
  email: string
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type TeamAssignmentMember = {
  freelanceId: string
  fullName: string
  freelanceType: FreelanceType
  whatsappNumber: string
  email: string
}

export type TeamAssignmentRecord = {
  id: string
  userId: string
  invoiceId: string
  photographers: TeamAssignmentMember[]
  videographers: TeamAssignmentMember[]
  assistants: TeamAssignmentMember[]
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type PlaceholderEntity = {
  id: string
  title: string
  status: string
}

export type FirestoreDate = Timestamp | Date | null

export type UserProfile = {
  id: string
  uid: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  isSuspended: boolean
  activatedAt: FirestoreDate
  activationExpiresAt: FirestoreDate
  activationTokenId: string | null
  deletedAt: FirestoreDate
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
}

export type ActivationToken = {
  id: string
  code: string
  durationType: TokenDurationType
  isUsed: boolean
  expiresAt: FirestoreDate
  createdById: string
  usedById: string | null
  usedAt: FirestoreDate
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
}

export type BusinessProfile = {
  id: string
  userId: string
  vendorName: string
  vendorCode: string
  whatsappNumber: string
  email: string
  address: string
  businessDescription: string
  ownerName: string
  bankAccountNumber: string
  bankAccountName: string
  logoUrl: string | null
  logoKey: string | null
  signatureUrl: string | null
  defaultPaymentNote: string | null
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
}

export type ServicePackage = {
  id: string
  userId: string
  categoryId: string
  categoryName: string
  name: string
  price: number
  description: string | null
  eventDuration: string | null
  additionalNote: string | null
  isActive: boolean
  deletedAt: FirestoreDate
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
}

export type ServicePackageCategory = {
  id: string
  userId: string
  name: string
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type ClientRecord = {
  id: string
  userId: string
  name: string
  whatsappNumber: string | null
  email: string | null
  address: string | null
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type InvoicePackageItem = {
  id: string
  packageId: string
  categoryId: string
  categoryName: string
  packageName: string
  description: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type InvoicePaymentEntry = {
  id: string
  amount: number
  method: PaymentMethod
  paymentDate: FirestoreDate
  note: string | null
}

export type PaymentRecord = {
  id: string
  userId: string
  invoiceId: string
  amount: number
  paymentDate: FirestoreDate
  paymentMethod: PaymentMethod
  notes: string | null
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type ReceiptRecord = {
  id: string
  userId: string
  receiptNumber: string
  receiptDate: FirestoreDate
  invoiceId: string
  invoiceNumber: string
  paymentId: string
  clientName: string
  vendorName: string
  vendorWhatsappNumber: string | null
  vendorAddress: string | null
  amount: number
  paymentMethod: PaymentMethod
  notes: string | null
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type AgreementRecord = {
  id: string
  userId: string
  invoiceId: string
  agreementNumber: string
  agreementDate: FirestoreDate
  vendorName: string
  vendorWhatsappNumber: string | null
  vendorAddress: string | null
  vendorBankAccountNumber: string | null
  vendorBankAccountName: string | null
  vendorLogoUrl: string | null
  vendorSignatureUrl: string | null
  clientName: string
  clientWhatsappNumber: string | null
  clientEmail: string | null
  clientAddress: string | null
  eventDate: FirestoreDate
  eventLocation: string
  totalAmount: number
  totalPaid: number
  remainingAmount: number
  invoiceNumber: string
  packageSummary: string
  clauses: string[]
  status: 'DRAFT' | 'SIGNED'
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type PricelistPackageItem = {
  id: string
  packageId: string
  categoryId: string
  categoryName: string
  packageName: string
  description: string | null
  price: number
  imageUrl: string | null
  imageKey: string | null
}

export type PricelistRecord = {
  id: string
  userId: string
  slug: string
  title: string
  tagline: string | null
  discountTitle: string | null
  discountDescription: string | null
  discountPercentage: number
  discountIsActive: boolean
  vendorName: string
  vendorWhatsappNumber: string | null
  vendorAddress: string | null
  vendorLogoUrl: string | null
  thumbnailUrl: string | null
  thumbnailKey: string | null
  instagramUrl: string | null
  tiktokUrl: string | null
  whatsappUrl: string | null
  items: PricelistPackageItem[]
  isPublished: boolean
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
  deletedAt: FirestoreDate
}

export type InvoiceRecord = {
  id: string
  userId: string
  clientId: string
  clientName: string
  clientWhatsappNumber: string | null
  clientEmail: string | null
  clientAddress: string | null
  invoiceNumber: string
  invoiceDate: FirestoreDate
  eventType: EventType
  eventDataStatus: EventDataStatus
  publicFormSlug: string | null
  publicFormEnabled: boolean
  eventDate: FirestoreDate
  eventLocation: string
  additionalNote: string | null
  subtotal: number
  discountType: DiscountType | null
  discountValue: number
  discountAmount: number
  discountLabel: string | null
  discountSourcePricelistId: string | null
  totalAmount: number
  totalPaid: number
  remainingAmount: number
  paymentPercentage: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  items: InvoicePackageItem[]
  payments: InvoicePaymentEntry[]
  isPublic: boolean
  deletedAt: FirestoreDate
  createdAt: FirestoreDate
  updatedAt: FirestoreDate
}
