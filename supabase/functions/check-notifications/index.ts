// Edge Function: check-notifications
//
// 到期通知檢查（ADR 0003／0011）：找出即將到達受訓里程碑（前3天進入通知窗口）
// 且尚未通知過的學員，寄信給其所屬機構的機構管理者。
//
// 兩種呼叫方式：
//   1. GitHub Actions 排程（每天1次）：帶 x-cron-secret 標頭，這個呼叫本身
//      同時達成「Supabase 專案保活」的目的（避免免費專案7天無活動被暫停）。
//   2. 平台管理者/系統管理者手動觸發測試：帶一般登入 session。

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// 受訓階段常數（與 take-exam 函式各自維護一份——Dashboard 是逐一貼上單一檔案部署，
// 沒有辦法像 CLI 部署那樣共用一個 `_shared` 資料夾，見 supabase/functions/_shared/stages.ts
// 的說明註解。若之後改用 CLI 部署，可以改成從那裡匯入，避免兩處手動同步）
const STAGE_ORDER = ['1m', '3m', '1y'] as const
type Stage = (typeof STAGE_ORDER)[number]
const STAGE_MONTHS: Record<Stage, number> = { '1m': 1, '3m': 3, '1y': 12 }
const STAGE_LABELS: Record<Stage, string> = {
  '1m': '到職滿1個月',
  '3m': '到職滿3個月',
  '1y': '到職滿1年',
}
function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

const NOTIFY_WINDOW_DAYS = 3 // ADR 0011：提前 3 天
const REVIEW_ROLES = new Set(['super_admin', 'platform_admin'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const cronHeader = req.headers.get('x-cron-secret')
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET

    if (!isCron) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return jsonResponse({ error: '缺少身分驗證' }, 401)

      const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user: caller },
      } = await callerClient.auth.getUser()
      if (!caller) return jsonResponse({ error: '身分驗證失敗' }, 401)

      const { data: profile } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
      if (!profile || !REVIEW_ROLES.has(profile.role)) {
        return jsonResponse({ error: '權限不足：僅系統管理者/平台管理者可執行此操作' }, 403)
      }
    }

    const results = await runNotificationCheck(admin)
    return jsonResponse({ ok: true, checked: results.length, results })
  } catch (err) {
    console.error('check-notifications 未預期例外：', err)
    return jsonResponse({ error: err instanceof Error ? err.message : '未預期的伺服器錯誤' }, 500)
  }
})

interface CheckResult {
  staff_id: string
  account_code: string
  stage: string
  milestone_date: string
  status: string
}

async function runNotificationCheck(admin: ReturnType<typeof createClient>): Promise<CheckResult[]> {
  const today = new Date()
  const results: CheckResult[] = []

  const { data: staffList } = await admin
    .from('profiles')
    .select('id, account_code, institution_id, staff_detail!inner(hire_date, current_stage)')
    .eq('role', 'staff')
    .eq('is_active', true)

  for (const staff of staffList ?? []) {
    const detail = Array.isArray(staff.staff_detail) ? staff.staff_detail[0] : staff.staff_detail
    if (!detail) continue

    const passedIndex = detail.current_stage ? STAGE_ORDER.indexOf(detail.current_stage as Stage) : -1
    const nextIndex = passedIndex + 1
    if (nextIndex >= STAGE_ORDER.length) continue // 已完成所有階段
    const nextStage = STAGE_ORDER[nextIndex]

    // 該階段已經有作答在跑（不論待核對/存疑保留/已確認）就不用再提醒去安排測考
    const { data: examDef } = await admin
      .from('exam_def')
      .select('id')
      .eq('stage_code', nextStage)
      .eq('is_active', true)
      .maybeSingle()
    if (!examDef) continue

    const { data: existingAttempt } = await admin
      .from('attempt')
      .select('id')
      .eq('staff_id', staff.id)
      .eq('exam_def_id', examDef.id)
      .in('status', ['pending_review', 'flagged', 'confirmed_passed'])
      .limit(1)
      .maybeSingle()
    if (existingAttempt) continue

    const milestone = addMonths(new Date(detail.hire_date), STAGE_MONTHS[nextStage])
    const windowStart = new Date(milestone)
    windowStart.setDate(windowStart.getDate() - NOTIFY_WINDOW_DAYS)
    if (today < windowStart || today > milestone) continue

    const { data: already } = await admin
      .from('notification_log')
      .select('id')
      .eq('staff_id', staff.id)
      .eq('stage_code', nextStage)
      .maybeSingle()
    if (already) continue

    const { data: managers } = await admin
      .from('profiles')
      .select('contact_email')
      .eq('role', 'institution_manager')
      .eq('institution_id', staff.institution_id)
      .eq('is_active', true)

    const recipients = (managers ?? []).map((m) => m.contact_email).filter((e): e is string => !!e)

    const label = STAGE_LABELS[nextStage]
    let status: string
    if (recipients.length === 0) {
      status = 'no_managers'
    } else {
      const subject = `【測考提醒】工號 ${staff.account_code} 即將${label}，請安排測考`
      const body = `機構管理者您好：\n\n以下學員即將到達受訓里程碑，請協助安排教育訓練測考：\n\n  工號：${staff.account_code}\n  里程碑：${label}（${milestone.toISOString().slice(0, 10)}）\n\n請提醒該員於期限內登入測考系統完成測驗。\n\n—— 清福長照集團教育訓練測考系統 自動通知`
      status = (await sendEmail(admin, recipients, subject, body)) ?? 'sent'
    }

    await admin.from('notification_log').insert({
      staff_id: staff.id,
      stage_code: nextStage,
      milestone_date: milestone.toISOString().slice(0, 10),
      recipients: recipients.join(','),
      status,
    })

    results.push({
      staff_id: staff.id,
      account_code: staff.account_code,
      stage: label,
      milestone_date: milestone.toISOString().slice(0, 10),
      status,
    })
  }

  return results
}

interface SmtpSettings {
  host: string
  port: string
  username: string
  password: string
  sender: string
  use_tls: boolean
}

async function getSmtpSettings(admin: ReturnType<typeof createClient>): Promise<SmtpSettings> {
  const { data } = await admin.from('system_setting').select('key, value')
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']))
  return {
    host: map.smtp_host ?? '',
    port: map.smtp_port ?? '587',
    username: map.smtp_username ?? '',
    password: map.smtp_password ?? '',
    sender: map.smtp_sender ?? '',
    use_tls: (map.smtp_use_tls ?? '1') === '1',
  }
}

/** 寄送成功回傳 null；未設定 SMTP 或寄送失敗回傳描述字串，不中斷整批檢查 */
async function sendEmail(
  admin: ReturnType<typeof createClient>,
  recipients: string[],
  subject: string,
  body: string,
): Promise<string | null> {
  const smtp = await getSmtpSettings(admin)
  if (!smtp.host || !smtp.sender) return 'smtp_not_configured'

  try {
    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: Number(smtp.port) || 587,
        tls: smtp.use_tls,
        auth: smtp.username ? { username: smtp.username, password: smtp.password } : undefined,
      },
    })
    await client.send({ from: smtp.sender, to: recipients, subject, content: body })
    await client.close()
    return null
  } catch (err) {
    return `error:${err instanceof Error ? err.message : String(err)}`
  }
}
