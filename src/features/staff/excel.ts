import * as XLSX from 'xlsx'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import type { BulkImportRow, TrainingStage } from './api'

const STAGE_BY_LABEL: Record<string, TrainingStage> = {
  滿1個月: '1m',
  滿一個月: '1m',
  滿3個月: '3m',
  滿三個月: '3m',
  滿1年: '1y',
  滿一年: '1y',
}

const LANG_BY_LABEL: Record<string, string> = {
  繁體中文: 'zh-TW',
  中文: 'zh-TW',
  越南文: 'vi',
  印尼文: 'id',
}

export interface ParsedRow extends BulkImportRow {
  rowNumber: number
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: { rowNumber: number; message: string }[]
}

/** 範本欄位：工號 / 姓名 / 母語姓名 / 國籍 / 出生年月日 / 到職日 / 已合格階段 / 機構類別 / 機構名稱 / 部門 */
export async function parseStaffExcel(
  file: File,
  categories: InstitutionCategory[],
  institutions: Institution[],
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const categoryByName = new Map(categories.map((c) => [c.name, c]))
  const institutionByKey = new Map(institutions.map((i) => [`${i.category_id}:${i.name}`, i]))

  const rows: ParsedRow[] = []
  const errors: { rowNumber: number; message: string }[] = []

  raw.forEach((line, index) => {
    const rowNumber = index + 2 // 第 1 列是標題
    const accountCode = String(line['工號'] ?? '').trim()
    const displayName = String(line['姓名'] ?? '').trim()
    const categoryName = String(line['機構類別'] ?? '').trim()
    const institutionName = String(line['機構名稱'] ?? '').trim()
    const hireDateRaw = line['到職日']
    const birthDateRaw = line['出生年月日']
    const stageLabel = String(line['已合格階段'] ?? '').trim()
    const langLabel = String(line['國籍'] ?? '繁體中文').trim()

    if (!accountCode || !displayName) {
      errors.push({ rowNumber, message: '缺少工號或姓名' })
      return
    }

    const category = categoryByName.get(categoryName)
    if (categoryName && !category) {
      errors.push({ rowNumber, message: `找不到機構類別「${categoryName}」` })
      return
    }
    const institution = category
      ? institutionByKey.get(`${category.id}:${institutionName}`)
      : undefined
    if (categoryName && institutionName && !institution) {
      errors.push({ rowNumber, message: `找不到機構「${categoryName}－${institutionName}」` })
      return
    }

    const hireDate = normalizeDate(hireDateRaw)
    if (!hireDate) {
      errors.push({ rowNumber, message: '到職日格式無法辨識' })
      return
    }

    const stage = stageLabel ? STAGE_BY_LABEL[stageLabel] : undefined
    if (stageLabel && !stage) {
      errors.push({ rowNumber, message: `已合格階段「${stageLabel}」無法辨識` })
      return
    }

    const birthDate = birthDateRaw ? normalizeDate(birthDateRaw) : null
    if (birthDateRaw && !birthDate) {
      errors.push({ rowNumber, message: '出生年月日格式無法辨識' })
      return
    }

    const langCode = LANG_BY_LABEL[langLabel] ?? langLabel

    rows.push({
      rowNumber,
      account_code: accountCode,
      display_name: displayName,
      institution_id: institution?.id ?? null,
      name_native: String(line['母語姓名'] ?? '').trim() || undefined,
      lang_code: langCode,
      birth_date: birthDate ?? undefined,
      hire_date: hireDate,
      current_stage: stage,
      department: String(line['部門'] ?? '').trim() || undefined,
    })
  })

  return { rows, errors }
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  const text = String(value ?? '').trim()
  if (!text) return null
  // 支援 2016.01.18、2016/01/18、2016-01-18
  const match = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
  if (!match) return null
  const [, y, m, d] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function downloadStaffTemplate() {
  const headers = [
    '工號', '姓名', '母語姓名', '國籍', '出生年月日', '到職日', '已合格階段', '機構類別', '機構名稱', '部門',
  ]
  const example = [
    'T0001', '王小明', '', '繁體中文', '1990-05-20', '2026-01-18', '滿1個月', '養護機構', '清安', '',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([headers, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '學員名單')
  XLSX.writeFile(workbook, '學員批次匯入範本.xlsx')
}
