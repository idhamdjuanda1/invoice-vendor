import { useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Check, Loader2, MapPin, MessageCircle, Percent, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { formatCurrency } from '../../lib/formatters/currency'
import { getPublishedPricelistBySlug } from '../../services/firestore/pricelists'
import type { PricelistPackageItem, PricelistRecord } from '../../types/domain'

function normalizeWhatsAppNumber(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

function normalizeExternalUrl(value: string | null) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function TikTokIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16.7 3c.5 2.5 1.9 4 4.3 4.2v3.4c-1.6 0-3-.5-4.2-1.3v6.1c0 3.4-2.3 5.6-5.7 5.6-3.1 0-5.4-2.1-5.4-5.1 0-3.1 2.4-5.2 5.7-5.2.4 0 .7 0 1 .1v3.5c-.3-.1-.6-.1-1-.1-1.3 0-2.2.7-2.2 1.8 0 1 .8 1.7 1.9 1.7 1.4 0 2.1-.8 2.1-2.4V3h3.5Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect height="16" rx="5" width="16" x="4" y="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" fill="currentColor" r="1" stroke="none" />
    </svg>
  )
}

function buildWhatsAppUrl(pricelist: PricelistRecord, selectedItems: PricelistPackageItem[], discountAmount: number, finalTotal: number) {
  const phoneNumber = normalizeWhatsAppNumber(pricelist.vendorWhatsappNumber)
  const packageLines = selectedItems.map((item) => `- ${item.packageName}: ${formatCurrency(item.price)}`).join('\n')
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0)
  const message = [
    `Halo ${pricelist.vendorName}, saya tertarik dengan pricelist ${pricelist.title}.`,
    '',
    'Paket yang saya pilih:',
    packageLines,
    '',
    `Subtotal: ${formatCurrency(subtotal)}`,
    discountAmount > 0 ? `Diskon: ${formatCurrency(discountAmount)}` : '',
    `Total estimasi: ${formatCurrency(finalTotal)}`,
    '',
    'Mohon info detail dan ketersediaannya.',
  ].filter(Boolean).join('\n')

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
}

function formatPackageDetails(description: string | null) {
  if (!description) return []

  const manualLines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (manualLines.length > 1) return manualLines

  const normalized = description.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  return normalized
    .replace(/\s+(?=\d+(?:-\d+)?\s+[A-Za-z])/g, '\n')
    .replace(/\s+(?=Kolase\b)/gi, '\n')
    .replace(/\s+(?=Flashdrive\b)/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function getVendorInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  return initials || 'IV'
}

export function PublicPricelistPage() {
  const { slug } = useParams()
  const [pricelist, setPricelist] = useState<PricelistRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [imageOrientations, setImageOrientations] = useState<Record<string, 'portrait' | 'landscape'>>({})
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadPricelist() {
      if (!slug) {
        setErrorMessage('Link pricelist tidak valid.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedPricelist = await getPublishedPricelistBySlug(slug)
        if (!isMounted) return

        setPricelist(loadedPricelist)
        setLogoFailed(false)
        setShowDiscountModal(Boolean(loadedPricelist?.discountIsActive))
        document.title = loadedPricelist ? `${loadedPricelist.title} - ${loadedPricelist.vendorName}` : 'Pricelist Invoice Vendor'
        if (!loadedPricelist) setErrorMessage('Pricelist tidak ditemukan atau sudah tidak aktif.')
      } catch (error) {
        console.error('Failed to load public pricelist', error)
        if (isMounted) setErrorMessage('Pricelist belum bisa dimuat.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadPricelist()

    return () => {
      isMounted = false
    }
  }, [slug])

  const selectedItems = useMemo(
    () => pricelist?.items.filter((item) => selectedIds.includes(item.id)) ?? [],
    [pricelist?.items, selectedIds],
  )

  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0)
  const discountPercentage = pricelist?.discountIsActive ? pricelist.discountPercentage : 0
  const discountAmount = Math.round(subtotal * (discountPercentage / 100))
  const finalTotal = Math.max(subtotal - discountAmount, 0)
  const whatsappUrl = pricelist ? buildWhatsAppUrl(pricelist, selectedItems, discountAmount, finalTotal) : ''
  const hasWhatsApp = Boolean(normalizeWhatsAppNumber(pricelist?.vendorWhatsappNumber ?? null))
  const socialWhatsappUrl = normalizeExternalUrl(pricelist?.whatsappUrl ?? null)
  const fallbackWhatsappUrl = pricelist?.vendorWhatsappNumber ? `https://wa.me/${normalizeWhatsAppNumber(pricelist.vendorWhatsappNumber)}` : ''
  const socialLinks = [
    { label: 'Instagram', href: normalizeExternalUrl(pricelist?.instagramUrl ?? null), icon: <InstagramIcon /> },
    { label: 'TikTok', href: normalizeExternalUrl(pricelist?.tiktokUrl ?? null), icon: <TikTokIcon /> },
    { label: 'WhatsApp', href: socialWhatsappUrl || fallbackWhatsappUrl, icon: <MessageCircle size={20} /> },
  ].filter((link) => link.href)

  function toggleItem(itemId: string) {
    setSelectedIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId)
      return [...current, itemId]
    })
  }

  function handleImageLoad(itemId: string, event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget
    setImageOrientations((current) => ({
      ...current,
      [itemId]: image.naturalHeight > image.naturalWidth ? 'portrait' : 'landscape',
    }))
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f3] px-5">
        <div className="flex items-center gap-2 rounded-md border border-app-border bg-white px-4 py-3 text-sm text-neutral-500 shadow-sm">
          <Loader2 className="animate-spin" size={16} />
          Memuat pricelist...
        </div>
      </div>
    )
  }

  if (!pricelist || errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f3] px-5">
        <div className="max-w-md rounded-lg border border-app-border bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-bold text-app-text">Pricelist tidak tersedia</p>
          <p className="mt-2 text-sm text-neutral-600">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f3ec] text-app-text">
      {showDiscountModal ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-11 items-center justify-center rounded-md bg-app-gold-soft text-app-text">
                  <Percent size={22} />
                </div>
                <h2 className="mt-4 text-xl font-bold">{pricelist.discountTitle || 'Diskon spesial'}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {pricelist.discountDescription || `Dapatkan diskon ${pricelist.discountPercentage}% untuk paket pilihan.`}
                </p>
              </div>
              <Button aria-label="Tutup popup diskon" className="px-3" onClick={() => setShowDiscountModal(false)} type="button" variant="secondary">
                <X size={16} />
              </Button>
            </div>
            <Button className="mt-5 w-full" onClick={() => setShowDiscountModal(false)} type="button">
              Lihat Pricelist
            </Button>
          </div>
        </div>
      ) : null}

      <header className="border-b border-app-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-7 px-5 py-8 md:grid-cols-[minmax(0,1fr)_380px] md:items-center md:px-8 md:py-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-app-border bg-[#201b14] text-sm font-black tracking-wide text-app-gold">
                {pricelist.vendorLogoUrl && !logoFailed ? (
                  <img
                    alt={pricelist.vendorName}
                    className="size-full bg-white object-contain p-1"
                    onError={() => setLogoFailed(true)}
                    src={pricelist.vendorLogoUrl}
                  />
                ) : (
                  getVendorInitials(pricelist.vendorName)
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-app-gold">{pricelist.vendorName}</p>
                {pricelist.vendorAddress ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                    <MapPin size={13} />
                    {pricelist.vendorAddress}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-9 text-xs font-bold uppercase tracking-[0.24em] text-app-gold">Pricelist</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-normal text-[#201b14] md:text-6xl">
              {pricelist.title}
            </h1>
            {pricelist.tagline ? (
              <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-600 md:text-lg">{pricelist.tagline}</p>
            ) : null}
            {socialLinks.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <a
                    aria-label={link.label}
                    className="flex size-11 items-center justify-center rounded-full border border-app-border bg-white text-app-text transition hover:border-app-gold hover:bg-app-gold-soft"
                    href={link.href}
                    key={link.label}
                    rel="noreferrer"
                    target="_blank"
                    title={link.label}
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3">
            <div
              className={`overflow-hidden rounded-lg border border-app-border bg-[#f1eee7] shadow-sm ${
                imageOrientations.__hero === 'portrait' ? 'aspect-[3/4] md:mx-auto md:w-[300px]' : 'aspect-[4/3]'
              }`}
            >
              {pricelist.thumbnailUrl ? (
                <img
                  alt={pricelist.title}
                  className={`size-full ${imageOrientations.__hero === 'portrait' ? 'object-contain' : 'object-cover'}`}
                  onLoad={(event) => handleImageLoad('__hero', event)}
                  src={pricelist.thumbnailUrl}
                />
              ) : pricelist.items.find((item) => item.imageUrl)?.imageUrl ? (
                <img
                  alt={pricelist.title}
                  className={`size-full ${imageOrientations.__hero === 'portrait' ? 'object-contain' : 'object-cover'}`}
                  onLoad={(event) => handleImageLoad('__hero', event)}
                  src={pricelist.items.find((item) => item.imageUrl)?.imageUrl ?? ''}
                />
              ) : (
                <div className="flex size-full items-center justify-center px-6 text-center font-serif text-2xl font-semibold text-neutral-400">
                  {pricelist.vendorName}
                </div>
              )}
            </div>
            {pricelist.discountIsActive ? (
              <div className="rounded-md border border-app-gold bg-app-gold-soft px-4 py-3 text-sm font-semibold">
                Diskon {pricelist.discountPercentage}% tersedia
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-6 md:grid-cols-[1fr_340px] md:px-8">
        <section className="grid gap-4">
          {pricelist.items.map((item) => {
            const isSelected = selectedIds.includes(item.id)
            const orientation = imageOrientations[item.id] ?? 'landscape'
            const details = formatPackageDetails(item.description)

            return (
              <article className="overflow-hidden rounded-lg border border-app-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={item.id}>
                <div className={`grid ${orientation === 'portrait' ? 'md:grid-cols-[220px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
                  <button
                    className={`relative bg-[#f1eee7] text-left ${
                      orientation === 'portrait' ? 'aspect-[3/4] md:min-h-[300px]' : 'aspect-[4/3] max-h-[460px]'
                    }`}
                    onClick={() => toggleItem(item.id)}
                    type="button"
                  >
                    {item.imageUrl ? (
                      <img
                        alt={item.packageName}
                        className={`size-full ${orientation === 'portrait' ? 'object-contain' : 'object-cover'}`}
                        onLoad={(event) => handleImageLoad(item.id, event)}
                        src={item.imageUrl}
                      />
                    ) : (
                      <div className="flex size-full min-h-48 items-center justify-center text-sm font-semibold text-neutral-400">
                        {item.categoryName}
                      </div>
                    )}
                  </button>
                  <div className="grid gap-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-app-gold">
                          {item.categoryName}
                        </p>
                        <h2 className="font-serif text-2xl font-semibold leading-tight text-[#201b14]">{item.packageName}</h2>
                        {details.length > 0 ? (
                          <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-600">
                            {details.map((detail) => (
                              <li className="flex gap-2" key={detail}>
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-app-gold" />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <button
                        aria-label={isSelected ? 'Batalkan pilihan paket' : 'Pilih paket'}
                        className={`flex size-11 shrink-0 items-center justify-center rounded-md border transition ${
                          isSelected ? 'border-app-gold bg-app-gold text-app-text' : 'border-app-border bg-white text-neutral-500'
                        }`}
                        onClick={() => toggleItem(item.id)}
                        type="button"
                      >
                        <Check size={18} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-app-border pt-4">
                      <span className="text-sm text-neutral-500">Harga paket</span>
                      <span className="text-lg font-bold text-[#201b14]">{formatCurrency(item.price)}</span>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <aside className="md:sticky md:top-6 md:self-start">
          <div className="rounded-lg border border-app-border bg-white p-5 shadow-sm">
            <p className="font-serif text-xl font-semibold">Paket Dipilih</p>
            {selectedItems.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-neutral-500">Ceklis paket yang diminati untuk melihat total dan membuat pesan WhatsApp otomatis.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {selectedItems.map((item) => (
                  <div className="flex items-start justify-between gap-3 text-sm" key={item.id}>
                    <span>{item.packageName}</span>
                    <span className="font-semibold">{formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-2 border-t border-app-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">Potongan diskon</span>
                <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-app-border pt-3 text-base">
                <span className="font-bold">Total estimasi</span>
                <span className="font-bold">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {hasWhatsApp && selectedItems.length > 0 ? (
              <a href={whatsappUrl} rel="noreferrer" target="_blank">
                <Button className="mt-5 w-full" icon={<MessageCircle size={16} />}>
                  Tanya via WhatsApp
                </Button>
              </a>
            ) : (
              <Button className="mt-5 w-full" disabled icon={<MessageCircle size={16} />} type="button">
                Tanya via WhatsApp
              </Button>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
