import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchExamResults, type ExamResultRow } from './api'
import { BarChart } from './BarChart'
import { LANG_SERIES } from './langSeries'
import { STATUS_SERIES } from './statusSeries'

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function ExamResultsTab({ institutions }: { institutions: Institution[] }) {
  const [institutionId, setInstitutionId] = useState<number | ''>('')
  const [year, setYear] = useState<number | ''>('')
  const [half, setHalf] = useState<'' | 1 | 2>('')
  const [quarter, setQuarter] = useState<'' | 1 | 2 | 3 | 4>('')
  const [stageCode, setStageCode] = useState<'' | '1m' | '3m' | '1y'>('')
  const [langCode, setLangCode] = useState('')
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
          langCode: langCode || undefined,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [institutionId, year, half, quarter, stageCode, langCode])

  useEffect(() => {
    void reload()
  }, [reload])

  // 每個機構一根柱子，柱子裡依「狀態」堆疊；選定單一機構時 groups 自然只剩一根，
  // 不用另外切換成甜甜圈圖——狀態種類已經到6種，堆疊柱狀圖才安全（見上方註解）。
  const columnChart = useMemo(() => {
    const groupMap = new Map<string, string>()
    const values: Record<string, Record<string, number>> = {}
    for (const r of rows) {
      const gKey = String(r.institution_id ?? 'none')
      groupMap.set(gKey, r.institution_name ?? '(未指定機構)')
      values[gKey] ??= {}
      values[gKey][r.status] = (values[gKey][r.status] ?? 0) + r.staff_count
    }
    const groups = [...groupMap.entries()].map(([key, label]) => ({ key, label }))
    const activeStatuses = new Set(rows.map((r) => r.status))
    const series = STATUS_SERIES.filter((s) => activeStatuses.has(s.key))
    return { groups, series, values }
  }, [rows])

  // 表格收斂成跟圖表一樣的粒度——一個機構一列，不再依階段/國籍/狀態展開，
  // 否則機構一多、表格會變得又長又重複（圖表已經看得出比例，表格只補精確數字）。
  // 要看特定階段/國籍的細節，用上面的篩選縮小範圍即可，不需要在表格裡全部攤開。
  const summaryRows = useMemo(() => {
    const byInstitution = new Map<
      string,
      {
        institutionName: string
        total: number
        passed: number
        failedScore: number
        failedViolation: number
        other: number
        scoreSum: number
        scoreWeight: number
      }
    >()
    for (const r of rows) {
      const key = String(r.institution_id ?? 'none')
      const acc = byInstitution.get(key) ?? {
        institutionName: r.institution_name ?? '(未指定)',
        total: 0,
        passed: 0,
        failedScore: 0,
        failedViolation: 0,
        other: 0,
        scoreSum: 0,
        scoreWeight: 0,
      }
      acc.total += r.staff_count
      if (r.status === 'confirmed_passed') {
        acc.passed += r.staff_count
        if (r.avg_score != null) {
          acc.scoreSum += r.avg_score * r.staff_count
          acc.scoreWeight += r.staff_count
        }
      } else if (r.status === 'failed_score') {
        acc.failedScore += r.staff_count
      } else if (r.status === 'failed_violation') {
        acc.failedViolation += r.staff_count
      } else {
        acc.other += r.staff_count
      }
      byInstitution.set(key, acc)
    }
    return [...byInstitution.entries()].map(([key, acc]) => ({
      key,
      institutionName: acc.institutionName,
      total: acc.total,
      passed: acc.passed,
      failedScore: acc.failedScore,
      failedViolation: acc.failedViolation,
      other: acc.other,
      passRate: acc.total > 0 ? Math.round((acc.passed / acc.total) * 100) : null,
      avgScorePassed: acc.scoreWeight > 0 ? Math.round((acc.scoreSum / acc.scoreWeight) * 10) / 10 : null,
    }))
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Select value={institutionId} onChange={(e) => setInstitutionId(e.target.value ? Number(e.target.value) : '')} className="max-w-xs">
          <option value="">全部機構（跨機構比較）</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Select value={langCode} onChange={(e) => setLangCode(e.target.value)} className="max-w-xs">
          <option value="">全部國籍（跨國籍比較）</option>
          {LANG_SERIES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
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
        <>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">
              測驗結果組成（以人為單位）——{institutionId ? '該機構' : '各機構比較'}
            </h3>
            <BarChart
              groups={columnChart.groups}
              series={columnChart.series}
              values={columnChart.values}
              valueSuffix=" 人"
              stacked
              orientation="vertical"
            />
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">機構</th>
                  <th className="px-3 py-2 font-medium">人數</th>
                  <th className="px-3 py-2 font-medium text-status-pass">已確認通過</th>
                  <th className="px-3 py-2 font-medium text-status-fail">測驗未達標</th>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--color-status-violation)' }}>
                    考試紀律違規
                  </th>
                  <th className="px-3 py-2 font-medium" title="待核對/存疑保留/已作廢，尚無最終結果">
                    其他
                  </th>
                  <th className="px-3 py-2 font-medium">及格率（人）</th>
                  <th className="px-3 py-2 font-medium">平均分數（通過者）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summaryRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-ink-muted">
                      無資料
                    </td>
                  </tr>
                )}
                {summaryRows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2">{r.institutionName}</td>
                    <td className="px-3 py-2">{r.total}</td>
                    <td className="px-3 py-2 text-status-pass">{r.passed}</td>
                    <td className="px-3 py-2 text-status-fail">{r.failedScore}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-status-violation)' }}>
                      {r.failedViolation}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{r.other}</td>
                    <td className="px-3 py-2 font-medium">{r.passRate ?? '-'}%</td>
                    <td className="px-3 py-2">{r.avgScorePassed ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-muted">
            「測驗未達標」是分數沒到及格線；「考試紀律違規」是監考機制自動中止（人臉消失3次或切換視窗2次），兩者都計入不及格但原因不同。表格已彙總成每機構一列（與上方圖表同一層級）；要看特定階段或國籍的細節，用上方篩選縮小範圍即可。正式及格率一律以「人」為單位計算，同一人補考多次只計最終結果一次。
          </p>
        </>
      )}
    </div>
  )
}
