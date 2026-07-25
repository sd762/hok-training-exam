import * as XLSX from 'xlsx'
import { LANG_LABELS, type LangCode, type QuestionInput } from './api'

// 機構實際題庫皆為單選、固定 4 個選項，Excel 匯入格式依此簡化
const MAX_OPTIONS = 4

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

/**
 * 解析「正確答案位置」欄位，同時支援數字（1、1,3）與字母（A、A,C、AC）兩種標示方式
 * ——機構實際提供的正式題庫檔案用的是字母標示（A/B/C/D），數字則是本系統原本設計的範本格式。
 * 回傳 0-based 的選項位置陣列。
 */
function parseAnswerPositions(raw: string): number[] {
  if (!raw) return []

  const isAllLetters = /^[A-Za-z]+$/.test(raw)
  // 純字母且沒有分隔符（如 "AC"）視為每個字母各自代表一個答案位置
  const tokens = isAllLetters && raw.length > 1 ? raw.split('') : raw.split(/[,，、\s]+/).filter(Boolean)

  return tokens
    .map((token) => {
      const t = token.trim()
      if (/^[A-Za-z]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
      const n = Number(t)
      return Number.isFinite(n) ? n - 1 : NaN
    })
    .filter((n) => Number.isInteger(n) && n >= 0)
}

/** 三語言共用同一套範本欄位：題目/選項1-4/正確答案位置（皆為單選題，每題固定4分） */
export function downloadQuestionTemplate(langCode: LangCode) {
  const headers = [
    '題目',
    ...Array.from({ length: MAX_OPTIONS }, (_, i) => `選項${i + 1}`),
    '正確答案位置（可填數字如 1，或字母如 A）',
  ]
  const example = ['洗手應該遵守幾個時機？', '5個時機', '3個時機', '7個時機', '9個時機', 'A']
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

    const answerRaw = String(
      line['正確答案位置（可填數字如 1，或字母如 A）'] ??
        line['正確答案位置（可填數字如 1 或 1,3，或字母如 A 或 A,C）'] ??
        line['正確答案位置（如 1 或 1,3）'] ??
        line['正確答案位置'] ??
        '',
    ).trim()
    const answer = parseAnswerPositions(answerRaw)
    if (answer.length === 0 || answer.some((n) => n >= options.length)) {
      errors.push({ rowNumber, message: `正確答案位置「${answerRaw}」無效` })
      return
    }

    rows.push({
      rowNumber,
      q_type: 'single', // 機構實際題庫皆為單選
      score: 4, // 每題固定 4 分（25題*4分=滿分100，見 ADR 0006）
      text,
      options,
      answer,
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
