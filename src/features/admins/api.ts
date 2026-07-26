import { supabase } from '@/lib/supabase'
import { callAdminUsers } from '@/lib/edge-functions'
import type { UserRole } from '@/lib/roles'

/** 這個功能只管理「非學員」的四種角色，學員帳號在學員管理頁另外處理 */
export type ManagedRole = Exclude<UserRole, 'staff'>

export interface AdminRow {
  id: string
  account_code: string
  display_name: string
  role: ManagedRole
  is_active: boolean
  institution_id: number | null
  institution_name: string | null
  contact_email: string | null
}

export interface AdminFormInput {
  account_code: string
  display_name: string
  role: ManagedRole
  institution_id: number | null
  contact_email?: string
}

interface RawAdminRow {
  id: string
  account_code: string
  display_name: string
  role: ManagedRole
  is_active: boolean
  institution_id: number | null
  contact_email: string | null
  institution: { name: string } | null
}

export async function fetchAdmins(): Promise<AdminRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `id, account_code, display_name, role, is_active, institution_id, contact_email,
       institution:institution_id ( name )`,
    )
    .neq('role', 'staff')
    .order('role')
    .order('account_code')

  if (error) throw error

  return (data as unknown as RawAdminRow[]).map((row) => ({
    id: row.id,
    account_code: row.account_code,
    display_name: row.display_name,
    role: row.role,
    is_active: row.is_active,
    institution_id: row.institution_id,
    institution_name: row.institution?.name ?? null,
    contact_email: row.contact_email,
  }))
}

export async function createOrUpdateAdmin(
  input: AdminFormInput,
): Promise<{ created: boolean; password?: string }> {
  return callAdminUsers({
    action: 'create_account',
    input: {
      account_code: input.account_code,
      display_name: input.display_name,
      role: input.role,
      institution_id: input.role === 'institution_manager' ? input.institution_id : null,
      contact_email: input.contact_email || null,
    },
  })
}

export async function setAdminActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteAdmin(accountCode: string): Promise<void> {
  await callAdminUsers({ action: 'delete_account', account_code: accountCode })
}

export async function resetAdminPassword(accountCode: string): Promise<{ new_password: string }> {
  return callAdminUsers({ action: 'reset_password', account_code: accountCode })
}
