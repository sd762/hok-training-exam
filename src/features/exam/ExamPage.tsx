import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useStudentLang } from './useStudentLang'
import { startExam, submitExam, type GradedQuestion, type StartResult } from './api'

export default function ExamPage() {
  const { t } = useStudentLang()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<StartResult | null>(null)
  const [answers, setAnswers] = useState<number[][]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean; status: string; questions: GradedQuestion[] } | null>(null)

  useEffect(() => {
    startExam()
      .then((data) => {
        setSession(data)
        setAnswers(data.questions.map(() => []))
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('error_generic')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleAnswer(qIndex: number, optionIndex: number, type: 'single' | 'multiple') {
    setAnswers((prev) =>
      prev.map((selected, i) => {
        if (i !== qIndex) return selected
        if (type === 'single') return [optionIndex]
        return selected.includes(optionIndex)
          ? selected.filter((v) => v !== optionIndex)
          : [...selected, optionIndex]
      }),
    )
  }

  async function handleSubmit() {
    if (!session) return
    const unanswered = answers.filter((a) => a.length === 0).length
    if (unanswered > 0 && !confirm(t('submit_confirm', { n: unanswered }))) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await submitExam(session.attempt_id, answers)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-ink-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    )
  }

  if (error && !session) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <p className="text-status-fail">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/')}>
          {t('back_home')}
        </Button>
      </Card>
    )
  }

  if (result) return <ExamResult result={result} t={t} onBack={() => navigate('/')} />
  if (!session) return null

  const answeredCount = answers.filter((a) => a.length > 0).length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="sticky top-0 z-10 -mx-6 border-b border-line bg-surface-muted px-6 py-3">
        <p className="text-sm font-medium">
          {session.exam.title} · {answeredCount}/{session.questions.length}
        </p>
      </div>

      {session.questions.map((q, qIndex) => (
        <Card key={q.question_id} className="p-5">
          <p className="font-medium">
            {t('question_progress', { current: qIndex + 1, total: session.questions.length })}
            {' '}
            {q.type === 'single' ? t('single_choice_hint') : t('multiple_choice_hint')}
          </p>
          <p className="mt-2">{q.text}</p>

          <div className="mt-4 space-y-2">
            {q.options.map((option, optIndex) => (
              <label key={optIndex} className="flex items-center gap-2 rounded-lg border border-line p-3 hover:bg-surface-muted">
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={`q-${qIndex}`}
                  checked={answers[qIndex]?.includes(optIndex) ?? false}
                  onChange={() => toggleAnswer(qIndex, optIndex, q.type)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </Card>
      ))}

      {error && <p className="text-sm text-status-fail">{error}</p>}

      <Button onClick={handleSubmit} loading={submitting} className="w-full">
        {t('submit_button')}
      </Button>
    </div>
  )
}

function ExamResult({
  result,
  t,
  onBack,
}: {
  result: { score: number; passed: boolean; status: string; questions: GradedQuestion[] }
  t: ReturnType<typeof useStudentLang>['t']
  onBack: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-6 text-center">
        <p className={result.passed ? 'text-status-pass text-xl font-semibold' : 'text-status-fail text-xl font-semibold'}>
          {result.passed ? t('result_passed') : t('result_failed')}
        </p>
        <p className="mt-2 text-2xl font-bold">{t('result_score', { score: result.score })}</p>
        {result.status === 'pending_review' && (
          <p className="mt-3 text-sm text-status-pending">{t('result_pending_review_note')}</p>
        )}
      </Card>

      {result.questions.map((q, i) => (
        <Card key={q.question_id} className="p-5">
          <p className="font-medium">
            {i + 1}. {q.text}
          </p>
          <div className="mt-3 space-y-1">
            {q.options.map((option, optIndex) => {
              const originalPosition = q.option_order[optIndex]
              const wasSelected = q.selected_original.includes(originalPosition)
              const wasCorrect = q.answer_original.includes(originalPosition)
              return (
                <p key={optIndex} className={cn('text-sm', wasCorrect && 'font-medium text-status-pass')}>
                  {option}
                  {wasCorrect && <span className="ml-2 text-status-pass">✓ 正解</span>}
                  {wasSelected && <span className="ml-2 text-ink-muted">（您的作答）</span>}
                </p>
              )
            })}
          </div>
          <p className={q.is_correct ? 'mt-2 text-sm text-status-pass' : 'mt-2 text-sm text-status-fail'}>
            {q.is_correct ? '✓ 答對' : '✗ 答錯'}
          </p>
          {q.explanation && <p className="mt-1 text-sm text-ink-muted">{q.explanation}</p>}
        </Card>
      ))}

      <Button variant="outline" onClick={onBack} className="w-full">
        {t('result_back_to_status')}
      </Button>
    </div>
  )
}
