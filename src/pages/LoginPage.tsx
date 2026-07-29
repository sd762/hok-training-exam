import { useState } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [accountCode, setAccountCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(accountCode, password)
      // 登入成功後導回首頁的邏輯集中在 App.tsx 的 AppRoutes（偵測 profile 換人就導頁），
      // 這裡不用另外處理，兩處各自導頁時機容易跟狀態更新卡在一起、反而不可靠
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand-600 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
          <GraduationCap className="size-7" aria-hidden />
          <span className="text-lg font-semibold tracking-wide">
            清福長照集團教育訓練測考系統
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-semibold">登入</h1>
          <p className="mt-1 text-sm text-ink-muted">
            請輸入您的工號與密碼
            <br />
            Nhập mã số nhân viên và mật khẩu
            <br />
            Masukkan nomor pegawai dan kata sandi
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="account-code" className="block text-sm font-medium">
                工號
              </label>
              <input
                id="account-code"
                name="accountCode"
                autoComplete="username"
                required
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                密碼
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-status-fail">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              登入
            </button>
          </form>

          <p className="mt-6 text-xs text-ink-muted">
            忘記密碼請聯絡管理者協助重設。
          </p>
        </div>
      </main>
    </div>
  )
}
