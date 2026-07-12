import { sendTokenExpiryReminders, type TokenReminderEnv } from './tokenReminders'

type Env = TokenReminderEnv & {
  INVOICE_FILES: R2Bucket
  FIREBASE_API_KEY: string
  ALLOWED_ORIGINS: string
}

type VendorLogoBody = {
  vendorId?: unknown
  fileName?: unknown
  contentType?: unknown
  base64?: unknown
  assetType?: unknown
  previousAssetKey?: unknown
  previousLogoKey?: unknown
  logoKey?: unknown
}

type FirestoreValue = {
  stringValue?: string
  booleanValue?: boolean
  arrayValue?: {
    values?: FirestoreValue[]
  }
  mapValue?: {
    fields?: Record<string, FirestoreValue>
  }
}

type FirestoreRunQueryItem = {
  document?: {
    fields?: Record<string, FirestoreValue>
  }
}

const maxLogoSizeBytes = 2 * 1024 * 1024
const maxPricelistImageSizeBytes = 8 * 1024 * 1024
const appOrigin = 'https://invoice-vendor.web.app'
const defaultShareImage = `${appOrigin}/og-invoice-vendor.svg`

function jsonResponse(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  })
}

function htmlResponse(body: string, status: number, headers: HeadersInit) {
  return new Response(body, {
    status,
    headers: {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

function getCorsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin') ?? ''
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '*'

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  }
}

async function verifyFirebaseToken(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED')

  const token = authorization.slice(7)
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken: token }),
  })

  if (!response.ok) throw new Error('AUTH_REQUIRED')

  const data = await response.json<{ users?: Array<{ localId?: string }> }>()
  const uid = data.users?.[0]?.localId
  if (!uid) throw new Error('AUTH_REQUIRED')

  return uid
}

function getExtension(fileName: string, contentType: string) {
  const extensionFromName = fileName.split('.').pop()?.toLowerCase()
  if (extensionFromName && ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extensionFromName)) {
    return extensionFromName
  }

  const extensionByType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }

  return extensionByType[contentType] ?? 'png'
}

function assertAsset(contentType: string, size: number, assetPrefix: string) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(contentType)) {
    throw new Error('INVALID_LOGO_TYPE')
  }

  const maxSize = assetPrefix === 'pricelist-images' ? maxPricelistImageSizeBytes : maxLogoSizeBytes
  if (size <= 0 || size > maxSize) {
    if (assetPrefix === 'pricelist-images') throw new Error('INVALID_PRICELIST_IMAGE_SIZE')
    throw new Error('INVALID_LOGO_SIZE')
  }
}

function getAssetPrefix(assetType: unknown) {
  return assetType === 'pricelist-image' ? 'pricelist-images' : 'vendor-logo'
}

function isPublicAssetKey(key: string) {
  return key.startsWith('vendor-logo/') || key.startsWith('pricelist-images/')
}

function getPublicUrl(request: Request, key: string) {
  const url = new URL(request.url)
  return `${url.origin}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getString(fields: Record<string, FirestoreValue> | null | undefined, field: string) {
  return fields?.[field]?.stringValue ?? ''
}

function getBoolean(fields: Record<string, FirestoreValue> | null | undefined, field: string) {
  return fields?.[field]?.booleanValue === true
}

async function runFirestoreQuery(env: Env, collectionId: string, filters: Array<{ field: string; value: string | boolean }>) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: filters.map((filter) => ({
                fieldFilter: {
                  field: { fieldPath: filter.field },
                  op: 'EQUAL',
                  value: typeof filter.value === 'boolean'
                    ? { booleanValue: filter.value }
                    : { stringValue: filter.value },
                },
              })),
            },
          },
          limit: 1,
        },
      }),
    },
  )

  if (!response.ok) return null
  const data = await response.json<FirestoreRunQueryItem[]>()
  return data.find((item) => item.document)?.document?.fields ?? null
}

async function getDocumentFields(env: Env, collectionId: string, documentId: string) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionId}/${encodeURIComponent(documentId)}?key=${env.FIREBASE_API_KEY}`,
  )
  if (!response.ok) return null
  const data = await response.json<{ fields?: Record<string, FirestoreValue> }>()
  return data.fields ?? null
}

function getFirstPricelistImage(fields: Record<string, FirestoreValue> | undefined) {
  return fields?.items?.arrayValue?.values?.find((item) => item.mapValue?.fields?.imageUrl?.stringValue)?.mapValue?.fields?.imageUrl?.stringValue ?? ''
}

async function getPublishedPricelist(env: Env, slug: string) {
  const fields = await runFirestoreQuery(env, 'pricelists', [
    { field: 'slug', value: slug },
    { field: 'isPublished', value: true },
  ])
  if (!fields) return null

  const userId = getString(fields, 'userId')
  const publicProfile = userId ? await getDocumentFields(env, 'publicVendorProfiles', userId) : null

  return {
    title: getString(fields, 'title') || 'Pricelist Invoice Vendor',
    vendorName: getString(publicProfile ?? fields, 'vendorName') || 'Invoice Vendor',
    tagline: getString(fields, 'tagline'),
    thumbnailUrl: getString(fields, 'thumbnailUrl') || getFirstPricelistImage(fields) || getString(publicProfile, 'logoUrl') || defaultShareImage,
  }
}

function getShareHtml(request: Request, env: Env, targetUrl: string, meta: { title: string; description: string; imageUrl?: string }, status = 200) {
  const imageUrl = meta.imageUrl || defaultShareImage
  return htmlResponse(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Invoice Vendor">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:url" content="${escapeHtml(request.url)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(targetUrl)})</script>
  <a href="${escapeHtml(targetUrl)}">Buka Invoice Vendor</a>
</body>
</html>`, status, getCorsHeaders(request, env))
}

async function getPricelistShareHtml(request: Request, env: Env, slug: string) {
  const pricelist = await getPublishedPricelist(env, slug)
  const targetUrl = `${appOrigin}/pricelist/${encodeURIComponent(slug)}`

  return getShareHtml(request, env, targetUrl, {
    title: pricelist ? `${pricelist.title} - ${pricelist.vendorName}` : 'Pricelist Invoice Vendor',
    description: pricelist?.tagline || 'Pricelist paket vendor wedding & event Indonesia.',
    imageUrl: pricelist?.thumbnailUrl,
  }, pricelist ? 200 : 404)
}

async function getClientFormShareHtml(request: Request, env: Env, slug: string) {
  const eventFields = await runFirestoreQuery(env, 'invoiceEvents', [
    { field: 'publicFormSlug', value: slug },
    { field: 'publicFormEnabled', value: true },
  ])
  const invoiceId = getString(eventFields, 'invoiceId')
  const invoiceFields = invoiceId ? await getDocumentFields(env, 'invoices', invoiceId) : null
  const userId = getString(eventFields, 'userId') || getString(invoiceFields, 'userId')
  const publicProfile = userId ? await getDocumentFields(env, 'publicVendorProfiles', userId) : null
  const clientName = getString(invoiceFields, 'clientName')
  const vendorName = getString(publicProfile, 'vendorName') || 'Invoice Vendor'
  const eventType = getString(eventFields, 'eventType') || getString(invoiceFields, 'eventType') || 'Acara'
  const targetUrl = `${appOrigin}/form/${encodeURIComponent(slug)}`

  return getShareHtml(request, env, targetUrl, {
    title: clientName ? `Form Detail Acara - ${clientName}` : 'Form Detail Acara Klien',
    description: `Lengkapi data acara ${eventType.toLowerCase()} untuk ${vendorName}. Data ini tidak mengubah invoice atau pembayaran.`,
    imageUrl: getString(publicProfile, 'logoUrl') || defaultShareImage,
  }, eventFields && getBoolean(invoiceFields, 'publicFormEnabled') ? 200 : 404)
}

function getHomeShareHtml(request: Request, env: Env) {
  return getShareHtml(request, env, appOrigin, {
    title: 'Invoice Vendor',
    description: 'Kelola invoice, klien, jadwal tim, editor, pricelist publish, dan accounting untuk vendor wedding & event.',
    imageUrl: defaultShareImage,
  })
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'Login diperlukan untuk mengelola file vendor.',
    INVALID_VENDOR: 'Vendor tidak valid.',
    INVALID_LOGO_TYPE: 'Format logo harus PNG, JPG, WEBP, atau SVG.',
    INVALID_LOGO_SIZE: 'Ukuran logo maksimal 2MB.',
    INVALID_PRICELIST_IMAGE_SIZE: 'Ukuran foto pricelist maksimal 8MB.',
  }

  return messages[message] ?? 'File vendor belum bisa diproses.'
}

export default {
  async fetch(request: Request, env: Env) {
    const corsHeaders = getCorsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

    try {
      if (request.method === 'GET') {
        const url = new URL(request.url)
        const objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        const pricelistShareMatch = objectKey.match(/^share\/pricelist\/([^/]+)$/)
        if (pricelistShareMatch?.[1]) {
          return getPricelistShareHtml(request, env, decodeURIComponent(pricelistShareMatch[1]))
        }

        const formShareMatch = objectKey.match(/^share\/form\/([^/]+)$/)
        if (formShareMatch?.[1]) {
          return getClientFormShareHtml(request, env, decodeURIComponent(formShareMatch[1]))
        }

        if (objectKey === 'share' || objectKey === 'share/home') {
          return getHomeShareHtml(request, env)
        }

        if (!isPublicAssetKey(objectKey)) {
          return jsonResponse({ message: 'File tidak ditemukan.' }, 404, corsHeaders)
        }

        const object = await env.INVOICE_FILES.get(objectKey)
        if (!object) {
          return jsonResponse({ message: 'File tidak ditemukan.' }, 404, corsHeaders)
        }

        return new Response(object.body, {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
          },
        })
      }

      const uid = await verifyFirebaseToken(request, env)
      const body = await request.json<VendorLogoBody>().catch((): VendorLogoBody => ({}))
      const vendorId = typeof body.vendorId === 'string' ? body.vendorId : ''
      if (!vendorId || vendorId !== uid) throw new Error('INVALID_VENDOR')

      if (request.method === 'POST') {
        if (
          typeof body.fileName !== 'string' ||
          typeof body.contentType !== 'string' ||
          typeof body.base64 !== 'string'
        ) {
          throw new Error('INVALID_LOGO_SIZE')
        }

        const extension = getExtension(body.fileName, body.contentType)
        const assetPrefix = getAssetPrefix(body.assetType)
        const bytes = Uint8Array.from(atob(body.base64), (char) => char.charCodeAt(0))
        assertAsset(body.contentType, bytes.byteLength, assetPrefix)

        const logoKey = `${assetPrefix}/${vendorId}-${Date.now()}.${extension}`
        await env.INVOICE_FILES.put(logoKey, bytes, {
          httpMetadata: {
            contentType: body.contentType,
          },
          customMetadata: {
            vendorId,
          },
        })

        const previousKey = typeof body.previousAssetKey === 'string' && body.previousAssetKey
          ? body.previousAssetKey
          : typeof body.previousLogoKey === 'string' ? body.previousLogoKey : ''

        if (previousKey) {
          await env.INVOICE_FILES.delete(previousKey).catch((error) => {
            console.error('Previous vendor file could not be deleted from R2', error)
          })
        }

        return jsonResponse({ logoUrl: getPublicUrl(request, logoKey), logoKey }, 200, corsHeaders)
      }

      if (request.method === 'DELETE') {
        if (typeof body.logoKey === 'string' && body.logoKey) {
          await env.INVOICE_FILES.delete(body.logoKey)
        }

        return jsonResponse({ ok: true }, 200, corsHeaders)
      }

      return jsonResponse({ message: 'Method not allowed.' }, 405, corsHeaders)
    } catch (error) {
      console.error('Vendor file R2 worker failed', error)
      return jsonResponse({ message: getErrorMessage(error) }, 400, corsHeaders)
    }
  },
  scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(sendTokenExpiryReminders(env))
  },
}
