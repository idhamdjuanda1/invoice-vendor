import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { FreelanceRole, UserRole } from '../../types/domain'
import { TokenExpiredModal } from './TokenExpiredModal'
import { useAuth } from './useAuth'

type ProtectedRouteProps = {
  allowedRoles: UserRole[]
  requiredFreelanceRole?: FreelanceRole
  children: ReactNode
}

export function ProtectedRoute({ allowedRoles, requiredFreelanceRole, children }: ProtectedRouteProps) {
  const { activationAccess, firebaseUser, profile, status, accountBlockedReason } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-app-muted px-5 text-center">
        <div>
          <p className="text-sm font-semibold text-app-gold">Invoice Vendor</p>
          <p className="mt-2 text-sm text-neutral-600">Memeriksa sesi...</p>
        </div>
      </main>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile) {
    return <Navigate to="/login" replace state={{ error: 'Profil Firestore belum tersedia.' }} />
  }

  if (accountBlockedReason) {
    if (profile?.role === 'user' && ['expired', 'invalid'].includes(String(activationAccess.code))) {
      return <TokenExpiredModal />
    }

    return <Navigate to="/login" replace state={{ error: accountBlockedReason }} />
  }

  if (profile.role === 'user' && activationAccess.isBlocked && ['expired', 'invalid'].includes(String(activationAccess.code))) {
    return <TokenExpiredModal />
  }

  if (!allowedRoles.includes(profile.role)) {
    const freelancePath = profile.role === 'freelance' && profile.freelanceRoles.includes('ACCOUNTING') ? '/accounting' : '/freelance'
    return <Navigate to={profile.role === 'super_admin' ? '/admin' : profile.role === 'freelance' ? freelancePath : '/dashboard'} replace />
  }

  if (profile.role === 'freelance') {
    const hasAccountingRole = profile.freelanceRoles.includes('ACCOUNTING')
    const hasOperationalRole = profile.freelanceRoles.some((role) => role !== 'ACCOUNTING')
    if (requiredFreelanceRole && !profile.freelanceRoles.includes(requiredFreelanceRole)) {
      return <Navigate to={hasAccountingRole ? '/accounting' : '/freelance'} replace />
    }
    if (!requiredFreelanceRole && hasAccountingRole && !hasOperationalRole && location.pathname.startsWith('/freelance')) {
      return <Navigate to="/accounting" replace />
    }
  }

  return children
}
