export type TokenReminderEnv = {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL?: string
  FIREBASE_PRIVATE_KEY?: string
  WHATSAPP_ACCESS_TOKEN?: string
  WHATSAPP_PHONE_NUMBER_ID?: string
  WHATSAPP_TOKEN_REMINDER_TEMPLATE?: string
  WHATSAPP_TEMPLATE_LANGUAGE?: string
  WHATSAPP_GRAPH_API_VERSION?: string
}

type FirestoreValue = {
  stringValue?: string
  booleanValue?: boolean
  timestampValue?: string
  nullValue?: string
}

type FirestoreDocument = {
  name: string
  fields?: Record<string, FirestoreValue>
}

type FirestoreListResponse = {
  documents?: FirestoreDocument[]
  nextPageToken?: string
}

const reminderDays = new Set([7, 3, 1])
const dayInMs = 24 * 60 * 60 * 1000

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

async function createGoogleAccessToken(env: TokenReminderEnv) {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_MISSING')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = stringToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = stringToBase64Url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore',
    iat: now,
    exp: now + 3600,
  }))
  const unsignedToken = `${header}.${claims}`
  const pem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  const der = Uint8Array.from(
    atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')),
    (character) => character.charCodeAt(0),
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken),
  )
  const assertion = `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_AUTH_FAILED_${response.status}`)
  }

  const payload = await response.json<{ access_token?: string }>()
  if (!payload.access_token) throw new Error('FIREBASE_SERVICE_ACCOUNT_AUTH_FAILED')
  return payload.access_token
}

function firestoreBaseUrl(env: TokenReminderEnv) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`
}

async function listUserDocuments(env: TokenReminderEnv, accessToken: string) {
  const documents: FirestoreDocument[] = []
  let nextPageToken = ''

  do {
    const url = new URL(`${firestoreBaseUrl(env)}/users`)
    url.searchParams.set('pageSize', '100')
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error(`FIRESTORE_USERS_READ_FAILED_${response.status}`)

    const payload = await response.json<FirestoreListResponse>()
    documents.push(...(payload.documents ?? []))
    nextPageToken = payload.nextPageToken ?? ''
  } while (nextPageToken)

  return documents
}

async function getDocument(
  env: TokenReminderEnv,
  accessToken: string,
  collectionName: string,
  documentId: string,
) {
  const response = await fetch(
    `${firestoreBaseUrl(env)}/${collectionName}/${encodeURIComponent(documentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`FIRESTORE_DOCUMENT_READ_FAILED_${response.status}`)
  return response.json<FirestoreDocument>()
}

function getDocumentId(document: FirestoreDocument) {
  return document.name.split('/').pop() ?? ''
}

function getString(fields: Record<string, FirestoreValue>, field: string) {
  return fields[field]?.stringValue ?? ''
}

function getBoolean(fields: Record<string, FirestoreValue>, field: string) {
  return fields[field]?.booleanValue === true
}

function hasDeletedValue(fields: Record<string, FirestoreValue>) {
  const deletedAt = fields.deletedAt
  return Boolean(deletedAt && deletedAt.nullValue !== 'NULL_VALUE')
}

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

async function hasReminderLog(env: TokenReminderEnv, accessToken: string, logId: string) {
  return Boolean(await getDocument(env, accessToken, 'tokenReminderLogs', logId))
}

async function saveReminderLog(params: {
  env: TokenReminderEnv
  accessToken: string
  logId: string
  userId: string
  email: string
  whatsappNumber: string
  remainingDays: number
  expiresAt: string
  messageId: string
}) {
  const { env, accessToken, logId, userId, email, whatsappNumber, remainingDays, expiresAt, messageId } = params
  const response = await fetch(`${firestoreBaseUrl(env)}/tokenReminderLogs/${encodeURIComponent(logId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: userId },
        email: { stringValue: email },
        whatsappNumber: { stringValue: whatsappNumber },
        remainingDays: { integerValue: String(remainingDays) },
        expiresAt: { timestampValue: expiresAt },
        messageId: { stringValue: messageId },
        sentAt: { timestampValue: new Date().toISOString() },
      },
    }),
  })

  if (!response.ok) throw new Error(`FIRESTORE_REMINDER_LOG_WRITE_FAILED_${response.status}`)
}

async function sendWhatsAppTemplate(
  env: TokenReminderEnv,
  whatsappNumber: string,
  remainingDays: number,
) {
  if (
    !env.WHATSAPP_ACCESS_TOKEN
    || !env.WHATSAPP_PHONE_NUMBER_ID
    || !env.WHATSAPP_TOKEN_REMINDER_TEMPLATE
  ) {
    throw new Error('WHATSAPP_REMINDER_CONFIG_MISSING')
  }

  const apiVersion = env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: whatsappNumber,
        type: 'template',
        template: {
          name: env.WHATSAPP_TOKEN_REMINDER_TEMPLATE,
          language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || 'id' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: String(remainingDays) }],
            },
          ],
        },
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`WHATSAPP_REMINDER_SEND_FAILED_${response.status}_${detail.slice(0, 200)}`)
  }

  const payload = await response.json<{ messages?: Array<{ id?: string }> }>()
  return payload.messages?.[0]?.id ?? ''
}

export async function sendTokenExpiryReminders(env: TokenReminderEnv) {
  if (
    !env.FIREBASE_CLIENT_EMAIL
    || !env.FIREBASE_PRIVATE_KEY
    || !env.WHATSAPP_ACCESS_TOKEN
    || !env.WHATSAPP_PHONE_NUMBER_ID
    || !env.WHATSAPP_TOKEN_REMINDER_TEMPLATE
  ) {
    console.warn('Token reminder skipped because server credentials are not configured.')
    return
  }

  const accessToken = await createGoogleAccessToken(env)
  const users = await listUserDocuments(env, accessToken)

  for (const userDocument of users) {
    const userId = getDocumentId(userDocument)
    const fields = userDocument.fields ?? {}
    const expiresAt = fields.activationExpiresAt?.timestampValue ?? ''
    const expiryMillis = Date.parse(expiresAt)

    if (
      !userId
      || getString(fields, 'role') !== 'user'
      || !getBoolean(fields, 'isActive')
      || getBoolean(fields, 'isSuspended')
      || hasDeletedValue(fields)
      || !Number.isFinite(expiryMillis)
    ) {
      continue
    }

    const remainingDays = Math.ceil((expiryMillis - Date.now()) / dayInMs)
    if (!reminderDays.has(remainingDays)) continue

    try {
      const logId = `${userId}_${expiryMillis}_${remainingDays}`
      if (await hasReminderLog(env, accessToken, logId)) continue

      const businessProfile = await getDocument(env, accessToken, 'businessProfiles', userId)
      const whatsappNumber = normalizeWhatsAppNumber(
        getString(businessProfile?.fields ?? {}, 'whatsappNumber'),
      )
      if (!whatsappNumber) {
        console.warn('Token reminder skipped because vendor WhatsApp number is empty.', { userId })
        continue
      }

      const messageId = await sendWhatsAppTemplate(env, whatsappNumber, remainingDays)
      await saveReminderLog({
        env,
        accessToken,
        logId,
        userId,
        email: getString(fields, 'email'),
        whatsappNumber,
        remainingDays,
        expiresAt,
        messageId,
      })
    } catch (error) {
      console.error('Token reminder failed for vendor.', { userId, error })
    }
  }
}
