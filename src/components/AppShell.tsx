import { GraduationCap, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ROLE_LABELS, canWrite, type UserRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  /** 哪些角色看得到這個項目；未列出者不顯示 */
  visibleTo: (role: UserRole) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/institutions', label: '機構管理', visibleTo: canWrite },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  if (!profile) return null

  const items = NAV_ITEMS.filter((item) => item.visibleTo(profile.role))

  return (
    <div className="min-h-screen">
      <header className="bg-brand-600 text-white">
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
              onClick={signOut}
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
