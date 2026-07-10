import { Banknote, CalendarCheck, Camera, FileText, MessageCircle, UsersRound } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

const highlights = [
  {
    title: 'Invoice & Pembayaran',
    description: 'Kelola invoice, DP, pelunasan, dan kuitansi dengan mudah.',
    icon: FileText,
  },
  {
    title: 'Data Klien',
    description: 'Semua detail acara tersimpan rapi dalam satu tempat.',
    icon: CalendarCheck,
  },
  {
    title: 'Tim & Freelance',
    description: 'Atur fotografer, videografer, editor, dan penugasan tim.',
    icon: UsersRound,
  },
  {
    title: 'WhatsApp Automation',
    description: 'Kirim invoice, reminder, dan informasi acara lebih cepat.',
    icon: MessageCircle,
  },
  {
    title: 'Accounting',
    description: 'Catat pemasukan, pengeluaran, aset, hingga laporan keuangan.',
    icon: Banknote,
  },
]

export function AuthLayout() {
  return (
    <main className="min-h-screen bg-app-muted">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="relative overflow-hidden bg-app-text px-5 py-8 text-white sm:px-8 lg:min-h-screen lg:px-12 lg:py-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-app-gold/20 to-transparent" />
          <div className="relative mx-auto grid max-w-5xl gap-8 lg:min-h-[calc(100vh-5rem)] lg:grid-rows-[auto_1fr_auto]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-black text-app-gold">Invoice Vendor</p>
              </div>
              <div className="hidden rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300 sm:block">
                Wedding & Event Ops
              </div>
            </div>

            <div className="grid content-center gap-8">
              <div className="max-w-3xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-app-gold">
                  <Camera size={14} />
                  Sistem operasional vendor wedding & event
                </div>
                <h1 className="text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">Invoice Vendor</h1>
                <p className="mt-4 text-2xl font-bold leading-snug text-white sm:text-3xl">
                  Sibuk motret, bukan sibuk ngurus admin.
                </p>
                <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
                  Kelola invoice, klien, jadwal tim, editor, hingga accounting dalam satu aplikasi yang dibuat khusus untuk vendor wedding & event.
                </p>
                <Link
                  className="mt-7 inline-flex min-h-12 items-center justify-center rounded-md bg-app-gold px-5 py-3 text-sm font-black text-app-text transition hover:bg-app-gold/90"
                  to="/register#register-form"
                >
                  Mulai Trial Gratis 1 Hari
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {highlights.map((feature) => (
                  <div className="rounded-md border border-white/10 bg-white/[0.04] p-4" key={feature.title}>
                    <feature.icon className="text-app-gold" size={20} />
                    <p className="mt-3 font-bold">{feature.title}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-neutral-500">
              Dibuat ringan, responsif, dan fokus untuk alur kerja vendor Indonesia.
            </p>
          </div>
        </section>

        <section id="auth-panel" className="flex scroll-mt-6 items-start justify-center px-4 py-6 sm:px-5 sm:py-10 lg:min-h-screen lg:items-center">
          <Outlet />
        </section>
      </div>
    </main>
  )
}
