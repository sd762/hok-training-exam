import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { AppShell } from '@/components/AppShell'
import { canWrite } from '@/lib/roles'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import InstitutionsPage from '@/features/institutions/InstitutionsPage'
import StaffPage from '@/features/staff/StaffPage'
import QuestionsPage from '@/features/questions/QuestionsPage'

// 監考用的 @mediapipe/tasks-vision 體積不小，只有學員進考試畫面才需要，延後載入
const ExamPage = lazy(() => import('@/features/exam/ExamPage'))

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
        {writable && <Route path="/staff" element={<StaffPage />} />}
        {writable && <Route path="/questions" element={<QuestionsPage />} />}
        {profile.role === 'staff' && (
          <Route
            path="/exam"
            element={
              <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden /></div>}>
                <ExamPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
