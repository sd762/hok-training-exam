import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchAttemptDistribution, type AttemptDistributionRow } from './api'
import { BarChart } from './BarChart'
import { LANG_SERIES } from './langSeries'
import { STATUS_SERIES } from './statusSeries'

const BUCKET_ORDER = ['1次', '2次', '3次', '4次以上']

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i)

/**
 * 應考次數分布——取代原本只有「平均嘗試次數」單一數字看不出分布形狀的問題。
 * 例如平均1.8次，看不出是「大家都剛好2次」還是「一半1次過、一半3次以上」，
 * 用分布圖才看得出這種洞察。依最終結果狀態上色，跟考測結果分析用同一組狀態色，
 * 才看得出「需要補考很多次的人，最後是通過還是被判定違規」。
 */
export default function AttemptDistributionTab({ institutions }: { institutions: Institution[] }) {
  const [institutionId, setInstitutionId] = useState<number | ''>('')
  const [year, setYear] = useState<number | ''>('')
  const [half, setHalf] = useState<'' | 1 | 2>('')
  const [quarter, setQuarter] = useState<'' | 1 | 2 | 3 | 4>('')
  const [stageCode, setStageCode] = useState<'' | '1m' | '3m' | '1y'>('')
  const [langCode, setLangCode] = useState('')
  const [rows, setRows] = useState<AttemptDistributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(
        await fetchAttemptDistribution({
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

  const chart = useMemo(() => {
    const groups = BUCKET_ORDER.map((b) => ({ key: b, label: b }))
    const values: Record<string, Record<string, number>> = {}
    for (const b of BUCKET_ORDER) values[b] = {}
    for (const r of rows) {
      values[r.attempt_bucket] ??= {}
      values[r.attempt_bucket][r.status] = (values[r.attempt_bucket][r.status] ?? 0) + r.staff_count
    }
    const activeStatuses = new Set(rows.map((r) => r.status))
    const series = STATUS_SERIES.filter((s) => activeStatuses.has(s.key))
    return { groups, series, values }
  }, [rows])

  const total = rows.reduce((sum, r) => sum + r.staff_count, 0)

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">
        每個人在同一階段只計一次（依最終結果，不論補考幾次）；「次數」是這個人總共考了幾次才落到目前結果。
      </p>
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
            <h3 className="mb-2 text-sm font-medium text-ink">應考次數分布（共 {total} 人，依最終結果上色）</h3>
            <BarChart
              groups={chart.groups}
              series={chart.series}
              values={chart.values}
              valueSuffix=" 人"
              stacked
              orientation="vertical"
            />
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">應考次數</th>
                  <th className="px-3 py-2 font-medium">最終結果</th>
                  <th className="px-3 py-2 font-medium">人數</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-ink-muted">
                      無資料
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{r.attempt_bucket}</td>
                    <td className="px-3 py-2">{STATUS_SERIES.find((s) => s.key === r.status)?.label ?? r.status}</td>
                    <td className="px-3 py-2">{r.staff_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
