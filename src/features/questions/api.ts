import { supabase } from '@/lib/supabase'

export interface ExamDef {
  id: number
  stage_code: '1m' | '3m' | '1y'
  title: string
  pass_score: number
  validity_months: number
  is_active: boolean
}

export interface Translation {
  lang_code: string
  text: string
  options: string[]
  explanation: string | null
}

export interface QuestionRow {
  id: number
  exam_def_id: number
  q_type: 'single' | 'multiple'
  score: number
  is_active: boolean
  /** 正確答案在「原始選項順序」中的位置（0-based），呼應 ADR 0007/0010 的答案鎖定機制 */
  answer: number[]
  translations: Record<string, Translation>
}

export interface QuestionInput {
  id?: number
  exam_def_id: number
  q_type: 'single' | 'multiple'
  score: number
  answer: number[]
  translations: Record<string, { text: string; options: string[]; explanation?: string }>
}

export async function fetchExamDefs(): Promise<ExamDef[]> {
  const { data, error } = await supabase
    .from('exam_def')
    .select('id, stage_code, title, pass_score, validity_months, is_active')
    .order('id')
  if (error) throw error
  return data
}

export async function fetchQuestions(examDefId: number): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select(
      `id, exam_def_id, q_type, score, is_active, answer_json,
       question_translation ( lang_code, text, options_json, explanation )`,
    )
    .eq('exam_def_id', examDefId)
    .order('id')
  if (error) throw error

  return (data as unknown as RawQuestionRow[]).map((row) => ({
    id: row.id,
    exam_def_id: row.exam_def_id,
    q_type: row.q_type,
    score: row.score,
    is_active: row.is_active,
    answer: row.answer_json as number[],
    translations: Object.fromEntries(
      row.question_translation.map((t) => [
        t.lang_code,
        { lang_code: t.lang_code, text: t.text, options: t.options_json as string[], explanation: t.explanation },
      ]),
    ),
  }))
}

interface RawQuestionRow {
  id: number
  exam_def_id: number
  q_type: 'single' | 'multiple'
  score: number
  is_active: boolean
  answer_json: unknown
  question_translation: { lang_code: string; text: string; options_json: unknown; explanation: string | null }[]
}

export async function createQuestion(input: QuestionInput): Promise<void> {
  const zhTW = input.translations['zh-TW']
  if (!zhTW) throw new Error('繁體中文為必填')

  const { data: question, error } = await supabase
    .from('question_bank')
    .insert({
      exam_def_id: input.exam_def_id,
      q_type: input.q_type,
      score: input.score,
      answer_json: input.answer,
    })
    .select('id')
    .single()
  if (error) throw error

  await writeTranslations(question.id, input.translations)
}

export async function updateQuestion(input: QuestionInput): Promise<void> {
  if (!input.id) throw new Error('缺少題目 ID')

  const { error } = await supabase
    .from('question_bank')
    .update({
      exam_def_id: input.exam_def_id,
      q_type: input.q_type,
      score: input.score,
      answer_json: input.answer,
    })
    .eq('id', input.id)
  if (error) throw error

  await writeTranslations(input.id, input.translations)
}

async function writeTranslations(
  questionId: number,
  translations: Record<string, { text: string; options: string[]; explanation?: string }>,
) {
  const rows = Object.entries(translations)
    .filter(([, t]) => t.text.trim())
    .map(([lang_code, t]) => ({
      question_id: questionId,
      lang_code,
      text: t.text,
      options_json: t.options,
      explanation: t.explanation || null,
    }))
  if (rows.length === 0) return

  const { error } = await supabase
    .from('question_translation')
    .upsert(rows, { onConflict: 'question_id,lang_code' })
  if (error) throw error
}

export async function setQuestionActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('question_bank').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** 批次建立中文題目（Excel 匯入用）。逐筆建立，任何一筆失敗不影響其他筆。 */
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

/** 批次補上／更新指定語言的翻譯（不影響繁體中文與答案位置） */
export async function bulkImportTranslations(
  rows: { questionId: number; text: string; options: string[]; explanation?: string; lang_code: string }[],
): Promise<{ index: number; error?: string }[]> {
  const results: { index: number; error?: string }[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const { error } = await supabase.from('question_translation').upsert(
      {
        question_id: row.questionId,
        lang_code: row.lang_code,
        text: row.text,
        options_json: row.options,
        explanation: row.explanation || null,
      },
      { onConflict: 'question_id,lang_code' },
    )
    results.push(error ? { index: i, error: error.message } : { index: i })
  }
  return results
}
