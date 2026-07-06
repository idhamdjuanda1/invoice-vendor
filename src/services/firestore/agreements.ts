import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestoreCollections } from '../../constants/firestore'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { firestore } from '../../lib/firebase/client'
import type { AgreementRecord, BusinessProfile, InvoiceRecord } from '../../types/domain'
import { getBusinessProfile } from './businessProfiles'
import { getInvoice } from './invoices'

function buildAgreementRecord(id: string, data: Record<string, unknown>): AgreementRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    invoiceId: String(data.invoiceId ?? ''),
    agreementNumber: String(data.agreementNumber ?? ''),
    agreementDate: (data.agreementDate as AgreementRecord['agreementDate']) ?? null,
    vendorName: String(data.vendorName ?? ''),
    vendorWhatsappNumber: typeof data.vendorWhatsappNumber === 'string' ? data.vendorWhatsappNumber : null,
    vendorAddress: typeof data.vendorAddress === 'string' ? data.vendorAddress : null,
    vendorBankAccountNumber: typeof data.vendorBankAccountNumber === 'string' ? data.vendorBankAccountNumber : null,
    vendorBankAccountName: typeof data.vendorBankAccountName === 'string' ? data.vendorBankAccountName : null,
    vendorLogoUrl: typeof data.vendorLogoUrl === 'string' ? data.vendorLogoUrl : null,
    vendorSignatureUrl: typeof data.vendorSignatureUrl === 'string' ? data.vendorSignatureUrl : null,
    clientName: String(data.clientName ?? ''),
    clientWhatsappNumber: typeof data.clientWhatsappNumber === 'string' ? data.clientWhatsappNumber : null,
    clientEmail: typeof data.clientEmail === 'string' ? data.clientEmail : null,
    clientAddress: typeof data.clientAddress === 'string' ? data.clientAddress : null,
    eventDate: (data.eventDate as AgreementRecord['eventDate']) ?? null,
    eventLocation: String(data.eventLocation ?? ''),
    totalAmount: Number(data.totalAmount ?? 0),
    totalPaid: Number(data.totalPaid ?? 0),
    remainingAmount: Number(data.remainingAmount ?? 0),
    invoiceNumber: String(data.invoiceNumber ?? ''),
    packageSummary: String(data.packageSummary ?? ''),
    clauses: Array.isArray(data.clauses) ? data.clauses.map(String) : [],
    status: data.status === 'SIGNED' ? 'SIGNED' : 'DRAFT',
    createdAt: (data.createdAt as AgreementRecord['createdAt']) ?? null,
    updatedAt: (data.updatedAt as AgreementRecord['updatedAt']) ?? null,
    deletedAt: (data.deletedAt as AgreementRecord['deletedAt']) ?? null,
  }
}

function getDefaultClauses(invoice: InvoiceRecord, businessProfile: BusinessProfile | null) {
  const vendorName = businessProfile?.vendorName || 'Vendor'
  const clientName = invoice.clientName || 'Klien'
  const packageSummary = invoice.items.map((item) => item.packageName).join(', ') || 'layanan yang telah disepakati'

  return [
    `Para pihak sepakat bahwa ${vendorName} bertindak sebagai penyedia jasa/vendor dan ${clientName} bertindak sebagai klien/pemesan jasa untuk kebutuhan acara sebagaimana tercantum dalam invoice ${invoice.invoiceNumber}.`,
    `Ruang lingkup kerja sama meliputi penyediaan ${packageSummary}, termasuk persiapan, pelaksanaan, dan koordinasi layanan sesuai detail paket yang telah disepakati oleh para pihak.`,
    `Nilai kerja sama adalah ${formatCurrency(invoice.totalAmount)}. Pembayaran yang telah diterima sampai dokumen ini dibuat adalah ${formatCurrency(invoice.totalPaid)}, dengan sisa pembayaran sebesar ${formatCurrency(invoice.remainingAmount)}.`,
    'Termin Pertama dibayarkan saat booking jasa. Termin Kedua atau pelunasan dibayar paling lambat 1 minggu sebelum acara. Apabila klien membatalkan perjanjian setelah pembayaran Termin Pertama, maka pembayaran Termin Pertama dinyatakan hangus. Apabila klien telah melakukan pelunasan dan membatalkan acara, maka pengembalian dana dilakukan sebesar 60% dari Termin Kedua.',
    'Produk foto dan/atau video yang diterima klien mengikuti paket yang dipilih. Materi untuk kebutuhan sosial media dapat diberikan bertahap dalam estimasi 1-2 minggu setelah acara, sedangkan keseluruhan hasil akhir mengikuti antrean produksi dan proses editing vendor.',
    'Biaya paket tidak termasuk biaya tambahan venue, perizinan lokasi, transport di luar kesepakatan awal, akomodasi, charge lokasi, atau kebutuhan teknis lain yang muncul di luar paket. Biaya tambahan wajib disepakati sebelum pelaksanaan.',
    'Penyerahan hasil foto dan/atau video dilakukan paling lambat 30 sampai 45 hari sejak proses pengambilan gambar, sepanjang tidak ada kendala revisi, keterlambatan materi dari klien, force majeure, atau kondisi teknis di luar kendali vendor.',
    'Seluruh hasil karya dapat digunakan oleh vendor untuk kebutuhan portofolio, promosi, website, media sosial, dan materi pemasaran lain tanpa mengurangi hak klien untuk menggunakan hasil sesuai kebutuhan pribadi, kecuali terdapat kesepakatan tertulis lain.',
    'Data pekerjaan akan disimpan selama 3 sampai 6 bulan setelah seluruh output cetak dan softcopy diterima klien. Setelah masa penyimpanan berakhir, vendor tidak berkewajiban menyimpan ulang seluruh data mentah maupun hasil akhir.',
    'Apabila terjadi kehilangan data akibat kesalahan teknis atau human error dari pihak vendor selama proses produksi, vendor akan memberikan kompensasi sesuai musyawarah para pihak. Ketentuan ini tidak berlaku untuk bencana alam, kebakaran, kehilangan alat saat bertugas, kerusakan pihak ketiga, atau keadaan lain di luar kelalaian vendor.',
    `Klien wajib menyampaikan perubahan jadwal, lokasi, konsep, atau kebutuhan teknis secara tertulis kepada vendor. Perubahan yang berdampak pada biaya atau jadwal hanya berlaku setelah disetujui oleh kedua belah pihak.`,
    `Vendor berkewajiban memberikan layanan secara profesional pada tanggal ${formatDisplayDate(invoice.eventDate)} di ${invoice.eventLocation || 'lokasi acara yang disepakati'}, sepanjang klien memenuhi kewajiban pembayaran dan informasi teknis yang dibutuhkan.`,
    'Pembatalan oleh klien setelah pembayaran DP dapat menyebabkan DP tidak dapat dikembalikan, kecuali terdapat kesepakatan tertulis lain antara para pihak.',
    'Apabila terjadi keadaan kahar seperti bencana alam, kerusuhan, pembatasan pemerintah, gangguan keamanan, atau kondisi lain di luar kendali para pihak, maka para pihak akan melakukan musyawarah untuk menentukan penjadwalan ulang atau penyesuaian kewajiban.',
    'Setiap perselisihan yang timbul dari pelaksanaan kerja sama ini akan diselesaikan terlebih dahulu melalui musyawarah mufakat sebelum ditempuh langkah hukum sesuai ketentuan yang berlaku di Indonesia.',
    'Dokumen MOU ini dibuat secara elektronik sebagai bukti kesepahaman awal dan dapat dilengkapi dengan tanda tangan basah/digital apabila diperlukan oleh para pihak.',
  ]
}

function getPackageSummary(invoice: InvoiceRecord) {
  return invoice.items.map((item) => item.packageName).join(', ') || '-'
}

export async function listAgreements(userId: string) {
  const agreementsQuery = query(collection(firestore, firestoreCollections.agreements), where('userId', '==', userId))
  const snapshot = await getDocs(agreementsQuery)

  return snapshot.docs
    .map((agreementDoc) => buildAgreementRecord(agreementDoc.id, agreementDoc.data()))
    .filter((agreement) => !agreement.deletedAt)
    .sort((a, b) => {
      const aDate = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0
      const bDate = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0
      return bDate - aDate
    })
}

export async function getAgreement(userId: string, agreementId: string) {
  const snapshot = await getDoc(doc(firestore, firestoreCollections.agreements, agreementId))
  if (!snapshot.exists()) return null

  const agreement = buildAgreementRecord(snapshot.id, snapshot.data())
  if (agreement.userId !== userId || agreement.deletedAt) return null

  return agreement
}

export async function createAgreementFromInvoice(userId: string, invoiceId: string) {
  const existingQuery = query(
    collection(firestore, firestoreCollections.agreements),
    where('userId', '==', userId),
    where('invoiceId', '==', invoiceId),
  )
  const existingSnapshot = await getDocs(existingQuery)
  const existingAgreement = existingSnapshot.docs
    .map((agreementDoc) => buildAgreementRecord(agreementDoc.id, agreementDoc.data()))
    .find((agreement) => !agreement.deletedAt)

  if (existingAgreement) return existingAgreement.id

  const [invoice, businessProfile] = await Promise.all([
    getInvoice(userId, invoiceId),
    getBusinessProfile(userId),
  ])
  if (!invoice) throw new Error('INVOICE_NOT_FOUND')

  const docRef = await addDoc(collection(firestore, firestoreCollections.agreements), {
    userId,
    invoiceId: invoice.id,
    agreementNumber: `MOU-${invoice.invoiceNumber}`,
    agreementDate: Timestamp.now(),
    vendorName: businessProfile?.vendorName || 'Vendor',
    vendorWhatsappNumber: businessProfile?.whatsappNumber || null,
    vendorAddress: businessProfile?.address || null,
    vendorBankAccountNumber: businessProfile?.bankAccountNumber || null,
    vendorBankAccountName: businessProfile?.bankAccountName || null,
    vendorLogoUrl: businessProfile?.logoUrl || null,
    vendorSignatureUrl: businessProfile?.signatureUrl || null,
    clientName: invoice.clientName,
    clientWhatsappNumber: invoice.clientWhatsappNumber,
    clientEmail: invoice.clientEmail,
    clientAddress: invoice.clientAddress,
    eventDate: invoice.eventDate,
    eventLocation: invoice.eventLocation,
    totalAmount: invoice.totalAmount,
    totalPaid: invoice.totalPaid,
    remainingAmount: invoice.remainingAmount,
    invoiceNumber: invoice.invoiceNumber,
    packageSummary: getPackageSummary(invoice),
    clauses: getDefaultClauses(invoice, businessProfile),
    status: 'DRAFT',
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export async function softDeleteAgreement(userId: string, agreementId: string) {
  const agreement = await getAgreement(userId, agreementId)
  if (!agreement) throw new Error('AGREEMENT_NOT_FOUND')

  await updateDoc(doc(firestore, firestoreCollections.agreements, agreementId), {
    userId,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
