import type { User } from 'firebase/auth'
import type { UserProfile } from '../../types/domain'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type LoginInput = {
  email: string
  password: string
}

export type RegisterInput = {
  name: string
  email: string
  password: string
  activationToken: string
}

export type ActivationAccessState = {
  isChecking: boolean
  isBlocked: boolean
  code: 'active' | 'expired' | 'invalid' | 'inactive' | 'suspended' | 'deleted' | 'missing_profile' | null
  message: string | null
  currentToken: string | null
}

export type AuthContextValue = {
  firebaseUser: User | null
  profile: UserProfile | null
  status: AuthStatus
  isSuperAdmin: boolean
  isVendor: boolean
  accountBlockedReason: string | null
  activationAccess: ActivationAccessState
  login: (input: LoginInput) => Promise<void>
  registerVendor: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}
