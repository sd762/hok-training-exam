import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import StaffSummaryTab from './StaffSummaryTab'
import QuestionAccuracyTab from './QuestionAccuracyTab'
import ExamResultsTab from './ExamResultsTab'
import AgeDistributionTab from './AgeDistributionTab'
import { fetchInstitutions, type Institution } from '@/features/institutions/api'

type Tab = 'staff' | 'questions' | 'results' | 'demographics'

const TABS: { key: Tab; label: string }[] = [
  { key: 'results', label: '考測結果分析' },
  { key: 'staff', label: '學員分析' },
  { key: 'questions', label: '考題分析' },
  { key: 'demographics', label: '國籍與年齡分布' },
]

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('results')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInstitutions()
      .then(setInstitutions)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">分析報表</h1>
        <p className="mt-1 text-sm text-ink-muted">
          每個分頁都可用「機構」「國籍」兩個篩選切換分析範圍：兩者都不篩＝全院總況；
          留空其中一個＝跨機構或跨國籍比較；篩選其一＝單一機構或單一國籍的深入分析。
          機構管理者只會看到自己機構的資料；只有「已確認通過」計入正式及格數字，待核對/存疑保留分開列出。
        </p>
      </div>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm',
              tab === t.key ? 'border-b-2 border-brand-600 font-medium text-brand-600' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          載入中…
        </div>
      ) : (
        <Card className="p-5">
          {tab === 'staff' && <StaffSummaryTab institutions={institutions} />}
          {tab === 'questions' && <QuestionAccuracyTab />}
          {tab === 'results' && <ExamResultsTab institutions={institutions} />}
          {tab === 'demographics' && <AgeDistributionTab institutions={institutions} />}
        </Card>
      )}
    </div>
  )
}
