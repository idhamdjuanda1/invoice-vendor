import { firebaseAuth } from '../../lib/firebase/client'
import { env } from '../../config/env'

export type VendorLogoUploadResult = {
  logoUrl: string
  logoKey: string
}

type VendorAssetType = 'vendor-logo' | 'pricelist-image'

export type VendorAssetUploadResult = {
  assetUrl: string
  assetKey: string
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('LOGO_READ_FAILED'))
    reader.readAsDataURL(file)
  })
}

async function getAuthHeaders() {
  const token = await firebaseAuth.currentUser?.getIdToken()
  if (!token) throw new Error('AUTH_REQUIRED')

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function parseApiResponse<T>(response: Response) {
  const data = await response.json().catch(() => null) as { message?: string } | T | null
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data ? data.message : ''
    throw new Error(message || 'R2_REQUEST_FAILED')
  }

  return data as T
}

async function uploadVendorAssetToR2(
  vendorId: string,
  file: File,
  assetType: VendorAssetType,
  previousAssetKey?: string | null,
) {
  if (!env.r2LogoApiUrl) throw new Error('R2_LOGO_API_URL_MISSING')

  const response = await fetch(env.r2LogoApiUrl, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      vendorId,
      fileName: file.name,
      contentType: file.type || 'image/png',
      base64: await fileToBase64(file),
      assetType,
      previousAssetKey: previousAssetKey ?? null,
    }),
  })

  const result = await parseApiResponse<VendorLogoUploadResult>(response)
  return {
    assetUrl: result.logoUrl,
    assetKey: result.logoKey,
  }
}

export async function uploadVendorLogoToR2(vendorId: string, file: File, previousLogoKey?: string | null) {
  const result = await uploadVendorAssetToR2(vendorId, file, 'vendor-logo', previousLogoKey)
  return {
    logoUrl: result.assetUrl,
    logoKey: result.assetKey,
  }
}

export async function uploadPricelistImageToR2(vendorId: string, file: File) {
  return uploadVendorAssetToR2(vendorId, file, 'pricelist-image')
}

export async function deleteVendorLogoFromR2(vendorId: string, logoKey: string) {
  if (!env.r2LogoApiUrl) throw new Error('R2_LOGO_API_URL_MISSING')

  const response = await fetch(env.r2LogoApiUrl, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      vendorId,
      logoKey,
    }),
  })

  return parseApiResponse<{ ok: boolean }>(response)
}
