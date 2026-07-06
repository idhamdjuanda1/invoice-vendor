import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="grid min-h-screen bg-app-muted lg:grid-cols-[1fr_560px]">
      <section className="flex min-h-[240px] flex-col justify-between bg-app-text p-6 text-white sm:min-h-[280px] sm:p-8 lg:min-h-screen lg:p-10">
        <div className="text-lg font-bold text-app-gold">Invoice Vendor</div>
        <div>
          <p className="mt-8 max-w-xl text-2xl font-bold leading-tight sm:text-3xl lg:mt-0 lg:text-4xl">
            Invoice, pembayaran, kuitansi, dan reminder WhatsApp untuk vendor event Indonesia.
          </p>
        </div>
        <p className="text-sm text-neutral-400">Apps by @ IDM Project</p>
      </section>
      <section className="flex items-start justify-center px-4 py-6 sm:px-5 sm:py-10 lg:min-h-screen lg:items-center">
        <Outlet />
      </section>
    </main>
  )
}
