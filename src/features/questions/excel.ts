import * as XLSX from 'xlsx'
import type { ExamDef, QuestionInput, QuestionRow } from './api'

const MAX_OPTIONS = 6
const STAGE_LABELS: Record<string, string> = { '1m': '到職滿1個月', '3m': '到職滿3個月', '1y': '到職滿1年' }

export interface ParsedQuestion extends Omit<QuestionInput, 'exam_def_id'> {
  rowNumber: number
  examDefId: number
}

export interface ParseResult<T> {
  rows: T[]
  errors: { rowNumber: number; message: string }[]
}

/** 中文題庫批次建立範本：受訓階段 / 題型 / 分數 / 題目 / 選項1~6 / 正確答案位置 / 解析 */
export function downloadQuestionTemplate() {
  const headers = [
    '受訓階段', '題型', '分數', '題目',
    ...Array.from({ length: MAX_OPTIONS }, (_, i) => `選項${i + 1}`),
    '正確答案位置（如 1 或 1,3）', '解析',
  ]
  const example = [
    '到職滿1個月', '單選', 4, '洗手應該遵守幾個時機？',
    '5個時機', '3個時機', '7個時機', '', '', '',
    '1', '依據WHO洗手5時機準則',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([headers, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '題庫')
  XLSX.writeFile(workbook, '題庫批次建立範本.xlsx')
}

export async function parseQuestionExcel(
  file: File,
  examDefs: ExamDef[],
): Promise<ParseResult<ParsedQuestion>> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const examByLabel = new Map(examDefs.map((e) => [STAGE_LABELS[e.stage_code], e]))

  const rows: ParsedQuestion[] = []
  const errors: { rowNumber: number; message: string }[] = []

  raw.forEach((line, index) => {
    const rowNumber = index + 2
    const stageLabel = String(line['受訓階段'] ?? '').trim()
    const exam = examByLabel.get(stageLabel)
    if (!exam) {
      errors.push({ rowNumber, message: `受訓階段「${stageLabel}」無法辨識` })
      return
    }

    const qTypeLabel = String(line['題型'] ?? '單選').trim()
    const qType = qTypeLabel === '複選' ? 'multiple' : 'single'
    const score = Number(line['分數'] ?? 4) || 4
    const text = String(line['題目'] ?? '').trim()
    if (!text) {
      errors.push({ rowNumber, message: '缺少題目內容' })
      return
    }

    const options: string[] = []
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      const value = String(line[`選項${i}`] ?? '').trim()
      if (value) options.push(value)
    }
    if (options.length < 2) {
      errors.push({ rowNumber, message: '選項至少需要 2 個' })
      return
    }

    const answerRaw = String(line['正確答案位置（如 1 或 1,3）'] ?? line['正確答案位置'] ?? '').trim()
    const answer = answerRaw
      .split(',')
      .map((s) => Number(s.trim()) - 1)
      .filter((n) => Number.isInteger(n) && n >= 0)
    if (answer.length === 0 || answer.some((n) => n >= options.length)) {
      errors.push({ rowNumber, message: `正確答案位置「${answerRaw}」無效` })
      return
    }

    rows.push({
      rowNumber,
      examDefId: exam.id,
      q_type: qType,
      score,
      answer,
      translations: {
        'zh-TW': { text, options, explanation: String(line['解析'] ?? '').trim() || undefined },
      },
    })
  })

  return { rows, errors }
}

// ---- 翻譯範本 ----

export interface ParsedTranslation {
  rowNumber: number
  questionId: number
  text: string
  options: string[]
  explanation?: string
}

const LANG_COLUMN_LABEL: Record<string, string> = { vi: '越南文', id: '印尼文' }

/** 匯出某考科目前的中文題目，供對照填寫指定語言的翻譯 */
export function downloadTranslationTemplate(examTitle: string, langCode: string, questions: QuestionRow[]) {
  const langLabel = LANG_COLUMN_LABEL[langCode] ?? langCode
  const headers = [
    '題號（請勿修改）', '中文題目（對照用，請勿修改）',
    ...Array.from({ length: MAX_OPTIONS }, (_, i) => `中文選項${i + 1}`),
    `${langLabel}題目`,
    ...Array.from({ length: MAX_OPTIONS }, (_, i) => `${langLabel}選項${i + 1}`),
    `${langLabel}解析（選填）`,
  ]
  const rows = questions.map((q) => {
    const zh = q.translations['zh-TW']
    const existing = q.translations[langCode]
    const zhOptions = Array.from({ length: MAX_OPTIONS }, (_, i) => zh?.options[i] ?? '')
    const existingOptions = Array.from({ length: MAX_OPTIONS }, (_, i) => existing?.options[i] ?? '')
    return [
      q.id, zh?.text ?? '',
      ...zhOptions,
      existing?.text ?? '',
      ...existingOptions,
      existing?.explanation ?? '',
    ]
  })
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '翻譯範本')
  XLSX.writeFile(workbook, `${examTitle}_${langLabel}翻譯範本.xlsx`)
}

export async function parseTranslationExcel(
  file: File,
  langCode: string,
): Promise<ParseResult<ParsedTranslation>> {
  const langLabel = LANG_COLUMN_LABEL[langCode] ?? langCode
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const rows: ParsedTranslation[] = []
  const errors: { rowNumber: number; message: string }[] = []

  raw.forEach((line, index) => {
    const rowNumber = index + 2
    const questionId = Number(line['題號（請勿修改）'] ?? line['題號'])
    if (!Number.isInteger(questionId)) {
      errors.push({ rowNumber, message: '題號缺失或格式錯誤，請勿修改範本的題號欄位' })
      return
    }

    const text = String(line[`${langLabel}題目`] ?? '').trim()
    if (!text) return // 尚未翻譯的列直接略過，不視為錯誤

    const options: string[] = []
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      const value = String(line[`${langLabel}選項${i}`] ?? '').trim()
      if (value) options.push(value)
    }
    if (options.length < 2) {
      errors.push({ rowNumber, message: '翻譯選項至少需要 2 個' })
      return
    }

    rows.push({
      rowNumber,
      questionId,
      text,
      options,
      explanation: String(line[`${langLabel}解析（選填）`] ?? '').trim() || undefined,
    })
  })

  return { rows, errors }
}
