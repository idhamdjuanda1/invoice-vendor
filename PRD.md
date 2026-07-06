# PRD.md - Invoice Vendor Web Application

## 1. Ringkasan Produk

**Invoice Vendor** adalah web application responsif untuk vendor wedding dan event di Indonesia. Aplikasi membantu vendor mengelola profil usaha, paket layanan, klien, invoice, pembayaran, kuitansi, MOU, reminder WhatsApp, dan pricelist publik dalam satu sistem.

Aplikasi dipakai oleh:

- Fotografer dan videografer wedding
- Vendor prewedding
- Vendor lamaran
- Wedding organizer
- MUA
- Dekorasi
- Catering
- Vendor event umum

Produk harus nyaman dipakai di desktop dan mobile, dengan tampilan bersih, profesional, dan cocok untuk vendor event Indonesia.

---

## 2. Tujuan Produk

1. Membuat invoice profesional dengan cepat.
2. Mencatat pembayaran DP, cicilan, dan pelunasan.
3. Membuat kuitansi otomatis dari pembayaran.
4. Membuat MOU/perjanjian kerja sama dari invoice.
5. Mengelola paket dan kategori paket.
6. Membagikan pricelist publik tanpa login.
7. Mengirim reminder pembayaran melalui WhatsApp.
8. Menampilkan dashboard ringkasan invoice, omzet, dan piutang.
9. Mengamankan akses vendor menggunakan token aktivasi.
10. Menyediakan Super Admin untuk manajemen token dan user.

---

## 3. Tech Stack Aktual

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Recharts
- Lucide React

### Backend dan Database

- Firebase Authentication
- Firestore
- Firebase Hosting
- Firestore Security Rules

### Storage

- Cloudflare R2 untuk file upload seperti logo vendor dan foto pricelist.
- Cloudflare Worker sebagai upload gateway agar credential R2 tidak hardcoded di frontend.
- Firebase Storage tidak digunakan untuk project ini.

### PDF dan Export

- Browser print untuk cetak PDF langsung dari browser.
- jsPDF untuk generate PDF native invoice, MOU, dan kuitansi.
- html2canvas masih tersedia sebagai fallback/helper lama.
- xlsx untuk export data.

### Deployment dan Backup Source Code

- Production hosting: Firebase Hosting.
- Source code backup: GitHub private repository `idhamdjuanda1/invoice-vendor`.
- File rahasia seperti `.env.local`, credential, token, `node_modules`, `dist`, `.firebase`, dan `.vercel` tidak boleh masuk GitHub.

---

## 4. Role dan Hak Akses

### Role

1. **Super Admin**
2. **Vendor/User**

### Super Admin

Super Admin menggunakan Firebase Email/Password.

Email Super Admin:

```env
VITE_SUPERADMIN_EMAIL=idhamdjuanda@gmail.com
```

Bootstrap Super Admin dilakukan manual melalui Firebase Auth dan Firestore rules/config.

### Permission Matrix

| Fitur | Super Admin | Vendor/User |
|---|---:|---:|
| Login | Ya | Ya |
| Membuat token aktivasi | Ya | Tidak |
| Melihat token aktivasi | Ya | Tidak |
| Melihat daftar user | Ya | Tidak |
| Suspend/reactivate user | Ya | Tidak |
| Soft delete user | Ya | Tidak |
| Melihat dashboard admin | Ya | Tidak |
| Mengubah profil usaha | Tidak | Ya |
| Upload logo usaha | Tidak | Ya |
| Simpan tanda tangan digital | Tidak | Ya |
| Manajemen kategori paket | Tidak | Ya |
| Manajemen paket | Tidak | Ya |
| Manajemen klien | Tidak | Ya |
| Membuat dan edit invoice | Tidak | Ya |
| Mencatat pembayaran | Tidak | Ya |
| Membuat kuitansi otomatis | Tidak | Ya |
| Membuat MOU | Tidak | Ya |
| Membuat pricelist publish | Tidak | Ya |
| Reminder WhatsApp | Tidak | Ya |
| Export data | Tidak | Ya |

---

## 5. Authentication dan Aktivasi

### Login

User login menggunakan Firebase Email/Password.

Syarat akses vendor:

1. Email dan password benar.
2. Dokumen user tersedia di Firestore.
3. Role adalah `user`.
4. `isActive` bernilai true.
5. `isSuspended` bernilai false.
6. `activationExpiresAt` belum lewat.
7. `deletedAt` kosong.

### Registrasi Vendor

Vendor registrasi menggunakan:

- Nama
- Email
- Password
- Token aktivasi

Validasi token:

1. Token ada di Firestore.
2. Token aktif.
3. Token belum digunakan.
4. Token belum expired.
5. Token memiliki durasi valid.

### Durasi Token

Token aktivasi mendukung:

- 1 jam
- 1 hari
- 1 bulan

Setelah token dipakai, user mendapat masa aktif sesuai durasi token.

### Token Expired Flow

Jika token vendor expired atau invalid:

1. Aplikasi menampilkan modal blocking.
2. Modal tidak bisa ditutup dengan tombol X.
3. Vendor bisa memasukkan token baru.
4. Token baru divalidasi ke Firestore.
5. Jika valid, akses vendor langsung dipulihkan tanpa login ulang.
6. Vendor bisa logout.
7. Vendor bisa hubungi admin via WhatsApp.

---

## 6. Firestore Collections

Koleksi utama:

- `users`
- `activationTokens`
- `businessProfiles`
- `packageCategories`
- `packages`
- `clients`
- `invoiceSequences`
- `receiptSequences`
- `invoices`
- `payments`
- `receipts`
- `agreements`
- `pricelists`
- `backupLogs`
- `auditLogs`

Rules utama:

1. Vendor hanya boleh membaca/menulis data miliknya sendiri.
2. Super Admin dapat membaca dan mengelola data admin/user sesuai kebutuhan.
3. Public pricelist dapat dibaca tanpa login jika `isPublished == true`.
4. Public invoice hanya boleh menampilkan data minimal jika fitur public invoice diaktifkan.
5. Delete permanen tidak digunakan; gunakan soft delete melalui `deletedAt`.

---

## 7. Profil Vendor

Vendor dapat mengisi:

- Nama usaha
- Nomor WhatsApp
- Email
- Alamat
- Deskripsi usaha
- Nomor rekening usaha
- Atas nama rekening
- Logo vendor
- Tanda tangan digital

### Logo Vendor

Logo vendor:

- Diunggah ke Cloudflare R2.
- URL dan key file disimpan di Firestore.
- Jika logo tidak tersedia atau gagal dimuat, UI wajib menampilkan fallback monogram/icon.
- Logo digunakan pada dashboard, profile, pricelist, dan dokumen sesuai dukungan fitur.

### Tanda Tangan Digital

Vendor dapat menyimpan tanda tangan digital.

Sumber tanda tangan:

- Canvas tanda tangan manual.
- Upload PNG/data image.

Tanda tangan digunakan di MOU dan dokumen terkait.

---

## 8. Manajemen Kategori dan Paket

### Kategori Paket

Vendor dapat:

1. Membuat kategori.
2. Mengedit kategori.
3. Menghapus kategori yang belum digunakan.

Kategori custom lama dihapus. Semua paket harus menggunakan kategori dari menu manajemen kategori.

### Paket

Field paket:

- Kategori
- Nama paket
- Harga
- Deskripsi
- Durasi acara
- Catatan tambahan
- Status aktif

Aturan:

1. Paket hanya milik vendor pembuatnya.
2. Paket yang dipakai invoice disimpan sebagai snapshot.
3. Perubahan master paket tidak mengubah invoice lama.
4. Daftar paket diurutkan berdasarkan kategori, lalu harga termurah ke termahal.

---

## 9. Klien

Vendor dapat membuat dan mengedit klien.

Field klien:

- Nama klien
- Nomor WhatsApp
- Email
- Alamat

Saat membuat invoice, vendor dapat memilih klien yang sudah tersimpan atau membuat klien baru.

---

## 10. Invoice

Vendor dapat:

1. Membuat invoice baru.
2. Memilih klien.
3. Memilih satu atau beberapa paket.
4. Mengisi tanggal acara.
5. Mengisi lokasi acara.
6. Mengisi catatan tambahan.
7. Mengedit invoice.
8. Menghapus invoice secara soft delete.
9. Melihat detail invoice.
10. Mencetak invoice dari browser.
11. Generate/download PDF invoice native.
12. Mengirim reminder WhatsApp.

### Nomor Invoice

Format:

```text
INV-{KODE_VENDOR}-{YYYYMM}-{URUTAN}
```

Contoh:

```text
INV-IDM-202607-0001
```

Nomor invoice:

- Otomatis.
- Berurutan.
- Reset per vendor dan bulan.
- Tidak berubah setelah invoice dibuat.

### Status Pembayaran

Status yang didukung:

- Belum Bayar
- DP
- Cicilan
- Lunas

Status dihitung dari payment history:

```text
totalPaid = jumlah semua payment aktif
remainingAmount = totalAmount - totalPaid
paymentPercentage = totalPaid / totalAmount * 100
```

Aturan status:

- `Belum Bayar`: belum ada pembayaran.
- `DP`: ada satu pembayaran dan belum lunas.
- `Cicilan`: lebih dari satu pembayaran dan belum lunas.
- `Lunas`: total dibayar sama dengan atau lebih besar dari total tagihan.

---

## 11. Payment System

Setiap payment disimpan di collection `payments`.

Field payment:

- `id`
- `userId`
- `invoiceId`
- `amount`
- `paymentDate`
- `paymentMethod`
- `notes`
- `createdAt`
- `updatedAt`
- `deletedAt`

Metode pembayaran:

- Transfer
- Cash
- QRIS
- Other

Vendor dapat:

1. Add payment.
2. Edit payment.
3. Delete payment soft delete.
4. Mark invoice fully paid.
5. Melihat payment timeline/history.

Setelah payment berubah:

1. Invoice dihitung ulang.
2. Status invoice diperbarui.
3. Kuitansi dibuat atau disinkronkan.

---

## 12. Kuitansi

Kuitansi dibuat otomatis dari payment.

Field kuitansi:

- Nomor kuitansi
- Tanggal kuitansi
- Invoice terkait
- Payment terkait
- Nama klien
- Nama vendor
- Nominal
- Metode pembayaran
- Catatan

Nomor kuitansi:

```text
RCT-{KODE_VENDOR}-{YYYYMM}-{URUTAN}
```

Kuitansi dapat:

- Dilihat di aplikasi.
- Dicetak via browser.
- Download PDF native.

---

## 13. MOU / Perjanjian Kerja Sama

Vendor dapat membuat MOU dari invoice.

MOU berisi:

- Nomor MOU
- Tanggal MOU
- Pihak pertama/vendor
- Pihak kedua/klien
- Detail acara
- Nilai kerja sama
- Paket/layanan
- Pasal-pasal kerja sama
- Syarat pembayaran
- Ketentuan pembatalan
- Ketentuan hasil foto/video
- Ketentuan biaya tambahan
- Ketentuan penyerahan hasil
- Hak cipta/promosi
- Penyimpanan data
- Kehilangan data
- Force majeure
- Penyelesaian perselisihan
- Tanda tangan vendor

MOU dapat:

- Dilihat di aplikasi.
- Dicetak via browser.
- Download PDF native.

PDF MOU harus tetap berhasil walaupun logo/tanda tangan belum tersedia atau gagal dimuat.

---

## 14. Pricelist Publish

Vendor dapat membuat halaman pricelist publik tanpa login.

Fitur pricelist:

1. Nama pricelist.
2. Tagline.
3. Pilih paket yang masuk pricelist.
4. Upload/fill foto per paket.
5. Pilih thumbnail.
6. Discount popup.
7. Link Instagram.
8. Link TikTok.
9. Link WhatsApp.
10. Publish link.

Public pricelist:

- Bisa dibuka tanpa login.
- Mobile friendly.
- Menampilkan nama vendor, alamat, logo/fallback monogram, judul, tagline, foto paket, detail paket, harga, diskon, dan CTA WhatsApp.
- Memiliki label kecil "Pricelist" di atas judul.
- Detail paket ditampilkan per baris agar mudah dibaca.
- Jika gambar landscape/portrait, layout harus menyesuaikan agar teks tidak tertutup.
- Jika logo gagal dimuat, tampil fallback inisial vendor.

WhatsApp pricelist:

- Visitor dapat mencentang paket.
- Sistem menghitung subtotal, diskon, dan total estimasi.
- Tombol WhatsApp membuat pesan otomatis berisi paket yang dipilih dan total estimasi.

Open Graph/share:

- Link pricelist harus menampilkan title sesuai judul pricelist.
- Thumbnail share memakai thumbnail yang dipilih.
- Implementasi menggunakan Cloudflare Worker/share route bila dibutuhkan untuk metadata WhatsApp.

---

## 15. WhatsApp Reminder

Reminder invoice tersedia dari:

- Detail invoice.
- Payment manager.
- Daftar invoice jika invoice belum lunas.

Isi pesan:

- Nama klien
- Nomor invoice
- Tanggal acara
- Total tagihan
- Total dibayar
- Sisa pembayaran
- Ajakan konfirmasi pembayaran

Link WhatsApp:

- Nomor Indonesia dinormalisasi ke format `62`.
- Pada mobile, reminder menggunakan deep link `whatsapp://send`.
- Fallback menggunakan `https://api.whatsapp.com/send`.
- Pada desktop, membuka WhatsApp web/API.

---

## 16. Dashboard

Dashboard vendor menampilkan:

- Total invoice.
- Total omzet/terbayar.
- Sisa pembayaran/piutang.
- Invoice lunas.
- Invoice belum lunas.
- Invoice bulan ini.
- Grafik/ringkasan bulanan.
- Invoice terbaru.

Dashboard harus mobile friendly dan tidak memaksa user zoom out.

---

## 17. Super Admin

Super Admin dapat:

1. Melihat dashboard admin.
2. Melihat total user.
3. Melihat token tersedia/dipakai/expired.
4. Membuat token aktivasi.
5. Melihat token digunakan oleh email pendaftar.
6. Melihat daftar user.
7. Suspend user.
8. Reactivate user.
9. Soft delete user.

---

## 18. Export dan Backup

Vendor dapat export data.

Target export:

- Invoice
- Pembayaran
- Kuitansi
- Klien

Format:

- Excel
- CSV

Backup source code:

- Source code wajib disimpan di GitHub private.
- Repo saat ini: `idhamdjuanda1/invoice-vendor`.
- `.env.local` dan credential tidak boleh masuk repo.

Restore development environment:

```bash
git clone https://github.com/idhamdjuanda1/invoice-vendor.git
cd invoice-vendor
npm install
cp .env.example .env.local
npm run build
firebase deploy --only hosting
```

---

## 19. UI/UX Requirements

### Visual

- Clean.
- Profesional.
- Modern.
- Cocok untuk vendor event/wedding.
- Dominan putih, hitam, gold.

### Mobile

- Layout mobile-first.
- Menu utama mudah di-tap.
- Tidak perlu zoom out untuk melihat menu.
- Bottom/mobile navigation dapat digeser horizontal.
- Button cukup besar untuk jari.
- Text tidak overlap.
- Pricelist public harus nyaman dibuka dari HP baru/guest.

### Print

Print browser harus:

- Menggunakan area dokumen saja.
- Header/footer browser disarankan dimatikan oleh user jika muncul URL/tanggal.
- Invoice print diusahakan 1 halaman untuk invoice normal.
- Detail paket invoice dibuat ringkas dengan format koma.
- MOU dan kuitansi tetap rapi saat print.

---

## 20. Environment Variables

Frontend:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_URL=
VITE_SUPERADMIN_EMAIL=idhamdjuanda@gmail.com
VITE_R2_LOGO_API_URL=
```

Cloudflare Worker:

```env
FIREBASE_PROJECT_ID=
```

R2 credential disimpan sebagai secret/environment variable di Cloudflare, bukan di source code.

Vercel/Firebase/production secret tidak boleh ditulis ke repository.

---

## 21. Security Requirements

1. Credential tidak boleh hardcoded.
2. `.env.local` tidak boleh commit ke GitHub.
3. Firestore rules wajib membatasi data per `userId`.
4. Super Admin route wajib role protected.
5. Vendor tidak boleh mengakses data vendor lain.
6. Public pricelist hanya membaca data yang dipublish.
7. Soft delete digunakan untuk data penting.
8. Upload file harus lewat endpoint/worker aman.
9. R2 secret tidak boleh pernah dikirim ke frontend.
10. Token aktivasi harus random dan sulit ditebak.

---

## 22. Non-Functional Requirements

### Performance

- Dashboard dan list utama cepat pada data normal.
- Query besar perlu dipertimbangkan pagination/filter.
- Public pricelist harus cepat di mobile.

### Reliability

- Nomor invoice dan kuitansi tidak boleh duplikat.
- Payment update harus menghitung ulang invoice.
- PDF harus tetap bisa dibuat walaupun gambar gagal.
- Fallback UI wajib tersedia untuk logo/gambar yang gagal.

### Maintainability

- TypeScript digunakan konsisten.
- Logic Firestore dipisah di service.
- UI reusable component.
- Formatter dan helper dipisah di `lib`.
- Folder project harus tetap scalable.

---

## 23. Acceptance Criteria

### Authentication

- Super Admin bisa login.
- Vendor bisa registrasi dengan token.
- Vendor tanpa token valid tidak bisa akses.
- Vendor expired melihat modal token expired.
- Vendor dapat aktivasi token baru dari modal.

### Super Admin

- Super Admin bisa membuat token.
- Super Admin bisa melihat token.
- Super Admin bisa melihat daftar user.
- Super Admin bisa suspend/reactivate user.
- Token used by menampilkan email pendaftar.

### Vendor Profile

- Vendor bisa menyimpan profil.
- Vendor bisa upload logo.
- Vendor bisa menyimpan tanda tangan.
- Data tetap muncul setelah refresh.

### Paket

- Vendor bisa CRUD kategori.
- Vendor bisa CRUD paket.
- Paket diurutkan kategori lalu harga.
- Tidak ada fitur kategori custom lama.

### Invoice

- Vendor bisa buat/edit/hapus invoice.
- Invoice memilih klien dan paket.
- Nomor invoice otomatis.
- Total otomatis.
- Status pembayaran otomatis.
- Cetak invoice rapi dan compact.

### Payment

- Vendor bisa tambah/edit/hapus payment.
- Payment tersimpan di Firestore.
- Invoice recalculated setelah payment berubah.
- Mark fully paid berjalan.

### Kuitansi

- Kuitansi otomatis dibuat dari payment.
- Kuitansi bisa dilihat, dicetak, dan download PDF.

### MOU

- MOU bisa dibuat dari invoice.
- Detail pihak tampil lengkap.
- Tanda tangan vendor tampil jika tersedia.
- PDF MOU tidak gagal karena SVG/logo/tanda tangan.

### Pricelist

- Vendor bisa membuat pricelist publish.
- Public link bisa dibuka tanpa login.
- Label "Pricelist" tampil di atas judul.
- Logo tampil atau fallback monogram tampil.
- Paket bisa dicentang dan dikirim ke WhatsApp.

### WhatsApp

- Reminder invoice membuka WhatsApp biasa di HP.
- Pesan otomatis berisi ringkasan pembayaran.
- Nomor dinormalisasi ke format internasional.

### Backup

- Source code sudah ada di GitHub private.
- `.env.local` tidak masuk GitHub.
- Project bisa dipulihkan dari GitHub + env manual.

---

## 24. Roadmap / Prioritas Berikutnya

1. Optimasi ukuran bundle dengan dynamic import untuk PDF/html2canvas.
2. Pagination untuk invoice/payment jika data besar.
3. Public invoice link yang benar-benar aktif dan polished.
4. Scheduled reminder otomatis.
5. Backup/export Firestore otomatis.
6. Audit log untuk aksi admin.
7. Perapihan script seed agar tidak menyimpan password demo di repo jika project production makin serius.
8. Dokumentasi restore production lebih detail.

---

## 25. Definition of Done

Produk dianggap siap dipakai jika:

1. Aplikasi bisa login Super Admin dan Vendor.
2. Token aktivasi berjalan.
3. Vendor bisa mengelola profil, paket, klien.
4. Vendor bisa membuat invoice.
5. Payment system berjalan.
6. Kuitansi otomatis berjalan.
7. MOU berjalan.
8. Pricelist publish berjalan.
9. WhatsApp reminder berjalan di mobile.
10. Dashboard menampilkan ringkasan.
11. Build production sukses.
12. Deploy Firebase Hosting sukses.
13. Source code tersimpan di GitHub private.
14. Credential sensitif tidak masuk repository.
