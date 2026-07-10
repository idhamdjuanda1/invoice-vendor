import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'

export function RegisterPage() {
  const { registerVendor } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (window.location.hash !== '#register-form') return
    window.requestAnimationFrame(() => {
      document.getElementById('register-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setIsSubmitting(true)

    try {
      await registerVendor({ name, email, password })
      setSuccess('Akun vendor berhasil dibuat dengan Free Trial 1 hari.')
    } catch (registerError) {
      setError(getFriendlyAuthError(registerError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-xl scroll-mt-6" id="register-form">
      <CardHeader>
        <h1 className="text-2xl font-bold">Registrasi Vendor</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Buat akun dan gunakan seluruh fitur gratis selama 1 hari. Token baru diperlukan setelah trial berakhir.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Input
            id="name"
            label="Nama"
            onChange={(event) => setName(event.target.value)}
            placeholder="Nama pemilik atau PIC"
            required
            value={name}
          />
          <Input
            autoComplete="email"
            id="email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vendor@email.com"
            required
            type="email"
            value={email}
          />
          <Input
            autoComplete="new-password"
            id="password"
            label="Password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimal 8 karakter"
            required
            type="password"
            value={password}
          />
          <Input
            autoComplete="new-password"
            id="confirmPassword"
            label="Konfirmasi password"
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger">{error}</p> : null}
          {success ? <p className="rounded-md bg-green-50 p-3 text-sm text-app-success">{success}</p> : null}
          <Button disabled={isSubmitting}>{isSubmitting ? 'Memproses...' : 'Buat akun'}</Button>
        </form>
        <Link className="text-center text-sm font-semibold text-app-gold" to="/login">
          Sudah punya akun
        </Link>
      </CardContent>
    </Card>
  )
}
