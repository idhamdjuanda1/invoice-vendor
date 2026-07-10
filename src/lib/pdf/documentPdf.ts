import { jsPDF } from 'jspdf'
import { formatCurrency } from '../formatters/currency'
import { formatDisplayDate } from '../formatters/date'
import { paymentMethodLabels, paymentStatusLabels } from '../formatters/invoice'
import type { AgreementRecord, BusinessProfile, InvoiceRecord, PaymentRecord, ReceiptRecord } from '../../types/domain'

type PdfDoc = jsPDF

const pageWidth = 210
const pageHeight = 297
const margin = {
  top: 30,
  right: 30,
  bottom: 30,
  left: 40,
}
const contentWidth = pageWidth - margin.left - margin.right
const black = '#111111'
const gray = '#555555'
const border = '#d9d9d9'
const muted = '#f6f6f6'
const gold = '#c9a227'

function createDoc() {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
}

function saveDoc(doc: PdfDoc, filename: string) {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

function ensurePage(doc: PdfDoc, y: number, needed = 12) {
  if (y + needed <= pageHeight - margin.bottom) return y
  doc.addPage()
  return margin.top
}

function line(doc: PdfDoc, y: number) {
  doc.setDrawColor(border)
  doc.line(margin.left, y, pageWidth - margin.right, y)
}

function text(doc: PdfDoc, value: string, x: number, y: number, options?: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right' }) {
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  doc.setFontSize(options?.size ?? 10)
  doc.setTextColor(options?.color ?? black)
  doc.text(value, x, y, { align: options?.align ?? 'left' })
}

function wrappedText(doc: PdfDoc, value: string, x: number, y: number, width: number, options?: { size?: number; bold?: boolean; color?: string; lineHeight?: number }) {
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  doc.setFontSize(options?.size ?? 10)
  doc.setTextColor(options?.color ?? black)
  const lines = doc.splitTextToSize(value || '-', width) as string[]
  doc.text(lines, x, y)
  return y + lines.length * (options?.lineHeight ?? 5)
}

function keyValue(doc: PdfDoc, label: string, value: string, x: number, y: number, width: number) {
  text(doc, label, x, y, { size: 8, bold: true, color: gray })
  return wrappedText(doc, value || '-', x, y + 5, width, { size: 10, bold: true, lineHeight: 5 })
}

function box(doc: PdfDoc, x: number, y: number, width: number, height: number, fill = false) {
  doc.setDrawColor(border)
  if (fill) {
    doc.setFillColor(muted)
    doc.rect(x, y, width, height, 'FD')
    return
  }
  doc.rect(x, y, width, height)
}

function header(doc: PdfDoc, eyebrow: string, title: string, number: string, date: string, vendorName?: string) {
  text(doc, eyebrow, margin.left, margin.top, { size: 8, bold: true, color: gold })
  text(doc, title, margin.left, margin.top + 9, { size: 20, bold: true })
  if (vendorName) text(doc, vendorName, margin.left, margin.top + 17, { size: 11, bold: true })
  text(doc, number, pageWidth - margin.right, margin.top + 3, { size: 10, bold: true, align: 'right' })
  text(doc, date, pageWidth - margin.right, margin.top + 10, { size: 9, color: gray, align: 'right' })
  line(doc, margin.top + 24)
  return margin.top + 34
}

function drawAmountSummary(doc: PdfDoc, y: number, rows: Array<[string, string]>) {
  const x = pageWidth - margin.right - 70
  const rowHeight = 10
  box(doc, x, y, 70, rows.length * rowHeight, true)
  rows.forEach(([label, value], index) => {
    const rowY = y + 7 + index * rowHeight
    text(doc, label, x + 4, rowY, { size: 9, color: gray })
    text(doc, value, x + 66, rowY, { size: 9, bold: true, align: 'right' })
  })
  return y + rows.length * rowHeight
}

function formatPackageDetails(value: string | null) {
  if (!value) return ''

  return value
    .split(/\r?\n|•|;|\s{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ')
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('PDF_IMAGE_READ_FAILED'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('PDF_IMAGE_LOAD_FAILED'))
    image.src = source
  })
}

async function rasterizeSvgDataUrl(source: string) {
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  const width = image.naturalWidth || 800
  const height = image.naturalHeight || 300

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('PDF_CANVAS_CONTEXT_FAILED')

  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL('image/png')
}

async function imageUrlToDataUrl(url: string | null) {
  if (!url) return null
  if (url.startsWith('data:image/svg+xml')) {
    return rasterizeSvgDataUrl(url)
  }
  if (url.startsWith('data:')) return url

  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!response.ok) throw new Error(`PDF_IMAGE_FETCH_FAILED_${response.status}`)
    const blob = await response.blob()
    const dataUrl = await readBlobAsDataUrl(blob)
    return blob.type === 'image/svg+xml' || dataUrl.startsWith('data:image/svg+xml')
      ? rasterizeSvgDataUrl(dataUrl)
      : dataUrl
  } catch (error) {
    console.warn('PDF image could not be loaded', { url, error })
    return null
  }
}

function addImageFit(doc: PdfDoc, imageData: string, x: number, y: number, maxWidth: number, maxHeight: number) {
  try {
    const properties = doc.getImageProperties(imageData)
    const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height)
    const width = properties.width * ratio
    const height = properties.height * ratio
    doc.addImage(imageData, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height)
  } catch (error) {
    console.warn('PDF image could not be embedded', error)
  }
}

export function generateInvoicePdf(params: {
  invoice: InvoiceRecord
  payments: PaymentRecord[]
  businessProfile: BusinessProfile | null
  filename: string
}) {
  const { invoice, payments, businessProfile, filename } = params
  const doc = createDoc()
  let y = header(doc, 'INVOICE VENDOR', 'INVOICE', invoice.invoiceNumber, formatDisplayDate(invoice.invoiceDate), businessProfile?.vendorName || 'Vendor')

  const colWidth = (contentWidth - 8) / 2
  box(doc, margin.left, y, colWidth, 42)
  keyValue(doc, 'DITAGIHKAN KEPADA', invoice.clientName || 'Klien', margin.left + 4, y + 7, colWidth - 8)
  text(doc, `Tahap Pembayaran: ${paymentStatusLabels[invoice.paymentStatus]}`, margin.left + 4, y + 28, { size: 9, color: gray })
  if (invoice.clientWhatsappNumber) text(doc, invoice.clientWhatsappNumber, margin.left + 4, y + 35, { size: 9, color: gray })

  box(doc, margin.left + colWidth + 8, y, colWidth, 42)
  keyValue(doc, 'DETAIL ACARA', formatDisplayDate(invoice.eventDate), margin.left + colWidth + 12, y + 7, colWidth - 8)
  wrappedText(doc, invoice.eventLocation || '-', margin.left + colWidth + 12, y + 28, colWidth - 8, { size: 9, color: gray, lineHeight: 4 })
  y += 52

  text(doc, 'Rincian Paket', margin.left, y, { size: 12, bold: true })
  y += 6
  box(doc, margin.left, y, contentWidth, 9, true)
  text(doc, 'Paket', margin.left + 3, y + 6, { size: 8, bold: true })
  text(doc, 'Qty', margin.left + 88, y + 6, { size: 8, bold: true, align: 'right' })
  text(doc, 'Harga', margin.left + 112, y + 6, { size: 8, bold: true, align: 'right' })
  text(doc, 'Total', pageWidth - margin.right - 3, y + 6, { size: 8, bold: true, align: 'right' })
  y += 9

  invoice.items.forEach((item) => {
    y = ensurePage(doc, y, 18)
    const packageDetails = formatPackageDetails(item.description)
    const packageText = packageDetails ? `${item.packageName}: ${packageDetails}` : item.packageName
    const rowHeight = Math.max(14, 8 + doc.splitTextToSize(packageText, 78).length * 4)
    box(doc, margin.left, y, contentWidth, rowHeight)
    wrappedText(doc, packageText, margin.left + 3, y + 5, 76, { size: 8.5, bold: true, lineHeight: 4 })
    text(doc, String(item.quantity), margin.left + 88, y + 6, { size: 9, align: 'right' })
    text(doc, formatCurrency(item.unitPrice), margin.left + 112, y + 6, { size: 9, align: 'right' })
    text(doc, formatCurrency(item.totalPrice), pageWidth - margin.right - 3, y + 6, { size: 9, bold: true, align: 'right' })
    y += rowHeight
  })

  const amountRows: Array<[string, string]> = [
    ['Subtotal', formatCurrency(invoice.subtotal)],
  ]
  if (invoice.discountAmount > 0) {
    amountRows.push([invoice.discountLabel || 'Potongan Harga', `-${formatCurrency(invoice.discountAmount)}`])
  }
  amountRows.push(
    ['Total Tagihan', formatCurrency(invoice.totalAmount)],
    ['Sudah Dibayar', formatCurrency(invoice.totalPaid)],
    ['Sisa Pembayaran', formatCurrency(invoice.remainingAmount)],
  )
  y = ensurePage(doc, y + 8, amountRows.length * 10 + 12)
  drawAmountSummary(doc, y, amountRows)
  if (businessProfile?.bankAccountNumber) {
    wrappedText(
      doc,
      `Pembayaran dilakukan ke nomor rekening ${businessProfile.bankAccountNumber}${businessProfile.bankAccountName ? ` atas nama ${businessProfile.bankAccountName}` : ''}.`,
      margin.left,
      y + 5,
      contentWidth - 78,
      { size: 9, color: gray, lineHeight: 5 },
    )
  }
  y += amountRows.length * 10 + 12

  if (payments.length > 0) {
    y = ensurePage(doc, y, 20)
    text(doc, 'Pembayaran Diterima', margin.left, y, { size: 11, bold: true })
    y += 7
    payments.forEach((payment) => {
      y = ensurePage(doc, y, 8)
      text(doc, `${formatDisplayDate(payment.paymentDate)} - ${paymentMethodLabels[payment.paymentMethod]}`, margin.left, y, { size: 9 })
      text(doc, formatCurrency(payment.amount), pageWidth - margin.right, y, { size: 9, bold: true, align: 'right' })
      y += 6
    })
  }

  saveDoc(doc, filename)
}

export async function generateAgreementPdf(params: { agreement: AgreementRecord; clauses: string[]; filename: string }) {
  const { agreement, clauses, filename } = params
  const doc = createDoc()
  let y = header(doc, 'MEMORANDUM OF UNDERSTANDING', 'PERJANJIAN KERJA SAMA', agreement.agreementNumber, formatDisplayDate(agreement.agreementDate), agreement.vendorName)
  const signatureDataUrl = await imageUrlToDataUrl(agreement.vendorSignatureUrl)

  const colWidth = (contentWidth - 8) / 2
  const partyBoxHeight = 58
  box(doc, margin.left, y, colWidth, partyBoxHeight)
  let leftY = keyValue(doc, 'PIHAK PERTAMA', agreement.vendorName || 'Vendor', margin.left + 4, y + 7, colWidth - 8) + 2
  if (agreement.vendorWhatsappNumber) {
    text(doc, `WhatsApp: ${agreement.vendorWhatsappNumber}`, margin.left + 4, leftY, { size: 8, color: gray })
    leftY += 5
  }
  if (agreement.vendorAddress) {
    leftY = wrappedText(doc, agreement.vendorAddress, margin.left + 4, leftY, colWidth - 8, { size: 8, color: gray, lineHeight: 4 }) + 1
  }
  if (agreement.vendorBankAccountNumber) {
    wrappedText(
      doc,
      `Rekening: ${agreement.vendorBankAccountNumber}${agreement.vendorBankAccountName ? ` a.n. ${agreement.vendorBankAccountName}` : ''}`,
      margin.left + 4,
      leftY,
      colWidth - 8,
      { size: 8, color: gray, lineHeight: 4 },
    )
  }

  box(doc, margin.left + colWidth + 8, y, colWidth, partyBoxHeight)
  let rightY = keyValue(doc, 'PIHAK KEDUA', agreement.clientName || 'Klien', margin.left + colWidth + 12, y + 7, colWidth - 8) + 2
  if (agreement.clientWhatsappNumber) {
    text(doc, `WhatsApp: ${agreement.clientWhatsappNumber}`, margin.left + colWidth + 12, rightY, { size: 8, color: gray })
    rightY += 5
  }
  if (agreement.clientEmail) {
    text(doc, agreement.clientEmail, margin.left + colWidth + 12, rightY, { size: 8, color: gray })
    rightY += 5
  }
  if (agreement.clientAddress) {
    wrappedText(doc, agreement.clientAddress, margin.left + colWidth + 12, rightY, colWidth - 8, { size: 8, color: gray, lineHeight: 4 })
  }
  y += partyBoxHeight + 10

  box(doc, margin.left, y, contentWidth, 30, true)
  text(doc, `Tanggal Acara: ${formatDisplayDate(agreement.eventDate)}`, margin.left + 4, y + 8, { size: 9, bold: true })
  text(doc, `Nilai Kerja Sama: ${formatCurrency(agreement.totalAmount)}`, margin.left + 4, y + 16, { size: 9, bold: true })
  wrappedText(doc, `Lokasi: ${agreement.eventLocation || '-'}`, margin.left + 4, y + 24, contentWidth - 8, { size: 9, color: gray, lineHeight: 4 })
  y += 40

  clauses.forEach((clause, index) => {
    const lines = doc.splitTextToSize(clause, contentWidth) as string[]
    y = ensurePage(doc, y, 12 + lines.length * 4.5)
    text(doc, `Pasal ${index + 1}`, margin.left, y, { size: 11, bold: true })
    y = wrappedText(doc, clause, margin.left, y + 6, contentWidth, { size: 9.5, color: gray, lineHeight: 4.7 }) + 4
  })

  y = ensurePage(doc, y + 8, 34)
  line(doc, y)
  y += 12
  text(doc, 'Pihak Pertama', margin.left + 25, y, { size: 10, bold: true, align: 'center' })
  text(doc, 'Pihak Kedua', pageWidth - margin.right - 25, y, { size: 10, bold: true, align: 'center' })
  if (signatureDataUrl) {
    addImageFit(doc, signatureDataUrl, margin.left + 3, y + 5, 44, 19)
  }
  y += 27
  text(doc, agreement.vendorName || 'Vendor', margin.left + 25, y, { size: 10, bold: true, align: 'center' })
  text(doc, agreement.clientName || 'Klien', pageWidth - margin.right - 25, y, { size: 10, bold: true, align: 'center' })

  saveDoc(doc, filename)
}

export function generateReceiptPdf(params: { receipt: ReceiptRecord; filename: string }) {
  const { receipt, filename } = params
  const doc = createDoc()
  let y = header(doc, 'INVOICE VENDOR', 'KUITANSI', receipt.receiptNumber, formatDisplayDate(receipt.receiptDate), receipt.vendorName)

  box(doc, margin.left, y, contentWidth, 40)
  keyValue(doc, 'TELAH DITERIMA DARI', receipt.clientName, margin.left + 5, y + 8, contentWidth - 10)
  text(doc, `Untuk pembayaran invoice ${receipt.invoiceNumber}`, margin.left + 5, y + 30, { size: 9, color: gray })
  y += 50

  box(doc, margin.left, y, contentWidth, 28, true)
  text(doc, 'Nominal Pembayaran', margin.left + 5, y + 8, { size: 9, bold: true, color: gray })
  text(doc, formatCurrency(receipt.amount), margin.left + 5, y + 20, { size: 18, bold: true })
  text(doc, `Metode: ${paymentMethodLabels[receipt.paymentMethod]}`, pageWidth - margin.right - 5, y + 18, { size: 10, bold: true, align: 'right' })
  y += 40

  text(doc, 'Keterangan', margin.left, y, { size: 11, bold: true })
  y = wrappedText(doc, receipt.notes || `Pembayaran untuk invoice ${receipt.invoiceNumber}.`, margin.left, y + 7, contentWidth, { size: 10, color: gray, lineHeight: 5 }) + 18

  y = ensurePage(doc, y, 35)
  text(doc, 'Hormat kami,', pageWidth - margin.right - 30, y, { size: 10, align: 'center' })
  y += 25
  text(doc, receipt.vendorName, pageWidth - margin.right - 30, y, { size: 10, bold: true, align: 'center' })
  text(doc, 'Kuitansi ini dibuat secara elektronik dan sah tanpa tanda tangan basah.', margin.left, pageHeight - margin.bottom, { size: 8, color: gray })

  saveDoc(doc, filename)
}
