import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import {
  createQuestion,
  fetchExamDefs,
  fetchQuestions,
  LANG_CODES,
  LANG_LABELS,
  setQuestionActive,
  updateQuestion,
  type ExamDef,
  type LangCode,
  type QuestionInput,
  type QuestionRow,
} from './api'
import { QuestionFormModal } from './QuestionFormModal'

const QuestionImportModal = lazy(() =>
  import('./QuestionImportModal').then((m) => ({ default: m.QuestionImportModal })),
)

export default function QuestionsPage() {
  const [examDefs, setExamDefs] = useState<ExamDef[]>([])
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null)
  const [langCode, setLangCode] = useState<LangCode>('zh-TW')
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<QuestionRow | 'new' | null>(null)
  const [importing, setImporting] = useState(false)

  const reloadExamDefs = useCallback(async () => {
    const defs = await fetchExamDefs()
    setExamDefs(defs)
    if (defs.length > 0 && selectedExamId === null) setSelectedExamId(defs[0].id)
  }, [selectedExamId])

  const reloadQuestions = useCallback(async (examId: number, lang: LangCode) => {
    setLoading(true)
    setError(null)
    try {
      setQuestions(await fetchQuestions(examId, lang))
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadExamDefs()
  }, [reloadExamDefs])

  useEffect(() => {
    if (selectedExamId !== null) void reloadQuestions(selectedExamId, langCode)
  }, [selectedExamId, langCode, reloadQuestions])

  const currentExam = examDefs.find((e) => e.id === selectedExamId)

  async function handleToggleActive(row: QuestionRow) {
    try {
      await setQuestionActive(row.id, !row.is_active)
      if (selectedExamId !== null) await reloadQuestions(selectedExamId, langCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : '狀態切換失敗')
    }
  }

  async function handleSubmit(input: QuestionInput) {
    if (input.id) await updateQuestion(input)
    else await createQuestion(input)
    if (selectedExamId !== null) await reloadQuestions(selectedExamId, langCode)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">題庫管理</h1>
          <p className="mt-1 text-sm text-ink-muted">
            繁體中文／越南文／印尼文為三份各自獨立的題庫，題目內容與題數互不相關（見 ADR 0015）。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)} disabled={!currentExam}>
            <Upload className="size-4" aria-hidden />
            匯入
          </Button>
          <Button size="sm" onClick={() => setEditing('new')} disabled={!currentExam}>
            <Plus className="size-4" aria-hidden />
            新增題目
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-line">
          {examDefs.map((exam) => (
            <button
              key={exam.id}
              onClick={() => setSelectedExamId(exam.id)}
              className={cn(
                'px-4 py-2 text-sm',
                selectedExamId === exam.id
                  ? 'border-b-2 border-brand-600 font-medium text-brand-600'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {exam.title}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border border-line bg-surface-muted p-1">
          {LANG_CODES.map((code) => (
            <button
              key={code}
              onClick={() => setLangCode(code)}
              className={cn(
                'rounded-md px-3 py-1 text-sm',
                langCode === code ? 'bg-surface font-medium text-brand-600 shadow-sm' : 'text-ink-muted',
              )}
            >
              {LANG_LABELS[code]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-status-fail/30 bg-status-fail/5 p-4 text-sm text-status-fail">{error}</Card>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          載入中…
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-muted text-left text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">題目</th>
                <th className="px-4 py-2 font-medium">題型</th>
                <th className="px-4 py-2 font-medium">配分</th>
                <th className="px-4 py-2 font-medium">狀態</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {questions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    此考科的{LANG_LABELS[langCode]}題庫尚無題目
                  </td>
                </tr>
              )}
              {questions.map((q) => (
                <tr key={q.id} className={q.is_active ? '' : 'text-ink-muted'}>
                  <td className="max-w-md truncate px-4 py-2">{q.text}</td>
                  <td className="px-4 py-2">{q.q_type === 'single' ? '單選' : '複選'}</td>
                  <td className="px-4 py-2">{q.score}</td>
                  <td className="px-4 py-2">
                    {q.is_active ? <span className="text-status-pass">啟用中</span> : <span>已停用</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>
                        編輯
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggleActive(q)}>
                        {q.is_active ? '停用' : '啟用'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && currentExam && (
        <QuestionFormModal
          editing={editing === 'new' ? null : editing}
          examDefId={currentExam.id}
          langCode={langCode}
          onSubmit={handleSubmit}
          onClose={() => setEditing(null)}
        />
      )}

      {importing && currentExam && (
        <Suspense fallback={null}>
          <QuestionImportModal
            currentExam={currentExam}
            langCode={langCode}
            onDone={() => reloadQuestions(currentExam.id, langCode)}
            onClose={() => setImporting(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
