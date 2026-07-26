import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Institution } from '@/features/institutions/api'
import { fetchRetention, type RetentionRow } from './api'

export default function RetentionTab({ institutions }: { institutions: Institution[] }) {
  const [institutionId, setInstitutionId] = useState<number | ''>('')
  const [rows, setRows] = useState<RetentionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchRetention(institutionId || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [institutionId])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">
        目前資料模型沒有記錄離職日期，此表呈現的是「目前在職狀態」的快照，不是離職趨勢圖。
      </p>
      <Select value={institutionId} onChange={(e) => setInstitutionId(e.target.value ? Number(e.target.value) : '')} className="max-w-xs">
        <option value="">全部機構</option>
        {institutions.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </Select>

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
                <th className="px-3 py-2 font-medium">在職人數</th>
                <th className="px-3 py-2 font-medium">離職人數</th>
                <th className="px-3 py-2 font-medium">在職平均年資(天)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink-muted">
                    無資料
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{r.institution_name ?? '(未指定)'}</td>
                  <td className="px-3 py-2">{r.active_count}</td>
                  <td className="px-3 py-2">{r.inactive_count}</td>
                  <td className="px-3 py-2">{r.avg_tenure_days ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
