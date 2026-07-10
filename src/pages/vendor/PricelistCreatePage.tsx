import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ImagePlus, Loader2, Save, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { formatCurrency } from '../../lib/formatters/currency'
import { createPricelist, getPricelist, updatePricelist } from '../../services/firestore/pricelists'
import { listServicePackages } from '../../services/firestore/packages'
import { uploadPricelistImageToR2 } from '../../services/r2/vendorLogo'
import type { ServicePackage } from '../../types/domain'

type ImageState = {
  file: File | null
  previewUrl: string
  imageUrl: string | null
  imageKey: string | null
}

const emptyImages: Record<string, ImageState> = {}
const maxSourceImageSize = 25 * 1024 * 1024
const maxUploadedImageSize = 1.8 * 1024 * 1024
const maxImageDimension = 1800

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('PRICELIST_IMAGE_READ_FAILED'))
    }
    image.src = objectUrl
  })
}

async function resizePricelistImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PRICELIST_IMAGE_TYPE_INVALID')
  }
  if (file.size > maxSourceImageSize) {
    throw new Error('PRICELIST_IMAGE_TOO_LARGE')
  }

  const image = await loadImage(file)
  const scale = Math.min(maxImageDimension / image.width, maxImageDimension / image.height, 1)
  const width = Math.max(Math.round(image.width * scale), 1)
  const height = Math.max(Math.round(image.height * scale), 1)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('PRICELIST_IMAGE_READ_FAILED')

  canvas.width = width
  canvas.height = height
  context.drawImage(image, 0, 0, width, height)

  for (const quality of [0.86, 0.78, 0.7, 0.62]) {
    const blob = await canvasToBlob(canvas, 'image/webp', quality)
    if (blob && (blob.size <= maxUploadedImageSize || quality === 0.62)) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'pricelist-photo'}.webp`, {
        type: 'image/webp',
      })
    }
  }

  throw new Error('PRICELIST_IMAGE_READ_FAILED')
}

export function PricelistCreatePage() {
  const { profile } = useAuth()
  const { pricelistId } = useParams()
  const navigate = useNavigate()
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([])
  const [images, setImages] = useState(emptyImages)
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [discountIsActive, setDiscountIsActive] = useState(false)
  const [discountTitle, setDiscountTitle] = useState('Diskon spesial')
  const [discountDescription, setDiscountDescription] = useState('Diskon 10% untuk deal di bulan ini.')
  const [discountPercentage, setDiscountPercentage] = useState(10)
  const [thumbnailPackageId, setThumbnailPackageId] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [compressingPackageId, setCompressingPackageId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedPackages = useMemo(
    () => packages.filter((servicePackage) => selectedPackageIds.includes(servicePackage.id)),
    [packages, selectedPackageIds],
  )

  const totalSelected = selectedPackages.reduce((sum, servicePackage) => sum + servicePackage.price, 0)

  const loadPackages = useCallback(async () => {
    if (!profile?.uid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const packageList = (await listServicePackages(profile.uid)).filter((servicePackage) => servicePackage.isActive)
      setPackages(packageList)

      if (pricelistId) {
        const pricelist = await getPricelist(profile.uid, pricelistId)
        if (!pricelist) throw new Error('PRICELIST_NOT_FOUND')

        setTitle(pricelist.title)
        setTagline(pricelist.tagline ?? '')
        setDiscountIsActive(pricelist.discountIsActive)
        setDiscountTitle(pricelist.discountTitle ?? 'Diskon spesial')
        setDiscountDescription(pricelist.discountDescription ?? 'Diskon 10% untuk deal di bulan ini.')
        setDiscountPercentage(pricelist.discountPercentage)
        setInstagramUrl(pricelist.instagramUrl ?? '')
        setTiktokUrl(pricelist.tiktokUrl ?? '')
        setWhatsappUrl(pricelist.whatsappUrl ?? '')
        setSelectedPackageIds(pricelist.items.map((item) => item.packageId))
        setThumbnailPackageId(pricelist.items.find((item) => item.imageKey === pricelist.thumbnailKey)?.packageId ?? pricelist.items.find((item) => item.imageUrl)?.packageId ?? '')
        setImages(
          pricelist.items.reduce<Record<string, ImageState>>((accumulator, item) => {
            if (item.imageUrl) {
              accumulator[item.packageId] = {
                file: null,
                previewUrl: item.imageUrl,
                imageUrl: item.imageUrl,
                imageKey: item.imageKey,
              }
            }
            return accumulator
          }, {}),
        )
      }
    } catch (error) {
      console.error('Failed to load packages for pricelist', error)
      setErrorMessage(pricelistId ? 'Pricelist belum bisa dimuat.' : 'Paket belum bisa dimuat.')
    } finally {
      setIsLoading(false)
    }
  }, [pricelistId, profile?.uid])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  useEffect(() => {
    return () => {
      Object.values(images).forEach((image) => {
        if (image.file) URL.revokeObjectURL(image.previewUrl)
      })
    }
  }, [images])

  function togglePackage(packageId: string) {
    setSelectedPackageIds((current) => {
      if (current.includes(packageId)) return current.filter((id) => id !== packageId)
      return [...current, packageId]
    })
  }

  async function handleImageChange(packageId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setErrorMessage('')
    setCompressingPackageId(packageId)

    try {
      const resizedFile = await resizePricelistImage(file)

      setImages((current) => {
        const existing = current[packageId]
        if (existing) URL.revokeObjectURL(existing.previewUrl)

        return {
          ...current,
          [packageId]: {
            file: resizedFile,
            previewUrl: URL.createObjectURL(resizedFile),
            imageUrl: null,
            imageKey: null,
          },
        }
      })
    } catch (error) {
      console.error('Failed to resize pricelist image', error)
      const message = error instanceof Error && error.message === 'PRICELIST_IMAGE_TYPE_INVALID'
        ? 'Format foto paket harus PNG, JPG, atau WEBP.'
        : error instanceof Error && error.message === 'PRICELIST_IMAGE_TOO_LARGE'
          ? 'Foto terlalu besar. Maksimal file asli 25MB.'
          : 'Foto paket belum bisa diproses. Coba gunakan foto lain.'
      setErrorMessage(message)
      event.target.value = ''
    } finally {
      setCompressingPackageId('')
    }
  }

  function removeImage(packageId: string) {
    setImages((current) => {
      const existing = current[packageId]
      if (existing?.file) URL.revokeObjectURL(existing.previewUrl)

      const next = { ...current }
      delete next[packageId]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile?.uid) return

    setIsSaving(true)
    setErrorMessage('')

    try {
      const packageImages: Record<string, { imageUrl: string | null; imageKey: string | null }> = {}

      for (const servicePackage of selectedPackages) {
        const image = images[servicePackage.id]
        if (!image) {
          packageImages[servicePackage.id] = { imageUrl: null, imageKey: null }
          continue
        }

        if (image.file) {
          const uploadResult = await uploadPricelistImageToR2(profile.uid, image.file)
          packageImages[servicePackage.id] = {
            imageUrl: uploadResult.assetUrl,
            imageKey: uploadResult.assetKey,
          }
        } else {
          packageImages[servicePackage.id] = {
            imageUrl: image.imageUrl,
            imageKey: image.imageKey,
          }
        }
      }

      const payload = {
        title,
        tagline,
        packageIds: selectedPackageIds,
        packageImages,
        thumbnailPackageId,
        instagramUrl,
        tiktokUrl,
        whatsappUrl,
        discountTitle,
        discountDescription,
        discountPercentage,
        discountIsActive,
      }

      if (pricelistId) {
        await updatePricelist(profile.uid, pricelistId, payload)
      } else {
        await createPricelist(profile.uid, payload)
      }

      navigate('/pricelists')
    } catch (error) {
      console.error('Failed to create pricelist', error)
      const message = error instanceof Error && error.message === 'PRICELIST_TITLE_REQUIRED'
        ? 'Nama pricelist wajib diisi.'
        : error instanceof Error && error.message === 'PRICELIST_PACKAGES_REQUIRED'
          ? 'Pilih minimal satu paket.'
          : getFriendlyAuthError(error)
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <PageHeader
        title={pricelistId ? 'Edit Pricelist' : 'Buat Pricelist'}
        description="Pilih paket, tambahkan foto, pilih thumbnail, isi tagline, lalu publish sebagai halaman yang bisa dibuka tanpa login."
        actions={
          <Link to="/pricelists">
            <Button type="button" variant="secondary">
              Kembali
            </Button>
          </Link>
        }
      />

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-app-text">Informasi Pricelist</h2>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input
            id="pricelist-title"
            label="Nama Pricelist"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Wedding Photography"
            value={title}
          />
          <Input
            id="pricelist-tagline"
            label="Tagline"
            onChange={(event) => setTagline(event.target.value)}
            placeholder="Create the moment with us"
            value={tagline}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              id="instagram-url"
              label="Link Instagram"
              onChange={(event) => setInstagramUrl(event.target.value)}
              placeholder="https://instagram.com/namaakun"
              type="url"
              value={instagramUrl}
            />
            <Input
              id="tiktok-url"
              label="Link TikTok"
              onChange={(event) => setTiktokUrl(event.target.value)}
              placeholder="https://tiktok.com/@namaakun"
              type="url"
              value={tiktokUrl}
            />
            <Input
              id="whatsapp-url"
              label="Link WhatsApp"
              onChange={(event) => setWhatsappUrl(event.target.value)}
              placeholder="https://wa.me/628..."
              type="url"
              value={whatsappUrl}
            />
          </div>
          <label className="flex items-start gap-3 rounded-md border border-app-border bg-app-muted p-4 text-sm text-app-text">
            <input
              checked={discountIsActive}
              className="mt-1 size-4 accent-app-gold"
              onChange={(event) => setDiscountIsActive(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold">Menggunakan Diskon</span>
              <span className="mt-1 block text-neutral-500">Diskon tampil di halaman publish dan dapat dipilih saat membuat invoice.</span>
            </span>
          </label>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_140px]">
            <Input
              disabled={!discountIsActive}
              id="discount-title"
              label="Judul Diskon"
              onChange={(event) => setDiscountTitle(event.target.value)}
              value={discountTitle}
            />
            <Input
              disabled={!discountIsActive}
              id="discount-description"
              label="Deskripsi Diskon"
              onChange={(event) => setDiscountDescription(event.target.value)}
              value={discountDescription}
            />
            <Input
              disabled={!discountIsActive}
              id="discount-percentage"
              label="Diskon (%)"
              max={100}
              min={0}
              onChange={(event) => setDiscountPercentage(Number(event.target.value))}
              type="number"
              value={discountPercentage}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-app-text">Paket yang Ditampilkan</h2>
            <p className="text-sm text-neutral-500">{selectedPackages.length} paket dipilih - {formatCurrency(totalSelected)}</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat paket...
            </div>
          ) : packages.length === 0 ? (
            <p className="text-sm text-neutral-500">Belum ada paket aktif. Tambahkan paket dulu dari menu Paket.</p>
          ) : (
            packages.map((servicePackage) => {
              const isSelected = selectedPackageIds.includes(servicePackage.id)
              const image = images[servicePackage.id]

              return (
                <div className="rounded-md border border-app-border p-4" key={servicePackage.id}>
                  <label className="flex items-start gap-3">
                    <input
                      checked={isSelected}
                      className="mt-1 size-4 accent-app-gold"
                      onChange={() => togglePackage(servicePackage.id)}
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-app-text">{servicePackage.name}</span>
                      <span className="mt-1 block text-xs uppercase tracking-wide text-app-gold">{servicePackage.categoryName}</span>
                      <span className="mt-2 block text-sm font-semibold">{formatCurrency(servicePackage.price)}</span>
                      {servicePackage.description ? (
                        <span className="mt-1 block text-sm text-neutral-500">{servicePackage.description}</span>
                      ) : null}
                    </span>
                  </label>

                  {isSelected ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-dashed border-app-border bg-app-muted">
                        {image ? (
                          <img alt={`Foto ${servicePackage.name}`} className="size-full object-cover" src={image.previewUrl} />
                        ) : (
                          <ImagePlus className="text-neutral-400" size={28} />
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Input
                          accept="image/png,image/jpeg,image/webp"
                          disabled={compressingPackageId === servicePackage.id}
                          id={`image-${servicePackage.id}`}
                          label={compressingPackageId === servicePackage.id ? 'Memproses Foto...' : 'Foto Paket'}
                          onChange={(event) => void handleImageChange(servicePackage.id, event)}
                          type="file"
                        />
                        {image ? (
                          <Button icon={<X size={15} />} onClick={() => removeImage(servicePackage.id)} type="button" variant="secondary">
                            Hapus Foto
                          </Button>
                        ) : null}
                        {image ? (
                          <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-sm font-semibold text-app-text">
                            <input
                              checked={thumbnailPackageId === servicePackage.id}
                              className="size-4 accent-app-gold"
                              onChange={() => setThumbnailPackageId(servicePackage.id)}
                              type="radio"
                            />
                            Jadikan thumbnail share
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button disabled={isSaving || isLoading || Boolean(compressingPackageId)} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}>
          {pricelistId ? 'Simpan Pricelist' : 'Publish Pricelist'}
        </Button>
      </div>
    </form>
  )
}
