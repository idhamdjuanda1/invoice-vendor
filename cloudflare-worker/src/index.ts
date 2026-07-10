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

async function getPublishedPricelist(env: Env, slug: string) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'pricelists' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'slug' }, op: 'EQUAL', value: { stringValue: slug } } },
                { fieldFilter: { field: { fieldPath: 'isPublished' }, op: 'EQUAL', value: { booleanValue: true } } },
              ],
            },
          },
          limit: 1,
        },
      }),
    },
  )

  if (!response.ok) return null

  const data = await response.json<FirestoreRunQueryItem[]>()
  const fields = data.find((item) => item.document)?.document?.fields
  if (!fields) return null

  return {
    title: fields.title?.stringValue ?? 'Pricelist Invoice Vendor',
    vendorName: fields.vendorName?.stringValue ?? 'Invoice Vendor',
    tagline: fields.tagline?.stringValue ?? '',
    thumbnailUrl: fields.thumbnailUrl?.stringValue
      ?? fields.items?.arrayValue?.values?.find((item) => item.mapValue?.fields?.imageUrl?.stringValue)?.mapValue?.fields?.imageUrl?.stringValue
      ?? '',
  }
}

async function getPricelistShareHtml(request: Request, env: Env, slug: string) {
  const pricelist = await getPublishedPricelist(env, slug)
  const targetUrl = `https://invoice-vendor.web.app/pricelist/${encodeURIComponent(slug)}`
  const title = pricelist ? `${pricelist.title} - ${pricelist.vendorName}` : 'Pricelist Invoice Vendor'
  const description = pricelist?.tagline || 'Pricelist paket vendor event Indonesia.'
  const imageMeta = pricelist?.thumbnailUrl
    ? `<meta property="og:image" content="${escapeHtml(pricelist.thumbnailUrl)}">
<meta name="twitter:image" content="${escapeHtml(pricelist.thumbnailUrl)}">`
    : ''

  return htmlResponse(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(request.url)}">
  ${imageMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(targetUrl)})</script>
  <a href="${escapeHtml(targetUrl)}">Buka pricelist</a>
</body>
</html>`, pricelist ? 200 : 404, getCorsHeaders(request, env))
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
        const shareMatch = objectKey.match(/^share\/pricelist\/([^/]+)$/)
        if (shareMatch?.[1]) {
          return getPricelistShareHtml(request, env, decodeURIComponent(shareMatch[1]))
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
