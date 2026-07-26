-- 0012: 及格率改以「人」為單位計算，不是「人次」
--
-- 使用者發現的錯誤：原本的 report_exam_results 是把每一筆作答紀錄（人次）分組計數。
-- 一個人補考多次才過，會被算成好幾筆紀錄，及格率因此被稀釋、不準確
-- （範例：3人各1階段全部最終都通過，但其中1人補考2次才過，會讓「已確認通過」
-- 只佔全部作答人次的 1/3，及格率誤顯示成 33%，而不是正確的 100%）。
--
-- 修正邏輯：同一位學員在同一個受訓階段內，只取「最終結果」一筆——依優先順序
-- 已確認通過 > 待核對/存疑保留 > 不及格 > 已作廢，且同優先序內取最新一筆
-- （voided 優先序低於 failed：一個人如果同時有 failed 跟 voided，代表他有一次
-- 「真的不及格」的紀錄，比起被作廢不算數的那次更能代表他目前的狀態）。
-- 以「人」分組後再計算及格率、平均分數。
--
-- 原本人次層級的統計沒有丟掉，改成附加的 avg_attempts（平均嘗試次數）與
-- attempt_pass_rate（每次作答的通過率，即「平均測考通過率」）兩個輔助欄位，
-- 跟主要的（人為單位）及格率分開呈現，避免混淆。

drop function if exists report_exam_results(bigint, int, int, int, training_stage, text);

create or replace function report_exam_results(
  p_institution_id bigint default null,
  p_year int default null,
  p_half int default null,
  p_quarter int default null,
  p_stage_code training_stage default null,
  p_lang_code text default null
)
returns table (
  institution_id    bigint,
  institution_name  text,
  stage_code        text,
  lang_code         text,
  status            text,
  staff_count       bigint,
  avg_score         numeric,
  avg_attempts      numeric,
  total_attempts    bigint,
  attempt_pass_rate numeric
)
language sql stable
as $$
  with filtered as (
    select
      a.staff_id,
      p.institution_id,
      e.stage_code,
      a.lang_code,
      a.status,
      a.score,
      a.submitted_at
    from attempt a
    join profiles p on p.id = a.staff_id
    join exam_def e on e.id = a.exam_def_id
    where a.submitted_at is not null
      and (p_institution_id is null or p.institution_id = p_institution_id)
      and (p_year is null or date_part('year', a.submitted_at) = p_year)
      and (p_half is null or ceil(date_part('month', a.submitted_at) / 6.0) = p_half)
      and (p_quarter is null or ceil(date_part('month', a.submitted_at) / 3.0) = p_quarter)
      and (p_stage_code is null or e.stage_code = p_stage_code)
      and (p_lang_code is null or a.lang_code = p_lang_code)
  ),
  ranked as (
    select
      f.*,
      row_number() over (
        partition by f.staff_id, f.stage_code
        order by
          case f.status
            when 'confirmed_passed' then 1
            when 'pending_review' then 2
            when 'flagged' then 2
            when 'failed' then 3
            when 'voided' then 4
            else 5
          end,
          f.submitted_at desc
      ) as rn,
      count(*) over (partition by f.staff_id, f.stage_code) as attempt_count
    from filtered f
  ),
  final_status as (
    select * from ranked where rn = 1
  ),
  group_attempt_stats as (
    select
      institution_id,
      stage_code,
      lang_code,
      count(*) as total_attempts,
      round((count(*) filter (where status = 'confirmed_passed'))::numeric / count(*) * 100, 1) as attempt_pass_rate
    from filtered
    group by institution_id, stage_code, lang_code
  )
  select
    i.id,
    i.name,
    fs.stage_code::text,
    fs.lang_code,
    fs.status::text,
    count(*) as staff_count,
    round(avg(fs.score), 1) as avg_score,
    round(avg(fs.attempt_count)::numeric, 1) as avg_attempts,
    gas.total_attempts,
    gas.attempt_pass_rate
  from final_status fs
  left join institution i on i.id = fs.institution_id
  left join group_attempt_stats gas
    on gas.institution_id is not distinct from fs.institution_id
   and gas.stage_code = fs.stage_code
   and gas.lang_code = fs.lang_code
  group by i.id, i.name, fs.stage_code, fs.lang_code, fs.status, gas.total_attempts, gas.attempt_pass_rate
  order by i.name, fs.stage_code, fs.lang_code, fs.status
$$;

grant execute on function report_exam_results(bigint, int, int, int, training_stage, text) to authenticated;
