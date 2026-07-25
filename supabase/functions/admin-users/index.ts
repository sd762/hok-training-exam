// Edge Function: admin-users
//
// 集中處理所有「需要 Admin API（service_role）才能做」的帳號操作：
// 建立學員/管理者帳號、批次匯入、代他人重設密碼。
// 絕不能在前端做——service_role key 可繞過所有 RLS，只能活在這裡的環境變數中。
//
// 呼叫者身分驗證：從呼叫者的 JWT 反查 profiles.role，只有
// super_admin / platform_admin 可執行本函式的任何操作（ADR 0013）。
// 這一步不能省略，否則任何登入者都能直接打這支 API 幫自己升級權限。

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_DOMAIN = 'hok-exam.local'

const WRITE_ROLES = new Set(['super_admin', 'platform_admin'])

type Role = 'super_admin' | 'platform_admin' | 'viewer_admin' | 'institution_manager' | 'staff'

interface CreateAccountInput {
  account_code: string
  display_name: string
  role: Role
  institution_id?: number | null
  contact_email?: string | null
  password?: string // 未提供時使用預設密碼，要求登入後盡快由使用者自行更改
}

const DEFAULT_PASSWORD = '000000'

function accountCodeToEmail(accountCode: string): string {
  return `${accountCode.trim().toLowerCase()}@${INTERNAL_DOMAIN}`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: '缺少身分驗證' }, 401)
  }

  // 用呼叫者的 JWT 建立一個「以呼叫者身分」的 client，藉此安全地反查其角色。
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()

  if (!caller) {
    return jsonResponse({ error: '身分驗證失敗' }, 401)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()

  if (!callerProfile || !WRITE_ROLES.has(callerProfile.role)) {
    return jsonResponse({ error: '權限不足：僅系統管理者/平台管理者可執行此操作' }, 403)
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.action !== 'string') {
    return jsonResponse({ error: '請求格式錯誤' }, 400)
  }

  switch (body.action) {
    case 'create_account':
      return await handleCreateAccount(admin, body.input as CreateAccountInput)
    case 'bulk_import':
      return await handleBulkImport(admin, body.rows as CreateAccountInput[])
    case 'reset_password':
      return await handleResetPassword(admin, body.account_code as string)
    default:
      return jsonResponse({ error: `未知操作：${body.action}` }, 400)
  }
})

async function handleCreateAccount(
  admin: ReturnType<typeof createClient>,
  input: CreateAccountInput,
) {
  if (!input?.account_code || !input.display_name || !input.role) {
    return jsonResponse({ error: '缺少必要欄位（account_code / display_name / role）' }, 400)
  }

  const result = await createOrUpdateAccount(admin, input)
  if (result.error) return jsonResponse({ error: result.error }, 400)
  return jsonResponse({ ok: true, account_code: input.account_code, created: result.created })
}

async function handleBulkImport(
  admin: ReturnType<typeof createClient>,
  rows: CreateAccountInput[],
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({ error: '沒有可匯入的資料' }, 400)
  }

  const results: { account_code: string; status: 'created' | 'updated' | 'error'; message?: string }[] = []

  for (const row of rows) {
    if (!row?.account_code || !row.display_name) {
      results.push({ account_code: row?.account_code ?? '(空白)', status: 'error', message: '缺少工號或姓名' })
      continue
    }
    const result = await createOrUpdateAccount(admin, { ...row, role: row.role ?? 'staff' })
    if (result.error) {
      results.push({ account_code: row.account_code, status: 'error', message: result.error })
    } else {
      results.push({ account_code: row.account_code, status: result.created ? 'created' : 'updated' })
    }
  }

  return jsonResponse({ ok: true, results })
}

async function handleResetPassword(admin: ReturnType<typeof createClient>, accountCode: string) {
  if (!accountCode) return jsonResponse({ error: '缺少帳號代碼' }, 400)

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('account_code', accountCode)
    .maybeSingle()

  if (!profile) return jsonResponse({ error: '找不到此帳號' }, 404)

  const { error } = await admin.auth.admin.updateUserById(profile.id, {
    password: DEFAULT_PASSWORD,
  })
  if (error) return jsonResponse({ error: error.message }, 400)

  return jsonResponse({ ok: true, account_code: accountCode, new_password: DEFAULT_PASSWORD })
}

/** 依 account_code 是否已存在，建立新 Auth 使用者 + profiles，或更新既有 profiles 資料 */
async function createOrUpdateAccount(
  admin: ReturnType<typeof createClient>,
  input: CreateAccountInput,
): Promise<{ error?: string; created?: boolean }> {
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('account_code', input.account_code)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('profiles')
      .update({
        display_name: input.display_name,
        role: input.role,
        institution_id: input.institution_id ?? null,
        contact_email: input.contact_email ?? null,
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { created: false }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: accountCodeToEmail(input.account_code),
    password: input.password ?? DEFAULT_PASSWORD,
    email_confirm: true,
  })
  if (createError || !created.user) {
    return { error: createError?.message ?? '建立登入帳號失敗' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    account_code: input.account_code,
    display_name: input.display_name,
    role: input.role,
    institution_id: input.institution_id ?? null,
    contact_email: input.contact_email ?? null,
  })
  if (profileError) {
    // profiles 寫入失敗時，回滾已建立的 Auth 使用者，避免留下沒有角色資料的孤兒帳號
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: profileError.message }
  }

  return { created: true }
}
