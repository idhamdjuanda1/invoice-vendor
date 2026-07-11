import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Edit3, Loader2, Printer } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { eventFieldDefinitions, eventTypeLabels } from '../../lib/events/eventDetails'
import { formatCurrency } from '../../lib/formatters/currency'
import { formatDisplayDate } from '../../lib/formatters/date'
import { makePrintTitle } from '../../lib/formatters/printTitle'
import { syncAgreementFromInvoice } from '../../services/firestore/agreements'
import { getBusinessProfile } from '../../services/firestore/businessProfiles'
import type { AgreementRecord, BusinessProfile } from '../../types/domain'

const supplementalAgreementClauses = [
  'Termin Pertama dibayarkan saat booking jasa. Termin Kedua atau pelunasan dibayar paling lambat 1 minggu sebelum acara. Apabila klien membatalkan perjanjian setelah pembayaran Termin Pertama, maka pembayaran Termin Pertama dinyatakan hangus. Apabila klien telah melakukan pelunasan dan membatalkan acara, maka pengembalian dana dilakukan sebesar 60% dari Termin Kedua.',
  'Produk foto dan/atau video yang diterima klien mengikuti paket yang dipilih. Materi untuk kebutuhan sosial media dapat diberikan bertahap dalam estimasi 1-2 minggu setelah acara, sedangkan keseluruhan hasil akhir mengikuti antrean produksi dan proses editing vendor.',
  'Biaya paket tidak termasuk biaya tambahan venue, perizinan lokasi, transport di luar kesepakatan awal, akomodasi, charge lokasi, atau kebutuhan teknis lain yang muncul di luar paket. Biaya tambahan wajib disepakati sebelum pelaksanaan.',
  'Penyerahan hasil foto dan/atau video dilakukan paling lambat 30 sampai 45 hari sejak proses pengambilan gambar, sepanjang tidak ada kendala revisi, keterlambatan materi dari klien, force majeure, atau kondisi teknis di luar kendali vendor.',
  'Seluruh hasil karya dapat digunakan oleh vendor untuk kebutuhan portofolio, promosi, website, media sosial, dan materi pemasaran lain tanpa mengurangi hak klien untuk menggunakan hasil sesuai kebutuhan pribadi, kecuali terdapat kesepakatan tertulis lain.',
  'Data pekerjaan akan disimpan selama 3 sampai 6 bulan setelah seluruh output cetak dan softcopy diterima klien. Setelah masa penyimpanan berakhir, vendor tidak berkewajiban menyimpan ulang seluruh data mentah maupun hasil akhir.',
  'Apabila terjadi kehilangan data akibat kesalahan teknis atau human error dari pihak vendor selama proses produksi, vendor akan memberikan kompensasi sesuai musyawarah para pihak. Ketentuan ini tidak berlaku untuk bencana alam, kebakaran, kehilangan alat saat bertugas, kerusakan pihak ketiga, atau keadaan lain di luar kelalaian vendor.',
]

export function AgreementDetailPage() {
  const { agreementId } = useParams()
  const { profile } = useAuth()
  const pdfRef = useRef<HTMLDivElement | null>(null)
  const [agreement, setAgreement] = useState<AgreementRecord | null>(null)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadAgreement = useCallback(async () => {
    if (!profile?.uid || !agreementId) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const [agreementData, profileData] = await Promise.all([
        syncAgreementFromInvoice(profile.uid, agreementId),
        getBusinessProfile(profile.uid),
      ])
      if (!agreementData) {
        setErrorMessage('MOU tidak ditemukan.')
        return
      }
      setAgreement(agreementData)
      setBusinessProfile(profileData)
    } catch (error) {
      console.error('Failed to load agreement detail', error)
      setErrorMessage('Detail MOU belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [agreementId, profile?.uid])

  useEffect(() => {
    void loadAgreement()
  }, [loadAgreement])

  function handlePrint() {
    const currentTitle = document.title
    document.title = agreement ? makePrintTitle([agreement.clientName || 'MOU']) : 'MOU'
    window.print()
    window.setTimeout(() => {
      document.title = currentTitle
    }, 500)
  }

  async function handleGeneratePdf() {
    if (!agreement) return

    setIsGeneratingPdf(true)
    setErrorMessage('')

    try {
      const { generateAgreementPdf } = await import('../../lib/pdf/documentPdf')
      await generateAgreementPdf({
        agreement,
        clauses: displayClauses,
        filename: makePrintTitle(['MOU', agreement.clientName || agreement.agreementNumber]),
      })
    } catch (error) {
      console.error('Failed to generate MOU PDF', error)
      setErrorMessage('PDF MOU belum bisa dibuat. Coba refresh halaman lalu ulangi.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const displayLogoUrl = agreement?.vendorLogoUrl || businessProfile?.logoUrl || null
  const displaySignatureUrl = agreement?.vendorSignatureUrl || businessProfile?.signatureUrl || null
  const displayClauses = agreement
    ? [
        ...agreement.clauses,
        ...supplementalAgreementClauses.filter(
          (clause) => !agreement.clauses.some((existingClause) => existingClause.slice(0, 60) === clause.slice(0, 60)),
        ),
      ]
    : []

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Detail MOU"
        description="Dokumen kerja sama yang siap dicetak dan dikirim ke klien/vendor partner."
        actions={
          <>
            {agreement ? (
              <Link to={`/invoices/${agreement.invoiceId}`}>
                <Button icon={<Edit3 size={16} />} variant="secondary">
                  Invoice
                </Button>
              </Link>
            ) : null}
            {agreement ? (
              <Button
                disabled={isGeneratingPdf}
                icon={isGeneratingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                onClick={() => void handleGeneratePdf()}
                variant="secondary"
              >
                {isGeneratingPdf ? 'Membuat PDF...' : 'Download PDF'}
              </Button>
            ) : null}
            <Button icon={<Printer size={16} />} onClick={handlePrint}>
              Cetak MOU
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={16} />
            Memuat MOU...
          </CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="text-sm text-red-600">{errorMessage}</CardContent>
        </Card>
      ) : agreement ? (
        <Card className="print-card">
          <CardContent className="print-card-content">
            <div className="print-area grid gap-6 bg-white p-2 text-sm text-app-text sm:p-8" ref={pdfRef}>
              <div className="print-header flex flex-col gap-4 border-b-2 border-app-text pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-gold">Memorandum of Understanding</p>
                  <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.08em]">Perjanjian Kerja Sama</h1>
                  <p className="mt-2 text-sm font-semibold">{agreement.agreementNumber}</p>
                </div>
                {displayLogoUrl ? (
                  <img alt="Logo vendor" className="print-logo ml-auto h-16 max-w-32 object-contain" src={displayLogoUrl} />
                ) : null}
              </div>

              <div className="print-meta grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-app-border bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Pihak Pertama</p>
                  <p className="mt-2 text-lg font-bold">{agreement.vendorName || 'Vendor'}</p>
                  <div className="mt-2 grid gap-1 text-neutral-600">
                    {agreement.vendorWhatsappNumber ? <span>WhatsApp: {agreement.vendorWhatsappNumber}</span> : null}
                    {agreement.vendorAddress ? <span>{agreement.vendorAddress}</span> : null}
                    {agreement.vendorBankAccountNumber ? (
                      <span>
                        Rekening: {agreement.vendorBankAccountNumber}
                        {agreement.vendorBankAccountName ? ` a.n. ${agreement.vendorBankAccountName}` : ''}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md border border-app-border bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Pihak Kedua</p>
                  <p className="mt-2 text-lg font-bold">{agreement.clientName || 'Klien'}</p>
                  <div className="mt-2 grid gap-1 text-neutral-600">
                    {agreement.clientWhatsappNumber ? <span>WhatsApp: {agreement.clientWhatsappNumber}</span> : null}
                    {agreement.clientEmail ? <span>{agreement.clientEmail}</span> : null}
                    {agreement.clientAddress ? <span>{agreement.clientAddress}</span> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-app-border bg-app-muted p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Tanggal Acara</p>
                    <p className="mt-1 font-semibold">{formatDisplayDate(agreement.eventDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Lokasi</p>
                    <p className="mt-1 font-semibold">{agreement.eventLocation || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Nilai Kerja Sama</p>
                    <p className="mt-1 font-semibold">{formatCurrency(agreement.totalAmount)}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-app-border pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Paket/Layanan</p>
                  {agreement.packageItems.length > 0 ? (
                    <div className="mt-2 grid gap-3">
                      {agreement.packageItems.map((item) => (
                        <div className="rounded-md border border-app-border bg-white p-3" key={item.id}>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <p className="font-semibold">{item.packageName}</p>
                            <p className="font-bold">{formatCurrency(item.totalPrice)}</p>
                          </div>
                          {item.description ? (
                            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-600">{item.description}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1">{agreement.packageSummary}</p>
                  )}
                </div>
                <div className="mt-3 border-t border-app-border pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Detail Acara</p>
                  <p className="mt-1 font-semibold">{eventTypeLabels[agreement.eventType]}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {eventFieldDefinitions[agreement.eventType].map((field) => (
                      <div key={field.key}>
                        <p className="text-xs text-neutral-500">{field.label}</p>
                        <p className="font-semibold">{agreement.eventDetails[field.key] || '-'}</p>
                      </div>
                    ))}
                    {agreement.eventLocationAddress ? (
                      <div className="md:col-span-2">
                        <p className="text-xs text-neutral-500">Alamat Lengkap</p>
                        <p className="whitespace-pre-line font-semibold">{agreement.eventLocationAddress}</p>
                      </div>
                    ) : null}
                    {agreement.eventLocationLandmark ? (
                      <div className="md:col-span-2">
                        <p className="text-xs text-neutral-500">Patokan Alamat</p>
                        <p className="whitespace-pre-line font-semibold">{agreement.eventLocationLandmark}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {displayClauses.map((clause, index) => (
                  <section className="rounded-md border border-app-border bg-white p-4" key={`${agreement.id}-clause-${index}`}>
                    <h2 className="text-sm font-bold uppercase tracking-wide">Pasal {index + 1}</h2>
                    <p className="mt-2 leading-relaxed text-neutral-700">{clause}</p>
                  </section>
                ))}
              </div>

              <div className="print-footer grid gap-8 border-t border-app-border pt-6 text-sm md:grid-cols-2">
                <div className="text-center">
                  <p className="font-semibold">Pihak Pertama</p>
                  <div className="flex h-20 items-center justify-center">
                    {displaySignatureUrl ? (
                      <img alt="Tanda tangan vendor" className="max-h-20 max-w-52 object-contain" src={displaySignatureUrl} />
                    ) : null}
                  </div>
                  <p className="font-bold">{agreement.vendorName || 'Vendor'}</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">Pihak Kedua</p>
                  <div className="h-20" />
                  <p className="font-bold">{agreement.clientName || 'Klien'}</p>
                </div>
              </div>

              <p className="text-center text-xs text-neutral-500">
                Dokumen dibuat pada {formatDisplayDate(agreement.agreementDate)} berdasarkan invoice {agreement.invoiceNumber}.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
