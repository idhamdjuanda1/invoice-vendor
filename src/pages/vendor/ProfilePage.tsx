import { ImageIcon, Loader2, Save, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import {
  getBusinessProfile,
  saveBusinessProfile,
  type BusinessProfileInput,
} from '../../services/firestore/businessProfiles'
import { deleteVendorLogoFromR2, uploadVendorLogoToR2 } from '../../services/r2/vendorLogo'

const emptyProfileForm: BusinessProfileInput = {
  vendorName: '',
  whatsappNumber: '',
  address: '',
  businessDescription: '',
  bankAccountNumber: '',
  bankAccountName: '',
  logoUrl: null,
  logoKey: null,
  signatureUrl: null,
}

type SignaturePadProps = {
  value?: string | null
  onChange: (value: string | null) => void
}

function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const [hasSignature, setHasSignature] = useState(Boolean(value))
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 4
    context.strokeStyle = '#111111'

    if (!value) {
      setHasSignature(false)
      return
    }

    const image = new Image()
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      setHasSignature(true)
    }
    image.src = value
  }, [value])

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getCanvasPoint(event)
    isDrawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getCanvasPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
    setHasSignature(true)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    canvasRef.current?.releasePointerCapture(event.pointerId)
    onChange(canvasRef.current?.toDataURL('image/png') ?? null)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onChange(null)
    setUploadError('')
  }

  function handleSignatureUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    if (file.type !== 'image/png') {
      setUploadError('Format tanda tangan harus PNG.')
      event.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Ukuran file tanda tangan maksimal 2MB.')
      event.target.value = ''
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min((canvas.width * 0.82) / image.width, (canvas.height * 0.72) / image.height, 1)
        const width = image.width * scale
        const height = image.height * scale
        const x = (canvas.width - width) / 2
        const y = (canvas.height - height) / 2
        context.drawImage(image, x, y, width, height)
        setHasSignature(true)
        onChange(canvas.toDataURL('image/png'))
      }
      image.src = String(reader.result ?? '')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid gap-3 rounded-md border border-app-border bg-app-muted p-4">
      <div>
        <p className="text-sm font-semibold text-app-text">Tanda Tangan Digital</p>
        <p className="text-xs text-neutral-500">Gambar tanda tangan di kotak ini, lalu simpan profil.</p>
      </div>
      <canvas
        aria-label="Kotak tanda tangan digital"
        className="h-40 w-full touch-none rounded-md border border-app-border bg-white"
        height={260}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
        width={900}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">{hasSignature ? 'Tanda tangan siap disimpan.' : 'Belum ada tanda tangan.'}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-app-border bg-white px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-white/80 sm:min-h-10 sm:py-2">
            <Upload size={16} />
            Upload PNG
            <input accept="image/png" className="sr-only" onChange={handleSignatureUpload} type="file" />
          </label>
          <Button onClick={clearSignature} type="button" variant="secondary">
            Bersihkan
          </Button>
        </div>
      </div>
      {uploadError ? <p className="rounded-md bg-red-50 p-2 text-xs text-app-danger">{uploadError}</p> : null}
    </div>
  )
}

export function ProfilePage() {
  const { profile } = useAuth()
  const [form, setForm] = useState<BusinessProfileInput>(emptyProfileForm)
  const [vendorCode, setVendorCode] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadProfile() {
      if (!profile) return

      setError('')
      setIsLoading(true)

      try {
        const businessProfile = await getBusinessProfile(profile.uid)

        if (businessProfile) {
          setForm({
            vendorName: businessProfile.vendorName,
            whatsappNumber: businessProfile.whatsappNumber,
            address: businessProfile.address,
            businessDescription: businessProfile.businessDescription,
            bankAccountNumber: businessProfile.bankAccountNumber,
            bankAccountName: businessProfile.bankAccountName,
            logoUrl: businessProfile.logoUrl,
            logoKey: businessProfile.logoKey,
            signatureUrl: businessProfile.signatureUrl,
          })
          setLogoPreviewUrl(businessProfile.logoUrl)
          setVendorCode(businessProfile.vendorCode)
        } else {
          setForm({
            ...emptyProfileForm,
          })
          setLogoPreviewUrl(null)
        }
      } catch (loadError) {
        setError(getFriendlyAuthError(loadError))
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [profile])

  function updateField(field: keyof BusinessProfileInput, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setError('')
    setSuccess('')
    setLogoFile(selectedFile)

    if (!selectedFile) {
      setLogoPreviewUrl(form.logoUrl ?? null)
      return
    }

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(selectedFile.type)) {
      setError('Format logo harus PNG, JPG, WEBP, atau SVG.')
      setLogoFile(null)
      event.target.value = ''
      return
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setError('Ukuran logo maksimal 2MB.')
      setLogoFile(null)
      event.target.value = ''
      return
    }

    setLogoPreviewUrl(URL.createObjectURL(selectedFile))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!profile) return

    if (!form.vendorName.trim()) {
      setError('Nama usaha wajib diisi.')
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      let logoUrl = form.logoUrl ?? null
      let logoKey = form.logoKey ?? null
      let logoUploadError = ''

      if (logoFile) {
        try {
          const uploadedLogo = await uploadVendorLogoToR2(profile.uid, logoFile, form.logoKey)
          logoUrl = uploadedLogo.logoUrl
          logoKey = uploadedLogo.logoKey
        } catch (uploadError) {
          if (import.meta.env.DEV) {
            console.error('Vendor logo upload failed.', uploadError)
          }

          logoUploadError = getFriendlyAuthError(uploadError)
        }
      }

      const savedProfile = await saveBusinessProfile(profile.uid, {
        ...form,
        logoUrl,
        logoKey,
      })
      setVendorCode(savedProfile?.vendorCode ?? '')
      setForm({
        vendorName: savedProfile?.vendorName ?? form.vendorName,
        whatsappNumber: savedProfile?.whatsappNumber ?? form.whatsappNumber,
        address: savedProfile?.address ?? form.address,
        businessDescription: savedProfile?.businessDescription ?? form.businessDescription,
        bankAccountNumber: savedProfile?.bankAccountNumber ?? form.bankAccountNumber,
        bankAccountName: savedProfile?.bankAccountName ?? form.bankAccountName,
        logoUrl: savedProfile?.logoUrl ?? logoUrl,
        logoKey: savedProfile?.logoKey ?? logoKey,
        signatureUrl: savedProfile?.signatureUrl ?? form.signatureUrl ?? null,
      })
      setLogoFile(logoUploadError ? logoFile : null)
      setLogoPreviewUrl(savedProfile?.logoUrl ?? logoUrl)
      setSuccess(
        logoUploadError
          ? `Profil usaha berhasil disimpan, tetapi logo belum tersimpan: ${logoUploadError}`
          : 'Profil usaha berhasil disimpan.',
      )
    } catch (saveError) {
      if (import.meta.env.DEV) {
        console.error('Vendor profile save failed.', saveError)
      }

      setError(getFriendlyAuthError(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveLogo() {
    if (!profile) return

    if (!form.vendorName.trim()) {
      setError('Nama usaha wajib diisi.')
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setIsRemovingLogo(true)

    try {
      if (form.logoKey) {
        await deleteVendorLogoFromR2(profile.uid, form.logoKey)
      }

      const savedProfile = await saveBusinessProfile(profile.uid, {
        ...form,
        logoUrl: null,
        logoKey: null,
      })

      setForm({
        vendorName: savedProfile?.vendorName ?? form.vendorName,
        whatsappNumber: savedProfile?.whatsappNumber ?? form.whatsappNumber,
        address: savedProfile?.address ?? form.address,
        businessDescription: savedProfile?.businessDescription ?? form.businessDescription,
        bankAccountNumber: savedProfile?.bankAccountNumber ?? form.bankAccountNumber,
        bankAccountName: savedProfile?.bankAccountName ?? form.bankAccountName,
        logoUrl: null,
        logoKey: null,
        signatureUrl: savedProfile?.signatureUrl ?? form.signatureUrl ?? null,
      })
      setLogoFile(null)
      setLogoPreviewUrl(null)
      setSuccess('Logo vendor berhasil dihapus.')
    } catch (removeError) {
      if (import.meta.env.DEV) {
        console.error('Vendor logo removal failed.', removeError)
      }

      setError(getFriendlyAuthError(removeError))
    } finally {
      setIsRemovingLogo(false)
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Profil Usaha"
        description="Kelola identitas usaha, kontak, deskripsi usaha, dan rekening pembayaran."
      />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">Data Usaha</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Data ini akan dipakai untuk invoice online, PDF invoice, dan kuitansi.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-neutral-500">Memuat profil usaha...</p>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 rounded-md border border-app-border bg-app-muted p-4 sm:grid-cols-[96px_1fr] sm:items-center">
                <div className="flex size-24 items-center justify-center overflow-hidden rounded-md border border-app-border bg-white">
                  {logoPreviewUrl ? (
                    <img alt="Logo vendor" className="size-full object-contain" src={logoPreviewUrl} />
                  ) : (
                    <ImageIcon className="text-neutral-400" size={32} />
                  )}
                </div>
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold text-app-text">Logo Vendor</p>
                    <p className="text-xs text-neutral-500">PNG, JPG, WEBP, atau SVG. Maksimal 2MB.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-app-border bg-white px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-white/80 sm:min-h-10 sm:py-2">
                      Pilih logo
                      <input
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="sr-only"
                        onChange={handleLogoChange}
                        type="file"
                      />
                    </label>
                    {form.logoUrl || logoFile ? (
                      <Button
                        disabled={isRemovingLogo}
                        icon={isRemovingLogo ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                        onClick={handleRemoveLogo}
                        type="button"
                        variant="secondary"
                      >
                        {isRemovingLogo ? 'Menghapus...' : 'Hapus logo'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <SignaturePad
                value={form.signatureUrl}
                onChange={(signatureUrl) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    signatureUrl,
                  }))
                }
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id="vendorName"
                  label="Nama Usaha"
                  onChange={(event) => updateField('vendorName', event.target.value)}
                  placeholder="IDM Project"
                  required
                  value={form.vendorName}
                />
                <Input
                  id="whatsappNumber"
                  label="Nomor WhatsApp"
                  onChange={(event) => updateField('whatsappNumber', event.target.value)}
                  placeholder="081234567890"
                  value={form.whatsappNumber}
                />
                <Input
                  id="bankAccountNumber"
                  label="Nomor Rekening Usaha"
                  onChange={(event) => updateField('bankAccountNumber', event.target.value)}
                  placeholder="Nomor rekening/e-wallet"
                  value={form.bankAccountNumber}
                />
                <Input
                  id="bankAccountName"
                  label="Atas Nama Rekening"
                  onChange={(event) => updateField('bankAccountName', event.target.value)}
                  placeholder="Nama pemilik rekening"
                  value={form.bankAccountName}
                />
              </div>
              <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor="address">
                Alamat
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                  id="address"
                  onChange={(event) => updateField('address', event.target.value)}
                  placeholder="Alamat usaha"
                  value={form.address}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor="businessDescription">
                Deskripsi Usaha
                <textarea
                  className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                  id="businessDescription"
                  onChange={(event) => updateField('businessDescription', event.target.value)}
                  placeholder="Ceritakan singkat tentang usaha Anda."
                  value={form.businessDescription}
                />
              </label>
              {vendorCode ? (
                <p className="rounded-md bg-app-muted p-3 text-sm text-neutral-600">
                  Kode vendor saat ini: <span className="font-semibold text-app-text">{vendorCode}</span>
                </p>
              ) : null}
              {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger">{error}</p> : null}
              {success ? <p className="rounded-md bg-green-50 p-3 text-sm text-app-success">{success}</p> : null}
              <div className="flex justify-end">
                <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}>
                  {isSaving ? 'Menyimpan...' : 'Simpan profil'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
