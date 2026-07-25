import { Loader2 } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { AppShell } from '@/components/AppShell'
import { canWrite } from '@/lib/roles'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import InstitutionsPage from '@/features/institutions/InstitutionsPage'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

function AppRoutes() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        載入中…
      </div>
    )
  }

  if (!profile) return <LoginPage />

  const writable = canWrite(profile.role)

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {writable && <Route path="/institutions" element={<InstitutionsPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
