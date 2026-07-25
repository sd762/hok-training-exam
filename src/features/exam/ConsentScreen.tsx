import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useStudentLang } from './useStudentLang'

export function ConsentScreen({
  onAgree,
  submitting,
  error,
}: {
  onAgree: () => void
  submitting: boolean
  error: string | null
}) {
  const { t } = useStudentLang()

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="text-lg font-semibold">{t('consent_title')}</h1>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{t('consent_body')}</p>

      {error && <p className="mt-4 text-sm text-status-fail">{error}</p>}

      <Button onClick={onAgree} loading={submitting} className="mt-6 w-full">
        {t('consent_agree_button')}
      </Button>
      <p className="mt-2 text-center text-xs text-ink-muted">{t('consent_decline_note')}</p>
    </Card>
  )
}
