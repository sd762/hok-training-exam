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
const STAGE_ORDER = ['1m', '3m', '1y'] as const
const STAGE_MONTHS: Record<(typeof STAGE_ORDER)[number], number> = { '1m': 1, '3m': 3, '1y': 12 }
const MAX_ATTEMPTS_PER_CYCLE = 3
const LOCKOUT_DAYS = 7

// 建立/刪除/重設密碼這幾個操作，目標帳號若是「系統管理者/平台管理者/管理者」這三種
// 全域角色，只有系統管理者本人能動；機構管理者跟學員則維持平台管理者也能操作（呼應
// migration 0001 的 profiles_write RLS：role in ('institution_manager','staff') or super_admin）。
// 這一層檢查不能只靠前端不顯示按鈕——呼叫者仍可直接打這支 Edge Function，必須在後端擋。
const GLOBAL_ADMIN_ROLES = new Set(['super_admin', 'platform_admin', 'viewer_admin'])

type Role = 'super_admin' | 'platform_admin' | 'viewer_admin' | 'institution_manager' | 'staff'

function canManageTargetRole(callerRole: string, targetRole: string): boolean {
  if (GLOBAL_ADMIN_ROLES.has(targetRole)) return callerRole === 'super_admin'
  return true // institution_manager / staff：WRITE_ROLES 兩種角色都能管
}

interface StaffDetailInput {
  name_native?: string | null
  lang_code?: string
  birth_date?: string | null // YYYY-MM-DD
  hire_date: string // YYYY-MM-DD，學員必填
  current_stage?: '1m' | '3m' | '1y' | null
  department?: string | null
}

interface CreateAccountInput {
  account_code: string
  display_name: string
  role: Role
  institution_id?: number | null
  contact_email?: string | null
  password?: string // 未提供時使用預設密碼，要求登入後盡快由使用者自行更改
  staff_detail?: StaffDetailInput // role = 'staff' 時必填
}

const DEFAULT_PASSWORD = '000000'

// 瀏覽器呼叫前會先送 OPTIONS 預檢請求；沒有正確回應 CORS 標頭，
// 瀏覽器會直接在網路層擋下正式請求，程式碼根本不會被執行到。
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function accountCodeToEmail(accountCode: string): string {
  return `${accountCode.trim().toLowerCase()}@${INTERNAL_DOMAIN}`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
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

    const callerRole = callerProfile.role as string

    switch (body.action) {
      case 'create_account':
        return await handleCreateAccount(admin, body.input as CreateAccountInput, callerRole)
      case 'bulk_import':
        return await handleBulkImport(admin, body.rows as CreateAccountInput[], callerRole)
      case 'reset_password':
        return await handleResetPassword(admin, body.account_code as string, callerRole)
      case 'delete_account':
        return await handleDeleteAccount(admin, body.account_code as string, callerRole)
      case 'get_exam_statuses':
        return await handleGetExamStatuses(admin)
      case 'release_exam_lockout':
        return await handleReleaseExamLockout(
          admin,
          caller.id,
          body.staff_id as string,
          body.reason as string | undefined,
        )
      default:
        return jsonResponse({ error: `未知操作：${body.action}` }, 400)
    }
  } catch (err) {
    console.error('admin-users 未預期例外：', err)
    return jsonResponse({ error: err instanceof Error ? err.message : '未預期的伺服器錯誤' }, 500)
  }
})

async function handleCreateAccount(
  admin: ReturnType<typeof createClient>,
  input: CreateAccountInput,
  callerRole: string,
) {
  if (!input?.account_code || !input.display_name || !input.role) {
    return jsonResponse({ error: '缺少必要欄位（account_code / display_name / role）' }, 400)
  }
  if (!canManageTargetRole(callerRole, input.role)) {
    return jsonResponse({ error: '權限不足：只有系統管理者能建立/修改系統管理者、平台管理者、管理者帳號' }, 403)
  }

  const result = await createOrUpdateAccount(admin, input)
  if (result.error) return jsonResponse({ error: result.error }, 400)
  return jsonResponse({
    ok: true,
    account_code: input.account_code,
    created: result.created,
    // 新建立的帳號才有密碼可回報；更新既有帳號不會動到密碼，不回傳
    password: result.created ? (input.password ?? DEFAULT_PASSWORD) : undefined,
  })
}

async function handleBulkImport(
  admin: ReturnType<typeof createClient>,
  rows: CreateAccountInput[],
  callerRole: string,
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
    const role = row.role ?? 'staff'
    if (!canManageTargetRole(callerRole, role)) {
      results.push({ account_code: row.account_code, status: 'error', message: '權限不足，無法建立此角色帳號' })
      continue
    }
    const result = await createOrUpdateAccount(admin, { ...row, role })
    if (result.error) {
      results.push({ account_code: row.account_code, status: 'error', message: result.error })
    } else {
      results.push({ account_code: row.account_code, status: result.created ? 'created' : 'updated' })
    }
  }

  return jsonResponse({ ok: true, results })
}

async function handleResetPassword(admin: ReturnType<typeof createClient>, accountCode: string, callerRole: string) {
  if (!accountCode) return jsonResponse({ error: '缺少帳號代碼' }, 400)

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('account_code', accountCode)
    .maybeSingle()

  if (!profile) return jsonResponse({ error: '找不到此帳號' }, 404)
  if (!canManageTargetRole(callerRole, profile.role)) {
    return jsonResponse({ error: '權限不足：只有系統管理者能重設這個帳號的密碼' }, 403)
  }

  const { error } = await admin.auth.admin.updateUserById(profile.id, {
    password: DEFAULT_PASSWORD,
  })
  if (error) return jsonResponse({ error: error.message }, 400)

  return jsonResponse({ ok: true, account_code: accountCode, new_password: DEFAULT_PASSWORD })
}

async function handleDeleteAccount(admin: ReturnType<typeof createClient>, accountCode: string, callerRole: string) {
  if (!accountCode) return jsonResponse({ error: '缺少帳號代碼' }, 400)

  const { data: profile } = await admin
    .from('profiles')
    .select('id, is_active, role')
    .eq('account_code', accountCode)
    .maybeSingle()

  if (!profile) return jsonResponse({ error: '找不到此帳號' }, 404)
  if (!canManageTargetRole(callerRole, profile.role)) {
    return jsonResponse({ error: '權限不足：只有系統管理者能刪除這個帳號' }, 403)
  }
  if (profile.is_active) {
    return jsonResponse({ error: '在職（啟用中）帳號無法刪除，請先停用' }, 400)
  }

  // 刪除 Auth 使用者會透過外鍵 on delete cascade 一併清除 profiles / staff_detail
  const { error } = await admin.auth.admin.deleteUser(profile.id)
  if (error) return jsonResponse({ error: error.message }, 400)

  return jsonResponse({ ok: true, account_code: accountCode })
}

type Stage = (typeof STAGE_ORDER)[number]
type ExamState =
  | 'inactive'
  | 'all_completed'
  | 'no_exam'
  | 'not_due_yet'
  | 'ready'
  | 'in_progress'
  | 'pending_review'
  | 'flagged'
  | 'locked'

interface StaffDetailRow {
  profile_id: string
  hire_date: string
  current_stage: Stage | null
}

interface ExamDefRow {
  id: number
  title: string
  stage_code: Stage
}

interface AttemptRow {
  id: number
  staff_id: string
  exam_def_id: number
  status: 'in_progress' | 'failed' | 'pending_review' | 'confirmed_passed' | 'flagged' | 'voided'
  score: number | null
  started_at: string
  submitted_at: string | null
  aborted_reason: string | null
}

interface ReleaseRow {
  staff_id: string
  exam_def_id: number
  released_at: string
}

interface StaffExamStatus {
  staff_id: string
  stage_code: Stage | null
  exam_title: string | null
  state: ExamState
  due_date: string | null
  locked_until: string | null
  attempts_left: number | null
  latest_status: AttemptRow['status'] | null
  latest_score: number | null
  latest_submitted_at: string | null
  latest_failed_by_violation: boolean
}

/**
 * 學員管理頁的考測摘要。只回傳狀態所需欄位，不回傳題目快照、答案或監考照片。
 * 呼叫端已在入口統一驗證為 super_admin / platform_admin。
 */
async function handleGetExamStatuses(admin: ReturnType<typeof createClient>) {
  const [profilesResult, detailsResult, examsResult, releasesResult] = await Promise.all([
    admin.from('profiles').select('id, is_active').eq('role', 'staff'),
    admin.from('staff_detail').select('profile_id, hire_date, current_stage'),
    admin.from('exam_def').select('id, title, stage_code').eq('is_active', true).order('id'),
    admin.from('exam_lockout_release').select('staff_id, exam_def_id, released_at'),
  ])

  const queryError = profilesResult.error ?? detailsResult.error ?? examsResult.error ?? releasesResult.error
  if (queryError) return jsonResponse({ error: queryError.message }, 500)

  const details = new Map(
    ((detailsResult.data ?? []) as StaffDetailRow[]).map((detail) => [detail.profile_id, detail]),
  )
  const exams = (examsResult.data ?? []) as ExamDefRow[]
  const releases = (releasesResult.data ?? []) as ReleaseRow[]

  // 只載入目前仍有效考科的作答，不把已停用的舊考科歷史整批送進記憶體。
  const examIds = exams.map((exam) => exam.id)
  let attempts: AttemptRow[] = []
  if (examIds.length > 0) {
    const { data, error } = await admin
      .from('attempt')
      .select('id, staff_id, exam_def_id, status, score, started_at, submitted_at, aborted_reason')
      .in('exam_def_id', examIds)
    if (error) return jsonResponse({ error: error.message }, 500)
    attempts = (data ?? []) as AttemptRow[]
  }

  const attemptsByStaff = new Map<string, AttemptRow[]>()
  for (const attempt of attempts) {
    const rows = attemptsByStaff.get(attempt.staff_id) ?? []
    rows.push(attempt)
    attemptsByStaff.set(attempt.staff_id, rows)
  }
  const releasesByStaff = new Map<string, ReleaseRow[]>()
  for (const release of releases) {
    const rows = releasesByStaff.get(release.staff_id) ?? []
    rows.push(release)
    releasesByStaff.set(release.staff_id, rows)
  }

  const statuses = (profilesResult.data ?? []).map((profile) =>
    buildStaffExamStatus(
      profile.id,
      profile.is_active,
      details.get(profile.id),
      exams,
      attemptsByStaff.get(profile.id) ?? [],
      releasesByStaff.get(profile.id) ?? [],
    ),
  )

  return jsonResponse({ statuses })
}

function buildStaffExamStatus(
  staffId: string,
  isActive: boolean,
  detail: StaffDetailRow | undefined,
  exams: ExamDefRow[],
  staffAttempts: AttemptRow[],
  staffReleases: ReleaseRow[],
): StaffExamStatus {
  const empty = {
    staff_id: staffId,
    stage_code: null,
    exam_title: null,
    due_date: null,
    locked_until: null,
    attempts_left: null,
    latest_status: null,
    latest_score: null,
    latest_submitted_at: null,
    latest_failed_by_violation: false,
  } satisfies Omit<StaffExamStatus, 'state'>

  if (!isActive) return { ...empty, state: 'inactive' }
  if (!detail) return { ...empty, state: 'no_exam' }

  const passedIndex = detail.current_stage ? STAGE_ORDER.indexOf(detail.current_stage) : -1
  const nextStage = STAGE_ORDER[passedIndex + 1]
  if (!nextStage) return { ...empty, state: 'all_completed' }

  const exam = exams.find((item) => item.stage_code === nextStage)
  if (!exam) return { ...empty, stage_code: nextStage, state: 'no_exam' }

  const relevant = staffAttempts
    .filter((attempt) => attempt.exam_def_id === exam.id)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  const latest = relevant[0]
  const base = {
    ...empty,
    stage_code: nextStage,
    exam_title: exam.title,
    latest_status: latest?.status ?? null,
    latest_score: latest?.score ?? null,
    latest_submitted_at: latest?.submitted_at ?? null,
    latest_failed_by_violation: latest?.status === 'failed' && !!latest.aborted_reason,
  }

  const blocking = relevant.find((attempt) => attempt.status === 'pending_review' || attempt.status === 'flagged')
  if (blocking) return { ...base, state: blocking.status }

  const dueDate = addMonths(new Date(detail.hire_date), STAGE_MONTHS[nextStage])
  if (new Date() < dueDate) {
    return { ...base, state: 'not_due_yet', due_date: dueDate.toISOString().slice(0, 10) }
  }

  const latestRelease = staffReleases
    .filter((release) => release.exam_def_id === exam.id)
    .sort((a, b) => Date.parse(b.released_at) - Date.parse(a.released_at))[0]
  const cycle = getCycleStatusFromRows(relevant, latestRelease?.released_at)
  if (cycle.lockedUntil) {
    return { ...base, state: 'locked', locked_until: cycle.lockedUntil, attempts_left: 0 }
  }

  const inProgress = relevant.find((attempt) => attempt.status === 'in_progress')
  if (inProgress) {
    return { ...base, state: 'in_progress', attempts_left: Math.max(0, cycle.attemptsLeft - 1) }
  }

  return { ...base, state: 'ready', attempts_left: cycle.attemptsLeft }
}

function getCycleStatusFromRows(attempts: AttemptRow[], releasedAt?: string) {
  const submitted = attempts
    .filter(
      (attempt) =>
        attempt.submitted_at && (!releasedAt || Date.parse(attempt.submitted_at) > Date.parse(releasedAt)),
    )
    .sort((a, b) => Date.parse(b.submitted_at!) - Date.parse(a.submitted_at!))

  let consecutiveFails = 0
  let lastFailTime: string | null = null
  for (const attempt of submitted) {
    if (attempt.status !== 'failed') break
    lastFailTime ??= attempt.submitted_at
    consecutiveFails++
  }

  const inCycle = consecutiveFails % MAX_ATTEMPTS_PER_CYCLE
  if (consecutiveFails > 0 && inCycle === 0) {
    const lockedUntil = new Date(lastFailTime!)
    lockedUntil.setDate(lockedUntil.getDate() + LOCKOUT_DAYS)
    if (new Date() < lockedUntil) {
      return { attemptsLeft: 0, lockedUntil: lockedUntil.toISOString() }
    }
    return { attemptsLeft: MAX_ATTEMPTS_PER_CYCLE, lockedUntil: null }
  }

  return { attemptsLeft: MAX_ATTEMPTS_PER_CYCLE - inCycle, lockedUntil: null }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

async function handleReleaseExamLockout(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  staffId: string,
  rawReason?: string,
) {
  if (!staffId) return jsonResponse({ error: '缺少學員 ID' }, 400)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', staffId)
    .maybeSingle()
  if (profileError) return jsonResponse({ error: profileError.message }, 500)
  if (!profile || profile.role !== 'staff') return jsonResponse({ error: '找不到此學員' }, 404)
  if (!profile.is_active) return jsonResponse({ error: '已停用的學員無法解除考試管制' }, 400)

  const { data: detail } = await admin
    .from('staff_detail')
    .select('current_stage')
    .eq('profile_id', staffId)
    .maybeSingle()
  const currentStage = detail?.current_stage as Stage | null | undefined
  const nextStage = STAGE_ORDER[(currentStage ? STAGE_ORDER.indexOf(currentStage) : -1) + 1]
  if (!nextStage) return jsonResponse({ error: '此學員已完成所有測考階段' }, 400)

  const { data: exam } = await admin
    .from('exam_def')
    .select('id, title')
    .eq('stage_code', nextStage)
    .eq('is_active', true)
    .order('id')
    .limit(1)
    .maybeSingle()
  if (!exam) return jsonResponse({ error: '找不到目前階段的有效測驗' }, 400)

  const [{ data: attempts, error: attemptsError }, { data: latestRelease, error: releaseError }] =
    await Promise.all([
      admin
        .from('attempt')
        .select('id, staff_id, exam_def_id, status, score, started_at, submitted_at, aborted_reason')
        .eq('staff_id', staffId)
        .eq('exam_def_id', exam.id)
        .order('started_at', { ascending: false }),
      admin
        .from('exam_lockout_release')
        .select('released_at')
        .eq('staff_id', staffId)
        .eq('exam_def_id', exam.id)
        .order('released_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
  if (attemptsError || releaseError) {
    return jsonResponse({ error: (attemptsError ?? releaseError)!.message }, 500)
  }

  const cycle = getCycleStatusFromRows(
    (attempts ?? []) as AttemptRow[],
    latestRelease?.released_at,
  )
  if (!cycle.lockedUntil) return jsonResponse({ error: '此學員目前沒有考試管制可解除' }, 409)

  const reason = rawReason?.trim().slice(0, 200) || '管理者提前解除考試管制'
  const { error: insertError } = await admin.from('exam_lockout_release').insert({
    staff_id: staffId,
    exam_def_id: exam.id,
    released_by: callerId,
    prior_locked_until: cycle.lockedUntil,
    reason,
  })
  if (insertError && insertError.code !== '23505') {
    return jsonResponse({ error: insertError.message }, 500)
  }

  return jsonResponse({
    ok: true,
    staff_id: staffId,
    exam_title: exam.title,
    prior_locked_until: cycle.lockedUntil,
    attempts_left: MAX_ATTEMPTS_PER_CYCLE,
  })
}

/** 依 account_code 是否已存在，建立新 Auth 使用者 + profiles（+ staff_detail），或更新既有資料 */
async function createOrUpdateAccount(
  admin: ReturnType<typeof createClient>,
  input: CreateAccountInput,
): Promise<{ error?: string; created?: boolean }> {
  if (input.role === 'staff' && !input.staff_detail?.hire_date) {
    return { error: '學員帳號缺少到職日（staff_detail.hire_date）' }
  }

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

    if (input.role === 'staff' && input.staff_detail) {
      const { error: detailError } = await admin
        .from('staff_detail')
        .upsert({ profile_id: existing.id, ...input.staff_detail })
      if (detailError) return { error: detailError.message }
    }
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

  if (input.role === 'staff' && input.staff_detail) {
    const { error: detailError } = await admin
      .from('staff_detail')
      .insert({ profile_id: created.user.id, ...input.staff_detail })
    if (detailError) {
      // 同樣回滾，避免留下沒有受訓資料的學員帳號
      await admin.from('profiles').delete().eq('id', created.user.id)
      await admin.auth.admin.deleteUser(created.user.id)
      return { error: detailError.message }
    }
  }

  return { created: true }
}
