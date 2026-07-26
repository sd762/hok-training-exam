import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchExamResults, type ExamResultRow } from './api'

const STAGE_LABELS: Record<string, string> = { '1m': '到職滿1個月', '3m': '到職滿3個月', '1y': '到職滿1年' }
const LANG_LABELS: Record<string, string> = { 'zh-TW': '繁體中文', vi: '越南文', id: '印尼文' }

const STATUS_LABELS: Record<string, string> = {
  confirmed_passed: '已確認通過',
  pending_review: '待核對',
  flagged: '存疑保留',
  failed: '不及格',
  voided: '已作廢',
}
const STATUS_COLORS: Record<string, string> = {
  confirmed_passed: 'text-status-pass',
  pending_review: 'text-status-pending',
  flagged: 'text-status-flagged',
  failed: 'text-status-fail',
  voided: 'text-ink-muted',
}

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function ExamResultsTab({ institutions }: { institutions: Institution[] }) {
  const [institutionId, setInstitutionId] = useState<number | ''>('')
  const [year, setYear] = useState<number | ''>('')
  const [half, setHalf] = useState<'' | 1 | 2>('')
  const [quarter, setQuarter] = useState<'' | 1 | 2 | 3 | 4>('')
  const [stageCode, setStageCode] = useState<'' | '1m' | '3m' | '1y'>('')
  const [rows, setRows] = useState<ExamResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(
        await fetchExamResults({
          institutionId: institutionId || undefined,
          year: year || undefined,
          half: half || undefined,
          quarter: quarter || undefined,
          stageCode: stageCode || undefined,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [institutionId, year, half, quarter, stageCode])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={institutionId} onChange={(e) => setInstitutionId(e.target.value ? Number(e.target.value) : '')} className="max-w-xs">
          <option value="">全部機構</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} className="max-w-32">
          <option value="">全部年度</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={half} onChange={(e) => setHalf(e.target.value ? (Number(e.target.value) as 1 | 2) : '')} className="max-w-32">
          <option value="">全年</option>
          <option value={1}>上半年</option>
          <option value={2}>下半年</option>
        </Select>
        <Select
          value={quarter}
          onChange={(e) => setQuarter(e.target.value ? (Number(e.target.value) as 1 | 2 | 3 | 4) : '')}
          className="max-w-32"
        >
          <option value="">不分季</option>
          <option value={1}>第1季</option>
          <option value={2}>第2季</option>
          <option value={3}>第3季</option>
          <option value={4}>第4季</option>
        </Select>
        <Select value={stageCode} onChange={(e) => setStageCode(e.target.value as never)} className="max-w-xs">
          <option value="">全部階段</option>
          <option value="1m">到職滿1個月</option>
          <option value="3m">到職滿3個月</option>
          <option value="1y">到職滿1年</option>
        </Select>
      </div>

      {error && <p className="text-sm text-status-fail">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          載入中…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">機構</th>
                <th className="px-3 py-2 font-medium">階段</th>
                <th className="px-3 py-2 font-medium">語言</th>
                <th className="px-3 py-2 font-medium">狀態</th>
                <th className="px-3 py-2 font-medium">筆數</th>
                <th className="px-3 py-2 font-medium">平均分數</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-muted">
                    無資料
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{r.institution_name ?? '(未指定)'}</td>
                  <td className="px-3 py-2">{STAGE_LABELS[r.stage_code] ?? r.stage_code}</td>
                  <td className="px-3 py-2">{LANG_LABELS[r.lang_code] ?? r.lang_code}</td>
                  <td className={`px-3 py-2 font-medium ${STATUS_COLORS[r.status] ?? ''}`}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </td>
                  <td className="px-3 py-2">{r.attempt_count}</td>
                  <td className="px-3 py-2">{r.avg_score ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
