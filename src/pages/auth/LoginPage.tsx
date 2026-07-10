import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'

export function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as { error?: string } | null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(routeState?.error ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const profile = await login({ email, password })
      const nextPath = profile?.role === 'super_admin'
        ? '/admin'
        : profile?.role === 'freelance'
          ? profile.freelanceRoles.includes('ACCOUNTING') ? '/accounting' : '/freelance'
          : '/dashboard'
      navigate(nextPath, { replace: true })
    } catch (loginError) {
      setError(getFriendlyAuthError(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-2 text-sm text-neutral-600">Masuk dengan email dan password.</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-4" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            id="password"
            label="Password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimal 8 karakter"
            required
            type="password"
            value={password}
          />
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger">{error}</p> : null}
          <Button disabled={isSubmitting} icon={<Lock size={16} />}>
            {isSubmitting ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>
        <Link className="text-center text-sm font-semibold text-app-gold" to="/register">
          Daftar dan coba gratis 1 hari
        </Link>
      </CardContent>
    </Card>
  )
}
