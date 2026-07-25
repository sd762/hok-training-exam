// Edge Function: review-attempt
//
// 平台管理者/系統管理者審查及格作答（ADR 0006／0013）。
// attempt 表刻意沒有任何前端可寫入的 RLS 政策，所有狀態轉換都必須經過這裡；
// 監考快照存放在完全鎖死的 Storage bucket（zero client policy），
// 要看照片也得透過這裡簽發短期有效的連結，不能直接用一般前端連線讀取。

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

const REVIEW_ROLES = new Set(['super_admin', 'platform_admin'])
const SNAPSHOT_URL_EXPIRY_SECONDS = 300

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: '缺少身分驗證' }, 401)

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) return jsonResponse({ error: '身分驗證失敗' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    if (!profile || !REVIEW_ROLES.has(profile.role)) {
      return jsonResponse({ error: '權限不足：僅系統管理者/平台管理者可執行此操作' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.action !== 'string') {
      return jsonResponse({ error: '請求格式錯誤' }, 400)
    }

    switch (body.action) {
      case 'get_snapshot_url':
        return await handleGetSnapshotUrl(admin, body.storage_path)
      case 'confirm_pass':
        return await handleConfirmPass(admin, caller.id, body.attempt_id)
      case 'flag':
        return await handleFlag(admin, caller.id, body.attempt_id)
      case 'resolve_flagged':
        return await handleResolveFlagged(admin, caller.id, body.attempt_id, body.outcome)
      default:
        return jsonResponse({ error: `未知操作：${body.action}` }, 400)
    }
  } catch (err) {
    console.error('review-attempt 未預期例外：', err)
    return jsonResponse({ error: err instanceof Error ? err.message : '未預期的伺服器錯誤' }, 500)
  }
})

async function handleGetSnapshotUrl(admin: ReturnType<typeof createClient>, storagePath: string) {
  if (!storagePath) return jsonResponse({ error: '缺少快照路徑' }, 400)
  const { data, error } = await admin.storage
    .from('proctoring')
    .createSignedUrl(storagePath, SNAPSHOT_URL_EXPIRY_SECONDS)
  if (error) return jsonResponse({ error: error.message }, 400)
  return jsonResponse({ url: data.signedUrl })
}

async function handleConfirmPass(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  attemptId: number,
) {
  const attempt = await loadAttemptForReview(admin, attemptId, 'pending_review')
  if ('error' in attempt) return jsonResponse({ error: attempt.error }, attempt.status)

  const { error: updateError } = await admin
    .from('attempt')
    .update({ status: 'confirmed_passed', reviewed_at: new Date().toISOString(), reviewed_by: callerId })
    .eq('id', attemptId)
  if (updateError) return jsonResponse({ error: updateError.message }, 400)

  await advanceStage(admin, attempt.staff_id, attempt.exam_def_id)
  await clearSnapshots(admin, attemptId)

  return jsonResponse({ ok: true })
}

async function handleFlag(admin: ReturnType<typeof createClient>, callerId: string, attemptId: number) {
  const attempt = await loadAttemptForReview(admin, attemptId, 'pending_review')
  if ('error' in attempt) return jsonResponse({ error: attempt.error }, attempt.status)

  const { error } = await admin
    .from('attempt')
    .update({ status: 'flagged', reviewed_at: new Date().toISOString(), reviewed_by: callerId })
    .eq('id', attemptId)
  if (error) return jsonResponse({ error: error.message }, 400)

  // 存疑保留：保留監考證據，不清除，留待進一步調查
  return jsonResponse({ ok: true })
}

async function handleResolveFlagged(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  attemptId: number,
  outcome: 'confirmed_passed' | 'voided',
) {
  if (outcome !== 'confirmed_passed' && outcome !== 'voided') {
    return jsonResponse({ error: '結果只能是 confirmed_passed 或 voided' }, 400)
  }
  const attempt = await loadAttemptForReview(admin, attemptId, 'flagged')
  if ('error' in attempt) return jsonResponse({ error: attempt.error }, attempt.status)

  const { error } = await admin
    .from('attempt')
    .update({ status: outcome, reviewed_at: new Date().toISOString(), reviewed_by: callerId })
    .eq('id', attemptId)
  if (error) return jsonResponse({ error: error.message }, 400)

  if (outcome === 'confirmed_passed') {
    await advanceStage(admin, attempt.staff_id, attempt.exam_def_id)
    await clearSnapshots(admin, attemptId)
  }
  // outcome === 'voided'：不追溯扣考試機會（ADR 0006），保留監考證據供留存查核，不清除

  return jsonResponse({ ok: true })
}

async function loadAttemptForReview(
  admin: ReturnType<typeof createClient>,
  attemptId: number,
  requiredStatus: string,
): Promise<{ staff_id: string; exam_def_id: number } | { error: string; status: number }> {
  if (!attemptId) return { error: '缺少作答 ID', status: 400 }
  const { data: attempt } = await admin
    .from('attempt')
    .select('staff_id, exam_def_id, status')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt) return { error: '找不到此作答紀錄', status: 404 }
  if (attempt.status !== requiredStatus) {
    return { error: `此作答目前狀態為 ${attempt.status}，不是 ${requiredStatus}，無法執行此操作`, status: 400 }
  }
  return { staff_id: attempt.staff_id, exam_def_id: attempt.exam_def_id }
}

/** 確認通過後，把學員的「已合格階段」推進到這次測驗的階段（ADR 0006：階段推進綁定已確認通過） */
async function advanceStage(admin: ReturnType<typeof createClient>, staffId: string, examDefId: number) {
  const { data: examDef } = await admin.from('exam_def').select('stage_code').eq('id', examDefId).single()
  if (!examDef) return
  await admin.from('staff_detail').update({ current_stage: examDef.stage_code }).eq('profile_id', staffId)
}

/** 核對無誤後，監考快照可以刪除（ADR 0005），但保留事件紀錄本身（時間戳記、類型）作為輕量稽核軌跡 */
async function clearSnapshots(admin: ReturnType<typeof createClient>, attemptId: number) {
  const { data: events } = await admin
    .from('proctoring_event')
    .select('id, storage_path')
    .eq('attempt_id', attemptId)
    .not('storage_path', 'is', null)

  const paths = (events ?? []).map((e) => e.storage_path).filter((p): p is string => !!p)
  if (paths.length > 0) {
    await admin.storage.from('proctoring').remove(paths)
    await admin.from('proctoring_event').update({ storage_path: null }).eq('attempt_id', attemptId)
  }
}
