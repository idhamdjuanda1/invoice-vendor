import { readFileSync } from 'node:fs'

function loadEnv() {
  const env = {}
  const file = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')

  file.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const [key, ...parts] = trimmed.split('=')
    env[key] = parts.join('=')
  })

  return env
}

function logoSvg() {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280">
      <rect width="640" height="280" rx="32" fill="#111111"/>
      <circle cx="142" cy="132" r="74" fill="none" stroke="#d4af37" stroke-width="8"/>
      <text x="142" y="150" text-anchor="middle" font-family="Arial" font-size="58" font-weight="800" fill="#d4af37">KJU</text>
      <text x="370" y="116" text-anchor="middle" font-family="Arial" font-size="38" font-weight="800" fill="#ffffff">KIM JONG UN</text>
      <text x="370" y="158" text-anchor="middle" font-family="Arial" font-size="28" letter-spacing="5" fill="#d4af37">PHOTOGRAPHY</text>
      <path d="M258 186 H506" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.72"/>
      <text x="382" y="218" text-anchor="middle" font-family="Arial" font-size="16" letter-spacing="3" fill="#ffffff" opacity="0.86">WEDDING - PREWEDDING - EVENT</text>
    </svg>
  `)}`
}

function stringValue(value) {
  return { stringValue: value }
}

function nullValue() {
  return { nullValue: null }
}

function timestampValue(value = new Date()) {
  return { timestampValue: value.toISOString() }
}

async function firebaseFetch(url, options = {}) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(data)}`)
  }
  return data
}

function documentUrl(projectId, path) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`
}

async function patchDocument(projectId, token, path, fields) {
  const masks = Object.keys(fields).map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&')
  return firebaseFetch(`${documentUrl(projectId, path)}?${masks}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
}

async function queryByUserId(projectId, token, collectionId, uid) {
  const result = await firebaseFetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: stringValue(uid),
          },
        },
      },
    }),
  })

  return result.map((row) => row.document).filter(Boolean)
}

async function main() {
  const env = loadEnv()
  const email = 'dummy@contoh.info'
  const password = 'dummy123'
  const vendorName = 'Kim Jong Un Photography'
  const vendorWhatsappNumber = '6285176932228'
  const vendorAddress = 'Jl. Raya Event Indonesia No. 27, Jakarta Selatan'
  const logoUrl = logoSvg()

  console.log('Signing in through Firebase Auth REST...')
  const authData = await firebaseFetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })

  const uid = authData.localId
  const token = authData.idToken
  const projectId = env.VITE_FIREBASE_PROJECT_ID

  console.log('Updating Auth display name...')
  await firebaseFetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, displayName: vendorName, returnSecureToken: false }),
  })

  console.log('Updating business profile...')
  await patchDocument(projectId, token, `businessProfiles/${uid}`, {
    vendorName: stringValue(vendorName),
    vendorCode: stringValue('KJU'),
    ownerName: stringValue('Kim Jong Un'),
    bankAccountName: stringValue('KIM JONG UN PHOTOGRAPHY'),
    logoUrl: stringValue(logoUrl),
    logoKey: nullValue(),
    updatedAt: timestampValue(),
  })

  console.log('Updating pricelists...')
  const pricelists = await queryByUserId(projectId, token, 'pricelists', uid)
  for (const item of pricelists) {
    const path = item.name.split('/documents/')[1]
    await patchDocument(projectId, token, path, {
      vendorName: stringValue(vendorName),
      vendorWhatsappNumber: stringValue(vendorWhatsappNumber),
      vendorAddress: stringValue(vendorAddress),
      vendorLogoUrl: stringValue(logoUrl),
      updatedAt: timestampValue(),
    })
  }

  console.log('Updating receipts...')
  const receipts = await queryByUserId(projectId, token, 'receipts', uid)
  for (const item of receipts) {
    const path = item.name.split('/documents/')[1]
    await patchDocument(projectId, token, path, {
      vendorName: stringValue(vendorName),
      vendorWhatsappNumber: stringValue(vendorWhatsappNumber),
      vendorAddress: stringValue(vendorAddress),
      updatedAt: timestampValue(),
    })
  }

  console.log(`Done. Updated ${pricelists.length} pricelists and ${receipts.length} receipts.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
