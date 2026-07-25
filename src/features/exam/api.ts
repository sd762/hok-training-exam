import { supabase } from '@/lib/supabase'
import { callTakeExam } from '@/lib/edge-functions'
import type { LangCode } from '@/lib/i18n'

export interface ExamRef {
  id: number
  title: string
  stage_code: '1m' | '3m' | '1y'
  pass_score: number
}

export type BlockReason = 'pending_review' | 'flagged' | 'not_due_yet' | 'all_completed' | 'locked'

export interface ExamStatus {
  assigned: ExamRef | null
  reason?: BlockReason
  exam?: ExamRef
  dueDate?: string
  lockedUntil?: string
  attemptsLeft?: number
}

export interface QuestionView {
  question_id: number
  type: 'single' | 'multiple'
  score: number
  text: string
  options: string[]
}

export interface StartResult {
  attempt_id: number
  exam: ExamRef
  questions: QuestionView[]
}

export interface GradedQuestion extends QuestionView {
  explanation: string
  option_order: number[]
  /** 正確答案在原始選項順序中的位置——送出作答後才會出現在回應內容中 */
  answer_original: number[]
  selected_original: number[]
  is_correct: boolean
}

export interface SubmitResult {
  score: number
  passed: boolean
  status: 'failed' | 'pending_review'
  questions: GradedQuestion[]
}

export async function fetchExamStatus(): Promise<ExamStatus> {
  return callTakeExam<ExamStatus>({ action: 'status' })
}

export async function startExam(): Promise<StartResult> {
  return callTakeExam<StartResult>({ action: 'start' })
}

export async function submitExam(attemptId: number, answers: number[][]): Promise<SubmitResult> {
  return callTakeExam<SubmitResult>({ action: 'submit', attempt_id: attemptId, answers })
}

/** 學員本人的語言別，用於切換整個作答流程的介面語言 */
export async function fetchOwnLangCode(profileId: string): Promise<LangCode> {
  const { data, error } = await supabase
    .from('staff_detail')
    .select('lang_code')
    .eq('profile_id', profileId)
    .single()
  if (error) throw error
  return data.lang_code as LangCode
}
