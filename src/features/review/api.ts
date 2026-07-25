import { supabase } from '@/lib/supabase'
import { callReviewAttempt } from '@/lib/edge-functions'

export type ProctoringEventType = 'warning' | 'scheduled' | 'tab_switch'

export interface ProctoringEventRow {
  id: number
  event_type: ProctoringEventType
  occurred_at: string
  storage_path: string | null
}

export interface ReviewAttempt {
  id: number
  staff_id: string
  staff_name: string
  staff_account_code: string
  exam_title: string
  score: number | null
  status: 'pending_review' | 'flagged'
  aborted_reason: string | null
  submitted_at: string
  events: ProctoringEventRow[]
}

interface RawReviewAttempt {
  id: number
  staff_id: string
  score: number | null
  status: 'pending_review' | 'flagged'
  aborted_reason: string | null
  submitted_at: string
  profiles: { display_name: string; account_code: string } | null
  exam_def: { title: string } | null
  proctoring_event: ProctoringEventRow[]
}

export async function fetchReviewQueue(): Promise<ReviewAttempt[]> {
  const { data, error } = await supabase
    .from('attempt')
    .select(
      `id, staff_id, score, status, aborted_reason, submitted_at,
       profiles:staff_id ( display_name, account_code ),
       exam_def:exam_def_id ( title ),
       proctoring_event ( id, event_type, occurred_at, storage_path )`,
    )
    .in('status', ['pending_review', 'flagged'])
    .order('submitted_at', { ascending: true })
  if (error) throw error

  return (data as unknown as RawReviewAttempt[]).map((row) => ({
    id: row.id,
    staff_id: row.staff_id,
    staff_name: row.profiles?.display_name ?? '(未知)',
    staff_account_code: row.profiles?.account_code ?? '-',
    exam_title: row.exam_def?.title ?? '-',
    score: row.score,
    status: row.status,
    aborted_reason: row.aborted_reason,
    submitted_at: row.submitted_at,
    events: row.proctoring_event,
  }))
}

export async function fetchSnapshotUrl(storagePath: string): Promise<string> {
  const res = await callReviewAttempt<{ url: string }>({ action: 'get_snapshot_url', storage_path: storagePath })
  return res.url
}

export async function confirmPass(attemptId: number): Promise<void> {
  await callReviewAttempt({ action: 'confirm_pass', attempt_id: attemptId })
}

export async function flagAttempt(attemptId: number): Promise<void> {
  await callReviewAttempt({ action: 'flag', attempt_id: attemptId })
}

export async function resolveFlagged(attemptId: number, outcome: 'confirmed_passed' | 'voided'): Promise<void> {
  await callReviewAttempt({ action: 'resolve_flagged', attempt_id: attemptId, outcome })
}
