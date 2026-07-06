import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

console.log('Starting demo brand update script...')
const progressFile = new URL('../demo-brand-update.log', import.meta.url)

function logProgress(message) {
  const line = `${new Date().toISOString()} ${message}\n`
  appendFileSync(progressFile, line)
  console.log(message)
}

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

async function main() {
  writeFileSync(progressFile, '')
  logProgress('Loading Firebase modules...')
  const [{ initializeApp }, { getAuth, signInWithEmailAndPassword, updateProfile }, firestoreModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  const {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    getFirestore,
  } = firestoreModule

  const env = loadEnv()
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })

  const auth = getAuth(app)
  const db = getFirestore(app)
  const email = 'dummy@contoh.info'
  const password = 'dummy123'
  const vendorName = 'Kim Jong Un Photography'
  const vendorWhatsappNumber = '6285176932228'
  const vendorAddress = 'Jl. Raya Event Indonesia No. 27, Jakarta Selatan'
  const logoUrl = logoSvg()

  logProgress('Signing in...')
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const uid = credential.user.uid
  await updateProfile(credential.user, { displayName: vendorName })

  logProgress('Updating profile...')
  await setDoc(doc(db, 'users', uid), { name: vendorName, updatedAt: serverTimestamp() }, { merge: true })
  await setDoc(
    doc(db, 'businessProfiles', uid),
    {
      vendorName,
      vendorCode: 'KJU',
      ownerName: 'Kim Jong Un',
      bankAccountName: 'KIM JONG UN PHOTOGRAPHY',
      logoUrl,
      logoKey: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  logProgress('Updating pricelists...')
  const pricelistSnapshot = await getDocs(query(collection(db, 'pricelists'), where('userId', '==', uid)))
  await Promise.all(
    pricelistSnapshot.docs.map((item) =>
      updateDoc(item.ref, {
        vendorName,
        vendorWhatsappNumber,
        vendorAddress,
        vendorLogoUrl: logoUrl,
        updatedAt: serverTimestamp(),
      }),
    ),
  )

  logProgress('Updating receipts...')
  const receiptSnapshot = await getDocs(query(collection(db, 'receipts'), where('userId', '==', uid)))
  await Promise.all(
    receiptSnapshot.docs.map((item) =>
      updateDoc(item.ref, {
        vendorName,
        vendorWhatsappNumber,
        vendorAddress,
        updatedAt: serverTimestamp(),
      }),
    ),
  )

  logProgress(`Updated ${pricelistSnapshot.size} pricelists and ${receiptSnapshot.size} receipts.`)
  logProgress(`Demo brand ready: ${vendorName}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
