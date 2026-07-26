import { supabase } from '@/lib/supabase'

export interface StaffSummaryRow {
  institution_id: number | null
  institution_name: string | null
  lang_code: string
  total_count: number
  active_count: number
  avg_age: number | null
}

export async function fetchStaffSummary(institutionId?: number, langCode?: string): Promise<StaffSummaryRow[]> {
  const { data, error } = await supabase.rpc('report_staff_summary', {
    p_institution_id: institutionId ?? null,
    p_lang_code: langCode ?? null,
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
  /** 這個狀態底下有幾「人」（同一人補考多次只算一次，取最終結果） */
  staff_count: number
  /** 這些人最終那次作答的平均分數 */
  avg_score: number | null
  /** 這些人平均補考了幾次才落到目前狀態 */
  avg_attempts: number | null
  /** 同機構/階段/國籍底下，所有作答「人次」總數（含補考） */
  total_attempts: number
  /** 平均測考通過率——以「人次」計算，跟以「人」計算的正式及格率是兩回事，僅供參考 */
  attempt_pass_rate: number | null
}

export interface ExamResultFilters {
  institutionId?: number
  year?: number
  half?: 1 | 2
  quarter?: 1 | 2 | 3 | 4
  stageCode?: '1m' | '3m' | '1y'
  langCode?: string
}

export async function fetchExamResults(filters: ExamResultFilters): Promise<ExamResultRow[]> {
  const { data, error } = await supabase.rpc('report_exam_results', {
    p_institution_id: filters.institutionId ?? null,
    p_year: filters.year ?? null,
    p_half: filters.half ?? null,
    p_quarter: filters.quarter ?? null,
    p_stage_code: filters.stageCode ?? null,
    p_lang_code: filters.langCode ?? null,
  })
  if (error) throw error
  return data
}

export interface AgeDistributionRow {
  lang_code: string
  age_bucket: string
  count: number
}

export async function fetchAgeDistribution(institutionId?: number, langCode?: string): Promise<AgeDistributionRow[]> {
  const { data, error } = await supabase.rpc('report_age_distribution', {
    p_institution_id: institutionId ?? null,
    p_lang_code: langCode ?? null,
  })
  if (error) throw error
  return data
}
