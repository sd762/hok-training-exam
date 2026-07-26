import * as XLSX from 'xlsx'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import { DEPARTMENT_OPTIONS, type BulkImportRow, type TrainingStage } from './api'

const STAGE_BY_LABEL: Record<string, TrainingStage> = {
  滿1個月: '1m',
  滿一個月: '1m',
  滿3個月: '3m',
  滿三個月: '3m',
  滿1年: '1y',
  滿一年: '1y',
}

// 國籍稱呼為主，語言名稱是舊範本用詞，保留相容避免舊檔案匯入失敗
const LANG_BY_LABEL: Record<string, string> = {
  台籍: 'zh-TW',
  繁體中文: 'zh-TW',
  中文: 'zh-TW',
  越南籍: 'vi',
  越南文: 'vi',
  印尼籍: 'id',
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
    const langLabel = String(line['國籍'] ?? '台籍').trim()
    const department = String(line['部門'] ?? '').trim()

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

    if (department && !DEPARTMENT_OPTIONS.includes(department)) {
      errors.push({
        rowNumber,
        message: `部門「${department}」不是允許的選項（${DEPARTMENT_OPTIONS.join('／')}）`,
      })
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
      department: department || undefined,
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

const NATIONALITY_OPTIONS = ['台籍', '越南籍', '印尼籍']

// 目前使用的 xlsx 套件（免費版 SheetJS）不支援寫入 Excel 原生的下拉選單資料驗證，
// 只能改用「對照表」這個折衷做法：把目前系統裡實際有效的機構/國籍/部門/階段列在
// 第二個工作表，讓填表的人直接複製正確寫法貼過去，減少手打錯字造成匯入失敗。
export function downloadStaffTemplate(categories: InstitutionCategory[], institutions: Institution[]) {
  const headers = [
    '工號', '姓名', '母語姓名', '國籍', '出生年月日', '到職日', '已合格階段', '機構類別', '機構名稱', '部門',
  ]
  const example = [
    'T0001', '王小明', '', '台籍', '1990-05-20', '2026-01-18', '滿1個月', '養護機構', '清安', '',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([headers, example])
  sheet['!cols'] = headers.map(() => ({ wch: 12 }))

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const institutionRows = institutions
    .filter((i) => i.is_active)
    .map((i) => [categoryById.get(i.category_id)?.name ?? '', i.name])

  const refRows: (string | undefined)[][] = [
    ['請填寫的值', '說明／可用選項'],
    ['國籍', NATIONALITY_OPTIONS.join('／')],
    ['已合格階段', '空白（尚未設定）／滿1個月／滿3個月／滿1年'],
    ['部門（選填）', DEPARTMENT_OPTIONS.join('／')],
    [],
    ['機構類別', '機構名稱（下面兩欄請照抄，不要自己改字）'],
    ...institutionRows,
  ]
  const refSheet = XLSX.utils.aoa_to_sheet(refRows)
  refSheet['!cols'] = [{ wch: 16 }, { wch: 30 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '學員名單')
  XLSX.utils.book_append_sheet(workbook, refSheet, '可用選項對照表')
  XLSX.writeFile(workbook, '學員批次匯入範本.xlsx')
}
