import { supabase } from '@/lib/supabase'

export interface ExamDef {
  id: number
  stage_code: '1m' | '3m' | '1y'
  title: string
  pass_score: number
  validity_months: number
  is_active: boolean
}

export const LANG_CODES = ['zh-TW', 'vi', 'id'] as const
export type LangCode = (typeof LANG_CODES)[number]

export const LANG_LABELS: Record<LangCode, string> = {
  'zh-TW': '繁體中文',
  vi: '越南文',
  id: '印尼文',
}

export interface QuestionRow {
  id: number
  exam_def_id: number
  lang_code: LangCode
  q_type: 'single' | 'multiple'
  score: number
  text: string
  options: string[]
  /** 正確答案在 options 中的位置（0-based） */
  answer: number[]
  explanation: string | null
  is_active: boolean
}

export interface QuestionInput {
  id?: number
  exam_def_id: number
  lang_code: LangCode
  q_type: 'single' | 'multiple'
  score: number
  text: string
  options: string[]
  answer: number[]
  explanation?: string
}

export async function fetchExamDefs(): Promise<ExamDef[]> {
  const { data, error } = await supabase
    .from('exam_def')
    .select('id, stage_code, title, pass_score, validity_months, is_active')
    .order('id')
  if (error) throw error
  return data
}

export async function fetchQuestions(examDefId: number, langCode: LangCode): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, exam_def_id, lang_code, q_type, score, text, options_json, answer_json, explanation, is_active')
    .eq('exam_def_id', examDefId)
    .eq('lang_code', langCode)
    .order('id')
  if (error) throw error

  return (data as unknown as RawQuestionRow[]).map((row) => ({
    id: row.id,
    exam_def_id: row.exam_def_id,
    lang_code: row.lang_code,
    q_type: row.q_type,
    score: row.score,
    text: row.text,
    options: row.options_json as string[],
    answer: row.answer_json as number[],
    explanation: row.explanation,
    is_active: row.is_active,
  }))
}

interface RawQuestionRow {
  id: number
  exam_def_id: number
  lang_code: LangCode
  q_type: 'single' | 'multiple'
  score: number
  text: string
  options_json: unknown
  answer_json: unknown
  explanation: string | null
  is_active: boolean
}

export async function createQuestion(input: QuestionInput): Promise<void> {
  const { error } = await supabase.from('question_bank').insert({
    exam_def_id: input.exam_def_id,
    lang_code: input.lang_code,
    q_type: input.q_type,
    score: input.score,
    text: input.text,
    options_json: input.options,
    answer_json: input.answer,
    explanation: input.explanation || null,
  })
  if (error) throw error
}

export async function updateQuestion(input: QuestionInput): Promise<void> {
  if (!input.id) throw new Error('缺少題目 ID')
  const { error } = await supabase
    .from('question_bank')
    .update({
      q_type: input.q_type,
      score: input.score,
      text: input.text,
      options_json: input.options,
      answer_json: input.answer,
      explanation: input.explanation || null,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function setQuestionActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('question_bank').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** 批次建立題目（Excel 匯入用）。逐筆建立，任何一筆失敗不影響其他筆。 */
export async function bulkCreateQuestions(
  inputs: QuestionInput[],
): Promise<{ index: number; error?: string }[]> {
  const results: { index: number; error?: string }[] = []
  for (let i = 0; i < inputs.length; i++) {
    try {
      await createQuestion(inputs[i])
      results.push({ index: i })
    } catch (err) {
      results.push({ index: i, error: err instanceof Error ? err.message : '建立失敗' })
    }
  }
  return results
}
