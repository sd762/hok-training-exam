// Edge Function: take-exam
//
// 出題與評分，全部在伺服器端執行，正確答案絕不送到瀏覽器（ADR 0007）。
// 呼叫者必須是有效的學員（role = 'staff'）。
//
// 四個操作：
//   status       — 查詢目前應考哪個階段（供首頁提醒使用），不建立任何作答紀錄
//   start        — 開始（或續答）測驗，回傳不含正解的題目快照
//   submit       — 送出作答，伺服器端評分並寫回資料庫
//   report_event — 監考事件回報（違規警告／定期排程快照），見 ADR 0005 2026-07-25 修訂。
//                  是否累計滿 3 次警告、是否觸發自動中止，一律由這裡（伺服器端）權威判定，
//                  不信任前端自行回報「已經中止」。

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

// ---- 測驗規則常數（ADR 0006／0010，2026-07-23 使用者定案）----
const QUESTIONS_PER_EXAM = 25

// ---- 音訊題（聽力題）規則（2026-07-26 使用者定案）----
// 只有越南文/印尼文考音訊題，台籍不考；25題裡固定5題音訊+20題一般題，
// 但音訊題庫還沒建到5題以前，維持現狀（25題全部從一般題庫抽），見 selectQuestions()。
const AUDIO_QUESTION_LANGS = new Set(['vi', 'id'])
const AUDIO_QUESTIONS_PER_EXAM = 5
const REGULAR_QUESTIONS_PER_EXAM = QUESTIONS_PER_EXAM - AUDIO_QUESTIONS_PER_EXAM
const AUDIO_BUCKET = 'question-audio'

// ---- 圖片題規則（2026-07-26 使用者定案）----
// 題目配圖／選項圖片，三語言都能用，不像音訊題那樣保證固定題數，隨機出現即可，抽題邏輯不受影響。
const IMAGE_BUCKET = 'question-images'

// 簽名網址有效期，要夠長涵蓋一次應考+中途重新整理續答；每次 start 都會重新簽發，不會存進資料庫
const AUDIO_URL_EXPIRY_SECONDS = 3600
const MAX_ATTEMPTS_PER_CYCLE = 3
const LOCKOUT_DAYS = 7
const STAGE_ORDER = ['1m', '3m', '1y'] as const
const STAGE_MONTHS: Record<string, number> = { '1m': 1, '3m': 3, '1y': 12 }

// ---- 監考規則常數（ADR 0005 2026-07-25 修訂）----
const MAX_WARNINGS_BEFORE_ABORT = 3

type Stage = (typeof STAGE_ORDER)[number]

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
      .select('id, role, is_active')
      .eq('id', caller.id)
      .maybeSingle()
    if (!profile || profile.role !== 'staff' || !profile.is_active) {
      return jsonResponse({ error: '僅學員帳號可執行此操作' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.action !== 'string') {
      return jsonResponse({ error: '請求格式錯誤' }, 400)
    }

    switch (body.action) {
      case 'status':
        return await handleStatus(admin, profile.id)
      case 'start':
        return await handleStart(admin, profile.id)
      case 'submit':
        return await handleSubmit(admin, profile.id, body.attempt_id, body.answers)
      case 'report_event':
        return await handleReportEvent(admin, profile.id, body.attempt_id, body.event_type, body.image_base64)
      default:
        return jsonResponse({ error: `未知操作：${body.action}` }, 400)
    }
  } catch (err) {
    console.error('take-exam 未預期例外：', err)
    return jsonResponse({ error: err instanceof Error ? err.message : '未預期的伺服器錯誤' }, 500)
  }
})

// ---------------------------------------------------------------------------
// 應考階段判定：已合格階段 + 到職日 → 下一個該考的階段
// ---------------------------------------------------------------------------
interface Assignment {
  examDef?: { id: number; title: string; stage_code: Stage; pass_score: number }
  blockedReason?: 'pending_review' | 'flagged' | 'not_due_yet' | 'all_completed' | 'locked'
  dueDate?: string
  lockedUntil?: string
}

async function resolveAssignment(admin: ReturnType<typeof createClient>, staffId: string): Promise<Assignment> {
  const { data: detail } = await admin
    .from('staff_detail')
    .select('hire_date, current_stage')
    .eq('profile_id', staffId)
    .maybeSingle()
  if (!detail) return { blockedReason: 'all_completed' }

  const passedIndex = detail.current_stage ? STAGE_ORDER.indexOf(detail.current_stage) : -1
  const nextIndex = passedIndex + 1
  if (nextIndex >= STAGE_ORDER.length) return { blockedReason: 'all_completed' }
  const nextStage = STAGE_ORDER[nextIndex]

  const { data: examDef } = await admin
    .from('exam_def')
    .select('id, title, stage_code, pass_score')
    .eq('stage_code', nextStage)
    .eq('is_active', true)
    .order('id')
    .maybeSingle()
  if (!examDef) return { blockedReason: 'all_completed' }

  // 該階段是否已有待核對/存疑保留的作答卡著（ADR 0006：階段推進綁定已確認通過）
  const { data: blocking } = await admin
    .from('attempt')
    .select('status')
    .eq('staff_id', staffId)
    .eq('exam_def_id', examDef.id)
    .in('status', ['pending_review', 'flagged'])
    .limit(1)
    .maybeSingle()
  if (blocking) return { blockedReason: blocking.status as 'pending_review' | 'flagged', examDef }

  // 到職日是否已達該階段里程碑
  const dueDate = addMonths(new Date(detail.hire_date), STAGE_MONTHS[nextStage])
  if (new Date() < dueDate) {
    return { blockedReason: 'not_due_yet', dueDate: dueDate.toISOString().slice(0, 10), examDef }
  }

  return { examDef }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

// ---------------------------------------------------------------------------
// 重考次數/鎖定狀態（同一輪最多 3 次，3 次都沒過鎖 7 天）
// ---------------------------------------------------------------------------
async function getCycleStatus(admin: ReturnType<typeof createClient>, staffId: string, examDefId: number) {
  // 管理者若曾提前解除管制，新一輪考試機會只計算解除時間後的失敗紀錄。
  // 解除紀錄本身保留 released_by / prior_locked_until，舊 attempt 不刪除也不改狀態。
  const { data: latestRelease } = await admin
    .from('exam_lockout_release')
    .select('released_at')
    .eq('staff_id', staffId)
    .eq('exam_def_id', examDefId)
    .order('released_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let recentQuery = admin
    .from('attempt')
    .select('status, submitted_at')
    .eq('staff_id', staffId)
    .eq('exam_def_id', examDefId)
    .not('submitted_at', 'is', null)

  if (latestRelease?.released_at) {
    recentQuery = recentQuery.gt('submitted_at', latestRelease.released_at)
  }

  const { data: recent } = await recentQuery.order('submitted_at', { ascending: false })

  let consecutiveFails = 0
  let lastFailTime: string | null = null
  for (const a of recent ?? []) {
    // 存疑保留最終被判定不合格時另外處理（ADR 0006：不追溯扣考試機會），
    // 這裡只看 'failed'，'pending_review'/'flagged'/'confirmed_passed' 都視為非失敗，中斷連續失敗計數
    if (a.status !== 'failed') break
    if (!lastFailTime) lastFailTime = a.submitted_at
    consecutiveFails++
  }

  const inCycle = consecutiveFails % MAX_ATTEMPTS_PER_CYCLE
  if (consecutiveFails > 0 && inCycle === 0) {
    const lockedUntil = new Date(lastFailTime!)
    lockedUntil.setDate(lockedUntil.getDate() + LOCKOUT_DAYS)
    if (new Date() < lockedUntil) {
      return { attemptsLeft: 0, lockedUntil: lockedUntil.toISOString(), cycleAttemptNumber: null }
    }
    return { attemptsLeft: MAX_ATTEMPTS_PER_CYCLE, lockedUntil: null, cycleAttemptNumber: 1 }
  }

  return {
    attemptsLeft: MAX_ATTEMPTS_PER_CYCLE - inCycle,
    lockedUntil: null,
    cycleAttemptNumber: inCycle + 1, // 1、2、3
  }
}

// ---------------------------------------------------------------------------
// status：查詢應考狀態，不建立任何紀錄
// ---------------------------------------------------------------------------
async function handleStatus(admin: ReturnType<typeof createClient>, staffId: string) {
  const assignment = await resolveAssignment(admin, staffId)
  if (!assignment.examDef) return jsonResponse({ assigned: null, reason: assignment.blockedReason })
  if (assignment.blockedReason) {
    return jsonResponse({
      assigned: null,
      reason: assignment.blockedReason,
      exam: assignment.examDef,
      dueDate: assignment.dueDate,
    })
  }

  const cycle = await getCycleStatus(admin, staffId, assignment.examDef.id)
  if (cycle.lockedUntil) {
    return jsonResponse({ assigned: null, reason: 'locked', exam: assignment.examDef, lockedUntil: cycle.lockedUntil })
  }

  return jsonResponse({ assigned: assignment.examDef, attemptsLeft: cycle.attemptsLeft })
}

// ---------------------------------------------------------------------------
// start：開始或續答測驗
// ---------------------------------------------------------------------------
async function handleStart(admin: ReturnType<typeof createClient>, staffId: string) {
  const assignment = await resolveAssignment(admin, staffId)
  if (!assignment.examDef) return jsonResponse({ error: '目前沒有應考的測驗' }, 400)
  if (assignment.blockedReason) {
    return jsonResponse({ error: `目前無法開始測驗（${assignment.blockedReason}）` }, 400)
  }
  const examDef = assignment.examDef

  // 有未完成的作答，直接續答（回傳時一樣要濾掉正解）
  const { data: inProgress } = await admin
    .from('attempt')
    .select('id, detail_json')
    .eq('staff_id', staffId)
    .eq('exam_def_id', examDef.id)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (inProgress) {
    return jsonResponse({
      attempt_id: inProgress.id,
      exam: examDef,
      questions: await attachAudioUrls(admin, stripAnswers(inProgress.detail_json.questions)),
    })
  }

  const cycle = await getCycleStatus(admin, staffId, examDef.id)
  if (cycle.lockedUntil) {
    return jsonResponse({ error: '已鎖定，尚未到解鎖時間', locked_until: cycle.lockedUntil }, 400)
  }

  const { data: staffDetail } = await admin
    .from('staff_detail')
    .select('lang_code')
    .eq('profile_id', staffId)
    .single()

  const { data: pool } = await admin
    .from('question_bank')
    .select('id, q_type, score, text, options_json, answer_json, explanation, audio_path, image_path, option_images_json')
    .eq('exam_def_id', examDef.id)
    .eq('lang_code', staffDetail!.lang_code)
    .eq('is_active', true)

  const poolCheck = checkPoolSize(pool ?? [], staffDetail!.lang_code)
  if (!poolCheck.ok) return jsonResponse({ error: poolCheck.error }, 400)

  const selected = await selectQuestions(admin, staffId, examDef.id, pool!, staffDetail!.lang_code, cycle.cycleAttemptNumber!)
  const snapshotQuestions = shuffle(selected).map((q) => {
    const options = q.options_json as string[]
    const optionImages = (q.option_images_json as (string | null)[] | null) ?? null
    const order = shuffle(options.map((_, i) => i)) // order[顯示位置] = 原始選項位置
    return {
      question_id: q.id,
      type: q.q_type,
      score: q.score,
      text: q.text,
      explanation: q.explanation ?? '',
      options: order.map((i) => options[i]),
      // 選項打亂順序後，選項圖片要跟著同一份 order 重排，不然圖片會對不上文字/正確答案位置
      option_images: optionImages ? order.map((i) => optionImages[i] ?? null) : null,
      option_order: order,
      answer_original: q.answer_json as number[],
      audio_path: q.audio_path ?? null,
      image_path: q.image_path ?? null,
    }
  })

  const { data: created, error } = await admin
    .from('attempt')
    .insert({
      staff_id: staffId,
      exam_def_id: examDef.id,
      lang_code: staffDetail!.lang_code,
      status: 'in_progress',
      pass_score_at_time: examDef.pass_score,
      detail_json: { questions: snapshotQuestions },
    })
    .select('id')
    .single()
  if (error) return jsonResponse({ error: error.message }, 400)

  return jsonResponse({
    attempt_id: created.id,
    exam: examDef,
    questions: await attachAudioUrls(admin, stripAnswers(snapshotQuestions)),
  })
}

type PoolQuestion = { id: number; audio_path?: string | null }

/** 該語言是否要用「20一般＋5音訊」的抽法：只有 vi/id，且音訊題庫已經有滿5題可用 */
function usesAudioSplit(pool: PoolQuestion[], langCode: string): boolean {
  if (!AUDIO_QUESTION_LANGS.has(langCode)) return false
  return pool.filter((q) => q.audio_path).length >= AUDIO_QUESTIONS_PER_EXAM
}

/** 出題前檢查題庫夠不夠——依語言/音訊題庫現況，檢查的是「實際會抽的那個池子」，不是籠統的題庫總數 */
function checkPoolSize(pool: PoolQuestion[], langCode: string): { ok: true } | { ok: false; error: string } {
  if (usesAudioSplit(pool, langCode)) {
    const regularCount = pool.filter((q) => !q.audio_path).length
    const audioCount = pool.filter((q) => q.audio_path).length
    if (regularCount < REGULAR_QUESTIONS_PER_EXAM || audioCount < AUDIO_QUESTIONS_PER_EXAM) {
      return {
        ok: false,
        error: `題庫不足（一般題需 ${REGULAR_QUESTIONS_PER_EXAM} 題，目前 ${regularCount} 題；音訊題需 ${AUDIO_QUESTIONS_PER_EXAM} 題，目前 ${audioCount} 題）`,
      }
    }
    return { ok: true }
  }
  const regularCount = pool.filter((q) => !q.audio_path).length
  if (regularCount < QUESTIONS_PER_EXAM) {
    return { ok: false, error: `題庫不足 ${QUESTIONS_PER_EXAM} 題，無法出題（目前 ${regularCount} 題）` }
  }
  return { ok: true }
}

/** ADR 0010：第1次全題庫隨機抽、第2次扣除第1次抽過的題目後再抽、第3次重新全題庫隨機抽。
 *  2026-07-26 追加：vi/id 且音訊題庫滿5題時，一般題與音訊題分開抽（各自套用同一套第2次排除規則），
 *  湊成 20+5＝25 題；其餘情況（台籍，或音訊題還沒建滿）維持完全比照原本邏輯，只從一般題庫抽25題。 */
async function selectQuestions(
  admin: ReturnType<typeof createClient>,
  staffId: string,
  examDefId: number,
  pool: PoolQuestion[],
  langCode: string,
  cycleAttemptNumber: number,
) {
  if (!usesAudioSplit(pool, langCode)) {
    const regularPool = pool.filter((q) => !q.audio_path)
    return selectFromPool(admin, staffId, examDefId, regularPool, QUESTIONS_PER_EXAM, cycleAttemptNumber)
  }

  const regularPool = pool.filter((q) => !q.audio_path)
  const audioPool = pool.filter((q) => q.audio_path)
  const [regularSelected, audioSelected] = await Promise.all([
    selectFromPool(admin, staffId, examDefId, regularPool, REGULAR_QUESTIONS_PER_EXAM, cycleAttemptNumber),
    selectFromPool(admin, staffId, examDefId, audioPool, AUDIO_QUESTIONS_PER_EXAM, cycleAttemptNumber),
  ])
  return [...regularSelected, ...audioSelected]
}

/** 單一題池的抽選：第2次補考要排除上次抽過的題目，其餘次數全池隨機抽 */
async function selectFromPool<T extends { id: number }>(
  admin: ReturnType<typeof createClient>,
  staffId: string,
  examDefId: number,
  pool: T[],
  count: number,
  cycleAttemptNumber: number,
): Promise<T[]> {
  if (cycleAttemptNumber !== 2) return sampleN(pool, count)

  const { data: previous } = await admin
    .from('attempt')
    .select('detail_json')
    .eq('staff_id', staffId)
    .eq('exam_def_id', examDefId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const usedIds = new Set<number>(
    (previous?.detail_json?.questions ?? []).map((q: { question_id: number }) => q.question_id),
  )
  const remaining = pool.filter((q) => !usedIds.has(q.id))
  if (remaining.length >= count) return sampleN(remaining, count)
  // 這個池子扣除後不夠抽：退回這個池子全池隨機抽，避免抽不滿（跟原本規則一致）
  return sampleN(pool, count)
}

function stripAnswers(questions: Record<string, unknown>[]) {
  return questions.map(({ answer_original: _answer_original, explanation: _explanation, ...rest }) => rest)
}

/** 幫每一題有 audio_path/image_path/option_images 的題目簽發限時網址（never 存進資料庫，每次呼叫都重新簽） */
async function attachAudioUrls(admin: ReturnType<typeof createClient>, questions: Record<string, unknown>[]) {
  return Promise.all(
    questions.map(async (q) => {
      const audioPath = q.audio_path as string | null | undefined
      const imagePath = q.image_path as string | null | undefined
      const optionImages = (q.option_images as (string | null)[] | null | undefined) ?? null
      const { audio_path: _audio_path, image_path: _image_path, option_images: _option_images, ...rest } = q

      const [audioUrl, imageUrl, optionImageUrls] = await Promise.all([
        audioPath ? signUrl(admin, AUDIO_BUCKET, audioPath) : null,
        imagePath ? signUrl(admin, IMAGE_BUCKET, imagePath) : null,
        optionImages
          ? Promise.all(optionImages.map((p) => (p ? signUrl(admin, IMAGE_BUCKET, p) : null)))
          : null,
      ])

      return {
        ...rest,
        ...(audioUrl !== null ? { audio_url: audioUrl } : {}),
        ...(imageUrl !== null ? { image_url: imageUrl } : {}),
        ...(optionImageUrls !== null ? { option_image_urls: optionImageUrls } : {}),
      }
    }),
  )
}

async function signUrl(admin: ReturnType<typeof createClient>, bucket: string, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, AUDIO_URL_EXPIRY_SECONDS)
  return data?.signedUrl ?? null
}

function sampleN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// submit：評分
// ---------------------------------------------------------------------------
interface SnapshotQuestion {
  question_id: number
  type: string
  score: number
  text: string
  explanation: string
  options: string[]
  option_order: number[]
  answer_original: number[]
  audio_path?: string | null
  image_path?: string | null
  option_images?: (string | null)[] | null
  selected_original?: number[]
  is_correct?: boolean
}

async function handleSubmit(
  admin: ReturnType<typeof createClient>,
  staffId: string,
  attemptId: number,
  answers: number[][], // 每題一組「畫面顯示位置」的選擇
) {
  if (!attemptId || !Array.isArray(answers)) return jsonResponse({ error: '請求格式錯誤' }, 400)

  const { data: attempt } = await admin
    .from('attempt')
    .select('id, staff_id, exam_def_id, pass_score_at_time, detail_json, status')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt || attempt.staff_id !== staffId) return jsonResponse({ error: '找不到此作答紀錄' }, 404)
  if (attempt.status !== 'in_progress') return jsonResponse({ error: '此次作答已經送出過了' }, 400)

  const questions: SnapshotQuestion[] = attempt.detail_json.questions
  const totalPossible = questions.reduce((sum, q) => sum + q.score, 0) || 1
  let earned = 0

  questions.forEach((q, i) => {
    const selectedDisplay = answers[i] ?? []
    const selectedOriginal = selectedDisplay.map((d) => q.option_order[d]).sort()
    const correctOriginal = [...q.answer_original].sort()
    const isCorrect =
      selectedOriginal.length === correctOriginal.length &&
      selectedOriginal.every((v, idx) => v === correctOriginal[idx])
    q.selected_original = selectedOriginal
    q.is_correct = isCorrect
    if (isCorrect) earned += q.score
  })

  const score = Math.round((earned / totalPossible) * 100)
  const passed = score >= attempt.pass_score_at_time
  const status = passed ? 'pending_review' : 'failed'

  const { error: updateError } = await admin
    .from('attempt')
    .update({ score, status, submitted_at: new Date().toISOString(), detail_json: { questions } })
    .eq('id', attemptId)
  if (updateError) return jsonResponse({ error: updateError.message }, 400)

  const { data: staffDetail } = await admin
    .from('staff_detail')
    .select('lang_code')
    .eq('profile_id', staffId)
    .single()

  await admin.from('attempt_answer').insert(
    questions.map((q) => ({
      attempt_id: attemptId,
      question_id: q.question_id,
      exam_def_id: attempt.exam_def_id,
      lang_code: staffDetail!.lang_code,
      is_correct: q.is_correct,
    })),
  )

  // 不及格時，附上這次失敗後的重考次數/鎖定資訊，讓前端能提示「請重新進行第N次測驗」或鎖定日期
  const retry = passed ? null : await getCycleStatus(admin, staffId, attempt.exam_def_id)

  // 結果頁要能重聽音訊題，同樣簽發限時網址；這裡不能用 stripAnswers（結果頁本來就要顯示正解）
  const questionsWithAudio = await attachAudioUrls(admin, questions as unknown as Record<string, unknown>[])

  return jsonResponse({ score, passed, status, questions: questionsWithAudio, retry })
}

// ---------------------------------------------------------------------------
// report_event：監考事件回報（違規警告／定期排程快照）
// ---------------------------------------------------------------------------
type ProctoringEventType = 'warning' | 'scheduled' | 'tab_switch'

// 各事件類型累積到幾次才自動中止；'scheduled' 不在此表中代表它永遠不會觸發中止
const ABORT_THRESHOLD: Partial<Record<ProctoringEventType, number>> = {
  warning: MAX_WARNINGS_BEFORE_ABORT, // 人臉連續消失，3 次緩衝（誤判風險較高：光線、低頭寫字）
  tab_switch: 2, // 切換視窗/離開頁面，2 次即中止（誤判風險較低，門檻更嚴格）
}
const ABORT_REASON: Partial<Record<ProctoringEventType, string>> = {
  warning: 'proctoring_violations',
  tab_switch: 'tab_switch',
}

async function handleReportEvent(
  admin: ReturnType<typeof createClient>,
  staffId: string,
  attemptId: number,
  eventType: ProctoringEventType,
  imageBase64?: string,
) {
  if (!attemptId || !['warning', 'scheduled', 'tab_switch'].includes(eventType)) {
    return jsonResponse({ error: '請求格式錯誤' }, 400)
  }

  const { data: attempt } = await admin
    .from('attempt')
    .select('id, staff_id, status')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt || attempt.staff_id !== staffId) return jsonResponse({ error: '找不到此作答紀錄' }, 404)
  if (attempt.status !== 'in_progress') {
    // 已經送出或已中止的作答，不再接受新的監考事件（可能是畫面還沒關閉的殘留請求）
    return jsonResponse({ ok: true, ignored: true })
  }

  // 切換視窗當下鏡頭畫面不一定拍得到（分頁被隱藏），沒有圖片也照樣記錄事件，只是沒有快照佐證
  let path: string | null = null
  if (imageBase64) {
    path = `${attemptId}/${Date.now()}-${eventType}.jpg`
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
    const { error: uploadError } = await admin.storage
      .from('proctoring')
      .upload(path, bytes, { contentType: 'image/jpeg' })
    if (uploadError) return jsonResponse({ error: uploadError.message }, 400)
  }

  const { error: insertError } = await admin
    .from('proctoring_event')
    .insert({ attempt_id: attemptId, event_type: eventType, storage_path: path })
  if (insertError) return jsonResponse({ error: insertError.message }, 400)

  const threshold = ABORT_THRESHOLD[eventType]
  if (!threshold) {
    return jsonResponse({ ok: true, aborted: false })
  }

  const { count: eventCount } = await admin
    .from('proctoring_event')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attemptId)
    .eq('event_type', eventType)

  if ((eventCount ?? 0) < threshold) {
    return jsonResponse({ ok: true, aborted: false, eventCount })
  }

  // 累積達到門檻：自動中止作答，計入一次失敗（ADR 0005 2026-07-25 修訂）
  const { error: abortError } = await admin
    .from('attempt')
    .update({
      status: 'failed',
      aborted_reason: ABORT_REASON[eventType],
      submitted_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
  if (abortError) return jsonResponse({ error: abortError.message }, 400)

  return jsonResponse({ ok: true, aborted: true, eventCount })
}
