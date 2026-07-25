import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/auth/useAuth'
import { useStudentLang } from './useStudentLang'
import { fetchExamStatus, type ExamStatus } from './api'

export default function StudentHome() {
  const { profile } = useAuth()
  const { t } = useStudentLang()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ExamStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchExamStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : t('error_generic')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (!profile) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="p-6 text-center">
        <p className="text-sm text-ink-muted">{profile.account_code}</p>
        <h1 className="mt-1 text-xl font-semibold">{profile.display_name}</h1>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">{t('exam_reminder_title')}</h2>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-ink-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {t('loading')}
          </div>
        ) : error ? (
          <p className="mt-4 text-sm text-status-fail">{error}</p>
        ) : (
          status && <StatusBody status={status} t={t} onStart={() => navigate('/exam')} />
        )}
      </Card>
    </div>
  )
}

function StatusBody({
  status,
  t,
  onStart,
}: {
  status: ExamStatus
  t: ReturnType<typeof useStudentLang>['t']
  onStart: () => void
}) {
  if (status.assigned) {
    return (
      <div className="mt-4 space-y-3">
        <p className="font-medium text-brand-600">{t('exam_due_message', { title: status.assigned.title })}</p>
        {status.attemptsLeft !== undefined && (
          <p className="text-sm text-ink-muted">{t('exam_attempts_left', { n: status.attemptsLeft })}</p>
        )}
        <Button onClick={onStart} className="w-full">
          {t('exam_start_button')}
        </Button>
      </div>
    )
  }

  const message = (() => {
    switch (status.reason) {
      case 'all_completed':
        return t('exam_all_completed')
      case 'pending_review':
        return t('exam_pending_review')
      case 'flagged':
        return t('exam_flagged')
      case 'not_due_yet':
        return t('exam_not_due_yet', { date: status.dueDate ?? '' })
      case 'locked':
        return t('exam_locked', { date: formatDate(status.lockedUntil) })
      default:
        return t('exam_none_due')
    }
  })()

  return <p className="mt-4 text-ink-muted">{message}</p>
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}
