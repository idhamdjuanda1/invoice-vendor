import { useEffect, useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { firestoreCollections } from '../../constants/firestore'
import { firebaseAuth, firestore } from '../../lib/firebase/client'
import { freelanceTypeLabels, getFreelanceInviteByToken, markFreelanceInviteAccepted } from '../../services/firestore/freelancers'
import type { FreelanceInviteRecord } from '../../types/domain'

export function FreelanceActivatePage() {
  const { token } = useParams()
  const [invite, setInvite] = useState<FreelanceInviteRecord | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadInvite() {
      if (!token) return
      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedInvite = await getFreelanceInviteByToken(token)
        setInvite(loadedInvite)
        if (!loadedInvite || loadedInvite.status !== 'PENDING') {
          setErrorMessage('Link aktivasi tidak ditemukan atau sudah digunakan.')
        }
      } catch (error) {
        console.error('Failed to load freelance invite', error)
        setErrorMessage('Link aktivasi belum bisa dimuat.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadInvite()
  }, [token])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!invite) return

    if (password.length < 6) {
      setErrorMessage('Password minimal 6 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi password belum sama.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, invite.email, password)
      await updateProfile(credential.user, { displayName: invite.fullName })
      await setDoc(doc(firestore, firestoreCollections.users, credential.user.uid), {
        uid: credential.user.uid,
        name: invite.fullName,
        email: invite.email,
        role: 'freelance',
        vendorId: invite.userId,
        freelancerId: invite.freelancerId,
        freelanceRoles: invite.roles,
        isActive: true,
        isSuspended: false,
        activatedAt: serverTimestamp(),
        activationExpiresAt: null,
        activationTokenId: null,
        deletedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await markFreelanceInviteAccepted(invite, credential.user.uid)
      setSuccessMessage('Akun freelance berhasil aktif. Silakan login.')
    } catch (error) {
      console.error('Failed to activate freelance account', error)
      const code = error instanceof Error ? error.message : ''
      setErrorMessage(code.includes('email-already-in-use') ? 'Email ini sudah terdaftar. Silakan login.' : 'Akun belum bisa diaktifkan.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-xl place-items-center bg-app-muted px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-gold">Invoice Vendor</p>
          <h1 className="mt-2 text-2xl font-bold">Aktivasi Akun Freelance</h1>
          {invite ? (
            <p className="mt-1 text-sm text-neutral-500">
              {invite.fullName} - {invite.roles.map((role) => freelanceTypeLabels[role]).join(', ')}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={16} />
              Memuat undangan...
            </div>
          ) : successMessage ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 size={16} />
                {successMessage}
              </div>
              <Link to="/login">
                <Button className="w-full">Login</Button>
              </Link>
            </div>
          ) : invite && invite.status === 'PENDING' ? (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              {errorMessage ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
              <Input label="Email" value={invite.email} disabled />
              <Input label="Password Baru" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <Input label="Konfirmasi Password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              <Button disabled={isSaving} icon={isSaving ? <Loader2 className="animate-spin" size={16} /> : undefined}>
                {isSaving ? 'Mengaktifkan...' : 'Aktifkan Akun'}
              </Button>
            </form>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
