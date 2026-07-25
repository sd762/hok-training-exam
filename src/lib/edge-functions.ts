import { supabase } from '@/lib/supabase'

/**
 * 呼叫需要 service_role 權限的 Edge Function（帳號建立/匯入/重設密碼/刪除）。
 * 自動帶上目前登入者的 session token，函式內部會反查呼叫者角色再決定放行與否。
 */
export async function callAdminUsers<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload })
  if (error) {
    throw new Error(await extractErrorMessage(error))
  }
  return data as T
}

/**
 * supabase-js 對 Edge Function 錯誤的包裝形狀依錯誤類型而不同：
 * - FunctionsHttpError（函式回了非 2xx）：context 是一個 Response，可 .json()
 * - FunctionsRelayError / FunctionsFetchError（網路層失敗，函式可能根本沒執行到）：
 *   context 通常是字串或原始 Error，沒有 .json()
 * 因此不能假設 context 一定能解析 JSON，逐一嘗試、都失敗才退回原始訊息。
 */
async function extractErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context

  if (context instanceof Response) {
    try {
      const body = await context.clone().json()
      if (body?.error) return body.error
    } catch {
      try {
        const text = await context.clone().text()
        if (text) return text
      } catch {
        /* 忽略，退回下方預設訊息 */
      }
    }
  }

  if (typeof context === 'string' && context) return context
  if (error instanceof Error) return error.message
  return '呼叫失敗，原因不明'
}
