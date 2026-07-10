export function getFriendlyAuthError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : ''

  if (code.includes('auth/invalid-credential')) return 'Email atau password tidak valid.'
  if (code.includes('auth/email-already-in-use')) return 'Email sudah terdaftar.'
  if (code.includes('auth/weak-password')) return 'Password minimal 8 karakter.'
  if (code.includes('auth/invalid-email')) return 'Format email tidak valid.'
  if (code.includes('permission-denied')) return 'Akses Firestore ditolak. Periksa rules dan role akun.'
  if (code.includes('invalid-argument')) return 'Data profil terlalu besar atau formatnya tidak valid. Coba hapus/ulang tanda tangan atau gunakan logo lebih kecil.'
  if (code.includes('unavailable')) return 'Koneksi ke Firestore sedang bermasalah. Coba simpan ulang beberapa saat lagi.'
  if (message === 'TOKEN_NOT_FOUND') return 'Token aktivasi tidak ditemukan.'
  if (message === 'TOKEN_USED') return 'Token aktivasi sudah digunakan.'
  if (message === 'TOKEN_EXPIRED') return 'Token aktivasi sudah expired.'
  if (message === 'TOKEN_INVALID_DURATION') return 'Durasi token aktivasi tidak valid.'
  if (message === 'TOKEN_REVOKED') return 'Token aktivasi sudah tidak aktif.'
  if (message === 'TOKEN_REQUIRED') return 'Token baru wajib diisi.'
  if (message === 'USER_PROFILE_NOT_FOUND') return 'Profil vendor tidak ditemukan.'
  if (message === 'VENDOR_REQUIRED') return 'Perpanjangan token hanya tersedia untuk vendor.'
  if (message === 'SUPER_ADMIN_REQUIRED') return 'Hanya Super Admin yang bisa membuat token aktivasi.'
  if (message === 'PACKAGE_NAME_REQUIRED') return 'Nama paket wajib diisi.'
  if (message === 'PACKAGE_PRICE_INVALID') return 'Harga paket harus lebih dari atau sama dengan 0.'
  if (message === 'PACKAGE_CATEGORY_REQUIRED') return 'Kategori paket wajib dipilih.'
  if (message === 'PACKAGE_CATEGORY_NAME_REQUIRED') return 'Nama kategori wajib diisi.'
  if (message === 'PACKAGE_CATEGORY_IN_USE') return 'Kategori masih digunakan oleh paket dan tidak bisa dihapus.'
  if (message === 'INVALID_FILE_TYPE') return 'Format file tidak didukung.'
  if (message === 'FILE_TOO_LARGE') return 'Ukuran file terlalu besar.'
  if (message === 'R2_LOGO_API_URL_MISSING') return 'URL API logo R2 belum dikonfigurasi.'
  if (message.includes('document') && message.includes('maximum')) return 'Data profil terlalu besar. Coba hapus/ulang tanda tangan atau gunakan logo lebih kecil.'
  if (message.includes('Ukuran foto pricelist')) return message
  if (message.includes('Ukuran logo')) return message
  if (message.includes('File vendor')) return message
  if (message.includes('Format logo')) return message
  if (message.includes('R2_PUBLIC_BASE_URL')) return message
  if (message.includes('Logo vendor')) return message

  return 'Terjadi kesalahan. Silakan coba lagi.'
}
