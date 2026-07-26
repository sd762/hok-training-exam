import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchStaffSummary, type StaffSummaryRow } from './api'
import { BarChart } from './BarChart'
import { DonutChart } from './DonutChart'
import { LANG_LABELS, LANG_SERIES } from './langSeries'

export default function StaffSummaryTab({ institutions }: { institutions: Institution[] }) {
  const [institutionId, setInstitutionId] = useState<number | ''>('')
  const [langCode, setLangCode] = useState('')
  const [rows, setRows] = useState<StaffSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchStaffSummary(institutionId || undefined, langCode || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [institutionId, langCode])

  useEffect(() => {
    void reload()
  }, [reload])

  // 未篩選機構＝跨機構比較（全院總況）；篩選機構＝單一機構深入。
  // 未篩選國籍＝跨國籍比較；篩選國籍＝單一國籍深入。兩個篩選可任意組合。
  const chart = useMemo(() => {
    const groupMap = new Map<string, string>()
    const values: Record<string, Record<string, number>> = {}
    for (const r of rows) {
      const gKey = String(r.institution_id ?? 'none')
      groupMap.set(gKey, r.institution_name ?? '(未指定機構)')
      values[gKey] ??= {}
      values[gKey][r.lang_code] = (values[gKey][r.lang_code] ?? 0) + r.active_count
    }
    const groups = [...groupMap.entries()].map(([key, label]) => ({ key, label }))
    const activeLangs = new Set(rows.map((r) => r.lang_code))
    const series = LANG_SERIES.filter((s) => activeLangs.has(s.key))
    return { groups, series, values }
  }, [rows])

  // 單一機構＝只有一個快照，用甜甜圈圖看國籍佔比最直觀；
  // 跨機構比較則要能比較多個機構的大小，改用堆疊長條圖（見上）。
  const donutSlices = useMemo(() => {
    const totalsByLang = new Map<string, number>()
    for (const r of rows) {
      totalsByLang.set(r.lang_code, (totalsByLang.get(r.lang_code) ?? 0) + r.active_count)
    }
    return LANG_SERIES.filter((s) => (totalsByLang.get(s.key) ?? 0) > 0).map((s) => ({
      key: s.key,
      label: s.label,
      value: totalsByLang.get(s.key) ?? 0,
      color: s.color,
    }))
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
              在職人數——{institutionId ? '該機構國籍佔比' : '各機構國籍比例'}
            </h3>
            {institutionId ? (
              <DonutChart slices={donutSlices} valueSuffix=" 人" centerLabel="在職人數" />
            ) : (
              <BarChart groups={chart.groups} series={chart.series} values={chart.values} valueSuffix=" 人" stacked />
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">機構</th>
                  <th className="px-3 py-2 font-medium">國籍</th>
                  <th className="px-3 py-2 font-medium">總人數</th>
                  <th className="px-3 py-2 font-medium">在職人數</th>
                  <th className="px-3 py-2 font-medium">平均年齡</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-ink-muted">
                      無資料
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{r.institution_name ?? '(未指定)'}</td>
                    <td className="px-3 py-2">{LANG_LABELS[r.lang_code] ?? r.lang_code}</td>
                    <td className="px-3 py-2">{r.total_count}</td>
                    <td className="px-3 py-2">{r.active_count}</td>
                    <td className="px-3 py-2">{r.avg_age ?? '-'}</td>
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
