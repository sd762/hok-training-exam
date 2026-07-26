import { supabase } from '@/lib/supabase'
import { callAdminUsers } from '@/lib/edge-functions'

export type TrainingStage = '1m' | '3m' | '1y'

export const STAGE_LABELS: Record<TrainingStage, string> = {
  '1m': '到職滿1個月',
  '3m': '到職滿3個月',
  '1y': '到職滿1年',
}

// 這裡的欄位標題是「國籍」，顯示文字也要對應國籍稱呼，不是語言名稱
export const LANG_LABELS: Record<string, string> = {
  'zh-TW': '台籍',
  vi: '越南籍',
  id: '印尼籍',
}

// 固定選項，對應公司實際的課別，不開放自由輸入以避免同一課別打成好幾種不同的寫法
export const DEPARTMENT_OPTIONS = ['生福課', '行政一課', '行政二課', '人事課']

export interface StaffRow {
  id: string
  account_code: string
  display_name: string
  is_active: boolean
  institution_id: number | null
  institution_name: string | null
  name_native: string | null
  lang_code: string
  birth_date: string | null
  hire_date: string
  current_stage: TrainingStage | null
  department: string | null
}

export interface StaffFormInput {
  account_code: string
  display_name: string
  institution_id: number | null
  name_native?: string
  lang_code: string
  birth_date?: string
  hire_date: string
  current_stage?: TrainingStage
  department?: string
}

export async function fetchStaff(): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `id, account_code, display_name, is_active, institution_id,
       institution:institution_id ( name ),
       staff_detail ( name_native, lang_code, birth_date, hire_date, current_stage, department )`,
    )
    .eq('role', 'staff')
    .order('account_code')

  if (error) throw error

  return (data as unknown as RawStaffRow[]).map((row) => ({
    id: row.id,
    account_code: row.account_code,
    display_name: row.display_name,
    is_active: row.is_active,
    institution_id: row.institution_id,
    institution_name: row.institution?.name ?? null,
    name_native: row.staff_detail?.name_native ?? null,
    lang_code: row.staff_detail?.lang_code ?? 'zh-TW',
    birth_date: row.staff_detail?.birth_date ?? null,
    hire_date: row.staff_detail?.hire_date ?? '',
    current_stage: row.staff_detail?.current_stage ?? null,
    department: row.staff_detail?.department ?? null,
  }))
}

interface RawStaffRow {
  id: string
  account_code: string
  display_name: string
  is_active: boolean
  institution_id: number | null
  institution: { name: string } | null
  staff_detail: {
    name_native: string | null
    lang_code: string
    birth_date: string | null
    hire_date: string
    current_stage: TrainingStage | null
    department: string | null
  } | null
}

export async function createOrUpdateStaff(input: StaffFormInput): Promise<void> {
  await callAdminUsers({
    action: 'create_account',
    input: {
      account_code: input.account_code,
      display_name: input.display_name,
      role: 'staff',
      institution_id: input.institution_id,
      staff_detail: {
        name_native: input.name_native || null,
        lang_code: input.lang_code,
        birth_date: input.birth_date || null,
        hire_date: input.hire_date,
        current_stage: input.current_stage || null,
        department: input.department || null,
      },
    },
  })
}

export async function setStaffActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteStaff(accountCode: string): Promise<void> {
  await callAdminUsers({ action: 'delete_account', account_code: accountCode })
}

export async function resetStaffPassword(accountCode: string): Promise<{ new_password: string }> {
  return callAdminUsers({ action: 'reset_password', account_code: accountCode })
}

export interface BulkImportRow extends StaffFormInput {}

export async function bulkImportStaff(
  rows: BulkImportRow[],
): Promise<{ account_code: string; status: 'created' | 'updated' | 'error'; message?: string }[]> {
  const payloadRows = rows.map((r) => ({
    account_code: r.account_code,
    display_name: r.display_name,
    role: 'staff' as const,
    institution_id: r.institution_id,
    staff_detail: {
      name_native: r.name_native || null,
      lang_code: r.lang_code,
      birth_date: r.birth_date || null,
      hire_date: r.hire_date,
      current_stage: r.current_stage || null,
      department: r.department || null,
    },
  }))
  const result = await callAdminUsers<{ results: BulkImportResult[] }>({
    action: 'bulk_import',
    rows: payloadRows,
  })
  return result.results
}

interface BulkImportResult {
  account_code: string
  status: 'created' | 'updated' | 'error'
  message?: string
}
