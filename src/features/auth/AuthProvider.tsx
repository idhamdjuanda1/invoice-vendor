import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { firebaseAuth } from '../../lib/firebase/client'
import { registerVendorWithFreeTrial } from '../../services/firestore/activationTokens'
import {
  bootstrapSuperAdminProfile,
  createActivationAccessState,
  getAccountBlockedReason,
  getUserProfile,
  validateVendorActivationAccess,
} from '../../services/firestore/userProfiles'
import type { UserProfile } from '../../types/domain'
import type { ActivationAccessState, AuthContextValue, AuthStatus, LoginInput, RegisterInput } from './authTypes'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [activationAccess, setActivationAccess] = useState<ActivationAccessState>(() =>
    createActivationAccessState({ isChecking: true }),
  )

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      setActivationAccess(createActivationAccessState())
      setStatus('unauthenticated')
      return null
    }

    setStatus('loading')
    setActivationAccess(createActivationAccessState({ isChecking: true }))

    try {
      const bootstrappedProfile = await bootstrapSuperAdminProfile(user)
      const loadedProfile = bootstrappedProfile ?? (await getUserProfile(user.uid))
      const loadedActivationAccess = await validateVendorActivationAccess(loadedProfile)

      setProfile(loadedProfile)
      setActivationAccess(loadedActivationAccess)
      setStatus('authenticated')
      return loadedProfile
    } catch (error) {
      console.warn('User profile could not be loaded.', error)
      setProfile(null)
      setActivationAccess(
        createActivationAccessState({
          isBlocked: true,
          code: 'missing_profile',
          message: 'Profil Firestore belum tersedia atau tidak bisa divalidasi.',
        }),
      )
      setStatus('authenticated')
      return null
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user)
      await loadProfile(user)
    })

    return unsubscribe
  }, [loadProfile])

  const login = useCallback(
    async ({ email, password }: LoginInput) => {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
      setFirebaseUser(credential.user)
      return loadProfile(credential.user)
    },
    [loadProfile],
  )

  const registerVendor = useCallback(
    async (input: RegisterInput) => {
      await registerVendorWithFreeTrial(input)
      await loadProfile(firebaseAuth.currentUser)
    },
    [loadProfile],
  )

  const logout = useCallback(async () => {
    await signOut(firebaseAuth)
    setFirebaseUser(null)
    setProfile(null)
    setActivationAccess(createActivationAccessState())
    setStatus('unauthenticated')
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(firebaseAuth.currentUser)
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(() => {
    const accountBlockedReason = getAccountBlockedReason(profile)

    return {
      firebaseUser,
      profile,
      status,
      isSuperAdmin: profile?.role === 'super_admin',
      isVendor: profile?.role === 'user',
      isFreelance: profile?.role === 'freelance',
      accountBlockedReason,
      activationAccess,
      login,
      registerVendor,
      logout,
      refreshProfile,
    }
  }, [activationAccess, firebaseUser, login, logout, profile, refreshProfile, registerVendor, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
