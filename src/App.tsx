import { Loader2 } from 'lucide-react'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}

function Routes() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        載入中…
      </div>
    )
  }

  return profile ? <HomePage /> : <LoginPage />
}
