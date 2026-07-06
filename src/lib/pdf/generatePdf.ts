import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

type PdfMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

type GeneratePdfOptions = {
  filename: string
  margins?: PdfMargins
  quality?: 'standard' | 'sharp'
}

const a4WidthMm = 210
const a4HeightMm = 297
const defaultMargins: PdfMargins = {
  top: 30,
  right: 30,
  bottom: 30,
  left: 40,
}
const defaultPdfScale = 2.4

function makePageSlice(sourceCanvas: HTMLCanvasElement, startY: number, height: number) {
  const sliceCanvas = document.createElement('canvas')
  const sliceHeight = Math.min(height, sourceCanvas.height - startY)

  sliceCanvas.width = sourceCanvas.width
  sliceCanvas.height = sliceHeight

  const context = sliceCanvas.getContext('2d')
  if (!context) throw new Error('PDF_CANVAS_CONTEXT_FAILED')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
  context.drawImage(sourceCanvas, 0, startY, sourceCanvas.width, sliceHeight, 0, 0, sourceCanvas.width, sliceHeight)

  return sliceCanvas
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('PDF_IMAGE_READ_FAILED'))
    reader.readAsDataURL(blob)
  })
}

async function makeImageSafe(image: HTMLImageElement) {
  const source = image.currentSrc || image.src
  if (!source || source.startsWith('data:') || source.startsWith('blob:')) return

  image.crossOrigin = 'anonymous'

  try {
    const response = await fetch(source, { mode: 'cors', cache: 'force-cache' })
    if (!response.ok) throw new Error(`PDF_IMAGE_FETCH_FAILED_${response.status}`)

    image.src = await readBlobAsDataUrl(await response.blob())
  } catch (error) {
    console.warn('PDF image could not be embedded and will be hidden', { source, error })
    image.style.display = 'none'
  }
}

async function prepareElementForPdf(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement
  const sourceWidth = Math.max(element.scrollWidth, element.getBoundingClientRect().width)

  clone.style.position = 'fixed'
  clone.style.left = '-10000px'
  clone.style.top = '0'
  clone.style.width = `${sourceWidth}px`
  clone.style.maxWidth = 'none'
  clone.style.background = '#ffffff'
  clone.style.fontSize = '15px'
  clone.style.lineHeight = '1.55'

  document.body.appendChild(clone)

  const elements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]
  elements.forEach((node) => {
    const computed = window.getComputedStyle(node)

    node.style.color = '#111111'
    node.style.borderColor = '#e5e5e5'
    node.style.textDecorationColor = '#111111'

    if (computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && computed.backgroundColor !== 'transparent') {
      node.style.backgroundColor = computed.backgroundColor.includes('oklch') ? '#ffffff' : computed.backgroundColor
    }

    if (node.className.includes('bg-app-muted')) {
      node.style.backgroundColor = '#f8f8f8'
    }

    if (node.className.includes('text-app-gold')) {
      node.style.color = '#c9a227'
    }

    if (node.className.includes('text-neutral')) {
      node.style.color = '#525252'
    }

    if (node.tagName === 'P' || node.tagName === 'SPAN' || node.tagName === 'TD' || node.tagName === 'LI') {
      node.style.lineHeight = '1.55'
    }
  })

  const images = Array.from(clone.querySelectorAll('img'))
  await Promise.all(images.map(makeImageSafe))

  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  return clone
}

export async function generatePdfFromElement(element: HTMLElement, options: GeneratePdfOptions) {
  const margins = options.margins ?? defaultMargins
  const contentWidthMm = a4WidthMm - margins.left - margins.right
  const contentHeightMm = a4HeightMm - margins.top - margins.bottom

  const pdfElement = await prepareElementForPdf(element)

  try {
    const canvas = await html2canvas(pdfElement, {
      backgroundColor: '#ffffff',
      scale: options.quality === 'standard' ? 2 : defaultPdfScale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: pdfElement.scrollWidth,
      windowHeight: pdfElement.scrollHeight,
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pageHeightPx = Math.floor((contentHeightMm * canvas.width) / contentWidthMm)
    let currentY = 0
    let pageIndex = 0

    while (currentY < canvas.height) {
      if (pageIndex > 0) pdf.addPage()

      const pageCanvas = makePageSlice(canvas, currentY, pageHeightPx)
      const pageHeightMm = (pageCanvas.height * contentWidthMm) / pageCanvas.width
      const imageData = pageCanvas.toDataURL('image/jpeg', 0.98)

      pdf.addImage(imageData, 'JPEG', margins.left, margins.top, contentWidthMm, pageHeightMm)
      currentY += pageHeightPx
      pageIndex += 1
    }

    pdf.save(options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`)
  } finally {
    pdfElement.remove()
  }
}
