/** 五層角色（ADR 0013），與資料庫的 user_role enum 對應 */
export type UserRole =
  | 'super_admin'
  | 'platform_admin'
  | 'viewer_admin'
  | 'institution_manager'
  | 'staff'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '系統管理者',
  platform_admin: '平台管理者',
  viewer_admin: '管理者',
  institution_manager: '機構管理者',
  staff: '學員',
}

export interface Profile {
  id: string
  account_code: string
  display_name: string
  role: UserRole
  institution_id: number | null
  contact_email: string | null
  is_active: boolean
}

/** 可查看全部機構資料的角色 */
export function isGlobalViewer(role: UserRole): boolean {
  return role === 'super_admin' || role === 'platform_admin' || role === 'viewer_admin'
}

/** 可寫入業務資料的角色——「管理者」為純查看，不在其中 */
export function canWrite(role: UserRole): boolean {
  return role === 'super_admin' || role === 'platform_admin'
}

/** 可審查及格作答的角色（ADR 0006） */
export function canReviewAttempts(role: UserRole): boolean {
  return role === 'super_admin' || role === 'platform_admin'
}

/** 可查看分析報表的角色——除了學員以外全部角色都能看，範圍由 RLS 自動限縮（工單12） */
export function canViewReports(role: UserRole): boolean {
  return role !== 'staff'
}
