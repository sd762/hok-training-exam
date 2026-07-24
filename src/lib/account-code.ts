/**
 * 帳號代碼 ⇄ Supabase Auth 內部信箱的轉換（ADR 0008）。
 *
 * 使用者全程只輸入/看到帳號代碼（工號或管理者代碼）；Supabase Auth 需要
 * email 形式的身分，因此在此統一補上內部網域。單一網域、不含角色——
 * 帳號代碼本身已全域唯一，且角色變更時不應牽動登入身分。
 *
 * `.local` 為保留網域，不可能對應到真實信箱，不會誤寄信給外部。
 */
const INTERNAL_DOMAIN = 'hok-exam.local'

export function accountCodeToEmail(accountCode: string): string {
  return `${accountCode.trim().toLowerCase()}@${INTERNAL_DOMAIN}`
}

export function emailToAccountCode(email: string): string {
  return email.replace(`@${INTERNAL_DOMAIN}`, '')
}
