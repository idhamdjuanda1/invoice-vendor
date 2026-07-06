import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'

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

const env = loadEnv()
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const email = 'dummy@contoh.info'
const password = 'dummy123'
const demoVendorName = 'Kim Jong Un Photography'
const demoOwnerName = 'Kim Jong Un'
const demoVendorWhatsapp = '6285176932228'
const demoVendorAddress = 'Jl. Raya Event Indonesia No. 27, Jakarta Selatan'
const now = Timestamp.now()
const future = Timestamp.fromDate(new Date('2027-12-31T23:59:59+07:00'))

function signatureSvg() {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="520" height="190" viewBox="0 0 520 190">
      <rect width="520" height="190" fill="none"/>
      <path d="M47 116 C93 45 113 142 161 73 C187 39 195 141 232 87 C256 52 268 134 307 78 C333 41 359 112 410 71 C442 45 456 57 480 38" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M103 136 C176 151 289 150 435 128" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <text x="260" y="174" text-anchor="middle" font-family="Arial" font-size="24" fill="#111">KJU Photography</text>
    </svg>
  `)}`
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
      <text x="382" y="218" text-anchor="middle" font-family="Arial" font-size="16" letter-spacing="3" fill="#ffffff" opacity="0.86">WEDDING • PREWEDDING • EVENT</text>
    </svg>
  `)}`
}

const images = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85',
  wedding2: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=85',
  prewedding: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=85',
  prewedding2: 'https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?auto=format&fit=crop&w=1200&q=85',
  engagement: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=85',
  engagement2: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=85',
}

async function signInOrCreateUser() {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName: demoVendorName })
    return credential.user
  } catch (error) {
    if (error?.code !== 'auth/email-already-in-use') throw error
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return credential.user
  }
}

async function ensureUserProfile(uid) {
  const ref = doc(db, 'users', uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) {
    await setDoc(ref, {
      name: demoVendorName,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    return
  }

  await setDoc(ref, {
    uid,
    name: demoVendorName,
    email,
    role: 'user',
    isActive: true,
    isSuspended: false,
    activatedAt: now,
    activationExpiresAt: future,
    activationTokenId: 'DEMO-ACTIVE-2026',
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

async function setBusinessProfile(uid) {
  await setDoc(
    doc(db, 'businessProfiles', uid),
    {
      userId: uid,
      vendorName: demoVendorName,
      vendorCode: 'KJU',
      whatsappNumber: demoVendorWhatsapp,
      email,
      address: demoVendorAddress,
      businessDescription:
        'Vendor dokumentasi wedding, prewedding, lamaran, dan event keluarga dengan pendekatan clean, cinematic, dan natural.',
      ownerName: demoOwnerName,
      bankAccountNumber: '1234567890',
      bankAccountName: 'KIM JONG UN PHOTOGRAPHY',
      logoUrl: logoSvg(),
      logoKey: null,
      signatureUrl: signatureSvg(),
      defaultPaymentNote: 'Pembayaran dapat dilakukan melalui transfer bank sesuai nomor rekening yang tercantum pada invoice.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

async function getOrCreateByName(collectionName, uid, name, extra = {}) {
  const q = query(collection(db, collectionName), where('userId', '==', uid), where('name', '==', name))
  const snapshot = await getDocs(q)
  const existing = snapshot.docs.find((item) => !item.data().deletedAt)
  if (existing) return { id: existing.id, ...existing.data() }

  const ref = await addDoc(collection(db, collectionName), {
    userId: uid,
    name,
    ...extra,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return { id: ref.id, userId: uid, name, ...extra }
}

async function seedPackages(uid) {
  const categories = {
    wedding: await getOrCreateByName('packageCategories', uid, 'Wedding'),
    prewedding: await getOrCreateByName('packageCategories', uid, 'Prewedding'),
    engagement: await getOrCreateByName('packageCategories', uid, 'Lamaran'),
  }

  const packageSeeds = [
    {
      category: categories.wedding,
      name: 'Wedding Silver',
      price: 6500000,
      description:
        '1 Fotografer\n1 Videografer\n200 Editing photo\nKolase 11 sheet\nVideo cinematic 3-5 menit\nGoogle Drive',
      eventDuration: 'Akad atau pemberkatan + resepsi 6 jam',
    },
    {
      category: categories.wedding,
      name: 'Wedding Gold',
      price: 9500000,
      description:
        '2 Fotografer\n1 Videografer\n300 Editing photo\nAlbum premium 20 halaman\nTeaser 1 menit\nVideo cinematic 5-7 menit\nFlashdrive dan Google Drive',
      eventDuration: 'Full day wedding 8 jam',
    },
    {
      category: categories.wedding,
      name: 'Wedding Platinum',
      price: 14500000,
      description:
        '2 Fotografer\n2 Videografer\nSame day edit\nAlbum premium 30 halaman\nCetak frame 40x60\nDrone footage\nVideo cinematic 7-10 menit',
      eventDuration: 'Full day wedding 10 jam',
    },
    {
      category: categories.prewedding,
      name: 'Prewedding Outdoor',
      price: 3500000,
      description:
        '1 Fotografer\n1 Asisten lighting\n50 Editing photo\n2 Lokasi outdoor\nMoodboard konsep\nGoogle Drive',
      eventDuration: 'Sesi 4 jam',
    },
    {
      category: categories.prewedding,
      name: 'Prewedding Premium',
      price: 5500000,
      description:
        '1 Fotografer\n1 Videografer\n80 Editing photo\n3 Lokasi\nTeaser cinematic 1 menit\nGuide pose dan konsep',
      eventDuration: 'Sesi 6 jam',
    },
    {
      category: categories.engagement,
      name: 'Lamaran Intimate',
      price: 2500000,
      description:
        '1 Fotografer\n100 Editing photo\nDokumentasi prosesi lamaran\nFoto keluarga\nGoogle Drive',
      eventDuration: 'Sesi 3 jam',
    },
    {
      category: categories.engagement,
      name: 'Lamaran Cinematic',
      price: 4200000,
      description:
        '1 Fotografer\n1 Videografer\n150 Editing photo\nHighlight video 2-3 menit\nDokumentasi keluarga\nGoogle Drive',
      eventDuration: 'Sesi 4 jam',
    },
  ]

  const packages = []
  for (const item of packageSeeds) {
    packages.push(
      await getOrCreateByName('packages', uid, item.name, {
        categoryId: item.category.id,
        categoryName: item.category.name,
        price: item.price,
        description: item.description,
        eventDuration: item.eventDuration,
        additionalNote: 'Harga belum termasuk biaya transport luar kota, venue charge, dan akomodasi bila diperlukan.',
        isActive: true,
      }),
    )
  }

  return packages
}

async function seedPricelists(uid, packages) {
  const imageByPackage = {
    'Wedding Silver': images.wedding,
    'Wedding Gold': images.wedding2,
    'Wedding Platinum': images.wedding,
    'Prewedding Outdoor': images.prewedding,
    'Prewedding Premium': images.prewedding2,
    'Lamaran Intimate': images.engagement,
    'Lamaran Cinematic': images.engagement2,
  }

  const groups = [
    {
      title: 'Wedding Photography',
      tagline: 'Create the moment with us.',
      discountTitle: 'Promo Booking Bulan Ini',
      discountDescription: 'Diskon 10% untuk deal dan DP di bulan berjalan.',
      discountPercentage: 10,
      names: ['Wedding Silver', 'Wedding Gold', 'Wedding Platinum'],
    },
    {
      title: 'Prewedding Story',
      tagline: 'Natural, intimate, and cinematic prewedding session.',
      discountTitle: 'Promo Couple Session',
      discountDescription: 'Free konsultasi konsep dan moodboard untuk booking bulan ini.',
      discountPercentage: 5,
      names: ['Prewedding Outdoor', 'Prewedding Premium'],
    },
    {
      title: 'Lamaran Package',
      tagline: 'Dokumentasi hangat untuk momen keluarga.',
      discountTitle: 'Promo Lamaran',
      discountDescription: 'Bonus 20 foto edit tambahan untuk pemesanan cepat.',
      discountPercentage: 8,
      names: ['Lamaran Intimate', 'Lamaran Cinematic'],
    },
  ]

  for (const group of groups) {
    const q = query(collection(db, 'pricelists'), where('userId', '==', uid), where('title', '==', group.title))
    const snapshot = await getDocs(q)
    const selected = packages.filter((item) => group.names.includes(item.name))
    const items = selected.map((item) => ({
      id: item.id,
      packageId: item.id,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      packageName: item.name,
      description: item.description,
      price: item.price,
      imageUrl: imageByPackage[item.name] ?? null,
      imageKey: null,
    }))
    const payload = {
      userId: uid,
      slug: `${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-demo`,
      title: group.title,
      tagline: group.tagline,
      discountTitle: group.discountTitle,
      discountDescription: group.discountDescription,
      discountPercentage: group.discountPercentage,
      discountIsActive: true,
      vendorName: demoVendorName,
      vendorWhatsappNumber: demoVendorWhatsapp,
      vendorAddress: demoVendorAddress,
      vendorLogoUrl: logoSvg(),
      thumbnailUrl: items[0]?.imageUrl ?? null,
      thumbnailKey: null,
      instagramUrl: 'https://instagram.com/idmproject',
      tiktokUrl: 'https://tiktok.com/@idmproject',
      whatsappUrl: `https://wa.me/${demoVendorWhatsapp}`,
      items,
      isPublished: true,
      deletedAt: null,
      updatedAt: serverTimestamp(),
    }

    const existing = snapshot.docs.find((item) => !item.data().deletedAt)
    if (existing) {
      await updateDoc(existing.ref, payload)
    } else {
      await addDoc(collection(db, 'pricelists'), { ...payload, createdAt: serverTimestamp() })
    }
  }
}

async function seedClientsInvoicesPayments(uid, packages) {
  const clients = [
    ['Rara & Dimas', '6281211110001', 'rara@example.com', 'Bekasi'],
    ['Nadia & Fikri', '6281211110002', 'nadia@example.com', 'Jakarta Selatan'],
    ['Salsa & Rian', '6281211110003', 'salsa@example.com', 'Depok'],
    ['Maya & Ardi', '6281211110004', 'maya@example.com', 'Tangerang'],
    ['Laras & Bima', '6281211110005', 'laras@example.com', 'Bogor'],
    ['Putri & Reza', '6281211110006', 'putri@example.com', 'Bandung'],
    ['Ayu & Bagas', '6281211110007', 'ayu@example.com', 'Jakarta Timur'],
  ]

  const clientRecords = []
  for (const [name, whatsappNumber, emailAddress, address] of clients) {
    clientRecords.push(
      await getOrCreateByName('clients', uid, name, {
        whatsappNumber,
        email: emailAddress,
        address,
      }),
    )
  }

  const invoicePlans = [
    { client: clientRecords[0], packageNames: ['Wedding Gold'], paid: 'dp', amount: 3000000, method: 'TRANSFER_BANK', date: '2026-08-10', location: 'Gedung Serbaguna Bekasi' },
    { client: clientRecords[1], packageNames: ['Wedding Platinum'], paid: 'full', method: 'TRANSFER_BANK', date: '2026-09-14', location: 'The Manor Andara Jakarta' },
    { client: clientRecords[2], packageNames: ['Prewedding Premium'], paid: 'full', method: 'QRIS', date: '2026-08-24', location: 'Hutan Kota GBK Jakarta' },
    { client: clientRecords[3], packageNames: ['Lamaran Cinematic'], paid: 'dp', amount: 1500000, method: 'CASH', date: '2026-07-28', location: 'Rumah keluarga Tangerang' },
    { client: clientRecords[4], packageNames: ['Wedding Silver'], paid: 'full', method: 'TRANSFER_BANK', date: '2026-10-03', location: 'Masjid Agung Bogor' },
    { client: clientRecords[5], packageNames: ['Prewedding Outdoor'], paid: 'dp', amount: 1000000, method: 'QRIS', date: '2026-08-03', location: 'Lembang Bandung' },
    { client: clientRecords[6], packageNames: ['Lamaran Intimate'], paid: 'full', method: 'CASH', date: '2026-07-21', location: 'Jakarta Timur' },
  ]

  let sequence = 1
  for (const plan of invoicePlans) {
    const existingQ = query(collection(db, 'invoices'), where('userId', '==', uid), where('clientName', '==', plan.client.name))
    const existingSnapshot = await getDocs(existingQ)
    if (existingSnapshot.docs.find((item) => !item.data().deletedAt)) continue

    const selectedPackages = packages.filter((item) => plan.packageNames.includes(item.name))
    const items = selectedPackages.map((item) => ({
      id: item.id,
      packageId: item.id,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      packageName: item.name,
      description: item.description,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
    }))
    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const totalPaid = plan.paid === 'full' ? totalAmount : plan.amount
    const paymentStatus = totalPaid >= totalAmount ? 'LUNAS' : totalPaid > 0 ? 'DP' : 'BELUM_BAYAR'
    const invoiceRef = await addDoc(collection(db, 'invoices'), {
      userId: uid,
      clientId: plan.client.id,
      clientName: plan.client.name,
      clientWhatsappNumber: plan.client.whatsappNumber,
      clientEmail: plan.client.email,
      clientAddress: plan.client.address,
      invoiceNumber: `INV-IDM-202607-${String(sequence).padStart(4, '0')}`,
      invoiceDate: now,
      eventDate: Timestamp.fromDate(new Date(`${plan.date}T00:00:00+07:00`)),
      eventLocation: plan.location,
      additionalNote: 'Contoh invoice demo untuk simulasi pembayaran, kuitansi, dan MOU.',
      subtotal: totalAmount,
      totalAmount,
      totalPaid,
      remainingAmount: Math.max(totalAmount - totalPaid, 0),
      paymentPercentage: Math.round((totalPaid / totalAmount) * 100),
      paymentStatus,
      paymentMethod: totalPaid > 0 ? plan.method : null,
      items,
      payments: [],
      isPublic: false,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    if (totalPaid > 0) {
      const paymentRef = await addDoc(collection(db, 'payments'), {
        userId: uid,
        invoiceId: invoiceRef.id,
        amount: totalPaid,
        paymentDate: now,
        paymentMethod: plan.method,
        notes: plan.paid === 'full' ? 'Pelunasan invoice demo' : 'DP invoice demo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      })

      await addDoc(collection(db, 'receipts'), {
        userId: uid,
        receiptNumber: `RCT-IDM-202607-${String(sequence).padStart(4, '0')}`,
        receiptDate: now,
        invoiceId: invoiceRef.id,
        invoiceNumber: `INV-IDM-202607-${String(sequence).padStart(4, '0')}`,
        paymentId: paymentRef.id,
        clientName: plan.client.name,
        vendorName: demoVendorName,
        vendorWhatsappNumber: demoVendorWhatsapp,
        vendorAddress: demoVendorAddress,
        amount: totalPaid,
        paymentMethod: plan.method,
        notes: plan.paid === 'full' ? 'Pelunasan invoice demo' : 'DP invoice demo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      })
    }

    sequence += 1
  }
}

async function main() {
  console.log('Signing in or creating demo user...')
  const user = await signInOrCreateUser()
  console.log(`Signed in as ${user.uid}`)
  console.log('Ensuring user profile...')
  await ensureUserProfile(user.uid)
  console.log('Saving business profile...')
  await setBusinessProfile(user.uid)
  console.log('Seeding packages...')
  const packages = await seedPackages(user.uid)
  console.log(`Packages ready: ${packages.length}`)
  console.log('Seeding pricelists...')
  await seedPricelists(user.uid, packages)
  console.log('Seeding clients, invoices, payments, and receipts...')
  await seedClientsInvoicesPayments(user.uid, packages)

  console.log(`Demo account ready: ${email}`)
  console.log(`Password: ${password}`)
  console.log(`UID: ${user.uid}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
