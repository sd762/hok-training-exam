import { GraduationCap, LogOut } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ROLE_LABELS, canViewReports, canWrite, type UserRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  /** 哪些角色看得到這個項目；未列出者不顯示 */
  visibleTo: (role: UserRole) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/reports', label: '分析報表', visibleTo: canViewReports },
  { to: '/review', label: '審查', visibleTo: canWrite },
  { to: '/staff', label: '學員管理', visibleTo: canWrite },
  { to: '/questions', label: '題庫管理', visibleTo: canWrite },
  { to: '/institutions', label: '機構管理', visibleTo: canWrite },
  { to: '/admins', label: '管理者帳號', visibleTo: canWrite },
  { to: '/notifications', label: '通知設定', visibleTo: canWrite },
  { to: '/help', label: '使用說明', visibleTo: () => true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  if (!profile) return null

  const items = NAV_ITEMS.filter((item) => item.visibleTo(profile.role))

  async function handleSignOut() {
    await signOut()
    // 同一台裝置換下一個人登入前，先把網址重設回首頁（見 LoginPage 的同一則註解）
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="bg-brand-600 text-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-6 shrink-0" aria-hidden />
            <span className="font-semibold tracking-wide">清福長照集團教育訓練測考系統</span>
          </div>

          <nav className="hidden gap-1 sm:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-brand-800' : 'hover:bg-brand-700',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm">
              {profile.display_name}（{ROLE_LABELS[profile.role]}）
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm transition-colors hover:bg-brand-800"
            >
              <LogOut className="size-4" aria-hidden />
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
