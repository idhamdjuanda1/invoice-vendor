import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-muted px-5 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-app-gold">404</p>
      <h1 className="text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-sm text-neutral-600">Route ini belum tersedia di scaffold Phase 1.</p>
      <Link to="/dashboard">
        <Button>Kembali ke dashboard</Button>
      </Link>
    </main>
  )
}
