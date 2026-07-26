import { supabase } from '@/lib/supabase'

export interface StaffSummaryRow {
  institution_id: number | null
  institution_name: string | null
  lang_code: string
  total_count: number
  active_count: number
  avg_age: number | null
}

export async function fetchStaffSummary(institutionId?: number): Promise<StaffSummaryRow[]> {
  const { data, error } = await supabase.rpc('report_staff_summary', {
    p_institution_id: institutionId ?? null,
  })
  if (error) throw error
  return data
}

export interface QuestionAccuracyRow {
  question_id: number
  question_text: string | null
  lang_code: string
  total_answers: number
  correct_answers: number
  accuracy_pct: number | null
}

export async function fetchQuestionAccuracy(examDefId: number, langCode?: string): Promise<QuestionAccuracyRow[]> {
  const { data, error } = await supabase.rpc('report_question_accuracy', {
    p_exam_def_id: examDefId,
    p_lang_code: langCode ?? null,
  })
  if (error) throw error
  return data
}

export interface ExamResultRow {
  institution_id: number | null
  institution_name: string | null
  stage_code: string
  lang_code: string
  status: string
  attempt_count: number
  avg_score: number | null
}

export interface ExamResultFilters {
  institutionId?: number
  year?: number
  half?: 1 | 2
  quarter?: 1 | 2 | 3 | 4
  stageCode?: '1m' | '3m' | '1y'
}

export async function fetchExamResults(filters: ExamResultFilters): Promise<ExamResultRow[]> {
  const { data, error } = await supabase.rpc('report_exam_results', {
    p_institution_id: filters.institutionId ?? null,
    p_year: filters.year ?? null,
    p_half: filters.half ?? null,
    p_quarter: filters.quarter ?? null,
    p_stage_code: filters.stageCode ?? null,
  })
  if (error) throw error
  return data
}

export interface RetentionRow {
  institution_id: number | null
  institution_name: string | null
  active_count: number
  inactive_count: number
  avg_tenure_days: number | null
}

export async function fetchRetention(institutionId?: number): Promise<RetentionRow[]> {
  const { data, error } = await supabase.rpc('report_retention', {
    p_institution_id: institutionId ?? null,
  })
  if (error) throw error
  return data
}
