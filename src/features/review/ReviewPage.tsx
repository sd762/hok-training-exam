import { useCallback, useEffect, useState } from 'react'
import { Loader2, ImageIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  confirmPass,
  fetchReviewQueue,
  fetchSnapshotUrl,
  flagAttempt,
  resolveFlagged,
  type ReviewAttempt,
} from './api'

const EVENT_TYPE_LABELS: Record<string, string> = {
  warning: '人臉消失警告',
  scheduled: '定期存證',
  tab_switch: '切換視窗警告',
}

export default function ReviewPage() {
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      setAttempts(await fetchReviewQueue())
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function runAction(attemptId: number, action: () => Promise<void>) {
    setBusyId(attemptId)
    setError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setBusyId(null)
    }
  }

  async function handleViewSnapshot(storagePath: string) {
    setError(null)
    try {
      setSnapshotUrl(await fetchSnapshotUrl(storagePath))
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法載入快照')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        載入中…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">及格作答審查</h1>
        <p className="mt-1 text-sm text-ink-muted">
          只有及格的作答需要審查。核對無誤後正式納入及格紀錄，學員才能推進到下一階段；有出入則標記存疑，保留監考證據待進一步調查。
        </p>
      </div>

      {error && (
        <Card className="border-status-fail/30 bg-status-fail/5 p-4 text-sm text-status-fail">{error}</Card>
      )}

      {attempts.length === 0 && (
        <Card className="p-6 text-center text-ink-muted">目前沒有待審查的作答</Card>
      )}

      {attempts.map((a) => (
        <Card key={a.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {a.staff_name}（{a.staff_account_code}） · {a.exam_title}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                得分 {a.score ?? '-'} · 送出時間 {new Date(a.submitted_at).toLocaleString()}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                a.status === 'pending_review'
                  ? 'bg-status-pending/10 text-status-pending'
                  : 'bg-status-flagged/10 text-status-flagged',
              )}
            >
              {a.status === 'pending_review' ? '待核對' : '存疑保留'}
            </span>
          </div>

          {a.events.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink-muted">監考事件（{a.events.length}）</p>
              <ul className="mt-2 space-y-1">
                {a.events.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="text-ink-muted">
                      {new Date(e.occurred_at).toLocaleTimeString()} · {EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
                    </span>
                    {e.storage_path && (
                      <Button size="sm" variant="ghost" onClick={() => handleViewSnapshot(e.storage_path!)}>
                        <ImageIcon className="size-4" aria-hidden />
                        查看快照
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {a.status === 'pending_review' ? (
              <>
                <Button
                  size="sm"
                  loading={busyId === a.id}
                  onClick={() => runAction(a.id, () => confirmPass(a.id))}
                >
                  確認通過
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busyId === a.id}
                  onClick={() => runAction(a.id, () => flagAttempt(a.id))}
                >
                  標記存疑
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  loading={busyId === a.id}
                  onClick={() => runAction(a.id, () => resolveFlagged(a.id, 'confirmed_passed'))}
                >
                  維持通過
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busyId === a.id}
                  onClick={() => runAction(a.id, () => resolveFlagged(a.id, 'voided'))}
                >
                  判定不合格（作廢重考）
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}

      {snapshotUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setSnapshotUrl(null)}
        >
          <img src={snapshotUrl} alt="監考快照" className="max-h-[80vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
