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

// 只有這兩個語言會考音訊題，台籍(zh-TW)不考
export const AUDIO_QUESTION_LANGS: LangCode[] = ['vi', 'id']

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
  /** Storage 裡的音檔路徑，沒有就是一般文字題 */
  audio_path: string | null
  /** 題目本身配的圖（跟音訊不同，三語言都能用） */
  image_path: string | null
  /** 跟 options 等長，每格是該選項的圖片路徑或 null（選項本身是圖片時使用） */
  option_images: (string | null)[] | null
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
  audio_path?: string | null
  image_path?: string | null
  option_images?: (string | null)[] | null
}

export async function fetchExamDefs(): Promise<ExamDef[]> {
  const { data, error } = await supabase
    .from('exam_def')
    .select('id, stage_code, title, pass_score, validity_months, is_active')
    .order('id')
  if (error) throw error
  return data
}

const QUESTION_COLUMNS =
  'id, exam_def_id, lang_code, q_type, score, text, options_json, answer_json, explanation, is_active, audio_path, image_path, option_images_json'

export async function fetchQuestions(examDefId: number, langCode: LangCode): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select(QUESTION_COLUMNS)
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
    audio_path: row.audio_path,
    image_path: row.image_path,
    option_images: (row.option_images_json as (string | null)[] | null) ?? null,
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
  audio_path: string | null
  image_path: string | null
  option_images_json: unknown
}

/** 已經有音檔的題目路徑清單（同一考試定義底下），供新增音訊題時「重複使用既有音檔」選取 */
export async function fetchUsedAudioPaths(examDefId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('audio_path')
    .eq('exam_def_id', examDefId)
    .not('audio_path', 'is', null)
  if (error) throw error
  return [...new Set((data as { audio_path: string }[]).map((r) => r.audio_path))]
}

/** 已經上傳過的圖片路徑清單（題目配圖跟選項圖片共用同一個池子，同一個考試定義底下） */
export async function fetchUsedImagePaths(examDefId: number): Promise<string[]> {
  const [questionImages, optionImages] = await Promise.all([
    supabase.from('question_bank').select('image_path').eq('exam_def_id', examDefId).not('image_path', 'is', null),
    supabase
      .from('question_bank')
      .select('option_images_json')
      .eq('exam_def_id', examDefId)
      .not('option_images_json', 'is', null),
  ])
  if (questionImages.error) throw questionImages.error
  if (optionImages.error) throw optionImages.error

  const paths = new Set<string>()
  for (const row of questionImages.data as { image_path: string }[]) paths.add(row.image_path)
  for (const row of optionImages.data as { option_images_json: (string | null)[] }[]) {
    for (const p of row.option_images_json ?? []) if (p) paths.add(p)
  }
  return [...paths]
}

const AUDIO_BUCKET = 'question-audio'
const IMAGE_BUCKET = 'question-images'

/** 上傳新音檔，回傳 Storage 路徑（不是網址——網址由學員端 take-exam Edge Function 簽發） */
export async function uploadQuestionAudio(examDefId: number, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'mp3'
  const path = `${examDefId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

/** 上傳新圖片，回傳 Storage 路徑（題目配圖、選項圖片共用這支函式） */
export async function uploadQuestionImage(examDefId: number, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${examDefId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

/** 後台預覽用的簽名網址（管理者角色對這個 bucket 有直接 select 權限，不需要經過 Edge Function） */
export async function getAudioPreviewUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

/** 後台預覽用的圖片簽名網址 */
export async function getImagePreviewUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
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
    audio_path: input.audio_path || null,
    image_path: input.image_path || null,
    option_images_json: input.option_images ?? null,
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
      audio_path: input.audio_path || null,
      image_path: input.image_path || null,
      option_images_json: input.option_images ?? null,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function setQuestionActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('question_bank').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** 只能刪除已停用的題目，避免誤刪還在使用中的題目（與學員管理相同的安全性設計） */
export async function deleteQuestion(row: Pick<QuestionRow, 'id' | 'is_active'>): Promise<void> {
  if (row.is_active) throw new Error('啟用中的題目無法刪除，請先停用')
  const { error } = await supabase.from('question_bank').delete().eq('id', row.id)
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
