import {
  Banknote,
  Building2,
  Boxes,
  FileBarChart,
  FileSignature,
  FileText,
  Home,
  LogOut,
  Receipt,
  Shield,
  Tags,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '../ui/Button'
import { useAuth } from '../../features/auth/useAuth'
import { cn } from '../../lib/utils/cn'
import { getBusinessProfile, syncPricelistsWithBusinessProfile } from '../../services/firestore/businessProfiles'
import type { BusinessProfile } from '../../types/domain'

type DashboardLayoutProps = {
  role: 'vendor' | 'admin'
}

const vendorNav = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Profil', href: '/profile', icon: UserRound },
  { label: 'Paket', href: '/packages', icon: Boxes },
  { label: 'Invoice', href: '/invoices', icon: FileText },
  { label: 'Pembayaran', href: '/payments', icon: Banknote },
  { label: 'Kuitansi', href: '/receipts', icon: Receipt },
  { label: 'MOU', href: '/agreements', icon: FileSignature },
  { label: 'Pricelist', href: '/pricelists', icon: Tags },
  { label: 'Export', href: '/export', icon: FileBarChart },
]

const adminNav = [
  { label: 'Admin', href: '/admin', icon: Shield },
  { label: 'Token', href: '/admin/tokens', icon: FileText },
  { label: 'User', href: '/admin/users', icon: Users },
  { label: 'Backup', href: '/admin/backup', icon: Upload },
]

export function DashboardLayout({ role }: DashboardLayoutProps) {
  const navigation = role === 'admin' ? adminNav : vendorNav
  const { logout, profile } = useAuth()
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadBusinessProfile() {
      if (role !== 'vendor' || !profile?.uid) {
        setBusinessProfile(null)
        return
      }

      try {
        const loadedProfile = await getBusinessProfile(profile.uid)
        if (isMounted) setBusinessProfile(loadedProfile)
        if (loadedProfile) {
          void syncPricelistsWithBusinessProfile(profile.uid).catch((error) => {
            console.error('Failed to sync public vendor profile', error)
          })
        }
      } catch {
        if (isMounted) setBusinessProfile(null)
      }
    }

    void loadBusinessProfile()

    return () => {
      isMounted = false
    }
  }, [profile?.uid, role])

  const displayName = role === 'vendor' ? businessProfile?.vendorName || profile?.name || 'Vendor' : profile?.name || 'Super Admin'
  const displayEmail = businessProfile?.email || profile?.email || ''

  return (
    <div className="min-h-screen bg-app-muted">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-app-border bg-white p-5 lg:block">
        <div className="text-xl font-bold text-app-text">Invoice Vendor</div>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-app-gold">
          {role === 'admin' ? 'Super Admin' : 'Vendor'}
        </p>
        <nav className="mt-8 grid gap-1">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-app-muted hover:text-app-text',
                  isActive && 'bg-app-gold-soft text-app-text',
                )
              }
              key={item.href}
              to={item.href}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-app-border bg-white/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                {role === 'vendor' ? (
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-app-border bg-app-muted">
                    {businessProfile?.logoUrl ? (
                      <img alt="Logo vendor" className="size-full object-contain" src={businessProfile.logoUrl} />
                    ) : (
                      <Building2 className="text-neutral-400" size={20} />
                    )}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-app-text">Selamat datang, {displayName}</p>
                  <p className="truncate text-xs text-neutral-500">{displayEmail}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-full border border-app-border px-3 py-1 text-xs font-semibold text-neutral-600 sm:block">
                {profile?.role === 'super_admin' ? 'Super Admin' : 'Vendor'}
              </div>
              <Button
                aria-label="Logout"
                className="h-11 min-h-11 px-3 sm:h-9 sm:min-h-9"
                icon={<LogOut size={16} />}
                onClick={() => void logout()}
                variant="secondary"
              >
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5 pb-32 sm:px-5 sm:py-6 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-20 flex gap-2 overflow-x-auto border-t border-app-border bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] lg:hidden">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                'flex min-w-20 flex-col items-center gap-1 rounded-md px-3 py-2.5 text-[11px] font-medium text-neutral-500',
                isActive && 'bg-app-gold-soft text-app-text',
              )
            }
            key={item.href}
            to={item.href}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
