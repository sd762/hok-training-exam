import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useStudentLang } from './useStudentLang'
import { useProctoring } from './useProctoring'
import { useTabSwitchGuard } from './useTabSwitchGuard'
import { ConsentScreen } from './ConsentScreen'
import { startExam, submitExam, type StartResult, type SubmitResult } from './api'

export default function ExamPage() {
  const { t } = useStudentLang()
  const navigate = useNavigate()

  const [consented, setConsented] = useState(false)
  const [consentSubmitting, setConsentSubmitting] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<StartResult | null>(null)
  const [answers, setAnswers] = useState<number[][]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [abortedReason, setAbortedReason] = useState<'face' | 'tab_switch' | null>(null)
  const [tabSwitchWarned, setTabSwitchWarned] = useState(false)

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop())
  }

  // 分頁關閉/切換離開時，確保鏡頭一定會關掉
  useEffect(() => stopCamera, [stream])

  function handleAborted(reason: 'face' | 'tab_switch') {
    stopCamera()
    setAbortedReason(reason)
  }

  const { videoRef, showFaceWarning } = useProctoring(stream, session?.attempt_id ?? null, () =>
    handleAborted('face'),
  )

  useTabSwitchGuard(session?.attempt_id ?? null, videoRef, () => setTabSwitchWarned(true), () =>
    handleAborted('tab_switch'),
  )

  async function handleConsent() {
    setError(null)
    setConsentSubmitting(true)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      const data = await startExam()
      setStream(mediaStream)
      setSession(data)
      setAnswers(data.questions.map(() => []))
      setConsented(true)
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setError(t('camera_denied'))
      } else {
        setError(err instanceof Error ? err.message : t('error_generic'))
      }
    } finally {
      setConsentSubmitting(false)
    }
  }

  // 送出後畫面會切換到結果頁，但使用者當下多半捲到最後一題附近，
  // 得分卡在最上方看不到，需要主動捲回頂端
  useEffect(() => {
    if (result || abortedReason) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [result, abortedReason])

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
      stopCamera()
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (abortedReason) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto size-10 text-status-fail" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-status-fail">{t('aborted_title')}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {t(abortedReason === 'face' ? 'aborted_body_face' : 'aborted_body_tab_switch')}
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => navigate('/')}>
          {t('back_home')}
        </Button>
      </Card>
    )
  }

  if (result) return <ExamResult result={result} t={t} onBack={() => navigate('/')} />

  if (!consented) {
    return <ConsentScreen onAgree={handleConsent} submitting={consentSubmitting} error={error} />
  }

  if (!session) return null

  const answeredCount = answers.filter((a) => a.length > 0).length

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div className="sticky top-0 z-10 -mx-6 flex items-center gap-3 border-b border-line bg-surface-muted px-6 py-3">
        {/* 監考鏡頭預覽：放在頂端進度列的左側，符合實際應考時視角習慣（鏡頭本來就在螢幕上方），
            且跟著這條 sticky 列一起固定，不需要另外計算高度避免疊到標題文字 */}
        <div className="relative shrink-0 overflow-hidden rounded-lg border-2 border-line shadow-sm">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-12 w-16 bg-ink object-cover sm:h-14 sm:w-20"
          />
          {showFaceWarning && (
            <div className="absolute inset-0 flex items-center justify-center bg-status-fail/80 p-1 text-center text-[9px] text-white sm:text-[10px]">
              {t('face_missing_warning')}
            </div>
          )}
        </div>
        <p className="text-sm font-medium">
          {session.exam.title} · {answeredCount}/{session.questions.length}
        </p>
      </div>

      {tabSwitchWarned && (
        // 用 fixed 蓋版而不是插在文件流裡的橫幅：25題的作答畫面很長，學員被警告當下
        // 常常已經捲到後面的題目，插在最上方的橫幅會滑出畫面外看不到，等於沒警告到，
        // 蓋版不管捲到哪裡都會蓋在畫面正中間，且要按按鈕才能關掉，確保真的有看到。
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <Card className="max-w-sm p-6 text-center">
            <AlertTriangle className="mx-auto size-10 text-status-fail" aria-hidden />
            <p className="mt-3 text-sm text-status-fail">{t('tab_switch_warning')}</p>
            <Button className="mt-5 w-full" onClick={() => setTabSwitchWarned(false)}>
              {t('tab_switch_warning_acknowledge')}
            </Button>
          </Card>
        </div>
      )}

      {session.questions.map((q, qIndex) => (
        <Card key={q.question_id} className="p-5">
          <p className="font-medium">
            {t('question_progress', { current: qIndex + 1, total: session.questions.length })}
            {' '}
            {q.type === 'single' ? t('single_choice_hint') : t('multiple_choice_hint')}
          </p>
          {q.audio_url && (
            <div className="mt-2 rounded-lg bg-surface-muted p-3">
              <p className="mb-1.5 text-xs text-ink-muted">{t('listen_hint')}</p>
              {/* preload=none：25題裡最多只有5題音訊，不要求瀏覽器一次把全部音檔都先抓下來 */}
              <audio controls preload="none" src={q.audio_url} className="w-full" />
            </div>
          )}
          {q.image_url && (
            <img src={q.image_url} alt="" className="mt-2 max-h-64 w-full rounded-lg object-contain" />
          )}
          <p className="mt-2">{q.text}</p>

          <div className="mt-4 space-y-2">
            {q.options.map((option, optIndex) => {
              const optionImage = q.option_image_urls?.[optIndex]
              return (
                <label
                  key={optIndex}
                  className="flex items-center gap-3 rounded-lg border border-line p-3 hover:bg-surface-muted"
                >
                  <input
                    type={q.type === 'single' ? 'radio' : 'checkbox'}
                    name={`q-${qIndex}`}
                    checked={answers[qIndex]?.includes(optIndex) ?? false}
                    onChange={() => toggleAnswer(qIndex, optIndex, q.type)}
                  />
                  {optionImage && (
                    <img src={optionImage} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
                  )}
                  <span>{option}</span>
                </label>
              )
            })}
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
  result: SubmitResult
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
        {!result.passed && result.retry && (
          <p className="mt-3 text-sm text-status-fail">
            {result.retry.lockedUntil
              ? t('result_locked_hint', { date: formatDate(result.retry.lockedUntil) })
              : t('result_retry_hint', { n: result.retry.cycleAttemptNumber ?? '' })}
          </p>
        )}

        {/* 送出後最先看到的就是分數，返回按鈕放在旁邊，不用捲到最底下才找得到 */}
        <Button variant="outline" onClick={onBack} className="mt-5 w-full">
          {t('result_back_to_status')}
        </Button>
      </Card>

      {result.questions.map((q, i) => (
        <Card
          key={q.question_id}
          className={cn('p-5', q.is_correct ? 'bg-status-pass/10' : 'bg-status-fail/10')}
        >
          <div className="flex gap-3">
            <span
              className={cn(
                'shrink-0 text-lg font-bold',
                q.is_correct ? 'text-status-pass' : 'text-status-fail',
              )}
              aria-label={q.is_correct ? t('answer_correct') : t('answer_incorrect')}
            >
              {q.is_correct ? '✓' : '✗'}
            </span>
            <div className="flex-1">
              {q.audio_url && (
                <audio controls preload="none" src={q.audio_url} className="mb-2 w-full" />
              )}
              {q.image_url && (
                <img src={q.image_url} alt="" className="mb-2 max-h-64 w-full rounded-lg object-contain" />
              )}
              <p className="font-medium">
                {i + 1}. {q.text}
              </p>
              <div className="mt-3 space-y-1">
                {q.options.map((option, optIndex) => {
                  const originalPosition = q.option_order[optIndex]
                  const wasSelected = q.selected_original.includes(originalPosition)
                  const wasCorrect = q.answer_original.includes(originalPosition)
                  const optionImage = q.option_image_urls?.[optIndex]
                  return (
                    <div key={optIndex} className="flex items-center gap-2">
                      {optionImage && (
                        <img src={optionImage} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                      )}
                      <p className={cn('text-sm', wasCorrect && 'font-medium text-status-pass')}>
                        {option}
                        {wasCorrect && <span className="ml-2 text-status-pass">{t('correct_answer_label')}</span>}
                        {wasSelected && <span className="ml-2 text-ink-muted">{t('your_answer_label')}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
              {q.explanation && <p className="mt-2 text-sm text-ink-muted">{q.explanation}</p>}
            </div>
          </div>
        </Card>
      ))}

      <Button variant="outline" onClick={onBack} className="w-full">
        {t('result_back_to_status')}
      </Button>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}
