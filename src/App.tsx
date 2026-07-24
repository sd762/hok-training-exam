import { GraduationCap } from 'lucide-react'

/**
 * 骨架首頁（工單 01）。
 * 目的是驗證建置與部署管線可用，並確立品牌視覺基調；
 * 實際的登入與各角色頁面分別在工單 03 之後建立。
 */
export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-brand-600 text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
          <GraduationCap className="size-7" aria-hidden />
          <h1 className="text-lg font-semibold tracking-wide sm:text-xl">
            清福長照集團教育訓練測考系統
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="rounded-xl border border-line bg-surface p-8 shadow-sm">
          <h2 className="text-xl font-semibold">系統建置中</h2>
          <p className="mt-2 text-ink-muted">
            前端骨架與部署管線已就緒，功能將依工單順序陸續上線。
          </p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusChip label="已確認通過" className="text-status-pass" />
            <StatusChip label="待核對" className="text-status-pending" />
            <StatusChip label="存疑保留" className="text-status-flagged" />
            <StatusChip label="不及格" className="text-status-fail" />
          </dl>
          <p className="mt-4 text-sm text-ink-muted">
            上列為考測狀態的標準燈號色，與頁首的品牌深紅分屬不同色票，避免混淆。
          </p>
        </section>
      </main>
    </div>
  )
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted px-4 py-3">
      <span className={`text-sm font-medium ${className}`}>● {label}</span>
    </div>
  )
}
