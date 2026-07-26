import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import StaffSummaryTab from './StaffSummaryTab'
import QuestionAccuracyTab from './QuestionAccuracyTab'
import ExamResultsTab from './ExamResultsTab'
import RetentionTab from './RetentionTab'
import { fetchInstitutions, type Institution } from '@/features/institutions/api'

type Tab = 'staff' | 'questions' | 'results' | 'retention'

const TABS: { key: Tab; label: string }[] = [
  { key: 'results', label: '考測結果分析' },
  { key: 'staff', label: '學員分析' },
  { key: 'questions', label: '考題分析' },
  { key: 'retention', label: '人力留任分析' },
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
          {tab === 'retention' && <RetentionTab institutions={institutions} />}
        </Card>
      )}
    </div>
  )
}
