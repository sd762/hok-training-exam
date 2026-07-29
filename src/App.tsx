import { lazy, Suspense, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { AppShell } from '@/components/AppShell'
import { canViewReports, canWrite } from '@/lib/roles'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import HelpPage from '@/pages/HelpPage'
import InstitutionsPage from '@/features/institutions/InstitutionsPage'
import StaffPage from '@/features/staff/StaffPage'
import QuestionsPage from '@/features/questions/QuestionsPage'
import ReviewPage from '@/features/review/ReviewPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import ReportsPage from '@/features/reports/ReportsPage'
import AdminsPage from '@/features/admins/AdminsPage'

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
  const navigate = useNavigate()
  const lastProfileId = useRef<string | null>(null)

  // HashRouter 的網址不會隨登入/登出自動重設。不管是「登入者換人」還是「登出」，
  // 只要偵測到 profile 有這兩種轉變，就把網址強制重設回首頁——登出當下就處理，
  // 不要只靠下次登入時再導頁，避免網址列停在登出前那一頁造成混淆。
  useEffect(() => {
    const wasLoggedIn = lastProfileId.current !== null
    if (profile && profile.id !== lastProfileId.current) {
      navigate('/', { replace: true }) // 登入、或換了另一個人登入
    } else if (!profile && wasLoggedIn) {
      navigate('/', { replace: true }) // 登出
    }
    lastProfileId.current = profile?.id ?? null
  }, [profile, navigate])

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
  const canReport = canViewReports(profile.role)

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/help" element={<HelpPage />} />
        {canReport && <Route path="/reports" element={<ReportsPage />} />}
        {writable && <Route path="/review" element={<ReviewPage />} />}
        {writable && <Route path="/notifications" element={<NotificationsPage />} />}
        {writable && <Route path="/institutions" element={<InstitutionsPage />} />}
        {writable && <Route path="/staff" element={<StaffPage />} />}
        {writable && <Route path="/questions" element={<QuestionsPage />} />}
        {writable && <Route path="/admins" element={<AdminsPage />} />}
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
