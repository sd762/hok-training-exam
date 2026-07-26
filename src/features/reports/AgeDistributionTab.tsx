import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchAgeDistribution, type AgeDistributionRow } from './api'
import { BarChart } from './BarChart'
import { LANG_LABELS, LANG_SERIES } from './langSeries'

const AGE_BUCKET_ORDER = ['20-29', '30-39', '40-49', '50-59', '60+']

export default function AgeDistributionTab({ institutions }: { institutions: Institution[] }) {
  const [institutionId, setInstitutionId] = useState<number | ''>('')
  const [langCode, setLangCode] = useState('')
  const [rows, setRows] = useState<AgeDistributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchAgeDistribution(institutionId || undefined, langCode || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [institutionId, langCode])

  useEffect(() => {
    void reload()
  }, [reload])

  // 未篩選機構＝全院/跨機構總況；篩選機構＝單一機構深入。
  // 未篩選國籍＝跨國籍比較；篩選國籍＝單一國籍深入。年齡分組固定順序當 x 軸，國籍固定色當系列。
  const chart = useMemo(() => {
    const groups = AGE_BUCKET_ORDER.map((b) => ({ key: b, label: b }))
    const values: Record<string, Record<string, number>> = {}
    for (const b of AGE_BUCKET_ORDER) values[b] = {}
    for (const r of rows) {
      values[r.age_bucket] ??= {}
      values[r.age_bucket][r.lang_code] = (values[r.age_bucket][r.lang_code] ?? 0) + r.count
    }
    const activeLangs = new Set(rows.map((r) => r.lang_code))
    const series = LANG_SERIES.filter((s) => activeLangs.has(s.key))
    return { groups, series, values }
  }, [rows])

  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">
        僅計入在職且已填寫出生日期的學員。可分別篩選機構、國籍，觀察全院／單一機構的年齡分布，以及各國籍間的年齡差異。
      </p>
      <div className="flex flex-wrap gap-3 print:hidden">
        <Select value={institutionId} onChange={(e) => setInstitutionId(e.target.value ? Number(e.target.value) : '')} className="max-w-xs">
          <option value="">全部機構（全院總況）</option>
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
            <h3 className="mb-2 text-sm font-medium text-ink">年齡分布（共 {total} 人）</h3>
            <BarChart groups={chart.groups} series={chart.series} values={chart.values} valueSuffix=" 人" stacked />
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">年齡區間</th>
                  <th className="px-3 py-2 font-medium">國籍</th>
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
                    <td className="px-3 py-2">{r.age_bucket}</td>
                    <td className="px-3 py-2">{LANG_LABELS[r.lang_code] ?? r.lang_code}</td>
                    <td className="px-3 py-2">{r.count}</td>
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
