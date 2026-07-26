import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { fetchExamDefs, type ExamDef } from '@/features/questions/api'
import { fetchQuestionAccuracy, type QuestionAccuracyRow } from './api'

const LANG_OPTIONS = [
  { code: '', label: '全部語言' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'vi', label: '越南文' },
  { code: 'id', label: '印尼文' },
]

export default function QuestionAccuracyTab() {
  const [examDefs, setExamDefs] = useState<ExamDef[]>([])
  const [examDefId, setExamDefId] = useState<number | ''>('')
  const [langCode, setLangCode] = useState('')
  const [rows, setRows] = useState<QuestionAccuracyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExamDefs().then((defs) => {
      setExamDefs(defs)
      if (defs.length > 0) setExamDefId(defs[0].id)
    })
  }, [])

  const reload = useCallback(async () => {
    if (!examDefId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchQuestionAccuracy(examDefId, langCode || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [examDefId, langCode])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={examDefId} onChange={(e) => setExamDefId(Number(e.target.value))} className="max-w-xs">
          {examDefs.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
        <Select value={langCode} onChange={(e) => setLangCode(e.target.value)} className="max-w-xs">
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">題目</th>
                <th className="px-3 py-2 font-medium">語言</th>
                <th className="px-3 py-2 font-medium">作答數</th>
                <th className="px-3 py-2 font-medium">答對數</th>
                <th className="px-3 py-2 font-medium">正確率</th>
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
              {rows.map((r) => (
                <tr key={`${r.question_id}-${r.lang_code}`}>
                  <td className="max-w-md truncate px-3 py-2">{r.question_text ?? '(題目已刪除)'}</td>
                  <td className="px-3 py-2">{r.lang_code}</td>
                  <td className="px-3 py-2">{r.total_answers}</td>
                  <td className="px-3 py-2">{r.correct_answers}</td>
                  <td className={`px-3 py-2 font-medium ${(r.accuracy_pct ?? 100) < 60 ? 'text-status-fail' : ''}`}>
                    {r.accuracy_pct ?? '-'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
