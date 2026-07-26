-- 0010: 分析報表用的資料庫彙總函式
-- 對應工單 12（.scratch/edu-exam-v2/issues/12-analytics-reports.md）、ADR 0012

-- 全部函式刻意不加 security definer（維持預設的 security invoker）：
-- 函式內部查詢底下的表時，套用的是「呼叫者自己」的 RLS 規則，不是函式作者的權限。
-- 這樣機構管理者呼叫這些函式時，會自動只查得到自己機構的資料列，
-- 不需要在每個函式裡各自重寫一次「你是哪個角色、只能看哪個機構」的判斷，
-- 也代表就算機構管理者故意傳別的機構 id 進來，RLS 那層還是只放行他自己機構的資料，
-- 兩個條件疊加後查不到東西，天生就擋住了。

-- ---------------------------------------------------------------------------
-- 1. 學員分析：依機構＋語言別彙總人數、在職狀態、平均年齡
-- ---------------------------------------------------------------------------
create or replace function report_staff_summary(p_institution_id bigint default null)
returns table (
  institution_id   bigint,
  institution_name text,
  lang_code        text,
  total_count      bigint,
  active_count     bigint,
  avg_age          numeric
)
language sql stable
as $$
  select
    i.id,
    i.name,
    sd.lang_code,
    count(*),
    count(*) filter (where p.is_active),
    round((avg(date_part('year', age(current_date, sd.birth_date))) filter (where sd.birth_date is not null))::numeric, 1)
  from profiles p
  join staff_detail sd on sd.profile_id = p.id
  left join institution i on i.id = p.institution_id
  where p.role = 'staff'
    and (p_institution_id is null or p.institution_id = p_institution_id)
  group by i.id, i.name, sd.lang_code
  order by i.name, sd.lang_code
$$;

-- ---------------------------------------------------------------------------
-- 2. 考題分析：每題的作答正確率
-- ---------------------------------------------------------------------------
create or replace function report_question_accuracy(p_exam_def_id bigint, p_lang_code text default null)
returns table (
  question_id     bigint,
  question_text   text,
  lang_code       text,
  total_answers   bigint,
  correct_answers bigint,
  accuracy_pct    numeric
)
language sql stable
as $$
  select
    aa.question_id,
    q.text,
    aa.lang_code,
    count(*) as total_answers,
    count(*) filter (where aa.is_correct) as correct_answers,
    round(100.0 * count(*) filter (where aa.is_correct) / count(*), 1) as accuracy_pct
  from attempt_answer aa
  left join question_bank q on q.id = aa.question_id
  where aa.exam_def_id = p_exam_def_id
    and (p_lang_code is null or aa.lang_code = p_lang_code)
  group by aa.question_id, q.text, aa.lang_code
  order by accuracy_pct asc nulls last
$$;

-- ---------------------------------------------------------------------------
-- 3. 考測結果分析：依機構／階段／語言／狀態彙總，時間軸可用年度/半年/季篩選
-- 「待核對」「存疑保留」與「已確認通過」分開列出，不會混算成及格
-- ---------------------------------------------------------------------------
create or replace function report_exam_results(
  p_institution_id bigint default null,
  p_year int default null,
  p_half int default null,   -- 1 或 2
  p_quarter int default null, -- 1~4
  p_stage_code training_stage default null
)
returns table (
  institution_id   bigint,
  institution_name text,
  stage_code       text,
  lang_code        text,
  status           text,
  attempt_count    bigint,
  avg_score        numeric
)
language sql stable
as $$
  select
    i.id,
    i.name,
    e.stage_code::text,
    a.lang_code,
    a.status::text,
    count(*),
    round(avg(a.score), 1)
  from attempt a
  join profiles p on p.id = a.staff_id
  join exam_def e on e.id = a.exam_def_id
  left join institution i on i.id = p.institution_id
  where a.submitted_at is not null
    and (p_institution_id is null or p.institution_id = p_institution_id)
    and (p_year is null or date_part('year', a.submitted_at) = p_year)
    and (p_half is null or ceil(date_part('month', a.submitted_at) / 6.0) = p_half)
    and (p_quarter is null or ceil(date_part('month', a.submitted_at) / 3.0) = p_quarter)
    and (p_stage_code is null or e.stage_code = p_stage_code)
  group by i.id, i.name, e.stage_code, a.lang_code, a.status
  order by i.name, e.stage_code, a.lang_code, a.status
$$;

-- ---------------------------------------------------------------------------
-- 4. 人力留任分析：在職/離職人數與在職學員的平均年資
-- 目前資料模型沒有記錄「離職日期」，只有 is_active 這個當下狀態，
-- 因此留任分析是「目前在職狀態的快照」，不是隨時間變化的離職趨勢圖
-- （若之後需要離職趨勢，需要新增離職日期欄位，屬於後續擴充）
-- ---------------------------------------------------------------------------
create or replace function report_retention(p_institution_id bigint default null)
returns table (
  institution_id     bigint,
  institution_name   text,
  active_count       bigint,
  inactive_count     bigint,
  avg_tenure_days    numeric
)
language sql stable
as $$
  select
    i.id,
    i.name,
    count(*) filter (where p.is_active),
    count(*) filter (where not p.is_active),
    round(avg(current_date - sd.hire_date) filter (where p.is_active), 0)
  from profiles p
  join staff_detail sd on sd.profile_id = p.id
  left join institution i on i.id = p.institution_id
  where p.role = 'staff'
    and (p_institution_id is null or p.institution_id = p_institution_id)
  group by i.id, i.name
  order by i.name
$$;

-- 明確授權已登入角色可以呼叫這四個函式（函式本身仍是 security invoker，
-- 實際看得到哪些資料列由呼叫者身分的 RLS 決定，這裡只是開放「可以呼叫」）
grant execute on function report_staff_summary(bigint) to authenticated;
grant execute on function report_question_accuracy(bigint, text) to authenticated;
grant execute on function report_exam_results(bigint, int, int, int, training_stage) to authenticated;
grant execute on function report_retention(bigint) to authenticated;

