import * as XLSX from 'xlsx'
import { LANG_LABELS, type LangCode, type QuestionInput } from './api'

const MAX_OPTIONS = 6

export interface ParsedQuestionRow {
  rowNumber: number
  q_type: 'single' | 'multiple'
  score: number
  text: string
  options: string[]
  answer: number[]
  explanation?: string
}

export interface ParseResult {
  rows: ParsedQuestionRow[]
  errors: { rowNumber: number; message: string }[]
}

/** 三語言共用同一套範本欄位：題型/分數/題目/選項/正確答案位置/解析 */
export function downloadQuestionTemplate(langCode: LangCode) {
  const headers = [
    '題型', '分數', '題目',
    ...Array.from({ length: MAX_OPTIONS }, (_, i) => `選項${i + 1}`),
    '正確答案位置（如 1 或 1,3）', '解析',
  ]
  const example = ['單選', 4, '洗手應該遵守幾個時機？', '5個時機', '3個時機', '7個時機', '', '', '', '1', '依據WHO洗手5時機準則']
  const sheet = XLSX.utils.aoa_to_sheet([headers, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '題庫')
  XLSX.writeFile(workbook, `${LANG_LABELS[langCode]}題庫範本.xlsx`)
}

export async function parseQuestionFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const rows: ParsedQuestionRow[] = []
  const errors: { rowNumber: number; message: string }[] = []

  raw.forEach((line, index) => {
    const rowNumber = index + 2
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

    const qTypeLabel = String(line['題型'] ?? '單選').trim()
    const score = Number(line['分數'] ?? 4) || 4
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
      q_type: qTypeLabel === '複選' ? 'multiple' : 'single',
      score,
      text,
      options,
      answer,
      explanation: String(line['解析'] ?? '').trim() || undefined,
    })
  })

  return { rows, errors }
}

export function toQuestionInputs(
  rows: ParsedQuestionRow[],
  examDefId: number,
  langCode: LangCode,
): QuestionInput[] {
  return rows.map((r) => ({
    exam_def_id: examDefId,
    lang_code: langCode,
    q_type: r.q_type,
    score: r.score,
    text: r.text,
    options: r.options,
    answer: r.answer,
    explanation: r.explanation,
  }))
}
