import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchExamResults, type ExamResultRow } from './api'
import { BarChart, type BarSeries } from './BarChart'
import { DonutChart } from './DonutChart'
import { LANG_LABELS, LANG_SERIES } from './langSeries'

const STAGE_LABELS: Record<string, string> = { '1m': '到職滿1個月', '3m': '到職滿3個月', '1y': '到職滿1年' }

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

// 這裡用的是「狀態色」而不是國籍色——這張圖分析的是及格/不及格的組成，
// 顏色代表的是結果狀態，跟其他分頁用國籍上色的圖表是不同的語意，不能混用同一組色票。
const STATUS_SERIES: BarSeries[] = [
  { key: 'confirmed_passed', label: '已確認通過', color: 'var(--color-status-pass)' },
  { key: 'failed', label: '不及格', color: 'var(--color-status-fail)' },
  { key: 'pending_review', label: '待核對', color: 'var(--color-status-pending)' },
  { key: 'flagged', label: '存疑保留', color: 'var(--color-status-flagged)' },
  { key: 'voided', label: '已作廢', color: 'var(--color-ink-muted)' },
]

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

  // 跨機構比較：每個機構一根柱子，柱子裡依「狀態」堆疊（已確認通過/不及格/待核對/存疑保留/已作廢），
  // 才能同時看出各機構的及格率跟不及格率，且是以「人數」為單位（RPC 端已經去重成每人一筆最終結果）。
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

  // 單一機構：只有一個快照，用甜甜圈圖看及格/不及格佔比最直觀。
  // 待核對/存疑保留/已作廢這幾個「還沒有最終結果」的狀態合併成「其他」，
  // 避免甜甜圖切片超過3片（圓餅圖形式的色票只驗證過前3色兩兩夠區分）。
  const donutSlices = useMemo(() => {
    let pass = 0
    let fail = 0
    let other = 0
    for (const r of rows) {
      if (r.status === 'confirmed_passed') pass += r.staff_count
      else if (r.status === 'failed') fail += r.staff_count
      else other += r.staff_count
    }
    return [
      { key: 'confirmed_passed', label: '已確認通過', value: pass, color: 'var(--color-status-pass)' },
      { key: 'failed', label: '不及格', value: fail, color: 'var(--color-status-fail)' },
      { key: 'other', label: '其他（待核對/存疑保留/已作廢）', value: other, color: 'var(--color-ink-muted)' },
    ]
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
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
              及格／不及格（以人為單位）——{institutionId ? '該機構結果佔比' : '各機構比較'}
            </h3>
            {institutionId ? (
              <DonutChart slices={donutSlices} valueSuffix=" 人" centerLabel="總人數" />
            ) : (
              <BarChart
                groups={columnChart.groups}
                series={columnChart.series}
                values={columnChart.values}
                valueSuffix=" 人"
                stacked
                orientation="vertical"
              />
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">機構</th>
                  <th className="px-3 py-2 font-medium">階段</th>
                  <th className="px-3 py-2 font-medium">國籍</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">人數</th>
                  <th className="px-3 py-2 font-medium">平均分數</th>
                  <th className="px-3 py-2 font-medium">平均嘗試次數</th>
                  <th className="px-3 py-2 font-medium" title="以「人次」計算的通過率，僅供參考，不是正式及格率">
                    平均測考通過率（人次）
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-ink-muted">
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
                    <td className="px-3 py-2">{r.staff_count}</td>
                    <td className="px-3 py-2">{r.avg_score ?? '-'}</td>
                    <td className="px-3 py-2">{r.avg_attempts ?? '-'}</td>
                    <td className="px-3 py-2 text-ink-muted">{r.attempt_pass_rate ?? '-'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-muted">
            「平均測考通過率（人次）」是以每一次作答計算的參考指標，一人補考多次會計入多次；正式及格率一律以「人」為單位，見上方圖表與「人數」欄位。
          </p>
        </>
      )}
    </div>
  )
}
