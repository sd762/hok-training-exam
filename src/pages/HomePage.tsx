import { GraduationCap, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ROLE_LABELS } from '@/lib/roles'

/**
 * 登入後的落地頁（工單 03）。
 * 目前僅證明角色資訊已正確自資料庫讀出；
 * 各角色的實際功能頁面於工單 04 之後陸續建立。
 */
export default function HomePage() {
  const { profile, signOut } = useAuth()
  if (!profile) return null

  return (
    <div className="min-h-screen">
      <header className="bg-brand-600 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
          <GraduationCap className="size-7 shrink-0" aria-hidden />
          <span className="text-lg font-semibold tracking-wide">
            清福長照集團教育訓練測考系統
          </span>
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

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="rounded-xl border border-line bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-semibold">登入成功</h1>
          <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-[auto_1fr]">
            <dt className="text-sm text-ink-muted">帳號</dt>
            <dd className="font-medium">{profile.account_code}</dd>
            <dt className="text-sm text-ink-muted">姓名</dt>
            <dd className="font-medium">{profile.display_name}</dd>
            <dt className="text-sm text-ink-muted">角色</dt>
            <dd className="font-medium">{ROLE_LABELS[profile.role]}</dd>
          </dl>
          <p className="mt-8 text-sm text-ink-muted">
            各角色的功能頁面將依工單順序陸續上線。
          </p>
        </section>
      </main>
    </div>
  )
}
